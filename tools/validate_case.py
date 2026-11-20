#!/usr/bin/env python3
"""Validate a case file before it goes into the library.

Guardrail checks:
  - required structure and phases
  - every phase of discovery has data, and essential facts exist
  - three options with a valid recommendation
  - numbers used in the model answer must appear in the case data
    (so the model answer never introduces figures the candidate couldn't discover)

Usage: python tools/validate_case.py cases/my-case.json [more.json ...]
"""
import json, re, sys

PHASES = {"frame", "find", "prove", "pick"}
TYPES = {"Onboarding", "Retention", "Revenue", "Growth", "Engagement"}
OPT_KEYS = ["name", "description", "customer_impact", "business_impact", "severity", "effort", "why"]
NUM = re.compile(r"\d+(?:[.,]\d+)?")


def numbers(text):
    return {n.replace(",", "") for n in NUM.findall(text or "")}


def validate(c):
    err = []
    for k in ["id", "company", "type", "title", "disclaimer", "brief", "facts", "rubric", "model_answer"]:
        if k not in c:
            err.append(f"missing '{k}'")
    if err:
        return err
    if c["type"] not in TYPES:
        err.append(f"type must be one of {sorted(TYPES)}")
    b = c["brief"]
    for k in ["problem", "objective", "baseline"]:
        if not b.get(k):
            err.append(f"brief.{k} is empty")
    ids = set()
    for f in c["facts"]:
        fid = f.get("id")
        if fid in ids:
            err.append(f"duplicate fact id {fid}")
        ids.add(fid)
        if f.get("phase") not in PHASES:
            err.append(f"{fid}: phase must be one of {sorted(PHASES)}")
        if len(f.get("keywords", [])) < 3:
            err.append(f"{fid}: needs at least 3 keywords")
        if not f.get("answer"):
            err.append(f"{fid}: empty answer")
    for p in ["frame", "find", "prove"]:
        if not any(f.get("phase") == p and f.get("essential") for f in c["facts"]):
            err.append(f"no essential fact in phase '{p}'")
    r = c["rubric"]
    for k in ["segment", "step", "cause"]:
        if not r.get("problem", {}).get(k):
            err.append(f"rubric.problem.{k} is empty")
    for k in ["change", "metric"]:
        if not r.get("hypothesis", {}).get(k):
            err.append(f"rubric.hypothesis.{k} is empty")
    m = c["model_answer"]
    opts = m.get("options", [])
    if len(opts) != 3:
        err.append("model_answer.options must have exactly 3 options")
    for i, o in enumerate(opts):
        for k in OPT_KEYS:
            if not o.get(k):
                err.append(f"option {i + 1}: missing '{k}'")
    if m.get("recommended_index") not in (0, 1, 2):
        err.append("model_answer.recommended_index must be 0, 1 or 2")
    for k in ["problem_statement", "decision", "hypothesis", "test"]:
        if not m.get(k):
            err.append(f"model_answer.{k} is empty")
    for k in ["success_metrics", "guardrails"]:
        if len(m.get(k, [])) < 3:
            err.append(f"model_answer.{k} needs at least 3 items")

    # Consistency guardrail: figures in the problem statement must exist in the case data.
    known = numbers(json.dumps(b, ensure_ascii=False)) | set().union(*[numbers(f.get("answer", "")) for f in c["facts"]])
    stray = numbers(m.get("problem_statement", "")) - known
    if stray:
        err.append(f"problem_statement uses numbers not found in the case data: {sorted(stray)}")
    return err


def main(paths):
    bad = 0
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            errs = validate(json.load(fh))
        print(("OK   " if not errs else "FAIL ") + p)
        for e in errs:
            print("   - " + e)
        bad += bool(errs)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
