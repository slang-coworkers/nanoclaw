# Session: nv-coworkers fixes — 2026-05-08

## Dashboard UI Fixes

| Commit | What |
|--------|------|
| `146eb78` | Ghost session timeline — added InstructionsLoaded handler (INIT marker) |
| `774f7a4` | Hide ghost sessions from timeline session picker dropdown |
| `3c00bbc` | Reverted InstructionsLoaded from session-flow (pure noise, user confirmed useless) |
| `556a730` | Activity-based session filter — added `activity_count` field (tool calls + subagents + notifications); hide sessions with 0 user_prompts AND 0 activity from dropdown |
| `fcbe79c` | Thread header actions — added pin/rename/timeline buttons to thread panel header |
| `be733ed` | Clickable session titles — thread session names open the thread directly (not just the small icon) |
| `747738e` | Thread empty fix — `matchingNano` was block-scoped inside `if (parentLabel)` but referenced outside; ReferenceError silently aborted renderCwThread before messages rendered. Hoisted to function scope. |

## Routing / Host Fixes

| Commit | What |
|--------|------|
| `d7bac27` | Self-referential a2a routing — `writeSessionRouting` skips `a2a_session_sources` where source === recipient (prevents routing replies to self instead of dashboard) |
| `083ff42` | Test fix — updated stale a2a filter assertion for the `(deleted)` coworker fallback |

## Container / Agent Fixes

| Commit | What |
|--------|------|
| `b153edc` | Bwrap regression — `startOrResumeCodexThread` forces `sandbox: 'danger-full-access'` regardless of caller; regression test added |
| `f3b5ed6` | IDLE_END_MS raised from 600s to 1200s (20 min) — prevents builds from being killed by idle timer |
| `360362e` | Watchdog rule in `invocation.md` — one-liner in base-common always-in-context: "MUST schedule_task for tasks > 5 min" |
| subagent | Watchdog in `slang-implement` workflow — full 3-step pattern (notify parent, schedule_task with new_session=false, run build) in the verify step override |
| subagent | Plan-gate subagent bypass — `plan-gate.sh` and `workflow-state-reset.sh` exit early when `CLAUDE_CODE_FORK_SUBAGENT=1` |
| `92d1cca` | scheduling.md watchdog docs — added long-running task watchdog section with the mandatory 3-step pattern |

## Cleanup

| Item | What |
|------|------|
| Stray file | Removed `2026-05-06-031550-this-session-...txt` from repo root |
| Live DB | Corrected `session_routing` in implementer thread session (was self-referential agent route → now dashboard:implementer) |
| Live poll-loop | Updated all 4 `data/v2-sessions/*/agent-runner-src/poll-loop.ts` to 1200s default |
| scheduling.md in base-common | Reverted subagent's promotion of scheduling.md into base-common.context (test regression); invocation.md one-liner is sufficient |

## Root Causes Found

1. **Thread panel empty** — `matchingNano` declared inside `if (parentLabel) {}` block (const scoping) but used outside it. The ReferenceError was swallowed by `catch {}` in fetchCwThread, making it look like a fetch issue when it was a render crash.

2. **Misrouted implementer messages** — `a2a_session_sources` had a self-referential row (implementer root → implementer thread, same agent group). `writeSessionRouting` used this to set routing to `agent:<self>` instead of falling through to the messaging group's `dashboard:implementer`.

3. **Ghost session noise** — SDK lifecycle events (InstructionsLoaded, SessionStart, Stop) create sessions with 3-5 events but zero user prompts or tool activity. These are double-wake races, restart recovery, or scheduled task script-guard fires.

4. **Bwrap regression** — branch merges can reintroduce `sandbox: 'read-only'` in codex thread params. Docker IS the sandbox; bwrap fails inside it. Provider-layer override prevents any caller from setting the wrong value.

5. **Implementer stuck on issue #8556** — agent hallucinated dispatching a "worker" (never called send_message), plan-gate blocked the SDK subagent's edits (inherited hook but not parent's workflow-state), and 600s idle timer killed the build stream. Fixed by: subagent hook bypass, 20-min timeout, watchdog in workflow.
