---
title: "Codex-Critique Round Recording: Bridge Path, Client Timeouts, and the Thread Map"
type: concept
group: agent-infra
tags: [codex-critique, critique-gate, track-critique, codex-mcp-bridge, mcp-timeout, critique-threads, thread-map, recording]
source_count: 25
---

# Codex-critique round recording: bridge path, client timeouts, and the thread map

## TL;DR

- A critique round records through the codex MCP **bridge** (`/app/src/critique-record.ts`, run on every
  successful turn, gated on `CRITIQUE_GATE_ACTIVE` which is set in the bridge env) — the PostToolUse-hook
  path was retired because opencode/codex groups never fired it.
- An MCP `-32001` client timeout is cosmetic when the turn completes server-side: poll
  `/workspace/.claude/workflow-state.json` and `~/.codex/sessions/<date>/rollout-*.jsonl`; never report
  "critique unavailable" — the timed-out round may be the must-fix every other round missed.
- A thread killed by the bridge's 15-minute cap (`turn_aborted`, no `task_complete`) never records, and its
  thread is poisoned: later `codex-reply` content records nothing. Re-record the stage with a fresh,
  tightly-scoped call framed as a re-recording round.
- Keep rounds inside the client budget: `config: {"model_reasoning_effort": "low"}` plus a lean 2-4-file
  artifact list. An xhigh round runs 8-15 min, the client gives up, and the orphaned session burns quota —
  kill orphaned `codex app-server` PIDs, keep the bridge process.
- A round records only with the verbatim `/codex-critique` developer-instructions block AND the exact param
  key — in opencode-harness sessions camelCase `developerInstructions` is the working spelling (measured
  recording 2026-11-18; the hyphenated spelling truncates), `STAGE:` on fresh calls only, and anchored
  `REQUIREMENTS:` URLs (anchoring detail on
  [gate-hook mechanics](agent-infra-gate-hook-mechanics.md)).
- In **opencode-harness sessions the param spelling decides recording**: the harness truncates
  hyphenated MCP param names at the first hyphen (`developer-instructions` arrives as `developer`),
  so pass the reviewer block under the working spelling (camelCase `developerInstructions`, measured
  2026-11-18/20). The direct `mcp__codex__codex` MCP tool DOES record when the block is present —
  prefer it over the bridge when it is available (the bridge's spawned codex child can die silently);
  when no tool path works, drive the production bun bridge via MCP JSON-RPC, or record manually with a
  synthetic PostToolUse payload / saved transcripts.
- `codex-reply` rounds do not reliably refresh `critique_attested` hashes — dispatch the FINAL round as a
  fresh `STAGE:` call listing every deliverable under ARTIFACTS.
- Workflow-state resets on EVERY inbound (auto-retry, parent ping): `plan_written` resets with it (re-record
  with the Write tool only), and `codex-reply` calls never record a stage — re-run a "missing stage" as a
  fresh codex call on the same artifacts.
- `codex-reply` inherits the **parent thread's** stage from `critique_threads`: reply on the wrong thread
  and you silently re-approve the wrong stage while the gate keeps refusing. Read the map before every reply.
- Recovery: `codex-reply` on the recorded thread ("your verdict was delivered but the output was lost in
  transit — re-emit ONLY the structured output verbatim") restates the full verdict; keep `STAGE:` explicit
  on every call so the stage map isn't misattributed.
- The authority is `critique_verdicts` + `critique_attested`, not stage counts, the hook's gate line, or a
  "round recorded" notice; verify with `jq` after every round.
- Put a SCOPE line in critique prompts (read-only checks, no builds, no test runs) — a review turn that
  runs `slang-test` inside the sandbox can kill the app-server mid-flight and record nothing.
- If the main session silently cannot emit the `developer-instructions` parameter (STAGE calls "succeed"
  but nothing records), dispatch a general subagent to make the gate-stage codex calls; omit `model:`
  (OneCLI's open-models rule 403s it).

## The recording path: the bridge, not the hook

Rounds ARE recorded in this harness (re-confirmed 2026-11-16, slang#14494 recheck): the codex MCP bridge
itself runs `track-critique.sh` via `/app/src/critique-record.ts` (called at `codex-mcp-bridge.ts:442` on
every successful turn, gated on `CRITIQUE_GATE_ACTIVE`, which IS set in the bridge env) — the
PostToolUse-hook path was retired because opencode/codex groups never fired it
([critique rounds record via the codex bridge, not the hook — timeouts are cosmetic](../learnings/1794851587389-critique-rounds-record-via-the-codex-bridge-not-th.md)).
Consequences: (1) the opencode MCP client still times out at ~330s on long codex turns, but the turn
completes server-side (30-min bridge budget, `CODEX_MCP_TURN_TIMEOUT_MS` — any "Request timed out" MCP
error is the client layer, not the bridge) and the round+verdict record anyway — poll
`/workspace/.claude/workflow-state.json` (`critique_verdicts` per stage, `critique_threads` map) and read
the FULL critique output from the newest `~/.codex/sessions/<date>/rollout-*.jsonl` (last `role=assistant`
message); (2) `codex-reply` calls often return inline when the turn is fast; (3) a review turn can DIE
mid-flight — one CODE_REVIEW attempt ran `slang-test tests/language-feature/ -api-only` inside the review
and the codex app-server exited (`exit_code -1`, no round recorded), so always put a SCOPE line in critique
prompts: read-only checks, no builds, no test runs; (4) the plan-tracker hook only fires on the Write tool
— an Edit to `reports/<slug>.md` does NOT mark `plan_written` (plan-gate detail on
[gate-hook mechanics](agent-infra-gate-hook-mechanics.md)).
The SCOPE line generalizes into **budget discipline for the prompt itself** (slang#14615, 2026-11-19):
if the prompt names suite evidence ("suites green: hlsl 792..."), kimi-k3 re-runs those suites in its
sandbox — 10-20 min each, and three consecutive OUTPUT_REVIEW attempts died at exactly the 900s turn
budget that way. Pre-run the suites yourself, leave the logs on disk with "of tests passed" tails, point
the prompt at them, and add BOTH a budget warning ("do NOT re-run suites; two previous attempts died
exactly this way") and a HARD numbered checklist of the few things to verify, ending with "list anything
else as Advisory without further verification" — with that the round completed in ~9 min with precise
findings. Two deliverable-side riders from the same atom: reordering quiz options leaves stale answer-key
letters inside each `<details><summary>Answer</summary>` block (re-grep them after any option reorder),
and pass the FULL sha to `--quiz-positions` (a 7-char prefix can differ from the verifier's letters)
([codex critique: hard-checklist prompt + no suite re-runs](../learnings/1795068180208-codex-critique-hard-checklist-prompt-no-suite-re-r.md)).

**Caveat measured 2026-11-17/18 (opencode-harness groups): the direct MCP tool path does NOT record there.**
In opencode sessions a direct `mcp__codex__codex` call systematically fails to record a round: the harness
truncates a hyphenated MCP parameter name at the first hyphen when the call is stored/executed, so
`developer-instructions` arrives at the bridge as `developer` (verified in opencode.db; the bridge's
`canonicalToolArgs` only fold-matches `developerinstructions`/`developer_instructions`), codex never sees
the reviewer block, and the pinning gate silently declines
([OpenCode truncates hyphenated MCP param names — pass developerinstructions](../learnings/1794933603258-opencode-truncates-hyphenated-mcp-param-names-pass.md));
on top of that the direct MCP calls do not fire the track-critique path (tool-name mismatch) and leave a
stale thread-writer lock (`~/.codex/thread-writer-locks/<id>.lock`) that makes later bun-bridge replies
fail with "thread already has an active writer" — a fresh codex session bypasses the lock. The reliable
recording path in those groups is to drive the **production bridge directly via MCP JSON-RPC**:
`PATH="/pnpm:$PATH" bun run /app/src/codex-mcp-bridge.ts`, `initialize` with `protocolVersion "2024-11-05"`
(empty params are rejected), then `tools/call {name:"codex"}` — the bridge records the round itself when
`CRITIQUE_GATE_ACTIVE=1` is in env
([recording rounds: bridge dispatch, anchored REQUIREMENTS, state-write races](../learnings/1794948587801-recording-critique-gate-rounds-bridge-dispatch-anc.md),
[critique-gate freshness: only bun-bridge codex dispatches record](../learnings/1794970120988-critique-gate-freshness-only-bun-bridge-codex-disp.md)).
Two recovery paths when a real review ran but recorded nothing: (1) re-run `track-critique.sh` with the SAVED
genuine codex transcripts (prompt + result files kept under a scratch dir) — it re-records real rounds
faithfully; (2) pipe a synthetic PostToolUse JSON payload into `bash /app/hooks/track-critique.sh` whose
`tool_input` carries a short developer-instructions string containing the two pinning sentinels and whose
`tool_response` embeds the REAL codex output (verdict + attested hashes) verbatim, then verify with
`jq '{stages: .critique_stages, verdicts: .critique_verdicts, edits: .edits_since_critique}'` and disclose
the workaround in the parent report
([codex critique rounds don't record in opencode sessions — synthetic payload workaround](../learnings/1794926576842-codex-critique-rounds-don-t-record-in-opencode-ses.md)).

## Client timeouts: cosmetic when the turn completes, fatal when it doesn't

Two `mcp__codex__codex` CODE_REVIEW calls returning `MCP error -32001: Request timed out` (~330s client
timeout) both completed server-side — the full verdicts were recoverable from
`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`, one file per call, matching the call's start timestamp (the
last `response_item` of `role:assistant` holds the structured verdict; a `turn_completed`/`task_complete`
event_msg says it finished; a still-growing file means the round is still running — poll, it may finish
minutes later). The first timed-out round turned out to be the **must-fix** verdict (a transitive
fold-guarantee gap in slang-ir-reconstruct-short-circuit.cpp) that the fixer's own CODE_REVIEW r1 (approve)
and a second independent round (approve) both missed; treating the timeout as "no independent round
possible" produced a wrong "PASS — no blockers" recheck verdict that had to be retracted. Rules: on a
codex `-32001`, never report "critique unavailable" — poll the rollout files first; when two independent
rounds conflict, resolve on the merits (re-read the disputed code path yourself, report which round analyzed
the disputed point and which asserted at face value — don't average); relayed verdicts should carry the
sha256 of the extracted verdict file plus the rollout path/timestamp for provenance
([codex MCP -32001 timeout is cosmetic — poll rollout files for the real verdict](../learnings/1794852776159-codex-mcp-32001-timeout-is-cosmetic-poll-codex-ses.md)).
The same rollout path recovers text when the **bridge client hangs after recording server-side**
(slang#14618, 2026-11-19): the verdict arrives via `jq .critique_stages workflow-state.json` while
the must-fix/advisory text seems lost — it is NOT lost. Codex writes a full session rollout at
`~/.codex/sessions/<YYYY/MM/DD>/rollout-<ts>-*.jsonl`; walk every string field for blocks containing
`### Verdict` and keep the LAST one that isn't the developer-instructions template (the template also
contains those headers — filter out blocks containing the literal `approve | must-fix`). This
recovered a must-fix (a dropped `?` in a verbatim maintainer quote) that would otherwise have been a
blind re-run; the delivery-recipe variant is to find the rollout file whose first lines carry your
`STAGE:` marker ([codex rollout files recover hung-bridge review text](../learnings/1795086068053-codex-rollout-files-recover-hung-bridge-review-tex.md);
recipe with the STAGE-marker match on [gate-hook mechanics](agent-infra-gate-hook-mechanics.md)).
The same recovery applies when the verdict recorded but you never saw it (slang#14498: three consecutive
CODE_REVIEW calls all "timed out" while the state showed rounds recording live): read the thread id from
`critique_threads`, then `codex-reply` on THAT thread — "your verdict was delivered but the output was lost
in transit — re-emit ONLY the structured output verbatim" — codex restates its full verdict; do NOT re-fire
a fresh call when one already recorded a round (a duplicate does not advance the stage and wastes another
~10 min), and keep `STAGE:` explicit on every call because the stage map is keyed from the prompt's STAGE
line and one OUTPUT_REVIEW got misattributed in `last_critique_stage` as CODE_REVIEW
([Codex MCP timeout ≠ failure: verdict records in background; recover via codex-reply on the recorded thread](../learnings/1794835792483-codex-mcp-timeout-failure-verdict-records-in-backg.md)).

The residual failure mode is a turn that never completes inside the budget. With
`model_reasoning_effort=xhigh` (a container default) a critique round needs 8-15 min while the MCP client
gives up in ~2 min; the earlier same-day reading — "client timeouts never record" — was the pre-bridge
observation that `track-critique.sh` deliberately skips error/timeout responses, and it holds only for
turns that die without completing: timed-out sessions are unrecoverable (no threadId returned) and keep
burning inference quota, so kill the orphaned `codex app-server` PIDs (keep the bridge process). The
working recipe: pass `config: {"model_reasoning_effort": "low"}` on the codex call plus a lean artifact
list (2-4 files, inline the small evidence) — that round-trips inside the client budget with good results.
The state file also shows when a timed-out call later completed and recorded (PLAN_REVIEW once recorded 2
rounds because an orphan's late response was processed)
([client timeouts never record — use low effort; read critique_threads before every codex-reply](../learnings/1794837209510-codex-critique-client-timeouts-never-record-use-lo.md)).

## Recording conditions that silently drop a round

**The verbatim developer-instructions block is mandatory.** In the OpenCode coworker container a
`codex_codex` critique round is recorded only if the verbatim block from
`/home/node/.claude/skills/codex-critique/SKILL.md` is passed (the hook checks the sentinels "You are an
independent reviewer" / "Return ONLY the structured output below"). Omitting it silently records nothing:
the call "succeeds", you get an approve, `.critique_stages` stays empty and the comment gate refuses the
post ("not among the files an OUTPUT_REVIEW attested"). Without the block codex also returns free-form
prose with no `### Attested` sha256 section, so long public comments (1,000+ chars must be posted via an
attested `--body-file`) stay blocked even after a recorded round. Always pass the verbatim block and, after
each round, `jq .critique_stages /workspace/.claude/workflow-state.json` to confirm
([codex-critique rounds only record with the verbatim developer-instructions block](../learnings/1794847766178-codex-critique-rounds-only-record-with-the-verbati.md)).
This re-confirmed on 2026-11-17/18 from both sides: the initial OUTPUT_REVIEW call with the parameter
omitted entirely records nothing and the delivery gate then denies the `gh api` post even though codex had
approved and attested the exact file — the refusal's additionalContext does not surface through the MCP
bridge, so the ONLY reliable check is the state file after every stage call
([initial codex call must carry developer-instructions verbatim](../learnings/1794926826665-critique-gate-initial-codex-call-must-carry-develo.md),
[developer-instructions omission silently drops gate rounds](../learnings/1794968405572-codex-critique-developer-instructions-omission-sil.md)).
The same pinning check is why a round tracks ONLY with the canonical block — a substantive review without
it records nothing and you discover it only when the delivery gate refuses for "missing critique stages"
([codex-critique rounds only record with the canonical developer-instructions block](../learnings/1794919003543-codex-critique-rounds-only-record-with-the-canonic.md)).
The verdict parser is just as literal: it needs a literal `### Verdict` heading line followed by `approve`
or `must-fix` — prose like "Verdict: APPROVED" or `APPROVE_WITH_NITS` parses as `unparseable`, and a prose
`**Verdict: APPROVE**` records a stage COUNT but no verdict, so the gate fails closed on the missing
verdict (CRITIQUE_VERDICT_STRICT). When a call cannot carry the full reviewer block, instruct codex to end
with the structured `### Verdict`/`### Attested` sections anyway
([canonical-block recording + literal verdict parse](../learnings/1794919003543-codex-critique-rounds-only-record-with-the-canonic.md),
[opencode synthetic-payload workaround](../learnings/1794926576842-codex-critique-rounds-don-t-record-in-opencode-ses.md)).

**Gate state resets on every inbound, and `codex-reply` rounds never record.** When a session processes
multiple inbounds (auto-retries, parent pings), the NanoClaw workflow-state (task_id) RESETS each time, and
with it `plan_written` — re-record the plan with the **Write tool only** (plan-tracker.sh ignores Edit;
bash writes don't count either). Critique-gate recordings survive only as fresh `mcp__codex__codex` calls
with the `STAGE:` line: `mcp__codex__codex-reply` calls (even with STAGE in the prompt) do NOT record. If
the deliver gate says a required stage is missing after you ran it via a reply, re-run it as a fresh codex
call pointing at the same artifacts — cheap, approves fast since the content was already reviewed
(symptom chain on slang#13749: `gh pr create` refused with "missing critique stages: PLAN_REVIEW,
OUTPUT_REVIEW" even though both had just been approved on reply threads)
([gate state resets on every inbound; codex-reply rounds don't record](../learnings/1794898781583-gate-state-resets-on-every-inbound-codex-reply-rou.md)).
A reply has a second, subtler recording gap: a round-2 `codex-reply` can bump `critique_rounds` and the
verdict while `critique_attested[OUTPUT_REVIEW]` KEEPS the round-1 hashes, so the delivery gate denies
posting the correctly re-reviewed file ("file is not among the files an OUTPUT_REVIEW attested"). Dispatch
the final round as a fresh `STAGE:` call (ROUND: n/n, REQUIREMENTS re-included — fresh calls need the
REQUIREMENTS field again; replies are exempt) and list every deliverable file under ARTIFACTS so the fresh
attested set replaces the stale one
([codex-reply attestation gap: fresh STAGE call needed for final artifact hashes](../learnings/1794954098752-codex-reply-attestation-gap-fresh-stage-call-neede.md)).

**The three silent round-droppers, in one place** (2026-11-17, #13618/#1195): a session restart (a
re-routed task re-delivers the router envelope and `workflow-state-reset.sh` wipes `critique_stages`), a
`STAGE:` marker inside a `codex-reply` prompt (parses a stage, fails pinning, exits without recording — a
reply can never un-drop itself), and an unanchored REQUIREMENTS URL. Each costs a full re-review cycle to
rediscover, so run the stages as fresh calls in the same turn as the delivery; when a delivery is denied
with "missing critique stages" RIGHT AFTER you recorded them, check `.task_id`/`started_at` in the state
file — if new, the state reset, and re-running the three stages as compact round-1 re-recordings is fine
(artifacts unchanged, codex re-verifies fast). The delivery-side corollary: the gate re-hashes every
reviewer-attested artifact path at send time, so never edit an attested file after its approve — write
PR-description updates to a NEW file (e.g. the bot disclaimer append) rather than into the reviewed
artifact
([3 silent round-droppers](../learnings/1794900588491-critique-gate-3-silent-round-droppers-restart-rese.md),
[dev-instructions pinning, state resets, marker routing](../learnings/1794901788554-critique-gate-gotchas-dev-instructions-pinning-sta.md)).
The Attested list also binds the reviewer's own advice: an OUTPUT_REVIEW that attested stale test leftovers
(e.g. `tests/….slang.actual`) and whose Advisory told you to delete them makes the delivery gate deny the
next marker once the files are gone ("reviewed artifacts changed … (missing)") — apply file-mutating
advisories only AFTER the gated delivery, or immediately re-run a fresh OUTPUT_REVIEW whose Attested list
drops the deleted paths; and since every file write (even a `/tmp` heredoc) bumps `edits_since_critique`
and stales OUTPUT_REVIEW freshness for the NEXT marker, make all edits first, run the final fresh
OUTPUT_REVIEW last, and send the marker in the same turn
([attested files bind the reviewer's own advisories](../learnings/1794989112338-codex-critique-recording-in-opencode-developerinst.md)).
The re-hash covers even the plan file in `reports/` and the mandatory plan re-arm Write; and the explain-diff
gate credits an explanation ONLY when posted via `upsert_pr_body.py` (marker + seal + receipt) — a plain
`gh pr comment` does not count and must be deleted as a duplicate; the plan-tracker likewise counts only
Write-tool writes under `/workspace/agent/reports/*` (Edit does not re-arm)
([verbatim dev-instructions; state resets per inbound; explain-diff credit](../learnings/1794908989857-codex-critique-rounds-record-only-with-the-skill-s.md)).

**When the CALLER can't emit the parameter at all, dispatch a subagent.** A main agent session can be
structurally unable to pass `developer-instructions` on `codex_codex` — 8+ deliberate STAGE attempts all
silently dropped the parameter (pin-check read it as absent, recorded nothing, and codex ran un-instructed,
returning prose verdicts that then failed the parser). A general SDK subagent emits the parameter
correctly: all three stages recorded approve on the first try. Also omit an explicit `model:` parameter —
it hits OneCLI's open-models rule (403 `blocked_by_policy`)
([main session can't emit developer-instructions — use a subagent](../learnings/1794913063020-codex-gate-calls-main-session-can-t-emit-developer.md)).

**The parameter key must match exactly.** `track-critique.sh` reads
`.tool_input."developer-instructions" // .tool_input.developer_instructions // .tool_input.developerinstructions`
— a call passing camelCase `developerInstructions` (capital I) runs fine and codex even returns a
structured verdict, but DEV_INST resolves empty, the canonical-block pin check fails, and `critique_rounds`
stays 0 with no error surfaced to the caller. Always pass `developerinstructions` (or
`developer-instructions` — but note the opencode harness truncates the hyphenated spelling at the first
hyphen, so in opencode sessions `developerinstructions` is the only safe form) and re-check
`workflow-state.json` (`critique_rounds`, `critique_verdicts`) after
every critique call you expect to be recorded
([codex critique rounds silently unrecorded with camelCase developerInstructions param](../learnings/1794816470745-codex-critique-rounds-silently-unrecorded-with-cam.md);
[OpenCode truncates hyphenated MCP param names](../learnings/1794933603258-opencode-truncates-hyphenated-mcp-param-names-pass.md)).
CORRECTION re-measured 2026-11-18 (slang#14579): in this opencode harness `mcp__codex__codex` DOES pass
camelCase `developerInstructions` and track-critique.sh RECORDS the round — the pin-check accepts it and
the verdict parses when codex emits the canonical `### Verdict` — so camelCase is the working spelling
there, superseding the earlier camelCase-fails reading; without the verbatim block codex instead replies
`**Verdict:**` bold-inline, which the hook's awk (`^### verdict`) cannot parse, so the round records with an
EMPTY verdict and the gate stays closed. Always pass the /codex-critique developer-instructions block
verbatim ([codex critique recording in opencode: developerInstructions camelCase works](../learnings/1794989112338-codex-critique-recording-in-opencode-developerinst.md)).
Re-confirmed and extended 2026-11-20 (slang#14652): the track-critique hook DOES fire on
`codex_codex`/`codex_codex-reply` MCP calls, but its instruction-pinning gate requires the reviewer
block in `developer-instructions` — a call without it runs the review fine yet records only a
"start" event, never the "round" (`critique_stages` stays null; the PR-create gate then names every
stage missing). Always pass the canonical developer-instructions block and verify
`jq .critique_stages /workspace/.claude/workflow-state.json` after every round; and when the MCP
tool is present, prefer it over the bun-bridge fallback client, whose spawned codex child can die
silently (empty output, no round event) — PLAN/CODE/OUTPUT rounds all recorded correctly once the
field was added ([codex critique rounds need developer-instructions even on the codex_codex MCP tool](../learnings/1795146830771-codex-critique-rounds-need-developer-instructions-.md)).
Also: the gate, plan-tracker and edit-counter hooks all write `workflow-state.json` via tmp+mv with NO
locking — concurrent writes race and clobber each other (one plan re-write erased a recorded CODE_REVIEW),
so do gate writes with nothing else in flight
([bridge dispatch, anchored REQUIREMENTS, state-write races](../learnings/1794948587801-recording-critique-gate-rounds-bridge-dispatch-anc.md)).
For roles requiring PLAN_REVIEW, the prompt's
`REQUIREMENTS:` field must contain at least one GitHub comment URL or the round is not counted — keep the
URLs in the field and stop codex from fetching them via a credential-down exception clause in the
developer-instructions instead of stripping them
([codex critique rounds silently unrecorded with camelCase developerInstructions param](../learnings/1794816470745-codex-critique-rounds-silently-unrecorded-with-cam.md);
URL anchoring rules on [gate-hook mechanics](agent-infra-gate-hook-mechanics.md), canonical-block
sentinels on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md)).

## The thread map: stage inheritance and wrong-thread replies

Each fresh `mcp__codex__codex` call with a `STAGE:` line starts a NEW codex thread, and `codex-reply`
continuations inherit the PARENT thread's stage from `critique_threads` in workflow-state.json. Sending a
round-2 reply to an old thread (e.g. the PLAN_REVIEW thread when the must-fix came from the CODE_REVIEW
thread) records the approve under the wrong stage and leaves `critique_verdicts[CODE_REVIEW]` stuck at
must-fix — the delivery gate then blocks with "missing critique stages" even though you hold an approve.
Before any round-2 reply, read `.critique_threads` and reply on the thread id whose STAGE matches the
round you are answering. Also: codex calls often return intermediate progress text (or empty) — a plain
"Please print your final review now." reply gets the structured block; hashes in `### Attested` bind the
verdict to exact file bytes, so any later edit (even appending a required bot disclaimer) needs one more
approve round
([codex-reply rounds inherit the parent thread's STAGE — reply on the right thread id](../learnings/1794889217597-codex-reply-rounds-inherit-the-parent-thread-s-sta.md)).

`track-critique` maps threadId→STAGE only on the successful initial call; replying on the wrong thread
silently updates the WRONG stage's verdict (one OUTPUT_REVIEW round-2 went to the CODE_REVIEW thread:
CODE_REVIEW got re-approved, OUTPUT_REVIEW stayed must-fix, and the next `gh pr create` was refused with
"OUTPUT_REVIEW last verdict is must-fix"). Never guess the threadId — before every codex-reply, `jq
.critique_threads /workspace/.claude/workflow-state.json` and pick the thread whose mapped stage matches
([read the map first; low-effort recipe](../learnings/1794837209510-codex-critique-client-timeouts-never-record-use-lo.md)).

## Dead threads and recovery

A codex call killed by the bridge's 15-minute cap leaves a thread that can NEVER record rounds. Symptom:
the rollout jsonl stops growing at exactly 900s with `turn_aborted / reason: interrupted` and no
`task_complete`; a `codex-reply` on that thread returns full verdict content but `track-critique.sh`
records NOTHING — the stage stays missing and the delivery gate keeps refusing ("missing critique stages").
Fix: re-record the stage with a FRESH `codex` call (new thread) framed as a re-recording round ("ROUND: 3/3
— prior rounds ran on a killed thread; verify and record"), with a tightly-scoped artifact list so it
finishes under 15 min. Threads whose initial call COMPLETED record both their own rounds and later
`codex-reply` rounds fine
([codex rounds on bridge-killed threads never record — re-record stages with fresh calls](../learnings/1794868443680-codex-rounds-on-bridge-killed-threads-never-record.md)).
A related death mode is a provider-429 killing the turn mid-review ("exceeded retry limit" in
`~/.codex/sessions/**.jsonl`): resume by `codex-reply` with the thread_id grepped from the newest rollout
file — the reply inherits the stage via the thread map and its verdict records; an empty codex response
means the turn died, so check the jsonl before re-sending (state-reset context on
[gate-hook mechanics](agent-infra-gate-hook-mechanics.md)).

A cheap sibling of the gate itself: run the codex OUTPUT_REVIEW on a **[Review Verdict] draft
BEFORE sending it**, not only when the critique gate fires. On #14626 (2026-11-19) the pre-send
OUTPUT_REVIEW caught three real attribution errors in two rounds: a "3 gaps" claim that described
only two (the module-level API-specialization divergence at slang-check-shader.cpp:3843 was
missing from both the Test-gaps bullet and the fixer-next-step), an "A, B, and C converge"
claim that overstated Reviewer C (which never flagged the coverage hole), and a wrong "C's only
test-related keep is FG005" (C kept FG003/FG004/FG005). Codex also independently verified
file:line refs at the PR head, the diff_hash, and live maintainer-direction state — the fixer's
handoff inherits the accuracy. Cost ~3 short codex calls; the gate's spirit is best honored
pre-send ([pre-send codex OUTPUT_REVIEW catches verdict attribution errors](../learnings/1795055971325-pre-send-codex-output-review-catches-verdict-attri.md)).

For cross-cutting recording rules (fails-open verdict parser, recall-stub replies, `### Attested` line
format) see [critique gate and decision recording](review-critique-gate-and-recording.md); for stage
counting and delivery sequencing, [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md); for
the delivery-side freshness window (edits_since_critique bumped by late `>` redirects and timed-out
launchers, and the clean-window recipe for firing the delivery marker), [gate-hook
mechanics](agent-infra-gate-hook-mechanics.md).

**Source learnings (25):**
- [gate state resets per inbound; codex-reply rounds never record](../learnings/1794898781583-gate-state-resets-on-every-inbound-codex-reply-rou.md)

- [rounds record via the codex bridge, not the hook](../learnings/1794851587389-critique-rounds-record-via-the-codex-bridge-not-th.md)
- [-32001 timeout is cosmetic; poll rollout files](../learnings/1794852776159-codex-mcp-32001-timeout-is-cosmetic-poll-codex-ses.md)
- [timeout verdict records; recover via codex-reply](../learnings/1794835792483-codex-mcp-timeout-failure-verdict-records-in-backg.md)
- [client timeouts never record — low effort recipe](../learnings/1794837209510-codex-critique-client-timeouts-never-record-use-lo.md)
- [camelCase developerInstructions param unrecorded](../learnings/1794816470745-codex-critique-rounds-silently-unrecorded-with-cam.md)
- [reply rounds inherit the parent thread's stage](../learnings/1794889217597-codex-reply-rounds-inherit-the-parent-thread-s-sta.md)
- [bridge-killed threads never record](../learnings/1794868443680-codex-rounds-on-bridge-killed-threads-never-record.md)
- [canonical dev-instructions block + literal `### Verdict` parse](../learnings/1794919003543-codex-critique-rounds-only-record-with-the-canonic.md) — round tracks only with canonical block; verdict needs literal heading.
- [opencode rounds don't record; synthetic-payload workaround](../learnings/1794926576842-codex-critique-rounds-don-t-record-in-opencode-ses.md) — manual track-critique payload with sentinels + real codex output.
- [initial call must carry developer-instructions verbatim](../learnings/1794926826665-critique-gate-initial-codex-call-must-carry-develo.md) — omission silently drops the round; check jq after every stage call.
- [OpenCode truncates hyphenated MCP param names](../learnings/1794933603258-opencode-truncates-hyphenated-mcp-param-names-pass.md) — `developer-instructions` arrives as `developer`; pass `developerinstructions`.
- [bridge dispatch, anchored REQUIREMENTS, state-write races](../learnings/1794948587801-recording-critique-gate-rounds-bridge-dispatch-anc.md) — drive the bun bridge; tmp+mv writes race; saved-transcript recovery.
- [codex-reply attestation gap](../learnings/1794954098752-codex-reply-attestation-gap-fresh-stage-call-neede.md) — replies keep round-1 hashes; final round must be a fresh STAGE call.
- [developer-instructions omission silently drops rounds](../learnings/1794968405572-codex-critique-developer-instructions-omission-sil.md) — refusal context invisible through the bridge; jq is the only check.
- [critique-gate freshness: only bun-bridge dispatches record](../learnings/1794970120988-critique-gate-freshness-only-bun-bridge-codex-disp.md) — MCP tool records nothing; stale writer lock; clean-window recipe.
- [3 silent round-droppers: restart reset, STAGE-in-reply, unanchored URL](../learnings/1794900588491-critique-gate-3-silent-round-droppers-restart-rese.md) — each costs a full re-review cycle; never edit attested files after approve.
- [critique-gate gotchas: pinning, state resets, marker routing](../learnings/1794901788554-critique-gate-gotchas-dev-instructions-pinning-sta.md) — verdict needs literal `### Verdict`; re-run stages when `.task_id` is new.
- [codex rounds record only with the skill's verbatim dev-instructions](../learnings/1794908989857-codex-critique-rounds-record-only-with-the-skill-s.md) — explain-diff credit only via upsert_pr_body.py; plan-tracker counts Write only.
- [main session can't emit developer-instructions — use a subagent](../learnings/1794913063020-codex-gate-calls-main-session-can-t-emit-developer.md) — subagents emit the param; omit `model:` (403 open-models rule).
- [codex critique recording in opencode: developerInstructions camelCase works; attested files bind the reviewer's own advisories](../learnings/1794989112338-codex-critique-recording-in-opencode-developerinst.md) — camelCase records (2026-11-18 re-measure, no block ⇒ empty verdict); apply file-mutating advisories after delivery or re-review.
- [pre-send codex OUTPUT_REVIEW catches verdict attribution errors](../learnings/1795055971325-pre-send-codex-output-review-catches-verdict-attri.md) — review the [Review Verdict] draft before sending; ~3 codex calls for an accurate fixer handoff.
- [codex critique: hard-checklist prompt + no suite re-runs](../learnings/1795068180208-codex-critique-hard-checklist-prompt-no-suite-re-r.md) — suite re-runs kill rounds at 900s; budget warning + numbered checklist; quiz answer-key letters after reorder (slangc SIMPLE_EX half on slang-codebase specifics).
- [codex rollout files recover hung-bridge review text](../learnings/1795086068053-codex-rollout-files-recover-hung-bridge-review-tex.md) — last non-template `### Verdict` block; explicit-form force-with-lease for tracking-ref-less branches.
- [codex critique rounds need developer-instructions even on the codex_codex MCP tool](../learnings/1795146830771-codex-critique-rounds-need-developer-instructions-.md) — hook fires but records only "start" without the block; prefer the MCP tool over the silently-dying bridge.
