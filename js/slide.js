/* One-slide decision pager: renders HTML and exports PowerPoint (pptxgenjs) or PDF (print). */
(function (root) {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COLS = [["name", "Recommendation"], ["description", "Description"], ["customer_impact", "Customer impact"], ["business_impact", "Business / commercial impact"], ["severity", "Severity"], ["effort", "Engineering estimate"], ["why", "Why select it"]];

  function html(d) {
    const rows = d.options.map((o, i) => `<tr class="${i === d.selected ? "rec" : ""}">${COLS.map(([k], j) => `<td>${j === 0 && i === d.selected ? '<span class="tag">Recommended</span>' : ""}${esc(o[k])}</td>`).join("")}</tr>`).join("");
    return `<div class="slide" id="slide">
  <div class="s-title">${esc(d.title)}</div>
  <div class="s-sub">${esc(d.subtitle)}</div>
  <div class="s-problem"><b>Problem statement</b><br>${esc(d.problem)}</div>
  <table class="s-table"><thead><tr>${COLS.map(c => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
  <div class="s-bottom">
    <div class="s-box decision"><b>Final decision</b><br>${esc(d.decision)}</div>
    <div class="s-box"><b>Hypothesis</b><br>${esc(d.hypothesis)}</div>
    <div class="s-box"><b>Success metrics</b><br>${esc(d.metrics.join(" · "))}<br><b>Guardrails</b><br>${esc(d.guardrails.join(" · "))}</div>
  </div>
  <div class="s-foot">${esc(d.footer)}</div>
</div>`;
  }

  async function pptx(d, filename) {
    if (!root.PptxGenJS) throw new Error("PowerPoint export isn't available in this browser. Use Save as PDF instead.");
    const p = new root.PptxGenJS(); p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
    const s = p.addSlide(), F = "Arial", ACC = "534AB7";
    s.addText(d.title, { x: 0.4, y: 0.2, w: 12.5, h: 0.5, fontFace: F, fontSize: 22, bold: true, color: "26215C" });
    s.addText(d.subtitle, { x: 0.4, y: 0.68, w: 12.5, h: 0.3, fontFace: F, fontSize: 11, color: "5F5E5A" });
    s.addText([{ text: "Problem statement  ", options: { bold: true } }, { text: d.problem }], { x: 0.4, y: 1.05, w: 12.5, h: 0.75, fontFace: F, fontSize: 11, fill: { color: "EEEDFE" }, color: "26215C", margin: 6, valign: "middle" });
    const head = COLS.map(c => ({ text: c[1], options: { bold: true, fill: { color: "444441" }, color: "FFFFFF" } }));
    const body = d.options.map((o, i) => COLS.map(([k], j) => ({ text: (j === 0 && i === d.selected ? "★ " : "") + (o[k] || ""), options: i === d.selected ? { fill: { color: "E1F5EE" }, bold: j === 0, border: { type: "solid", pt: 2, color: "0F6E56" } } : {} })));
    s.addTable([head, ...body], { x: 0.4, y: 1.95, w: 12.5, colW: [1.5, 2.1, 1.8, 2.2, 1, 1.4, 2.5], fontFace: F, fontSize: 9, border: { type: "solid", pt: 0.5, color: "D3D1C7" }, valign: "top" });
    const by = 4.55, bw = 4.1, bh = 2.4;
    s.addText([{ text: "Final decision\n", options: { bold: true } }, { text: d.decision }], { x: 0.4, y: by, w: bw, h: bh, fontFace: F, fontSize: 9.5, valign: "top", margin: 6, fill: { color: "E1F5EE" }, line: { color: "0F6E56", width: 2 } });
    s.addText([{ text: "Hypothesis\n", options: { bold: true } }, { text: d.hypothesis }], { x: 0.6 + bw, y: by, w: bw, h: bh, fontFace: F, fontSize: 9.5, valign: "top", margin: 6, fill: { color: "FAEEDA" } });
    s.addText([{ text: "Success metrics\n", options: { bold: true } }, { text: d.metrics.join(" · ") + "\n" }, { text: "Guardrails\n", options: { bold: true } }, { text: d.guardrails.join(" · ") }], { x: 0.8 + 2 * bw, y: by, w: bw, h: bh, fontFace: F, fontSize: 9.5, valign: "top", margin: 6, fill: { color: "F1EFE8" } });
    s.addText(d.footer, { x: 0.4, y: 7.1, w: 12.5, h: 0.3, fontFace: F, fontSize: 8, color: "888780" });
    await p.writeFile({ fileName: filename || "decision-one-pager.pptx" });
  }

  root.Slide = { html, pptx };
})(window);
