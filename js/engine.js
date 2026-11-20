/* Case engine: deterministic, offline. Answers ONLY from the loaded case file.
   Nothing here generates or fetches data. */
(function (root) {
  const PHASES = ["frame", "find", "prove", "pick", "pilot"];
  const PHASE_LABEL = { frame: "Frame", find: "Find", prove: "Prove", pick: "Pick", pilot: "Pilot" };
  const PHASE_END = [300, 600, 780, 900, 1200]; // seconds: 0–5, 5–10, 10–13, 13–15, 15–20 min
  const NO_DATA = "We don't have that data.";

  function norm(t) {
    return " " + String(t || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9%$.\- ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  }
  function tokens(t) { return norm(t).trim().split(" ").filter(Boolean); }

  function kwScore(text, keywords) {
    const n = norm(text), toks = tokens(text);
    let s = 0;
    for (const k of keywords || []) {
      const kn = norm(k).trim();
      if (!kn) continue;
      if (kn.includes(" ")) { if (n.includes(" " + kn + " ") || n.includes(kn)) s += 3; }
      else if (toks.some(w => w === kn || (kn.length >= 4 && w.startsWith(kn)) || (w.length >= 5 && kn.startsWith(w)))) s += 1;
    }
    return s;
  }

  function phaseAt(elapsed) {
    for (let i = 0; i < PHASE_END.length; i++) if (elapsed < PHASE_END[i]) return i;
    return PHASES.length - 1;
  }

  function newState() { return { revealed: [], log: [], scores: [] }; }

  function match(caseData, text) {
    const facts = caseData.facts.map(f => ({ f, s: kwScore(text, f.keywords) })).filter(x => x.s >= 1).sort((a, b) => b.s - a.s);
    const un = Math.max(0, ...(caseData.unavailable || []).map(u => kwScore(text, u.keywords)));
    return { facts, un };
  }

  /* Candidate asks a discovery question. Returns the interviewer reply plus feedback.
     The reply text always comes from the case file, or is the fixed NO_DATA line. */
  function ask(state, caseData, text, phaseIdx) {
    const { facts, un } = match(caseData, text);
    const fb = { score: 0, notes: [], tip: "", stronger: "" };
    let reply;

    if (un >= 2 && (!facts.length || un >= facts[0].s)) {
      reply = NO_DATA;
      fb.score = 5; fb.notes.push("That information isn't part of this case.");
      fb.tip = "Ask about something you can act on: impact, segments, the funnel, changes or customer feedback.";
    } else if (!facts.length) {
      reply = NO_DATA;
      fb.score = 3; fb.notes.push("This didn't link to any case data.");
      fb.tip = "Ask one specific thing at a time, using plain terms like 'revenue impact', 'segments', 'funnel', 'what changed' or 'complaints'.";
    } else {
      const picks = [facts[0]];
      if (facts[1] && facts[1].s >= 3 && facts[1].s >= facts[0].s * 0.8 && facts[1].f.phase === facts[0].f.phase) picks.push(facts[1]);
      const fresh = picks.filter(p => !state.revealed.includes(p.f.id));
      if (!fresh.length) {
        reply = "That information has already been provided.";
        fb.score = 3; fb.notes.push("You asked for something already given.");
        fb.tip = "Keep notes of each answer so you don't repeat questions — interviewers notice.";
      } else {
        const f = fresh[0].f, fp = PHASES.indexOf(f.phase);
        if (phaseIdx == null) phaseIdx = Math.min(fp, 2); // untimed practice: judge order only via missed essentials
        reply = fresh.map(p => p.f.answer).join(" ");
        fresh.forEach(p => state.revealed.push(p.f.id));
        if (phaseIdx >= 3 && fp <= 2) {
          reply = "We're past discovery — I need your problem statement. But since you asked: " + reply;
          fb.score = 4; fb.notes.push("Discovery should be wrapped up by minute 13–15.");
        } else if (fp < phaseIdx) {
          fb.score = 6; fb.notes.push(`Good question, but it belongs earlier (${PHASE_LABEL[f.phase]}).`);
        } else if (fp > phaseIdx && f.phase !== "pick") {
          fb.score = 6; fb.notes.push(`Reasonable, but you're jumping ahead. Finish ${PHASE_LABEL[PHASES[phaseIdx]]} first.`);
        } else {
          fb.score = 8; fb.notes.push(`Right question for ${PHASE_LABEL[PHASES[Math.min(phaseIdx, 4)]]}.`);
          if (/\b(so|which means|that tells|this suggests|given)\b/i.test(text)) { fb.score = 9; fb.notes.push("You interpreted before asking — strong."); }
        }
        const missed = caseData.facts.filter(x => x.essential && PHASES.indexOf(x.phase) < fp && !state.revealed.includes(x.id));
        if (missed.length) { fb.score = Math.max(3, fb.score - 1); fb.notes.push("Not yet checked: " + missed.map(m => m.topic.toLowerCase()).join(", ") + "."); }
        fb.tip = f.coach_tip || "";
        fb.stronger = f.model_question || "";
      }
    }
    state.log.push({ q: text, a: reply, fb });
    state.scores.push(fb.score);
    return { reply, feedback: fb };
  }

  function has(text, list) { return kwScore(text, list) > 0; }

  function scoreProblem(caseData, text) {
    const r = caseData.rubric.problem, checks = [
      ["Names who is affected", has(text, r.segment)],
      ["Names where in the journey", has(text, r.step)],
      ["States why (the cause)", has(text, r.cause)],
      ["Includes a number", /\d/.test(text)]
    ];
    return finish(checks, caseData.model_answer.problem_statement);
  }

  function scoreHypothesis(caseData, text) {
    const r = caseData.rubric.hypothesis, nums = (text.match(/\d+(\.\d+)?/g) || []).length, checks = [
      ["States the change", has(text, r.change)],
      ["Names a metric", has(text, r.metric)],
      ["Has a target (from A to B)", nums >= 2 || /\bto\s+\d/.test(text)],
      ["Gives a reason ('because')", /\bbecause\b|\bsince\b|\bas\b.*\bshow/i.test(text)]
    ];
    return finish(checks, caseData.model_answer.hypothesis);
  }

  function scoreList(text, modelList, label) {
    const items = String(text || "").split(/\n|,|;/).map(s => s.trim()).filter(Boolean);
    const hits = modelList.filter(m => items.some(i => kwScore(i, tokens(m).filter(w => w.length > 3)) >= 1));
    const score = Math.min(10, Math.round(hits.length / Math.max(1, Math.min(modelList.length, 4)) * 10));
    return { score, checks: [[`${hits.length} of ${modelList.length} expected ${label} covered`, hits.length >= 3]], model: modelList.join(" · ") };
  }

  function finish(checks, model) {
    const ok = checks.filter(c => c[1]).length;
    return { score: Math.round(ok / checks.length * 10), checks, model };
  }

  function scoreChoice(caseData, idx) {
    const rec = caseData.model_answer.recommended_index;
    return idx === rec
      ? { score: 9, checks: [["Matches the recommended option", true]], model: caseData.model_answer.decision }
      : { score: 6, checks: [["Differs from the case's recommendation — defend it with impact vs effort", false]], model: caseData.model_answer.decision };
  }

  const api = { PHASES, PHASE_LABEL, PHASE_END, NO_DATA, phaseAt, newState, ask, scoreProblem, scoreHypothesis, scoreList, scoreChoice, kwScore };
  root.Engine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
