---
title: "Codex-Critique Round Recording: Bridge Path, Client Timeouts, and the Thread Map"
type: concept
group: agent-infra
tags: [codex-critique, critique-gate, track-critique, codex-mcp-bridge, mcp-timeout, critique-threads, thread-map, recording]
source_count: 9
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
  key (`developerinstructions`; camelCase `developerInstructions` silently records nothing), `STAGE:` on
  fresh calls only, and anchored `REQUIREMENTS:` URLs (anchoring detail on
  [gate-hook mechanics](agent-infra-gate-hook-mechanics.md)).
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

**The parameter key must match exactly.** `track-critique.sh` reads
`.tool_input."developer-instructions" // .tool_input.developer_instructions // .tool_input.developerinstructions`
— a call passing camelCase `developerInstructions` (capital I) runs fine and codex even returns a
structured verdict, but DEV_INST resolves empty, the canonical-block pin check fails, and `critique_rounds`
stays 0 with no error surfaced to the caller. Always pass `developerinstructions` (or
`developer-instructions`) and re-check `workflow-state.json` (`critique_rounds`, `critique_verdicts`) after
every critique call you expect to be recorded. Also: for roles requiring PLAN_REVIEW, the prompt's
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

For cross-cutting recording rules (fails-open verdict parser, recall-stub replies, `### Attested` line
format) see [critique gate and decision recording](review-critique-gate-and-recording.md); for stage
counting and delivery sequencing, [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md).

**Source learnings (9):**
- [gate state resets per inbound; codex-reply rounds never record](../learnings/1794898781583-gate-state-resets-on-every-inbound-codex-reply-rou.md)

- [rounds record via the codex bridge, not the hook](../learnings/1794851587389-critique-rounds-record-via-the-codex-bridge-not-th.md)
- [-32001 timeout is cosmetic; poll rollout files](../learnings/1794852776159-codex-mcp-32001-timeout-is-cosmetic-poll-codex-ses.md)
- [timeout verdict records; recover via codex-reply](../learnings/1794835792483-codex-mcp-timeout-failure-verdict-records-in-backg.md)
- [client timeouts never record — low effort recipe](../learnings/1794837209510-codex-critique-client-timeouts-never-record-use-lo.md)
- [rounds only record with verbatim dev-instructions](../learnings/1794847766178-codex-critique-rounds-only-record-with-the-verbati.md)
- [camelCase developerInstructions param unrecorded](../learnings/1794816470745-codex-critique-rounds-silently-unrecorded-with-cam.md)
- [reply rounds inherit the parent thread's stage](../learnings/1794889217597-codex-reply-rounds-inherit-the-parent-thread-s-sta.md)
- [bridge-killed threads never record](../learnings/1794868443680-codex-rounds-on-bridge-killed-threads-never-record.md)
