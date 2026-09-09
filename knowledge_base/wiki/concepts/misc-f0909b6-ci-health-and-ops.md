---
title: CI Health, Monitoring, Staleness Signals, and Operational Hygiene
type: concept
group: misc
tags: [ci-health, monitoring, stale-data, nightly, sanitizer, github-app-token, slang-pr-report, doc-comments, review-comments]
source_count: 10
---

## TL;DR

Operational lessons for CI-health sweeps, log monitoring, and the tooling around them — mostly about
distinguishing a stale/cached signal from a real one, and probing the right thing before escalating.

- **A fresh CI frame does NOT imply the sibling feed is current** — the precheck's `ci_health` and
  `workflow_failures` refresh independently; sanity-check `created_at` against `date -u` before
  writing dated figures into a report.
- **A nightly/scheduled red streak can be a stale-build artifact** — pull `head_sha` per run; if the
  post-fix nights share one pre-fix SHA, the streak isn't evidence of an unfixed bug. A streak on
  MOVING SHAs is real.
- **A "frozen field" heuristic ("stop re-checking, it doesn't change") is valid only while the number
  stays constant** — the instant it changes, treat it as a fresh signal and re-investigate.
- **Loose grep against dense stream-json JSONL false-positives in both directions** — a single long
  line carries `is_error:false` PLUS unrelated `true`/`529`/UUID matches. Read the terminal state
  (artifact exists; last-line `"type":"result"` event) and cross-check liveness (a growing stream =
  alive = any error-string match is false by construction).
- **A GitHub App installation token 403 on `/user` (and 401 on `/rate_limit`) is NORMAL** — test the
  write path with the actual write, not a sibling probe; a blocker escalation is a claim, verify it
  with the operation itself.
- **A slang-test teardown heap corruption after a passing Vulkan test = an unjoined slang-rhi global
  worker pool (a teardown race), not an allocator mismatch** — clean under ASan + needs-many-threads
  + varying glibc message = race.
- **Select a skill script by CAPABILITY, not path/mtime** — two copies can exist at different
  versions; probe `--help` for the feature.
- **Source doc comments are client-facing** — no off-GitHub refs, no change-narration.
- **Endorse a bot-flagged finding, don't re-post it** — read the PR's existing bot reviews first.

## Stale vs live signals in CI-health sweeps

Three atoms are variations of "a red/frozen signal isn't what it looks like." A precheck
`workflow_failures` feed for slang returned entries dated over a month stale while the `ci_health`
frame in the same JSON blob was fresh (7 min) — the two fields refresh independently, so compare the
top entry's `created_at` against `date -u` and fall back to a direct
`actions/runs?status=failure` query (with a cache-buster; the endpoint caches 60s) when stale
([precheck workflow_failures feed can be stale even when ci_health frame is
fresh](../learnings/1787643303858-precheck-workflow-failures-feed-can-be-stale-even-.md)). A
nightly job red for 5 consecutive nights after its tracker closed turned out to have built the
08-22/23/24 runs on the SAME stale pre-fix master HEAD; the 08-25 nightly on fresh master went green —
the close was correct all along. Pull `head_sha` per run; a streak where the SHA MOVES each night and
stays red is genuinely persistent, one where post-fix nights share a pre-fix SHA is a stale-build
artifact ([nightly red streak can be a stale-build artifact, not a persistent
failure](../learnings/1787646011162-nightly-red-streak-can-be-a-stale-build-artifact-n.md)). And a
"this field is frozen/cached, stop re-checking" call is valid only while the number stays constant —
on the CI heartbeat a `merge_queue.failure` count read 1 unchanged across four wakes (correctly judged
frozen), then changed to 2; re-investigating anyway surfaced a genuine `test-falcor-perf`
artifact-download defect. The instant a believed-frozen numeric field changes, re-run full
investigation ([a frozen-field heuristic must re-arm when the number
changes](../learnings/1787606627212-a-frozen-field-heuristic-must-re-arm-when-the-numb.md)). A
companion coverage fact: before "fixing" a CI coverage gap by editing one workflow, grep ALL callers
of the reusable workflow and check each caller's defaults — the multi-server test-server transport
already runs under ASan on every PR because `ci.yml`'s call to `ci-slang-sanitizer.yml` uses the
default `server-count: 2`, so bumping the nightly's `server-count: 1` would remove unique in-process
coverage ([sanitizer multi-server transport already runs under ASan on PR
CI](../learnings/1787568663413-slang-sanitizer-multi-server-transport-already-run.md)).

## Read the terminal state; probe the actual operation

Loose grep against a claude `--print --output-format stream-json` log false-positives in both
directions: each event is ONE very long JSONL line, so `grep -qE 'is_error.*true'` matches a line
carrying `is_error:false` plus an unrelated `true`, and `grep 'API Error|529'` matches UUIDs,
timestamps, and source lines quoted inside a tool_result. Read the real terminal state instead — the
artifact exists (`[ -f final-review.md ]`), or the LAST line is the top-level `"type":"result"` event
— and cross-check liveness: if the stream is still growing and no final artifact exists, the run is
alive and any error-string match is a false positive by construction. Also, a `Monitor` appends to a
shared log across build attempts, so scope patterns to a per-attempt start marker ([monitor/grep false
positives against dense stream-json
JSONL](../learnings/1787576911893-monitor-grep-false-positives-against-dense-stream-.md)). The same
"probe the actual operation" discipline applies to GitHub write paths: a GitHub App installation token
(`nv-slang-bot[bot]`) legitimately returns 403 on `/user` and can 401 on `/rate_limit` via the OneCLI
proxy — these are NOT signs the token is invalid. A false GitHub-write BLOCKER was escalated to two
edges based on those probes, then the actual `POST .../comments` succeeded first try; test the write
path with the write you need (or a benign write-capable read like `GET .../issues/{n}`), never a
sibling probe ([GitHub App token 403 on /user is normal — not a broken write
path](../learnings/1787633494370-github-app-token-403-on-user-is-normal-not-a-broke.md)).

A harder diagnostic: a `slang-test` heap corruption that aborts at teardown after a passing Vulkan
test (varying glibc message each run, needs many threads, reproduces standalone but vanishes under gdb
and ASan) is a teardown RACE, not an allocator mismatch — slang-rhi's process-lifetime global worker
pool `s_globalTaskPool` is a leaked addRef'd pointer whose workers are joined only via
`rhiDestroyInstance()`, which no tool calls, so the workers are alive during static-destruction of
the render-test module. Two reusable discriminators: "ASan-tracked finding + clean ASan run ⇒ that
finding is NOT your bug" (clean-under-ASan + many-threads + varying-glibc-message = race, ASan's blind
spot), and mimalloc mixed-allocator is a Linux red herring (OFF by default, Windows-only)
([slang-test teardown heap corruption = unjoined slang-rhi global worker
pool](../learnings/1787565663141-slang-test-teardown-heap-corruption-unjoined-slang.md)).

## Tooling, comments, and non-duplicative review

A skill script can exist in two on-disk copies at different versions simultaneously (a git checkout
vs the freshness-maintained mirror), so a cron that needs a specific feature must resolve the script
by CAPABILITY, not path order or mtime — iterate candidate paths and pick the first whose `--help`
advertises the feature (`python3 "$c" --help | grep -qi community`); this is robust to the skill
relocating AND to one copy being outdated ([slang-pr-report: two on-disk copies at different versions;
select by capability not path](../learnings/1787593536039-slang-pr-report-two-on-disk-copies-at-different-ve.md)).

Two review-hygiene rules close the set. Source doc comments are client-facing: no off-GitHub
references (no `#12558`, "see issue X", PR/discussion links) in implementation OR doc comments —
"imagine your reader has a zip of the repo with no GitHub access"; a comment on a declaration is a DOC
comment even in a `.cpp` file (write it for the client, not the implementer); and don't narrate
change-history or restate the adjacent line — keep only the enduring non-obvious WHY. Apply the
clarity-review criteria to your own diff before pushing ([source doc comments: client-facing, no
off-github refs, no change-narration](../learnings/1787573555990-source-doc-comments-client-facing-no-off-github-re.md)).
And when triage hands off an issue whose fix already lives in a community contributor's PR, the
residual value is a review comment — but read the PR's existing bot reviews FIRST; if
`github-actions[bot]` already posted the "no regression test" finding, reference-and-reinforce it in
one line rather than re-posting (redundant maintainer noise), and lead with the point no bot raised
(e.g. a missing `Closes #N` closing keyword). Also drop the `@` from names even in internal report
prose, since a mention can be relayed onward into a prohibited GitHub ping ([dedup residual comment —
endorse a bot-flagged finding, don't re-post
it](../learnings/1787738047335-dedup-residual-comment-endorse-a-bot-flagged-findi.md)).

**Source learnings (10):**
- [Slang sanitizer multi-server transport already runs under ASan on PR CI](../learnings/1787568663413-slang-sanitizer-multi-server-transport-already-run.md) — grep ALL callers of a reusable workflow and check each caller's input defaults before "fixing" a coverage gap.
- [Monitor/grep false positives against dense stream-json JSONL](../learnings/1787576911893-monitor-grep-false-positives-against-dense-stream-.md) — read the artifact + last-line result event; a growing stream = alive = error match is false.
- [A frozen-field heuristic must re-arm when the number changes](../learnings/1787606627212-a-frozen-field-heuristic-must-re-arm-when-the-numb.md) — the instant a believed-frozen numeric field moves, treat it as a fresh signal.
- [Precheck workflow_failures feed can be stale even when ci_health frame is fresh](../learnings/1787643303858-precheck-workflow-failures-feed-can-be-stale-even-.md) — compare top-entry created_at against date -u; direct API query with cache-buster on staleness.
- [Nightly red streak can be a stale-build artifact, not a persistent failure](../learnings/1787646011162-nightly-red-streak-can-be-a-stale-build-artifact-n.md) — pull head_sha per run; moving-SHA streak is real, shared-pre-fix-SHA streak is stale-build.
- [slang-test teardown heap corruption = unjoined slang-rhi global worker pool](../learnings/1787565663141-slang-test-teardown-heap-corruption-unjoined-slang.md) — teardown race; clean-under-ASan + many-threads + varying glibc message; mimalloc is a Linux red herring.
- [GitHub App token 403 on /user is normal — not a broken write path](../learnings/1787633494370-github-app-token-403-on-user-is-normal-not-a-broke.md) — test the write path with the actual write; a blocker escalation is a claim to verify.
- [Source doc comments: client-facing, no off-github refs, no change-narration](../learnings/1787573555990-source-doc-comments-client-facing-no-off-github-re.md) — a decl comment is a doc comment even in .cpp; keep only the enduring non-obvious WHY.
- [slang-pr-report: two on-disk copies at different versions; select by capability not path](../learnings/1787593536039-slang-pr-report-two-on-disk-copies-at-different-ve.md) — probe `--help` for the feature; robust to relocation and staleness.
- [Dedup residual comment — endorse a bot-flagged finding, don't re-post it](../learnings/1787738047335-dedup-residual-comment-endorse-a-bot-flagged-findi.md) — read existing bot reviews first; lead with the point no bot raised; drop the @ even internally.
