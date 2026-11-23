/* One-pager builder: click-based wizard. All slide text is assembled from fixed templates
   and the user's own selections — nothing is generated or looked up. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const OTHER = "Other…";

  /* ---------- predefined choices ---------- */
  const AREAS = ["Payments and PayTo", "Merchant acquiring and POS", "Digital wallets and loyalty", "Buy now, pay later", "Neobanks and digital banking", "Lending", "Wealth, super and investing", "Insurtech", "Regtech (AML/KYC)", "Open Banking (CDR)", "Cross-border payments and FX", "Earned wage access and payroll", "Crypto and digital assets", "SME finance and accounting"];
  const TYPES = ["Onboarding", "Retention", "Revenue", "Growth", "Engagement"];
  const WHO = ["New customers", "Existing customers", "Small businesses (SMEs)", "Merchants", "Advisers or brokers", "Enterprise clients", "Customers under 30", "Customers aged 55+"];
  const WHERE = {
    Onboarding: ["the sign-up form", "the identity check (KYC)", "bank or card linking", "setup or integration", "the first transaction"],
    Retention: ["the first 90 days", "renewal or contract end", "a key life event", "a price or fee change", "a service issue"],
    Revenue: ["pricing and checkout", "approval or conversion", "upgrade or upsell", "everyday transaction use", "renewal"],
    Growth: ["lead to sign-up", "partner or channel activation", "referrals", "the first value moment", "account expansion"],
    Engagement: ["first use", "repeat use", "a key feature", "notifications and reminders", "self-service tasks"]
  };
  const EVIDENCE = ["funnel data", "support tickets", "app reviews", "NPS and surveys", "user research", "operations data", "A/B test results", "competitor analysis"];
  const IMPACT = ["under $100k", "$100k–$500k", "$500k–$1m", "$1m–$5m", "over $5m"];
  const METRICS = {
    Onboarding: ["completion rate", "step conversion rate", "time to activate", "activated customers", "onboarding CSAT", "drop-off at the problem step"],
    Retention: ["retention rate", "churn rate", "net outflows", "customer lifetime value", "re-engagement rate", "NPS"],
    Revenue: ["revenue per customer", "conversion to paid or funded", "total revenue", "average order or loan size", "margin", "upgrade rate"],
    Growth: ["new customers", "activation rate", "net inflows", "channel conversion", "time to first value", "referral rate"],
    Engagement: ["monthly active users", "journey completion rate", "feature adoption", "self-service rate", "sessions per user", "support contacts per user"]
  };
  const GUARDS = ["Fraud or security incidents", "Compliance breaches", "Support contacts", "Complaints", "Cost to serve", "NPS or CSAT", "Error rate", "Revenue per customer"];
  const GUARD_DEFAULT = {
    Onboarding: ["Fraud or security incidents", "Compliance breaches", "Support contacts", "Error rate"],
    Retention: ["Cost to serve", "Complaints", "Revenue per customer", "NPS or CSAT"],
    Revenue: ["Complaints", "NPS or CSAT", "Compliance breaches", "Support contacts"],
    Growth: ["Fraud or security incidents", "Cost to serve", "Support contacts", "Compliance breaches"],
    Engagement: ["Error rate", "Support contacts", "Complaints", "Fraud or security incidents"]
  };
  const TIMEFRAMES = ["1 month", "1 quarter", "2 quarters", "12 months"];
  const TESTS = ["A/B test", "Pilot vs a control group", "Staged rollout"];
  const DURATIONS = ["2 weeks", "4 weeks", "6 weeks", "8 weeks", "1 quarter"];

  /* Root causes, each with three ready-made options: quick fix, medium, big bet.
     Ratings: customer impact, business impact, severity addressed (H/M/L); effort S/M/L. */
  const o = (name, desc, ci, bi, sev, eff) => ({ name, desc, ci, bi, sev, eff });
  const CAUSES = {
    friction: { label: "Too many steps", phrase: "the journey has too many steps", opts: [o("Guided flow", "Clear steps, a progress bar and inline help.", "M", "M", "M", "S"), o("Remove or merge steps", "Cut non-essential steps and pre-fill data we already hold.", "H", "H", "H", "M"), o("Redesign the journey", "Rebuild the journey around the customer's goal.", "H", "H", "H", "L")] },
    technical: { label: "Technical errors", phrase: "errors and failures stop customers", opts: [o("Clear errors and retry", "Plain-language error messages with an easy retry.", "M", "M", "M", "S"), o("Fix the failing integration", "Find and fix the system that's failing.", "H", "H", "H", "M"), o("Rebuild the component", "Replace the fragile part with a robust one.", "H", "H", "H", "L")] },
    verification: { label: "New verification or compliance step", phrase: "a new verification step adds friction", opts: [o("Smart fallback", "Offer another way through when the check fails.", "M", "M", "M", "S"), o("Risk-based checks", "Apply the extra check only when risk is higher.", "H", "H", "H", "M"), o("New verification provider", "Switch to a provider with better coverage.", "H", "M", "H", "L")] },
    removed: { label: "Feature removed or changed", phrase: "a feature customers relied on was removed or changed", opts: [o("Interim workaround", "An assisted or manual path while the fix is built.", "L", "L", "M", "S"), o("Restore the feature", "Bring back what worked, with improvements.", "H", "H", "H", "M"), o("Rebuild it better", "Design a stronger replacement.", "H", "H", "H", "L")] },
    pricing: { label: "Pricing or fees", phrase: "pricing or fees put customers off", opts: [o("Targeted offer", "A time-limited offer for the affected group.", "M", "M", "L", "S"), o("Simpler tiers", "Repackage plans so the value is clearer.", "M", "H", "M", "M"), o("New pricing model", "Price on the value customers get.", "H", "H", "H", "L")] },
    competitor: { label: "Competitor offer", phrase: "a competitor offers something better", opts: [o("Match the key benefit", "Close the most-cited gap quickly.", "M", "M", "M", "S"), o("Partnership or bundle", "Add value through a partner.", "M", "H", "M", "M"), o("Differentiating feature", "Build something hard to copy.", "H", "H", "H", "L")] },
    visibility: { label: "No status visibility", phrase: "customers can't see what's happening or what to do next", opts: [o("Status notifications", "Send an update at each step.", "M", "M", "M", "S"), o("Status tracker", "Show progress and missing items in one place.", "H", "M", "H", "M"), o("Self-service hub", "Let customers resolve issues themselves.", "H", "H", "H", "L")] },
    manual: { label: "Slow manual process", phrase: "a slow manual process causes delays", opts: [o("Templates and checklists", "Standardise the manual work.", "L", "M", "M", "S"), o("Automate the slowest step", "Remove the biggest manual bottleneck.", "M", "H", "H", "M"), o("End-to-end automation", "Automate the whole process.", "H", "H", "H", "L")] },
    trust: { label: "Trust or privacy concern", phrase: "customers don't trust the step with their data", opts: [o("Clearer consent and copy", "Explain why we ask and how data is protected.", "M", "M", "M", "S"), o("Alternative path", "Offer another way to complete the step.", "H", "H", "H", "M"), o("Trust features", "In-product controls and reassurance.", "M", "M", "H", "L")] },
    other: { label: "Other", phrase: "", opts: [o("Quick fix", "", "M", "M", "M", "S"), o("Medium change", "", "H", "H", "H", "M"), o("Big bet", "", "H", "H", "H", "L")] }
  };
  const LV = { H: 3, M: 2, L: 1 }, EF = { S: 1, M: 2, L: 3 };
  const LVL = { H: "High", M: "Medium", L: "Low" };
  const EFL = { S: "S · under 4 weeks", M: "M · 4–8 weeks", L: "L · 8+ weeks" };
  const CI_TXT = { H: "Big improvement for customers", M: "Noticeable improvement", L: "Small improvement" };
  const BI_TXT = { H: "Tackles the main driver", M: "Partial recovery", L: "Small effect" };

  /* ---------- state ---------- */
  const KEY = "case-coach-onepager-v2";
  const blank = () => ({ step: 0, area: "", areaOther: "", type: "", who: "", whoOther: "", where: "", whereOther: "", cause: "", causeOther: "", evidence: [], metric: "", from: "", to: "", impact: "", options: null, pick: null, timeframe: "1 quarter", test: "A/B test", duration: "6 weeks", metrics: null, guards: null });
  let st = load();
  function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { return blank(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }

  const pick = (v, other) => v === OTHER ? (other || "").trim() : v;
  const area = () => pick(st.area, st.areaOther);
  const who = () => pick(st.who, st.whoOther);
  const where = () => pick(st.where, st.whereOther);
  const causePhrase = () => st.cause === "other" ? (st.causeOther || "").trim() : (CAUSES[st.cause] || {}).phrase || "";
  const fmt = v => { v = String(v || "").trim(); return v && /^\d+(\.\d+)?$/.test(v) ? v + "%" : v; };

  function ensureOptions() {
    if (!st.cause) return;
    if (!st.options || st.options._cause !== st.cause) {
      st.options = CAUSES[st.cause].opts.map(x => ({ ...x }));
      st.options._cause = st.cause;
      st.pick = null;
    }
  }
  const score = x => LV[x.ci] + LV[x.bi] + 2 * LV[x.sev] - 2 * (EF[x.eff] - 1); // value minus effort cost
  function autoPick() { let b = 0; st.options.forEach((x, i) => { if (score(x) > score(st.options[b])) b = i; }); return b; }
  const chosen = () => st.pick ?? autoPick();

  /* ---------- composed text (templates only) ---------- */
  function problemText() {
    const parts = [];
    parts.push(`${who() || "[who]"} are dropping off at ${where() || "[where]"} because ${causePhrase() || "[cause]"}.`);
    if (st.metric && (st.from || st.to)) parts.push(`${cap(st.metric)} has moved from ${fmt(st.from) || "[from]"} to ${fmt(st.to) || "[to]"}.`);
    if (st.impact) parts.push(`This is costing about ${st.impact} a year.`);
    return parts.join(" ");
  }
  function whyText(i) {
    const x = st.options[i], best = autoPick();
    if (i === best) return "Best impact for the effort.";
    if (x.eff === "S") return "Fast win, but only a partial fix.";
    if (x.eff === "L") return "Strong fix, but slowest to land.";
    return "Solid option, but less impact for the effort.";
  }
  function decisionText() {
    if (!st.options) return "";
    const i = chosen(), x = st.options[i];
    let t = `Go with "${x.name}" — ${whyText(i).toLowerCase().replace(/\.$/, "")}.`;
    const quick = st.options.findIndex((y, j) => j !== i && y.eff === "S");
    if (x.eff !== "S" && quick >= 0) t += ` Ship "${st.options[quick].name}" first as a quick win while it's built.`;
    if (st.pick != null && st.pick !== autoPick()) t += ` Chosen over "${st.options[autoPick()].name}" on judgement.`;
    return t;
  }
  function hypothesisText() {
    if (!st.options) return "";
    const x = st.options[chosen()];
    const ev = st.evidence.length ? st.evidence.join(", ").replace(/, ([^,]*)$/, " and $1") : "our evidence";
    const move = st.from && st.to ? ` from ${fmt(st.to)} back towards ${fmt(st.from)}` : "";
    const w = who() || "[who]";
    return `If we roll out "${x.name}" for ${w.charAt(0).toLowerCase() + w.slice(1)}, ${st.metric || "[metric]"} will improve${move} within ${st.timeframe}, because ${ev} point to ${causePhrase() || "[cause]"}.`;
  }
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  /* ---------- UI helpers ---------- */
  const sel = (k, list, label, withOther = true) => `<label class="opq"><span>${label}</span><select data-k="${k}"><option value="">Choose…</option>${list.map(v => `<option ${st[k] === v ? "selected" : ""}>${esc(v)}</option>`).join("")}${withOther ? `<option ${st[k] === OTHER ? "selected" : ""}>${OTHER}</option>` : ""}</select>${withOther && st[k] === OTHER ? `<input type="text" data-k="${k}Other" value="${esc(st[k + "Other"])}" placeholder="Type your own">` : ""}</label>`;
  const radios = (k, list, label) => `<fieldset class="opq"><legend>${label}</legend><div class="rcards">${list.map(([v, t]) => `<label class="rcard ${st[k] === v ? "on" : ""}"><input type="radio" name="${k}" value="${esc(v)}" ${st[k] === v ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div></fieldset>`;
  const chips = (k, list, label) => `<fieldset class="opq"><legend>${label}</legend><div class="chips">${list.map(v => `<button type="button" class="chip ${(st[k] || []).includes(v) ? "on" : ""}" data-chip="${k}" data-v="${esc(v)}" aria-pressed="${(st[k] || []).includes(v)}">${esc(v)}</button>`).join("")}</div></fieldset>`;
  const lvlSel = (i, k, map) => `<select data-opt="${i}" data-f="${k}" aria-label="${k}">${Object.keys(map).map(v => `<option value="${v}" ${st.options[i][k] === v ? "selected" : ""}>${map[v]}</option>`).join("")}</select>`;

  const STEPS = [
    { t: "Context", ok: () => area() && st.type && who() && where(), html: () =>
      sel("area", AREAS, "1. Fintech area") +
      radios("type", TYPES.map(v => [v, v]), "2. Problem type") +
      sel("who", WHO, "3. Who is affected") +
      (st.type ? sel("where", WHERE[st.type], "4. Where it happens") : `<p class="small">Pick a problem type to see where it can happen.</p>`) },
    { t: "Cause and evidence", ok: () => causePhrase() && st.evidence.length, html: () =>
      radios("cause", Object.entries(CAUSES).map(([k, v]) => [k, v.label]), "5. Root cause") +
      (st.cause === "other" ? `<label class="opq"><span>Describe the cause (finish the sentence: "because …")</span><input type="text" data-k="causeOther" value="${esc(st.causeOther)}" placeholder="e.g. the app crashes on older phones"></label>` : "") +
      chips("evidence", EVIDENCE, "6. Evidence you have (pick all that apply)") },
    { t: "Impact", ok: () => st.metric && st.impact, html: () =>
      (st.type ? sel("metric", METRICS[st.type], "7. Main metric affected", false) : "") +
      `<div class="opq"><span>8. How has it moved? (numbers only, e.g. 62 → 41)</span><div class="nums"><input type="text" inputmode="decimal" data-k="from" value="${esc(st.from)}" placeholder="Before" aria-label="Before"> <b>→</b> <input type="text" inputmode="decimal" data-k="to" value="${esc(st.to)}" placeholder="Now" aria-label="Now"></div><span class="small">Plain numbers show as %. Leave blank if you don't know — the slide won't make numbers up.</span></div>` +
      radios("impact", IMPACT.map(v => [v, v + " a year"]), "9. Rough cost to the business") },
    { t: "Options", ok: () => !!st.options, html: () => {
      ensureOptions();
      if (!st.options) return `<p class="small">Pick a root cause first.</p>`;
      const best = autoPick(), ch = chosen();
      return `<p class="small">Suggested from your root cause. Rename them or change the ratings — the recommendation updates automatically.</p>` +
        st.options.map((x, i) => `<div class="optcard ${i === ch ? "rec" : ""}">
          <div class="optrow"><label class="rpick"><input type="radio" name="pick" value="${i}" ${i === ch ? "checked" : ""}> Recommend</label>
          <span class="badge">${["Quick fix", "Medium", "Big bet"][i]}</span>${i === best ? `<span class="badge good">Best score</span>` : ""}</div>
          <input type="text" class="optname" data-opt="${i}" data-f="name" value="${esc(x.name)}" aria-label="Option name">
          <input type="text" data-opt="${i}" data-f="desc" value="${esc(x.desc)}" placeholder="One-line description" aria-label="Description">
          <div class="ratings"><label>Customer impact ${lvlSel(i, "ci", LVL)}</label><label>Business impact ${lvlSel(i, "bi", LVL)}</label><label>Severity fixed ${lvlSel(i, "sev", LVL)}</label><label>Effort ${lvlSel(i, "eff", EFL)}</label></div>
        </div>`).join("");
    } },
    { t: "Plan", ok: () => (st.metrics || []).length && (st.guards || []).length, html: () => {
      if (!st.metrics && st.type) st.metrics = METRICS[st.type].slice(0, 3);
      if (!st.guards && st.type) st.guards = GUARD_DEFAULT[st.type].slice();
      return radios("timeframe", TIMEFRAMES.map(v => [v, v]), "10. When should we see results?") +
        radios("test", TESTS.map(v => [v, v]), "11. How will you test it?") +
        radios("duration", DURATIONS.map(v => [v, v]), "12. Test duration") +
        (st.type ? chips("metrics", METRICS[st.type], "13. Success metrics") : "") +
        chips("guards", GUARDS, "14. Guardrails (must not get worse)");
    } }
  ];

  /* ---------- render ---------- */
  function render() {
    const root = $("#op-root");
    if (!root) return;
    const s = STEPS[st.step];
    root.innerHTML = `
      <ol class="opsteps">${STEPS.map((x, i) => `<li class="${i === st.step ? "on" : i < st.step ? "done" : ""}"><button type="button" data-go="${i}">${i + 1}. ${x.t}</button></li>`).join("")}</ol>
      <div class="opgrid">
        <div class="opmain"><h2>${s.t}</h2>${s.html()}
          <div class="row-actions">${st.step ? `<button type="button" data-nav="-1">← Back</button>` : `<button type="button" id="op-reset">Start over</button>`}
          ${st.step < STEPS.length - 1 ? `<button type="button" class="primary" data-nav="1" ${s.ok() ? "" : "aria-disabled=\"true\""}>Next →</button>` : `<button type="button" class="primary" id="op-make">Build my slide →</button>`}</div>
          <p class="small" id="op-msg" role="status"></p>
        </div>
        <aside class="oplive"><h3>Live preview</h3>
          <p><b>Problem statement</b><br>${esc(problemText())}</p>
          ${st.options ? `<p><b>Recommendation</b><br>${esc(decisionText())}</p><p><b>Hypothesis</b><br>${esc(hypothesisText())}</p>` : ""}
        </aside>
      </div>`;
  }

  function onInput(e) {
    const t = e.target;
    if (t.dataset.k) { st[t.dataset.k] = t.value; if (t.dataset.k === "type") { st.where = ""; st.metric = ""; st.metrics = null; st.guards = null; } }
    else if (t.dataset.opt != null) st.options[+t.dataset.opt][t.dataset.f] = t.value;
    else if (t.name === "pick") st.pick = +t.value;
    else if (t.type === "radio") { st[t.name] = t.value; if (t.name === "type") { st.where = ""; st.metric = ""; st.metrics = null; st.guards = null; } if (t.name === "cause") st.options = null; }
    save();
    const rerender = t.tagName === "SELECT" || t.type === "radio";
    if (rerender) render(); else refreshPreview();
  }
  function refreshPreview() {
    const a = $(".oplive"); if (!a) return;
    a.innerHTML = `<h3>Live preview</h3><p><b>Problem statement</b><br>${esc(problemText())}</p>${st.options ? `<p><b>Recommendation</b><br>${esc(decisionText())}</p><p><b>Hypothesis</b><br>${esc(hypothesisText())}</p>` : ""}`;
  }
  function onClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.chip) { const k = b.dataset.chip, v = b.dataset.v; st[k] = st[k] || []; st[k] = st[k].includes(v) ? st[k].filter(x => x !== v) : [...st[k], v]; save(); render(); return; }
    if (b.dataset.go != null) { const g = +b.dataset.go; if (g <= st.step || STEPS.slice(0, g).every(x => x.ok())) { st.step = g; save(); render(); } else msg("Finish the earlier steps first."); return; }
    if (b.dataset.nav) { const n = +b.dataset.nav; if (n > 0 && !STEPS[st.step].ok()) { msg("Answer each question on this step to continue."); return; } st.step += n; save(); render(); window.scrollTo(0, 0); return; }
    if (b.id === "op-reset") { st = blank(); save(); render(); return; }
    if (b.id === "op-make") build();
  }
  function msg(t) { const m = $("#op-msg"); if (m) { m.textContent = t; m.style.color = "var(--bad)"; } }

  function build() {
    if (!STEPS.every(x => x.ok())) { msg("Some answers are missing — check each step."); return; }
    const i = chosen();
    const options = st.options.map((x, j) => ({
      name: x.name, description: x.desc || "—",
      customer_impact: `${LVL[x.ci]} — ${CI_TXT[x.ci]}`, business_impact: `${LVL[x.bi]} — ${BI_TXT[x.bi]}`,
      severity: LVL[x.sev], effort: EFL[x.eff], why: whyText(j)
    }));
    const test = `${st.test} for ${st.duration}`;
    window.App.showSlide({
      title: `${st.options[i].name}: recommended path`,
      subtitle: `${area()} · ${st.type} problem · Test: ${test}`,
      problem: problemText(), options, selected: i,
      decision: decisionText(), hypothesis: hypothesisText(),
      metrics: st.metrics.map(cap), guardrails: st.guards,
      footer: `Built from your selections only. Evidence: ${st.evidence.join(", ")}.`
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = $("#op-root"); if (!root) return;
    root.addEventListener("input", onInput);
    root.addEventListener("change", e => { if (e.target.tagName === "SELECT" || e.target.type === "radio") onInput(e); });
    root.addEventListener("click", onClick);
    render();
  });
  window.OnePager = { render, _state: () => st };
})();
