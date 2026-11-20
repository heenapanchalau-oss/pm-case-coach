#!/usr/bin/env python3
"""Create a new frozen case file for a company and case type.

This is the ONLY step that goes online. It:
  1. researches the company on the web (products, customers, channels, regulation),
  2. writes one complete, internally consistent case dataset plus a model answer,
  3. validates it (tools/validate_case.py) and saves it to cases/<id>.json,
  4. adds it to cases/index.json.

After this, the app answers only from the saved file. Nothing is looked up
or generated while a candidate works through the case.

Setup:
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-...

Usage:
  python tools/generate_case.py --company "Atlassian" --type Engagement
  python tools/generate_case.py --company "Afterpay" --type Revenue --focus "merchant checkout"

Always review a generated case before publishing it.
"""
import argparse, json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_case import validate  # noqa: E402

TYPES = ["Onboarding", "Retention", "Revenue", "Growth", "Engagement"]
MODEL = os.environ.get("CASE_MODEL", "claude-sonnet-5-5")


def client():
    try:
        import anthropic
    except ImportError:
        sys.exit("Install the SDK first: pip install anthropic")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY first.")
    return anthropic.Anthropic()


def text_of(resp):
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def research(cl, company, ctype, focus):
    prompt = (
        f"Research {company} for a product-management case study of type '{ctype}'"
        + (f", focused on {focus}" if focus else "")
        + ". Use web search. Return a short factual brief: what the company does, main products, "
        "customer segments, channels (web, app, partners), revenue model, regulation that matters, "
        "and recent product changes. Only state what your sources support. "
        "End with a 'SOURCES' list of title | url lines."
    )
    resp = cl.messages.create(
        model=MODEL, max_tokens=4000,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 6}],
        messages=[{"role": "user", "content": prompt}],
    )
    return text_of(resp)


def build_case(cl, company, ctype, brief, example, errors=None):
    rules = f"""Write ONE practice case as JSON, matching the structure of the EXAMPLE exactly.

Company: {company}
Case type: {ctype}
Research brief (real company context — use only for company_context and realism):
<research>
{brief}
</research>

Rules:
- The scenario and every metric are HYPOTHETICAL. Say so in "disclaimer". Never present them as real company data.
- company_context: 1–2 sentences of real, sourced context only.
- sources: the research sources as [{{"title":..., "url":...}}].
- Make one clear root cause that the facts reveal step by step: frame (impact, scale, metric definition) → find (segments, behaviour, funnel, channels) → prove (what changed, feedback/complaints, operations) → pick (constraints and estimates).
- 11–14 facts. Each answer is 1–3 sentences with 2–4 specific numbers, all mutually consistent.
- Each fact has 6–12 keywords a candidate might use when asking for it. Mark the key facts "essential": true.
- Include a red-herring fact (plausible but not the cause) and 2–3 "unavailable" topics.
- rubric keywords must match words a good answer would use.
- model_answer: problem statement (who + where + why + cost) using ONLY numbers that appear in the facts or brief; three options (quick fix, medium, big bet) with all fields; recommended_index; decision; hypothesis with from/to targets and 'because'; test; 5 success metrics; 5 guardrails.
- Questions, wording and options must be specific to {company} and to a {ctype} problem.
- Output JSON only, no commentary.

EXAMPLE:
{json.dumps(example, ensure_ascii=False)}
"""
    if errors:
        rules += "\nThe previous attempt failed validation. Fix these:\n- " + "\n- ".join(errors)
    resp = cl.messages.create(model=MODEL, max_tokens=12000, messages=[{"role": "user", "content": rules}])
    raw = text_of(resp)
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        raise ValueError("No JSON returned")
    return json.loads(m.group(0))


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--company", required=True)
    ap.add_argument("--type", required=True, choices=TYPES)
    ap.add_argument("--focus", default="", help="optional product area to focus on")
    a = ap.parse_args()

    cl = client()
    example = json.loads((ROOT / "cases" / "paynest-onboarding.json").read_text(encoding="utf-8"))
    print(f"Researching {a.company}…")
    brief = research(cl, a.company, a.type, a.focus)

    errors = None
    for attempt in (1, 2):
        print(f"Writing case (attempt {attempt})…")
        case = build_case(cl, a.company, a.type, brief, example, errors)
        case["id"] = slug(f"{a.company}-{a.type}" + (f"-{a.focus}" if a.focus else ""))
        case["company"], case["type"] = a.company, a.type
        errors = validate(case)
        if not errors:
            break
        print("Validation issues:\n - " + "\n - ".join(errors))
    if errors:
        sys.exit("Case failed validation twice. Not saved.")

    out = ROOT / "cases" / f"{case['id']}.json"
    out.write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding="utf-8")
    idx_path = ROOT / "cases" / "index.json"
    idx = [c for c in json.loads(idx_path.read_text(encoding="utf-8")) if c["id"] != case["id"]]
    idx.append({"id": case["id"], "company": case["company"], "type": case["type"], "title": case["title"]})
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {out.relative_to(ROOT)}. Review it before publishing.")


if __name__ == "__main__":
    main()
