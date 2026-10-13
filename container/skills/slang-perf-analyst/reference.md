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
  --repo-dir <slang checkout> --github-repo shader-slang/slang \
  --policy <policy path> --evidence-dir work/$L/evidence \
  --out-json work/$L/bundle.json --out-md work/$L/bundle.md
```

## Attribution: bisecting `bisect_points`

`bisect_points` contains the full range's base and head. The commit ranking only
prioritizes reading; it never selects which commits are eligible to be the cause.
An empty ranking (for example, an API counter with no component mapping) still
requires measuring these endpoints. Missing commits or measurements mean
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

An attributed PR may be absent from `bundle.intent` because the ranking missed
it. Collect it with `intent.collect_intent(triage.GitHub("shader-slang/slang"), pr,
trusted)` using the selected policy's `trust.intent_text_associations` (the
default only when absent, preserving an explicit empty list). Save the returned
record alongside the bundle and fetch that commit's diff before classification.

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

Write the complete report to the workflow's report path. Lead with a short
finding, then include measured counters, the parent/culprit evidence, the class,
the proposed action, the nightly link and the bot disclaimer. Keep it under
12,000 characters, with no mentions. The full report is posted inline as one
thread reply; no second message or attachment is needed. Obtain OUTPUT_REVIEW
for this exact content before preparing delivery.

```bash
python3 scripts/slack_report.py prepare \
  --run-id <run_id> --created-at <gate.created_at> \
  --policy <policy path> --report <report path>
```

The helper reads the configured channel's history through the credential
gateway. It accepts only a bot's top-level `Compile-perf nightly` message with
the exact GitHub run URL, checking every page in the bounded time window. Zero
or multiple matches are blocked, never a reason to use the channel root or the
newest unrelated thread. Missing Slack history access is a setup error reported
to the dashboard. The helper also verifies the destination in the session's
read-only inbound mailbox before returning any send arguments.

Only a `ready` result grants one call to `mcp__nanoclaw__send_message`, passing
the returned `arguments` unchanged. It contains `to`, the adapter thread ID
`slack:<channel>:<parent-ts>`, and the full `[Perf Finding]` text. Use NanoClaw's
tool so its destination ACL and critique gate apply; never call Slack's write
API or write the outbound database directly. Do not echo this send in the final
response. The JSON reservation in `memory/perf-deliveries/<run_id>.json` is
written before the arguments are returned, serializing overlapping attempts.

After sending, check the host's receipt (a tool response alone only means queued):

```bash
python3 scripts/slack_report.py status --run-id <run_id>
```

- `delivered`: persist the returned channel, parent timestamp, source session,
  outbound message id and Slack platform message id in the analysis ledger.
- `queued`: the host still owns delivery. Recheck after its delivery poll or
  resume at the next task fire; never enqueue a second copy.
- `reserved`: the send has not been found in the source session's outbound
  mailbox. It may be in flight or the process may have died before enqueueing.
  Hold and report a new blocker to the dashboard; never blindly resend.
- `failed`: the host recorded delivery failure. Preserve the report and receipt
  for operator recovery; do not mark the analysis complete or resend it.

On retry, resume the saved delivery in its source task session rather than
repeating the analysis. The helper recovers a queued send by exact text and route
even if the process died before recording the outbound id. A stored successful
receipt survives mailbox history cleanup. Reserved/failed states defer the next
check by six hours; queued or delivered-but-not-recorded reports resume at the
next gate fire even after the nightly ages out of the GitHub lookback window.
Report only a new or changed blocker to the dashboard. Do not remove a reservation
to retry: an operator must inspect the source session and resolve any pending send
first. Only confirmed delivery plus the ledger write permits the analyzed-run mark.

This helper uses the SQLite session mailbox contract (`/workspace/inbound.db`
and `/workspace/outbound.db`) read-only. An unavailable or different mailbox
backend is a visible setup failure, never permission to bypass delivery tracking.

## Ledger

After confirmed Slack delivery, append one JSON line to `/workspace/agent/memory/perf-ledger.jsonl` per analyzed run, **before** adding
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
 "slack_delivery": {"channel_id": "CFFF96M6Z", "parent_ts": "<nightly message ts>",
                    "message_id": "<outbound id>", "platform_message_id": "<Slack receipt id>"}}
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
