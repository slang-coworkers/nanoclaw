#!/usr/bin/env python3
"""Interleaved A/B of several slangc builds on the perf suite's own workloads.

Each round runs every build once per workload set, in the same order, so slow drift
on a shared host (another container building, thermal state) lands on all builds
equally. Per-build, per-(workload, counter) samples are pooled across rounds. The
report gives median and min and a ratio against the first build, plus a step column
(the ratio against the previous build) so a regression shows up as a step at one
commit.

`--aa` runs the SAME binary twice as two labels: the spread between them is the
noise floor of this host, and if it exceeds the policy's aa_max_spread_pct the
wall-clock A/B that follows is not trustworthy here.

Inputs are produced by the perf suite: `bench.py --prepare <dir>` writes a corpus once
so every build compiles identical sources; this script then drives `bench.py --corpus`.
Needs SLANG_COMPILE_PERF_DIR (a slang checkout's tools/compile-perf) for bench.py.

    ab.py --corpus corpus --only conformance,overload_resolution \\
          --counters SemanticChecking,frontEndExecute,compileInner --rounds 12 \\
          base=snap/base/bin/slangc c1=snap/c1/bin/slangc c2=snap/c2/bin/slangc
"""
import argparse
import json
import os
import statistics
import subprocess
import sys
import tempfile


def collect(results_json, counters, into):
    """Pool each counter's raw samples from one bench.py results.json into `into`."""
    with open(results_json, encoding="utf-8") as fh:
        rows = json.load(fh)
    for row in rows:
        if not row.get("ok") or not row.get("timers"):
            continue
        for counter in counters:
            st = row["timers"].get(counter)
            if st and st.get("samples"):
                into.setdefault((row["workload"], counter), []).extend(st["samples"])


def summarize(pooled, labels):
    """[{workload, counter, per_label: {label: {median, min, n}}, ratios, steps}].

    `ratios[label]` is the median over the first label's median; `steps[label]` is the
    median over the previous label's median. Keys with a missing label are dropped
    rather than compared against a partial set.
    """
    keys = sorted({k for p in pooled.values() for k in p})
    out = []
    for key in keys:
        if any(key not in pooled[l] or not pooled[l][key] for l in labels):
            continue
        per = {l: {"median": statistics.median(pooled[l][key]), "min": min(pooled[l][key]),
                   "n": len(pooled[l][key])} for l in labels}
        base = per[labels[0]]["median"]
        ratios = {l: (per[l]["median"] / base if base > 0 else None) for l in labels}
        steps = {}
        for prev, cur in zip(labels, labels[1:]):
            p = per[prev]["median"]
            steps[cur] = per[cur]["median"] / p if p > 0 else None
        out.append({"workload": key[0], "counter": key[1], "per_label": per,
                    "ratios": ratios, "steps": steps})
    return out


def spread_pct(summary, label_a, label_b):
    """Largest |median ratio - 1| between two labels of the same binary, in percent."""
    worst = 0.0
    for row in summary:
        a, b = row["per_label"][label_a]["median"], row["per_label"][label_b]["median"]
        if a > 0:
            worst = max(worst, abs(b / a - 1.0) * 100.0)
    return worst


def run_bench(bench, slangc, label, out_dir, corpus, only, samples):
    cmd = [sys.executable, bench, "--slangc", slangc, "--label", label, "--out", out_dir,
           "--samples", str(samples), "--only", only, "--corpus", corpus]
    return subprocess.run(cmd, capture_output=True, text=True)


def find_results(out_dir):
    for root, _, files in os.walk(out_dir):
        if "results.json" in files:
            return os.path.join(root, "results.json")
    return None


def render(summary, labels):
    head = f"{'workload':28s}{'counter':20s}" + "".join(f"{l:>20s}" for l in labels)
    lines = [head + "   last/first"]
    for r in summary:
        cells = "".join(f"{r['per_label'][l]['median']:11.2f}/{r['per_label'][l]['min']:8.2f}" for l in labels)
        lines.append(f"{r['workload']:28s}{r['counter']:20s}{cells}   {r['ratios'][labels[-1]]:.3f}")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("builds", nargs="+", help="label=path/to/slangc, in commit order (first is the base)")
    ap.add_argument("--corpus", required=True, help="directory written by bench.py --prepare")
    ap.add_argument("--only", required=True, help="comma-separated workloads")
    ap.add_argument("--counters", default="SemanticChecking,frontEndExecute,compileInner")
    ap.add_argument("--rounds", type=int, default=12)
    ap.add_argument("--samples", type=int, default=5, help="samples per bench.py run")
    ap.add_argument("--aa", action="store_true", help="run the first build twice as base and base-again")
    ap.add_argument("--json", dest="json_out")
    args = ap.parse_args(argv)

    suite = os.environ.get("SLANG_COMPILE_PERF_DIR")
    if not suite:
        sys.exit("ab.py: set SLANG_COMPILE_PERF_DIR to a slang checkout's tools/compile-perf")
    bench = os.path.join(suite, "bench.py")

    builds = [b.split("=", 1) for b in args.builds]
    if args.aa:
        builds = [(builds[0][0], builds[0][1]), (builds[0][0] + "-again", builds[0][1])]
    labels = [l for l, _ in builds]
    counters = args.counters.split(",")
    pooled = {l: {} for l in labels}
    with tempfile.TemporaryDirectory() as scratch:
        for rnd in range(args.rounds):
            for label, slangc in builds:  # same order every round: interleaved
                out = os.path.join(scratch, f"{label}-{rnd}")
                proc = run_bench(bench, slangc, f"{label}{rnd}", out, args.corpus, args.only, args.samples)
                path = find_results(out)
                if proc.returncode != 0 or not path:
                    sys.exit(f"ab.py: bench failed for {label} round {rnd}:\n{proc.stdout[-400:]}{proc.stderr[-400:]}")
                collect(path, counters, pooled[label])
    summary = summarize(pooled, labels)
    print(render(summary, labels))
    result = {"labels": labels, "rounds": args.rounds, "summary": summary}
    if args.aa:
        result["aa_spread_pct"] = spread_pct(summary, labels[0], labels[1])
        print(f"\nA/A spread (largest median difference between the two identical runs): "
              f"{result['aa_spread_pct']:.2f}%")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
