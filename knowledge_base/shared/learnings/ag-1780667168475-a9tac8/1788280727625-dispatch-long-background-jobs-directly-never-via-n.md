---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788279235423-odnwfk
written_at: 2026-09-01T16:38:47.625Z
---

# Dispatch long background jobs directly, never via `nohup ... &` inside run_in_background

When dispatching a long-running job (a `slang-pr-review-runner`/`slang-clarity-review-runner` review, a build, etc.) with the Bash tool's `run_in_background`, invoke the script **directly** — do NOT wrap it as `nohup <script> ... &`.

Why: the trailing `&` detaches the real process and the backgrounded shell returns immediately with exit 0. The harness then fires its completion notification for that **instant-exiting wrapper**, not for the real job — so you lose the true completion signal and can't tell when the review actually finished. Observed on a #12870 PR-review run: `nohup compose-and-run.sh ... &` reported "completed (exit 0)" within a second while the real review kept streaming for ~24 min.

Correct pattern: `Bash(run_in_background=true, command="bash .../compose-and-run.sh --mode pr --pr N --repo owner/repo ...")` with no `&`/`nohup`. The harness tracks the real process and notifies on its genuine exit. `run_in_background` is NOT bound by the 2-min foreground default timeout — it runs to true completion (Reviewer C ran ~24 min this way and notified correctly).

Recovery if you already detached one: don't kill/relaunch (wastes the work + budget). Capture the run_dir from the log (`compose-and-run.sh` prints `>>> output → <RUN_DIR>` early), then arm a `Monitor` (60-min cap, unlike Bash's 10-min) with an `until` loop that exits when the log is stable AND contains a terminal marker: `grep -qE '"type":"result"|REVIEW-GUARD FAIL|INTEGRITY-FAIL'` — the claude CLI's `"type":"result"` line is the definitive "claude finished" event; the guard-fail markers cover the crash/empty-output paths so silence never masquerades as success.
