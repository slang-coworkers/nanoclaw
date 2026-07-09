#!/usr/bin/env python3
"""Score Verity's decisions against ground truth (human reviews).

Joins the decision ledger to the human verdict for the SAME (pr, head_sha)
— per reviewed revision — from the offline round manifests, and optionally
to the two-axis labels DB (replay.db human_outcomes) when mounted.

Truth mapping (per revision):  CHANGES_REQUESTED -> UNSAFE
                               APPROVED          -> SAFE
                               COMMENTED         -> INDETERMINATE (reported, not scored)
                               NO_HUMAN_REVIEW   -> own bucket (reported, not scored)

Decision mapping:  WOULD_APPROVE                  -> approve
                   BLOCK | ABSTAIN_POLICY         -> withhold
                   ABSTAIN_INFRA                  -> pipeline failure (excluded from
                                                     agreement; scored as infra rate)

Headline numbers:
  false_safe        approve ∧ UNSAFE   — THE critical count; every case listed
  unsafe_recall     UNSAFE caught by withhold / all scored UNSAFE
  approval_coverage approve / all scored SAFE (the value metric)
  false_alarm       BLOCK ∧ SAFE (over-caution, split from policy-abstain ∧ SAFE)
  infra_rate        ABSTAIN_INFRA / all decisions (quality gate -> ~0)
R0 rows are reported separately from Rn>0 rows (launch metric vs follow-up
turnaround) and per class when --census is given.

Usage:
  score-decisions.py --decisions decisions.jsonl --manifests pr-snapshots \
                     [--census supply-census.csv] [--labels-db replay.db] \
                     [--out reports/verity-score.md]
stdlib only.
"""
import argparse, csv, glob, json, os, sqlite3, sys
from collections import Counter, defaultdict

TRUTH = {"CHANGES_REQUESTED": "UNSAFE", "APPROVED": "SAFE",
         "COMMENTED": "INDETERMINATE", "NO_HUMAN_REVIEW": "NO_HUMAN_REVIEW",
         "DISMISSED": "INDETERMINATE"}

def load_decisions(path):
    rows = []
    if path.endswith((".sqlite", ".db")):
        con = sqlite3.connect(path)
        con.row_factory = sqlite3.Row
        rows = [dict(r) for r in con.execute("SELECT * FROM decisions")]
        con.close()
    else:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows

def load_truth(manifest_dir):
    truth = {}
    for mf in sorted(glob.glob(os.path.join(manifest_dir, "task-manifest-round-*.json"))):
        for e in json.load(open(mf)):
            for rv in e.get("revisions", []):
                truth[(e["pr"], rv["head_sha"])] = {
                    "verdict": TRUTH.get(rv.get("human_verdict"), "INDETERMINATE"),
                    "rev_index": rv.get("index", 0)}
    return truth

def load_classes(census_csv):
    classes = {}
    with open(census_csv) as f:
        for row in csv.DictReader(f):
            classes[int(row["number"])] = row["class"]
    return classes

def pct(a, b):
    return "n/a" if not b else f"{100.0 * a / b:.1f}% ({a}/{b})"

def score(rows, truth, classes):
    joined, unmatched = [], 0
    for r in rows:
        key = (int(r["pr"]), r.get("commit_sha") or r.get("head_sha") or "")
        t = truth.get(key)
        if not t:
            unmatched += 1
            continue
        joined.append({**r, "truth": t["verdict"], "rev_index": t["rev_index"],
                       "cls": classes.get(int(r["pr"]), "unknown")})
    buckets = defaultdict(list)
    for j in joined:
        buckets["all"].append(j)
        buckets["R0" if j["rev_index"] == 0 else "Rn"].append(j)
        if classes:
            buckets[f"class:{j['cls']}"].append(j)
    out = {}
    for name, js in buckets.items():
        infra = [j for j in js if j["decision"] == "ABSTAIN_INFRA"]
        scored = [j for j in js if j["decision"] != "ABSTAIN_INFRA"
                  and j["truth"] in ("SAFE", "UNSAFE")]
        unsafe = [j for j in scored if j["truth"] == "UNSAFE"]
        safe = [j for j in scored if j["truth"] == "SAFE"]
        fs = [j for j in unsafe if j["decision"] == "WOULD_APPROVE"]
        out[name] = {
            "decisions": len(js),
            "scored": len(scored),
            "infra_rate": pct(len(infra), len(js)),
            "false_safe": pct(len(fs), len(unsafe)),
            "false_safe_cases": [(j["pr"], (j.get("commit_sha") or j.get("head_sha") or "")[:12]) for j in fs],
            "unsafe_recall": pct(sum(1 for j in unsafe
                                     if j["decision"] in ("BLOCK", "ABSTAIN_POLICY")),
                                 len(unsafe)),
            "approval_coverage": pct(sum(1 for j in safe
                                         if j["decision"] == "WOULD_APPROVE"), len(safe)),
            "block_on_safe": pct(sum(1 for j in safe if j["decision"] == "BLOCK"),
                                 len(safe)),
            "confusion": dict(Counter((j["truth"], j["decision"]) for j in scored)),
        }
    return out, joined, unmatched

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--manifests", default="pr-snapshots")
    ap.add_argument("--census", help="supply-census CSV for per-class breakdown")
    ap.add_argument("--out", default="verity-score.md")
    a = ap.parse_args()
    rows = load_decisions(a.decisions)
    truth = load_truth(a.manifests)
    classes = load_classes(a.census) if a.census else {}
    out, joined, unmatched = score(rows, truth, classes)
    lines = ["# Verity score vs human ground truth", ""]
    if unmatched:
        lines.append(f"⚠ {unmatched} decision(s) had no matching (pr, head_sha) in the "
                     "manifests — stale ledger or wrong revision pin; investigate first.")
        lines.append("")
    order = ["all", "R0", "Rn"] + sorted(k for k in out if k.startswith("class:"))
    lines.append("| cohort | decisions | scored | FALSE-SAFE | unsafe recall | "
                 "approval coverage | block-on-safe | infra rate |")
    lines.append("|---|---:|---:|---|---|---|---|---|")
    for name in order:
        if name not in out:
            continue
        m = out[name]
        lines.append(f"| {name} | {m['decisions']} | {m['scored']} | {m['false_safe']} | "
                     f"{m['unsafe_recall']} | {m['approval_coverage']} | "
                     f"{m['block_on_safe']} | {m['infra_rate']} |")
    fs_all = out.get("all", {}).get("false_safe_cases", [])
    lines.append("")
    if fs_all:
        lines.append("## FALSE-SAFE cases (approve where human required changes)")
        lines += [f"- PR {pr} @ {sha}" for pr, sha in fs_all]
    else:
        lines.append("No false-safe cases in the scored set. With zero observed, the 95% "
                     "upper bound on the true rate is ≈ 3/N (rule of three) — report the "
                     "bound, not \"perfect\".")
    lines.append("")
    lines.append("## Confusion (truth × decision), all scored rows")
    for (t, d), n in sorted(out.get("all", {}).get("confusion", {}).items()):
        lines.append(f"- {t} × {d}: {n}")
    text = "\n".join(lines) + "\n"
    open(a.out, "w").write(text)
    print(text)
    print(f"written: {a.out}", file=sys.stderr)

if __name__ == "__main__":
    main()
