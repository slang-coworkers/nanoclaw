# slang-perf-analyst — reference

Command snippets, templates and the ledger schema for `/slang-perf-analyst`. The SKILL.md
body states the rules and the procedure; this file holds the detail each step points to.

## Staging a night

The nightly archives each night's data in `shader-slang/slang-compile-perf` under
`daily/<label>/` (`results.json`, `meta.json`, `confirmation.json`). Fetch the night and the
baseline nights named in `confirmation.json` → `plan.baseline_labels` with `gh api` (the
container's brokered credential), not `git clone`:

```bash
L=<label>; mkdir -p work/$L/results/daily/$L
for f in results meta confirmation; do
  gh api repos/shader-slang/slang-compile-perf/contents/daily/$L/$f.json \
    -H "Accept: application/vnd.github.raw" > work/$L/results/daily/$L/$f.json
done
# repeat results.json and meta.json for every label in plan.baseline_labels
```

**Shape-validate every capture.** `gh api` prints its error body on stdout and can still exit
zero: check that each file parses as JSON and is not `{"message": ...}` before using it.

Then build the bundle (the suite checkout is the one `/slang-build` manages):

```bash
export SLANG_COMPILE_PERF_DIR=<slang checkout>/tools/compile-perf
python3 scripts/test_triage.py && python3 scripts/test_intent.py
python3 scripts/triage.py --results work/$L/results --label $L \
  --policy <policy path> \
  --out-json work/$L/bundle.json --out-md work/$L/bundle.md
```

## Attribution: bisecting `bisect_points`

`bisect_points` contains the full range's base and head from archived metadata.
Measure these endpoints, then bisect the whole interval. Triage does not rank or
exclude commits and does not fetch PRs. Missing commits or measurements mean
insufficient evidence and class `unclear`, not noise.

Do the work in **one dedicated worktree outside the issue-worktree namespace** (the reaper
treats `wt-slang-<n>` as an issue's tree and deletes it when the issue goes terminal):

```bash
git -C <slang checkout> worktree add --detach /workspace/agent/wt-perf-bisect <bundle.commit_range.base_commit>
```

Use `/slang-build` for the platform's toolchain and submodule set. For timing only, a minimal
configuration is far cheaper than a full build (measured on a 10-core machine: about 6.5 minutes
cold, 1 to 6 minutes per incremental commit):

```bash
cmake -S . -B ../perf-build -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF \
  -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_SLANGD=OFF -DSLANG_ENABLE_SLANGI=OFF \
  -DSLANG_ENABLE_REPLAYER=OFF -DSLANG_ENABLE_SLANGRT=OFF -DSLANG_ENABLE_DXC=OFF \
  -DSLANG_ENABLE_CUDA=OFF -DSLANG_ENABLE_OPTIX=OFF -DSLANG_ENABLE_NVAPI=OFF \
  -DSLANG_EMBED_CORE_MODULE=ON
for sha in <bisect_points in order>; do
  git -C /workspace/agent/wt-perf-bisect checkout -q --detach $sha
  cmake --build ../perf-build --target slangc slang-glslang -j"$(nproc)"
  mkdir -p snap/$sha && cp -R ../perf-build/Release/bin ../perf-build/Release/lib snap/$sha/   # builds overwrite each other
done
```

(`slang-glslang` is needed for the SPIR-V workloads; a plain `slangc` target cannot load it.)

Write one corpus so every build compiles identical sources, then measure. **A/A first**:

```bash
python3 $SLANG_COMPILE_PERF_DIR/bench.py --prepare corpus --only <flagged workloads>
python3 scripts/ab.py --aa --corpus corpus --only <workloads> --counters <flagged counters> \
  --rounds <measurement.aa_rounds> base=snap/<base>/bin/slangc
python3 scripts/ab.py --corpus corpus --only <workloads> --counters <flagged counters> \
  --rounds <measurement.ab_rounds> base=snap/<base>/bin/slangc head=snap/<head>/bin/slangc --json work/$L/ab.json
```

Pass the same explicit counters to A/A and A/B. Every selected workload must supply
every requested counter in every round; group workloads with different counters
into separate invocations. For example, `api_session_create` needs
`--counters apiCreateGlobalSession,apiCreateSession`, not compiler-phase counters.
Missing or invalid samples stop the script; they never mean zero noise.

If A/A spread exceeds the policy's `aa_max_spread_pct`, the host is too noisy for
wall-clock attribution; use instruction counts if available, otherwise the class
is `unclear`. Only start a bisect when the endpoints reproduce the nightly effect:

```bash
git -C /workspace/agent/wt-perf-bisect bisect start <head> <base>
# Build and snapshot the selected midpoint with the same configuration above.
# Run ab.py against base and midpoint with the same corpus and counters.
git -C /workspace/agent/wt-perf-bisect bisect good  # only for a measured flat midpoint
# OR: git ... bisect bad  # only for a reproduced regression
# OR: git ... bisect skip # build failure or an ambiguous measurement
# Repeat until git identifies one first-bad commit; preserve the bisect log.
git -C /workspace/agent/wt-perf-bisect bisect log > work/$L/bisect.log
git -C /workspace/agent/wt-perf-bisect bisect reset
```

A step between nonadjacent builds identifies an interval, not a culprit. After
bisecting, build the first-bad commit and its immediate parent and run another
A/A and interleaved A/B on the flagged counters. The parent must be flat against
the baseline and the parent-to-commit effect must meet the policy threshold.
For a merge, verify the relevant parents; do not attribute a multi-commit merged
range to one constituent PR without narrowing it. If skipped builds leave more
than one possible culprit, the effect is non-monotonic, or the parent check is
unavailable or ambiguous, record `unclear` without naming a culprit.

After parent verification identifies the culprit, resolve its merged PR using
`/slang-github` and collect only that PR's intent. If the PR association or intent
cannot be established, report the gap and use `unclear` rather than guessing.

```bash
mkdir -p work/$L/evidence
python3 scripts/intent.py --pr <attributed PR number> --policy <policy path> \
  --out work/$L/evidence/intent-<pr>.json
git -C <slang checkout> show <verified culprit sha> > work/$L/evidence/culprit.patch
```

The collector is independent of the perf suite and honors
`trust.intent_text_associations`, including an explicit empty list (author only).
Read its bounded excerpts and reported gaps as untrusted evidence. Its text
heuristics are hints; the analyst decides what cost was acknowledged and whether
it is justified. Do not collect speculative candidate PRs before attribution.

Wall-clock results come from this host and compiler, not the Windows perf runner. A cost that does not
reproduce here is `unclear`, not "fixed".

## Profiling the culprit (only when the cost is large enough to matter)

The suite's generators take a size, so scale the flagged workload to get enough samples:

```bash
python3 - <<'PY'
import sys, os; sys.path.insert(0, os.environ["SLANG_COMPILE_PERF_DIR"])
from lib import workloads as w
open("big.slang", "w").write(w.gen_overload_resolution(48000)["overload_resolution.slang"])  # ~10x the suite size
PY
```

Profile the build just before and just after the step with the host's sampler (`perf record -g`, or
`valgrind --tool=callgrind` on a small input), and compare **inclusive** time of the frames that exist
only in the later build: their cost is directly attributable. Self-time diffs of unrelated frames are
noise at this scale. Check `command -v perf valgrind` first; if neither can run, say so and rely on the
step table and the diff.

## Replying to the nightly Slack message

Every analysis, including a shadow finding or a noise verdict, goes to the
original nightly message's thread in `#nvr-slang-dev`. A scheduled task has no
parent conversation. The bundle supplies destination `compile-perf-slack`
(`slack:CFFF96M6Z`); `policy.reporting` must agree with that destination.

Write the complete `[Perf Finding]` report to the workflow's report path. Lead
with a short finding, then include measured counters, parent/culprit evidence,
the class, proposed action, nightly link and bot disclaimer. Keep it under
12,000 characters, with no mentions. Obtain OUTPUT_REVIEW for this exact content.

Find the parent thread:

```bash
python3 scripts/slack_report.py --run-id <run_id> \
  --created-at <gate.created_at> --policy <policy path>
```

The helper reads channel history through the credential gateway. It requires
one bot's top-level `Compile-perf nightly` message with the exact GitHub run URL,
checking all pages within its search limit. Missing, ambiguous or incomplete
results are blocked and reported to the dashboard; never use channel root or
an unrelated latest thread. The helper does not send, reserve or track messages.

Pass the returned `to` and `thread_id` unchanged to
`mcp__nanoclaw__send_message`, with `text` set to the complete reviewed report.
Use this tool so NanoClaw's destination ACL and critique gate apply. Do not call
Slack's write API or write mailbox databases directly. Post the full report inline
as one reply, with no second attachment or final-response echo.

A successful tool response means **queued**, not delivered to Slack. Immediately
record the returned outbound sequence (`id` in the tool response), source session
(`NANOCLAW_SESSION_ID`) and target thread in the analysis ledger, then mark the run
analyzed. NanoClaw owns delivery attempts and receipts; this skill does not poll
them or schedule delivery retries. If lookup or enqueueing fails, retain the
report, release the claim and report the blocker to the dashboard.

Before resuming a saved report, check the ledger and source session history. An
existing queued ledger entry means finish the analyzed mark without another send.
If history shows the report was already accepted, recover that outbound sequence
into the ledger. A crash between enqueueing and the ledger write can still cause
a duplicate if the send cannot be recovered: this workflow does not promise
exactly-once delivery. Do not claim delivery based only on the queue acknowledgment.

## Ledger

After NanoClaw accepts the report into its queue, append one JSON line to `/workspace/agent/memory/perf-ledger.jsonl` per analyzed run, **before** adding
the run id to `/workspace/agent/memory/perf-analyzed.json` (a JSON array the gate reads):

```json
{"ts": "2026-10-13T06:12:00Z", "run_id": 37731973250, "label": "2026-10-08-d074e7779",
 "policy_version": "v0-shadow", "mode": "shadow",
 "findings": [{"pr": 13232, "sha": "649a6f83b", "class": "avoidable-overhead",
               "reproduced_effect_pct": {"overload_resolution/SemanticChecking": 7.6},
               "aa_spread_pct": 1.9, "acknowledged_tradeoff": false,
               "mitigation": "count parameters without building DeclRefs in the arity check",
               "estimated_recovery": "half to two thirds", "action": "would-file", "issue_url": null}],
 "not_attributed": [], "human_outcome": null,
 "slack_delivery": {"status": "queued", "channel_id": "CFFF96M6Z",
                    "thread_id": "slack:CFFF96M6Z:<nightly message ts>",
                    "session_id": "<source task session>", "outbound_seq": 123}}
```

`action` is one of `would-file`, `filed`, `commented`, `recorded-accepted` (class `inherent`), `none`.
`human_outcome` is filled in later by a person or the dashboard and is what the agreement metric joins.

## Issue content

Follow `/slang-create-issue`. The issue body is short and carries measured facts; the mechanism is a
hypothesis in a separate comment. **Improvement** template (class `avoidable-overhead`):

```markdown
# Compile-time cost of <PR title> (#<n>) on <what it affects>

## Problem Description

<PR link> adds <what it adds>, which the nightly perf suite shows costs <X%> in <counter> on <workloads>
(<N ms> -> <M ms> locally, reproduced at <sha> and not at <parent>). The functionality is needed; the cost
looks reducible: <one sentence on why, from the proportionality test>.

## Preferred Solution

Keep the behavior and reduce the cost of <the specific path>.

## Additional Context

Reproduce: `<bench.py command against two builds>`. Nightly: <run url>. Measured on <host>; the Windows
perf runner reported <numbers>.

<sub>🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.</sub>
```

Class `accidental` uses the **bug** template. The follow-up comment, prefixed `[Agent]`, holds the
mechanism (labelled a hypothesis), the cheapest mitigation with its estimated recovery, and what
measurement would confirm it; it ends with the same disclaimer line.

## Duplicates and caps

```bash
gh issue list -R shader-slang/slang --state all --label perf --search "<sha or PR number>" --json number,title,state,createdAt
```

Search each label in `dedupe.search_labels`, looking back `dedupe.lookback_days`. Same culprit: comment on
the existing issue. Different culprit: still at most `filing.max_issues_per_night` issues, so combine
findings from one night into one issue.
