/* Case Coach app. All case content comes from the frozen files in /cases. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TYPES = ["Onboarding", "Retention", "Revenue", "Growth", "Engagement"];
  const COLORS = ["#534AB7", "#0F6E56", "#993C1D", "#854F0B", "#3B6D11"];
  let catalog = [], filterType = "All", C = null, S = null, timer = null, elapsed = 0, manualPhase = 0, synth = {}, slideFrom = "case";

  /* ---------- routing ---------- */
  function show(view) {
    document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + view);
    window.scrollTo(0, 0);
  }
  function route() {
    const h = (location.hash || "#home").slice(1);
    if (h === "practice") { show("practice"); renderList(); }
    else if (h === "onepager") { show("onepager"); }
    else if (h === "case" && C) show("case");
    else if (h === "slide" && lastSlide) show("slide");
    else show("home");
  }
  window.addEventListener("hashchange", route);

  /* ---------- case library ---------- */
  async function loadCatalog() {
    try { catalog = await (await fetch("cases/index.json")).json(); }
    catch { $("#case-list").innerHTML = `<p class="small">Couldn't load cases. If you opened the file directly, run a local server (see README).</p>`; }
    const companies = ["All", ...new Set(catalog.map(c => c.area || c.company))];
    $("#f-company").innerHTML = companies.map(c => `<option>${esc(c)}</option>`).join("");
    $("#f-company").onchange = renderList;
    $("#f-type").innerHTML = ["All", ...TYPES].map(t => `<button class="chip ${t === "All" ? "on" : ""}" data-t="${t}">${t}</button>`).join("");
    $("#f-type").onclick = e => { const t = e.target.dataset.t; if (!t) return; filterType = t; [...$("#f-type").children].forEach(b => b.classList.toggle("on", b.dataset.t === t)); renderList(); };
  }
  function renderList() {
    const co = $("#f-company").value || "All";
    const items = catalog.filter(c => (co === "All" || (c.area || c.company) === co) && (filterType === "All" || c.type === filterType));
    $("#case-list").innerHTML = items.length ? items.map(c => `<div class="item"><div><b>${esc(c.area || c.company)} · ${esc(c.type)}</b>${esc(c.title)} <span class="small">(${esc(c.company)})</span></div><button class="primary" data-id="${esc(c.id)}">Start</button></div>`).join("")
      : `<p class="small">No case for this company and type yet. Generate one with <code>tools/generate_case.py</code> (see README).</p>`;
    $("#case-list").querySelectorAll("button[data-id]").forEach(b => b.onclick = () => startCase(b.dataset.id));
  }

  /* ---------- running a case ---------- */
  async function startCase(id) {
    C = await (await fetch(`cases/${id}.json`)).json();
    S = Engine.newState(); synth = {}; elapsed = 0; manualPhase = 0; stopTimer();
    $("#c-title").textContent = `${C.company} · ${C.type}: ${C.title}`;
    $("#c-disclaimer").textContent = C.disclaimer;
    $("#c-brief").innerHTML = `<h3>Business problem</h3><p>${esc(C.brief.problem)}</p><h3>Objective</h3><p>${esc(C.brief.objective)}</p><h3>Baseline</h3><ul>${C.brief.baseline.map(b => `<li>${esc(b)}</li>`).join("")}</ul>${C.company_context ? `<p class="small">About the company: ${esc(C.company_context)}</p>` : ""}`;
    $("#c-log").innerHTML = ""; $("#c-synth").hidden = true; $("#c-synth").innerHTML = ""; $("#c-discovery").hidden = false;
    addMsg("cpo", "Thanks for coming in. You have the brief. Start the timer when you're ready, then ask your first question.");
    drawTimer(); location.hash = "case";
  }
  function phaseIdx() { return timer || elapsed ? Engine.phaseAt(elapsed) : manualPhase; }
  function drawTimer() {
    const left = Math.max(0, 1200 - elapsed), p = phaseIdx();
    $("#c-clock").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    $("#c-phase").textContent = left === 0 ? "Time's up" : Engine.PHASE_LABEL[Engine.PHASES[p]];
    $("#c-phase").style.background = COLORS[p];
    $("#c-phasebar").innerHTML = Engine.PHASES.map((_, i) => `<div class="${i < p ? "done" : ""}" style="background:${i <= p ? COLORS[i] : ""}" title="${Engine.PHASE_LABEL[Engine.PHASES[i]]}"></div>`).join("");
  }
  function stopTimer() { clearInterval(timer); timer = null; $("#c-start").textContent = elapsed ? "Resume" : "Start timer"; }
  $("#c-start").onclick = () => {
    if (timer) return stopTimer();
    timer = setInterval(() => { if (elapsed < 1200) { elapsed++; drawTimer(); } else stopTimer(); }, 1000);
    $("#c-start").textContent = "Pause";
  };

  function addMsg(who, text) {
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.innerHTML = `<div class="who">${who === "me" ? "You" : "Interviewer"}</div>${esc(text)}`;
    $("#c-log").appendChild(d);
    if (who === "cpo") Voice.speak(text, $("#c-tts").checked);
    d.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function addFb(fb) {
    const d = document.createElement("div");
    d.className = "fb " + (fb.score >= 8 ? "good" : fb.score <= 4 ? "low" : "");
    d.innerHTML = `<b class="score">${fb.score}/10</b> · ${esc(fb.notes.join(" "))}${fb.tip ? `<br><b>Tip:</b> ${esc(fb.tip)}` : ""}${fb.stronger ? `<br><b>Stronger version:</b> “${esc(fb.stronger)}”` : ""}`;
    $("#c-log").appendChild(d);
  }
  function send() {
    const t = $("#c-input").value.trim();
    if (!t) return;
    addMsg("me", t);
    const untimed = !timer && !elapsed && manualPhase < 3;
    const { reply, feedback } = Engine.ask(S, C, t, untimed ? null : phaseIdx());
    addMsg("cpo", reply); addFb(feedback);
    $("#c-input").value = "";
  }
  $("#c-send").onclick = send;
  $("#c-input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  Voice.attachMic($("#c-mic"), $("#c-input"));
  $("#c-to-synth").onclick = () => { if (!timer && !elapsed) manualPhase = 3; drawTimer(); renderSynth(); };

  /* ---------- synthesis ---------- */
  const STEPS = [
    { k: "problem", t: "Problem statement", h: "One sentence: who + where in the journey + why + what it's costing.", score: v => Engine.scoreProblem(C, v) },
    { k: "options", t: "Your three options", h: "Flip the root cause: a quick fix, a medium option and a big bet. One per line.", score: null },
    { k: "choice", t: "Pick a recommendation", h: "Compare the case's three options and pick one.", score: null },
    { k: "decision", t: "Final decision", h: "What you'll do, why it beats the others, and which concern it answers.", score: null },
    { k: "hypothesis", t: "Hypothesis", h: "If we [change] for [segment], [metric] moves from A to B within [time], because [evidence].", score: v => Engine.scoreHypothesis(C, v) },
    { k: "test", t: "How will you test it?", h: "A/B test, pilot vs control, or staged rollout — groups and duration.", score: null },
    { k: "metrics", t: "Success metrics", h: "Primary (closest to the change), then secondary and business. One per line.", score: v => Engine.scoreList(v, C.model_answer.success_metrics, "metrics") },
    { k: "guardrails", t: "Guardrails", h: "What must not get worse: risk, cost, compliance, experience. One per line.", score: v => Engine.scoreList(v, C.model_answer.guardrails, "guardrails") }
  ];
  function renderSynth() {
    $("#c-discovery").hidden = true; $("#c-synth").hidden = false;
    $("#c-synth").innerHTML = STEPS.map((s, i) => `<div class="step" id="st-${s.k}"><h3>${i + 1}. ${s.t}</h3><div class="hint">${esc(s.h)}</div>${
      s.k === "choice" ? optionsTable() : `<div class="field"><textarea rows="${s.k === "problem" || s.k === "hypothesis" || s.k === "decision" ? 3 : 3}" id="in-${s.k}"></textarea><button class="mic" id="mic-${s.k}" aria-label="Speak" aria-pressed="false">🎤</button></div><div class="row-actions"><button data-k="${s.k}">Submit</button></div>`
    }<div id="fb-${s.k}"></div></div>`).join("") + `<div class="row-actions"><button class="primary" id="c-build">Build my one-slide →</button></div>`;
    STEPS.forEach(s => { const m = $("#mic-" + s.k); if (m) Voice.attachMic(m, $("#in-" + s.k)); });
    $("#c-synth").querySelectorAll("button[data-k]").forEach(b => b.onclick = () => submitStep(b.dataset.k));
    $("#c-synth").querySelectorAll("input[name=opt]").forEach(r => r.onchange = () => { synth.choice = +r.value; $("#c-synth").querySelectorAll(".opt-table tr").forEach((tr, i) => tr.classList.toggle("sel", i - 1 === synth.choice)); showResult("choice", Engine.scoreChoice(C, synth.choice)); });
    $("#c-build").onclick = () => buildCaseSlide();
    addMsg("cpo", "Discovery is over. Take me through your problem statement, options, recommendation, hypothesis, test, success metrics and guardrails.");
    $("#st-problem").scrollIntoView({ behavior: "smooth" });
  }
  function optionsTable() {
    const o = C.model_answer.options;
    return `<table class="opt-table"><tr><th></th><th>Option</th><th>Description</th><th>Customer impact</th><th>Business impact</th><th>Severity</th><th>Estimate</th></tr>${o.map((x, i) => `<tr><td><input type="radio" name="opt" value="${i}" aria-label="Pick ${esc(x.name)}"></td><td><b>${esc(x.name)}</b></td><td>${esc(x.description)}</td><td>${esc(x.customer_impact)}</td><td>${esc(x.business_impact)}</td><td>${esc(x.severity)}</td><td>${esc(x.effort)}</td></tr>`).join("")}</table>`;
  }
  function submitStep(k) {
    const v = $("#in-" + k).value.trim();
    if (!v) { $("#fb-" + k).innerHTML = `<p class="small" style="color:var(--bad)">Add an answer first.</p>`; return; }
    synth[k] = v;
    const s = STEPS.find(x => x.k === k);
    const modelText = { options: C.model_answer.options.map(o => o.name).join(" · "), decision: C.model_answer.decision, test: C.model_answer.test }[k];
    showResult(k, s.score ? s.score(v) : { score: null, checks: [], model: modelText });
  }
  function showResult(k, r) {
    synth["score_" + k] = r.score;
    $("#fb-" + k).innerHTML = `${r.score != null ? `<div class="fb ${r.score >= 8 ? "good" : r.score <= 4 ? "low" : ""}"><b class="score">${r.score}/10</b><ul class="checks">${r.checks.map(c => `<li>${c[1] ? "✅" : "⬜"} ${esc(c[0])}</li>`).join("")}</ul></div>` : ""}${r.model ? `<details class="model"><summary>Compare with the model answer</summary>${esc(r.model)}</details>` : ""}`;
  }

  /* ---------- slide ---------- */
  let lastSlide = null, lastModel = null;
  const lines = v => String(v || "").split(/\n|;/).map(s => s.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
  function buildCaseSlide() {
    const m = C.model_answer, sel = synth.choice ?? m.recommended_index;
    const base = { subtitle: `${C.company} · ${C.type} case · practice scenario`, options: m.options, footer: C.disclaimer };
    lastModel = { ...base, title: m.options[m.recommended_index].name + ": recommended path", problem: m.problem_statement, selected: m.recommended_index, decision: m.decision, hypothesis: m.hypothesis, metrics: m.success_metrics, guardrails: m.guardrails };
    lastSlide = { ...base, title: m.options[sel].name + ": recommended path", problem: synth.problem || "(not answered)", selected: sel, decision: synth.decision || "(not answered)", hypothesis: synth.hypothesis || "(not answered)", metrics: lines(synth.metrics).length ? lines(synth.metrics) : ["(not answered)"], guardrails: lines(synth.guardrails).length ? lines(synth.guardrails) : ["(not answered)"] };
    const ds = S.scores, sy = ["problem", "hypothesis", "metrics", "guardrails", "choice"].map(k => synth["score_" + k]).filter(x => x != null);
    const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "–";
    $("#s-summary").innerHTML = `<div class="summary"><b>Your scores</b> · Discovery: ${avg(ds)}/10 across ${ds.length} questions · Synthesis: ${avg(sy)}/10 · Essential facts found: ${C.facts.filter(f => f.essential && S.revealed.includes(f.id)).length} of ${C.facts.filter(f => f.essential).length}</div>`;
    $("#s-toggle-wrap").hidden = false; $("#s-model").checked = false; slideFrom = "case";
    drawSlide(); location.hash = "slide";
  }
  function drawSlide() { $("#s-wrap").innerHTML = Slide.html($("#s-model").checked ? lastModel : lastSlide); $("#s-err").textContent = ""; }
  $("#s-model").onchange = drawSlide;
  $("#s-back").onclick = () => { location.hash = slideFrom; };
  $("#s-pdf").onclick = () => window.print();
  $("#s-pptx").onclick = async () => {
    try { await Slide.pptx($("#s-model").checked ? lastModel : lastSlide, "one-pager.pptx"); }
    catch (e) { $("#s-err").textContent = e.message; }
  };

  /* ---------- one-pager hook (builder lives in onepager.js) ---------- */
  window.App = {
    showSlide(d) {
      lastSlide = d; lastModel = null;
      $("#s-summary").innerHTML = ""; $("#s-toggle-wrap").hidden = true; $("#s-model").checked = false; slideFrom = "onepager";
      drawSlide(); location.hash = "slide";
    }
  };

  /* ---------- boot ---------- */
  loadCatalog().then(route);
})();
