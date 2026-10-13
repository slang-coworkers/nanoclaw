#!/usr/bin/env python3
"""Evidence bundle for a nightly compile-perf alert.

When the nightly confirms a regression, someone has to answer the same
questions every time: is it real or noise, which counters moved and across how
many workloads, and which commits between last night's build and tonight's could
have caused it. This script answers the measurable parts deterministically and
writes them as one JSON bundle (plus a Markdown rendering), so the analyst
starts from numbers instead of redoing the arithmetic by hand.

It consumes what the nightly already produced and never re-derives the alert:

  daily/<label>/results.json       tonight's original sweep
  daily/<label>/confirmation.json  the frozen baseline, the flagged candidates
                                   and the rerun (written by confirm.py)
  daily/<label>/meta.json          commit, runner

and reuses confirm.confirmed_changes and analyze.canonical_runs, so "flagged",
"confirmed" and "comparable" mean exactly what they mean in the alert.

What the bundle contains, per flagged counter:
  - the baseline's per-night medians/mins/maxes next to tonight's original and
    rerun samples, so a median that moved only because of slow outliers is
    visible as such (`tail-only`, `bimodal-history`);
  - a coarse hint -- a description of the evidence, not a verdict.
Across the whole sweep:
  - a per-timer shift table (median ratio over every comparable workload, with
    a leave-one-night-out null so ordinary night-to-night movement is not
    reported as a shift). One timer moving ~8% in nearly every workload while
    its neighbours stay flat is the signature of a fixed per-compile cost, as
    opposed to a defect in one workload's code path.
For attribution it supplies the full base/head commit range from the archived
metadata. The agent bisects that range and verifies the culprit against its
parent before collecting PR intent or diffs. Triage never fetches candidate PRs.

This copy lives in the slang-perf-analyst skill and runs inside the coworker
container. It reads the perf suite's own modules (confirm.py, lib/analyze.py) from
a slang checkout, so "flagged", "confirmed" and "comparable" always mean what the
suite at that revision means. Point SLANG_COMPILE_PERF_DIR at the checkout's
tools/compile-perf. The module refuses to import without it rather than carry a
second copy of the suite's logic that could drift.

All inputs are staged files; this script makes no network or git calls.

    SLANG_COMPILE_PERF_DIR=<slang>/tools/compile-perf \\
      python3 triage.py --results <perf-results> --out-json bundle.json --out-md bundle.md
"""
import argparse
import json
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SUITE_ENV = "SLANG_COMPILE_PERF_DIR"
_suite = os.environ.get(SUITE_ENV, "")
if _suite:
    sys.path.insert(0, _suite)
sys.path.insert(0, HERE)
try:
    import confirm
    from lib import analyze
except ImportError as exc:
    raise ImportError(
        f"triage.py needs the perf suite: set {SUITE_ENV} to a slang checkout's "
        f"tools/compile-perf (could not import: {exc})") from exc

SCHEMA_VERSION = 3

# Provenance a baseline night must share with tonight's row before the two are
# compared. Same rule as trend.py: a missing field is never evidence of equality.
PROVENANCE_FIELDS = ("size", "timer_schema", "sampling_strategy")

# A timer's baseline median must reach this before the shift table uses it. A
# 0.05 ms timer moving 20% is quantization, not a shift.
SHIFT_FLOOR_MS = 5.0
SHIFT_MIN_WORKLOADS = 5
SHIFT_MIN_RATIO = 1.02
# A shift must clear the biggest ordinary night-to-night movement by this much.
SHIFT_NULL_MARGIN = 0.005
OVER_RATIO = 1.03

# Heuristic knobs for the per-counter hint.
TAIL_NIGHT_RATIO = 1.25  # a night's max over its own median marks a slow tail
TAIL_FRACTION_BIMODAL = 0.3
MIN_SHIFT_RATIO = 1.03
TAIL_REACHED = 0.95

class TriageError(Exception):
    """A condition the caller should report, not a bug."""


# --------------------------------------------------------------------- loading

def load_rows(results_dir, label):
    """{workload: canonical ok row} for `label`'s original sweep."""
    path = analyze.results_path(results_dir, label)
    return {r["workload"]: r for r in analyze.canonical_runs(analyze.read_json(path))
            if r.get("ok") and r.get("timers")}


def daily_points(results_dir):
    return analyze.daily_labels(results_dir)


def pick_point(points, label=None, commit=None):
    """The daily point to analyze: by label, by commit (newest match), or newest."""
    if label:
        for p in points:
            if p["label"] == label:
                return p
        raise TriageError(f"no daily point labelled {label!r}")
    if commit:
        hits = [p for p in points if p["commit"] and (p["commit"].startswith(commit)
                                                      or commit.startswith(p["commit"]))]
        if not hits:
            raise TriageError(f"no daily point for commit {commit}")
        return max(hits, key=lambda p: (p["date"], p["label"]))
    if not points:
        raise TriageError("no daily points in the results directory")
    return max(points, key=lambda p: (p["date"], p["label"]))


def comparable(a, b):
    return all(a.get(f) is not None and a.get(f) == b.get(f) for f in PROVENANCE_FIELDS)


def stat(row, counter):
    st = (row.get("timers") or {}).get(counter)
    return st if st and st.get("samples") else None


def load_policy(path):
    """The signed policy (PERF_POLICY.json): `{}` if absent, so a missing file never
    stops an analysis. The policy_version it carries is echoed into the bundle so a
    decision can be tied to the policy it was made under."""
    if path and os.path.exists(path):
        return analyze.read_json(path)
    return {}


def known_flaky_of(policy):
    return dict(policy.get("known_flaky") or {})


# ------------------------------------------------------------ flagged counters

def _summ(st):
    return {"median": st["median"], "min": st["min"], "max": st["max"],
            "stdev": st.get("stdev"), "samples": st["samples"]}


def counter_evidence(workload, counter, cur_row, rerun_row, base_rows, known_flaky):
    """Evidence for one flagged counter, and a coarse hint about what it shows."""
    hist = [stat(r, counter) for r in base_rows if comparable(r, cur_row)]
    hist = [h for h in hist if h]
    cur, rer = stat(cur_row, counter), (stat(rerun_row, counter) if rerun_row else None)
    ev = {"workload": workload, "counter": counter,
          "original": _summ(cur) if cur else None,
          "rerun": _summ(rer) if rer else None,
          "history": {"nights": len(hist),
                      "medians": [h["median"] for h in hist],
                      "mins": [h["min"] for h in hist],
                      "maxes": [h["max"] for h in hist]},
          "hint": "insufficient-history", "hint_detail": ""}
    if len(hist) < 3 or not cur:
        return ev
    base_med = statistics.median(ev["history"]["medians"])
    base_min = statistics.median(ev["history"]["mins"])
    tail_nights = sum(1 for h in hist if h["median"] > 0 and h["max"] / h["median"] > TAIL_NIGHT_RATIO)
    tail_fraction = tail_nights / len(hist)
    ev["baseline_median"], ev["baseline_min"] = base_med, base_min
    ev["tail_fraction"] = round(tail_fraction, 2)
    ev["ratios"] = {
        "original_median": cur["median"] / base_med,
        "original_min": cur["min"] / base_min,
        "rerun_median": rer["median"] / base_med if rer else None,
        "rerun_min": rer["min"] / base_min if rer else None}
    best_min = min(x["min"] for x in (cur, rer) if x)
    worst_min = max(x["min"] for x in (cur, rer) if x)
    tail_reached = max(ev["history"]["maxes"]) >= TAIL_REACHED * worst_min
    shifted = best_min / base_min >= MIN_SHIFT_RATIO
    key = f"{workload}|{counter}"
    if key in known_flaky:
        ev["hint"], ev["hint_detail"] = "known-flaky", known_flaky[key]
    elif tail_fraction >= TAIL_FRACTION_BIMODAL and tail_reached:
        ev["hint"] = "bimodal-history"
        ev["hint_detail"] = (f"{tail_nights} of {len(hist)} baseline nights already contain "
                             f"samples as slow as tonight's fastest")
    elif shifted:
        ev["hint"] = "min-shifted"
        ev["hint_detail"] = "even the fastest sample in each batch is slower than the baseline's"
    else:
        ev["hint"] = "tail-only"
        ev["hint_detail"] = "the median rose but the fastest samples did not"
    return ev


def flagged_counters(plan, original_rows, repeated_rows, base_by_label, known_flaky):
    """One record per candidate in the frozen plan, with the alert's own outcome."""
    outcome, notes = {}, []
    try:
        errors, warnings, cleared = confirm.confirmed_changes(plan, original_rows, repeated_rows)
        for tier, items in (("error", errors), ("warning", warnings), ("cleared", cleared)):
            for ch in items:
                outcome[(ch.workload, ch.counter)] = tier
    except ValueError as exc:
        notes.append(f"confirmation could not be evaluated: {exc}")
    cur = {r["workload"]: r for r in analyze.canonical_runs(original_rows) if r.get("ok")}
    rer = {r["workload"]: r for r in analyze.canonical_runs(repeated_rows) if r.get("ok")}
    out = []
    for tier, key in (("error", "regressions"), ("warning", "warnings")):
        for row in plan.get(key, []):
            wl, counter = row["workload"], row["counter"]
            if wl not in cur:
                notes.append(f"{wl}/{counter}: workload missing from the original sweep")
                continue
            base_rows = [b[wl] for b in base_by_label.values() if wl in b]
            ev = counter_evidence(wl, counter, cur[wl], rer.get(wl), base_rows, known_flaky)
            ev.update({"initial_tier": tier,
                       "outcome": outcome.get((wl, counter), "cannot-evaluate"),
                       "plan_baseline": row.get("baseline"), "plan_value": row.get("value")})
            out.append(ev)
    return out, notes


# --------------------------------------------------------------- shift analysis

def _timer_stat(cur_rows, base_rows_list, timer):
    """Median over workloads of tonight/baseline, using medians and mins."""
    meds, mins, over = [], [], 0
    for wl, cur in cur_rows.items():
        c = stat(cur, timer)
        if not c:
            continue
        hist = [stat(b[wl], timer) for b in base_rows_list
                if wl in b and comparable(b[wl], cur)]
        hist = [h for h in hist if h]
        if len(hist) < 4:
            continue
        bm = statistics.median(h["median"] for h in hist)
        if bm < SHIFT_FLOOR_MS:
            continue
        r = c["median"] / bm
        meds.append(r)
        mins.append(c["min"] / statistics.median(h["min"] for h in hist))
        over += r > OVER_RATIO
    if len(meds) < SHIFT_MIN_WORKLOADS:
        return None
    return {"n": len(meds), "median_ratio": statistics.median(meds),
            "min_ratio": statistics.median(mins), "share_over": over / len(meds)}


def shift_table(cur_rows, base_by_label):
    """Per-timer shift across workloads, each judged against its own null.

    The null for a timer is the same statistic computed for every baseline night
    against the other baseline nights. Tonight's statistic is only called a shift
    when it clears the largest of those by SHIFT_NULL_MARGIN: a night that is
    uniformly 3% slow for reasons unrelated to the code shows up in the null too.
    """
    labels = sorted(base_by_label)
    timers = sorted({t for r in cur_rows.values() for t in r["timers"]})
    table = []
    for timer in timers:
        tonight = _timer_stat(cur_rows, list(base_by_label.values()), timer)
        if not tonight:
            continue
        null = []
        for held_out in labels:
            others = [base_by_label[l] for l in labels if l != held_out]
            s = _timer_stat(base_by_label[held_out], others, timer)
            if s:
                null.append(s["median_ratio"])
        tonight["null_max"] = max(null) if null else None
        tonight["null_nights"] = len(null)
        tonight["significant"] = bool(
            null and tonight["median_ratio"] >= SHIFT_MIN_RATIO
            and tonight["median_ratio"] > max(null) + SHIFT_NULL_MARGIN
            and tonight["share_over"] >= 0.5)
        tonight["timer"] = timer
        table.append(tonight)
    table.sort(key=lambda t: t["median_ratio"], reverse=True)
    return table


# ---------------------------------------------------------------- whole-compile impact

REAL_WORLD_BUCKETS = ("real_world",)


def bucket_summary(cur_rows, base_by_label):
    """Whole-compile effect per bucket, and the realistic workloads in detail.

    A regression in one phase matters to users as a share of the whole compile, so
    this reports compileInner and wall time ratios per bucket and, for the
    real-world bucket, how much of each compile the front end and semantic checking
    are. The caller multiplies a phase's shift by its share; the bundle supplies both.
    """
    def ratio(cur, base_rows, getter):
        hist = [getter(b) for b in base_rows if comparable(b, cur)]
        hist = [h for h in hist if h]
        c = getter(cur)
        if len(hist) < 4 or not c:
            return None
        base = statistics.median(hist)
        return c / base if base > 0 else None

    inner = lambda r: (stat(r, "compileInner") or {}).get("median")
    wall = lambda r: (r.get("wall_ms") or {}).get("median")
    buckets = {}
    for wl, cur in cur_rows.items():
        base_rows = [b[wl] for b in base_by_label.values() if wl in b]
        entry = buckets.setdefault(cur.get("bucket", "?"), {"inner": [], "wall": []})
        for key, getter in (("inner", inner), ("wall", wall)):
            r = ratio(cur, base_rows, getter)
            if r is not None:
                entry[key].append((r, wl))
    out = []
    for name, e in sorted(buckets.items()):
        item = {"bucket": name, "workloads": max(len(e["inner"]), len(e["wall"]))}
        for key, label in (("inner", "compileInner"), ("wall", "wall")):
            vals = sorted(e[key], reverse=True)
            item[f"{label}_median_ratio"] = statistics.median(v for v, _ in vals) if vals else None
            item[f"{label}_worst"] = {"ratio": vals[0][0], "workload": vals[0][1]} if vals else None
        out.append(item)
    detail = []
    for wl, cur in sorted(cur_rows.items()):
        if cur.get("bucket") not in REAL_WORLD_BUCKETS:
            continue
        base_rows = [b[wl] for b in base_by_label.values() if wl in b]
        total = inner(cur)
        entry = {"workload": wl, "compileInner": {"ratio": ratio(cur, base_rows, inner)},
                 "wall": {"ratio": ratio(cur, base_rows, wall)}}
        for t in ("frontEndExecute", "SemanticChecking"):
            st = stat(cur, t)
            entry[f"{t}_share_of_compile"] = st["median"] / total if st and total else None
            entry[f"{t}_ratio"] = ratio(cur, base_rows, lambda r, t=t: (stat(r, t) or {}).get("median"))
        detail.append(entry)
    return out, detail


# ---------------------------------------------------------------- commit range

def prefix_equal(a, b):
    return bool(a and b and (a.startswith(b) or b.startswith(a)))


def resolve_range(points_by_label, current, baseline_labels):
    """(base_point, same_commit) -- the newest baseline night built from a
    different commit than tonight's, or None when every baseline night shares it."""
    cands = [points_by_label[l] for l in baseline_labels if l in points_by_label]
    cands.sort(key=lambda p: (p["date"], p["label"]), reverse=True)
    for p in cands:
        if not prefix_equal(p["commit"], current["commit"]):
            return p
    return None


# ---------------------------------------------------------------------- driver

def build_bundle(results_dir, label=None, commit=None, known_flaky=None, policy=None):
    points = daily_points(results_dir)
    cur = pick_point(points, label, commit)
    label = cur["label"]
    ddir = analyze.results_dir_for(results_dir, label)
    bundle = {"schema": SCHEMA_VERSION, "policy_version": (policy or {}).get("policy_version"), "label": label, "commit": cur["commit"],
              "date": cur["date"], "has_candidates": False, "flagged": [],
              "global_shifts": [], "top_movers": [], "buckets": [], "real_world": [],
              "commit_range": None, "bisect_points": [], "notes": []}
    cpath = os.path.join(ddir, "confirmation.json")
    if not os.path.exists(cpath):
        bundle["notes"].append("no confirmation.json for this night: nothing was flagged, or the "
                               "confirmation step did not run")
        return bundle
    conf = analyze.read_json(cpath)
    plan = conf.get("plan") or {}
    bundle.update({"runner": plan.get("runner", ""), "thresholds": plan.get("thresholds", {}),
                   "baseline_labels": plan.get("baseline_labels", []), "confirmation_status": conf.get("status")})
    n_candidates = len(plan.get("regressions", [])) + len(plan.get("warnings", []))
    bundle["has_candidates"] = n_candidates > 0
    if not n_candidates:
        bundle["notes"].append("the frozen plan has no candidates")
        return bundle

    original_rows = analyze.read_json(analyze.results_path(results_dir, label))
    cur_rows = load_rows(results_dir, label)
    pts = {p["label"]: p for p in points}
    base_by_label = {}
    for bl in bundle["baseline_labels"]:
        if bl in pts:
            base_by_label[bl] = load_rows(results_dir, bl)
        else:
            bundle["notes"].append(f"baseline night {bl} is not on disk")

    flagged, notes = flagged_counters(plan, original_rows, conf.get("repeated", []),
                                      base_by_label, known_flaky or {})
    bundle["flagged"], bundle["notes"] = flagged, bundle["notes"] + notes

    table = shift_table(cur_rows, base_by_label) if len(base_by_label) >= 4 else []
    if not table:
        bundle["notes"].append("fewer than 4 comparable baseline nights: no shift table")
    bundle["global_shifts"] = [t for t in table if t["significant"]]
    bundle["top_movers"] = table[:8]

    if base_by_label:
        bundle["buckets"], bundle["real_world"] = bucket_summary(cur_rows, base_by_label)

    base_pt = resolve_range(pts, cur, bundle["baseline_labels"])
    if base_pt is None:
        bundle["notes"].append("tonight was built from the same commit as every baseline night: "
                               "any difference is measurement variation, not a code change")
        bundle["commit_range"] = {"same_commit": True}
        return bundle
    bundle["commit_range"] = {"same_commit": False, "base_label": base_pt["label"],
                              "base_commit": base_pt["commit"], "head_commit": cur["commit"]}
    # Every intervening commit remains eligible; git bisect selects builds.
    bundle["bisect_points"] = [base_pt["commit"], cur["commit"]]
    return bundle


# ------------------------------------------------------------------- rendering

def _f(x, nd=1):
    return "-" if x is None else f"{x:.{nd}f}"


def render_markdown(b):
    out = [f"# Compile-perf triage: {b['label']}", ""]
    out.append(f"commit `{(b.get('commit') or '')[:9]}`, runner `{b.get('runner', '?')}`, "
               f"baseline {len(b.get('baseline_labels', []))} nights")
    out.append("")
    if not b["has_candidates"]:
        out += ["No candidates were flagged for this night.", ""] + [f"- {n}" for n in b["notes"]]
        return "\n".join(out) + "\n"
    out += ["## Flagged counters", "",
            "| workload | counter | alert outcome | baseline | original (med/min) | rerun (med/min) | hint |",
            "|---|---|---|---|---|---|---|"]
    severity = {"error": 0, "warning": 1, "cannot-evaluate": 2, "cleared": 3}
    for f in sorted(b["flagged"], key=lambda f: severity.get(f["outcome"], 9)):
        o, r = f["original"], f["rerun"]
        out.append(f"| {f['workload']} | {f['counter']} | {f['outcome']} | {_f(f.get('baseline_median'))} | "
                   f"{_f(o and o['median'])}/{_f(o and o['min'])} | {_f(r and r['median'])}/{_f(r and r['min'])} | "
                   f"{f['hint']} |")
    details = [f"- `{f['workload']}/{f['counter']}`: {f['hint']} -- {f['hint_detail']}"
               for f in b["flagged"]
               if f["hint_detail"] and f["hint"] in ("known-flaky", "bimodal-history")]
    if details:
        out += [""] + details
    out += ["", "## Timers that shifted across workloads", ""]
    if b["global_shifts"]:
        out += ["| timer | workloads | median ratio | min ratio | share >3% | night-to-night max |",
                "|---|---|---|---|---|---|"]
        for t in b["global_shifts"]:
            out.append(f"| {t['timer']} | {t['n']} | {t['median_ratio']:.3f} | {t['min_ratio']:.3f} | "
                       f"{t['share_over']:.2f} | {_f(t['null_max'], 3)} |")
    else:
        out.append("None clears the night-to-night null.")
    out += ["", "Largest movers regardless of significance:", ""]
    out += [f"- {t['timer']}: {t['median_ratio']:.3f} over {t['n']} workloads"
            f" (null max {_f(t['null_max'], 3)})" for t in b["top_movers"][:5]]
    if b.get("real_world"):
        out += ["", "## Real-world workloads (whole-compile effect)", "",
                ("Ratios are from the original sweep only. Check any flagged counter of the same "
                 "workload against its rerun before relying on a single-night ratio."), "",
                "| workload | compileInner | wall | front end share | semantic checking share | semantic ratio |",
                "|---|---|---|---|---|---|"]
        for r in b["real_world"]:
            out.append(f"| {r['workload']} | {_f(r['compileInner']['ratio'], 3)} | {_f(r['wall']['ratio'], 3)} | "
                       f"{_f(r['frontEndExecute_share_of_compile'], 2)} | "
                       f"{_f(r['SemanticChecking_share_of_compile'], 2)} | {_f(r['SemanticChecking_ratio'], 3)} |")
    cr = b["commit_range"] or {}
    out += ["", "## Commit range", ""]
    if cr.get("same_commit"):
        out.append("Same commit as every baseline night: a measurement difference, not a code change.")
    elif cr:
        out.append(f"{cr['base_commit'][:9]} ({cr['base_label']}) .. {cr['head_commit'][:9]}")
        out += ["", "Bisect endpoints: " + ", ".join(s[:9] for s in b["bisect_points"]),
                ("Measure these endpoints, bisect the full interval, and verify the culprit "
                 "against its immediate parent before collecting PR intent.")]
    if b["notes"]:
        out += ["", "## Notes", ""] + [f"- {n}" for n in b["notes"]]
    return "\n".join(out) + "\n"


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--results", required=True, help="perf-results checkout")
    ap.add_argument("--label", help="daily label to analyze (default: newest)")
    ap.add_argument("--commit", help="analyze the newest night built from this commit")
    ap.add_argument("--policy", default=os.path.join(HERE, "PERF_POLICY.json"),
                    help="signed policy (known-flaky counters, filing rules); an absent file is {}")
    ap.add_argument("--out-json")
    ap.add_argument("--out-md")
    args = ap.parse_args(argv)
    policy = load_policy(args.policy)
    try:
        bundle = build_bundle(args.results, args.label, args.commit, known_flaky_of(policy), policy)
    except TriageError as exc:
        print(f"triage: {exc}", file=sys.stderr)
        return 2
    md = render_markdown(bundle)
    if args.out_json:
        with analyze.open_output(args.out_json) as fh:
            json.dump(bundle, fh, indent=2)
    if args.out_md:
        with analyze.open_output(args.out_md) as fh:
            fh.write(md)
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
