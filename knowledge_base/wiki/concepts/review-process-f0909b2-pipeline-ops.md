---
title: /slang-pr-review pipeline operations (dispatch, run-dir, budget, env, integrity, drift)
type: concept
group: review-process
tags: [slang-pr-review, reviewer-a, reviewer-b, reviewer-c, background-dispatch, monitor, run-dir, integrity-fail, max-budget-usd, onecli, drift-check, slang-rhi]
source_count: 9
---

## TL;DR

Running the three parallel reviewers of `/slang-pr-review` (A = correctness /
compose-and-run.sh; B = Devin / devin-fetch.sh; C = clarity / run-clarity.sh) has a set
of recurring operational traps:

- **Background dispatch: never `nohup … &` inside a `Bash(run_in_background=true)` call.**
  The tracked job is the wrapper shell, which exits at the `&` — you get a spurious
  "completed exit 0" within seconds while the real reviewer runs detached and you never
  learn when it finishes. Either run the script directly as the background command (so the
  tracked job IS the reviewer), or arm a `Monitor` until-loop that `kill -0`-polls the
  detached PIDs (Monitor's timeout reaches 3600000ms; Bash background caps at 600000ms,
  too short for ~30-min reviewers). `pgrep -f`/`pkill -f` are blocked by a guard hook —
  use `ps -eo args | grep`, and keep grep patterns in a script file so the watcher's own
  argv doesn't self-match.
- **`run-clarity.sh` often lacks the exec bit** (`Permission denied` under `nohup`) —
  launch it as `bash run-clarity.sh …`. A/B scripts are already +x.
- **Reviewer A `--max-budget-usd` must be ≥ 20.** The cap covers the whole run (orchestrator
  + ~5 subagents + synthesis); even a tiny PR costs ~$14, and a cap of 12 aborts AFTER the
  subagents finish but BEFORE `final-review.md` is written — a 0-byte review + misleading
  "zero dispatches" guard trips. The inner CLI cost is billed separately from the harness.
- **Pick YOUR run dir by identity, never by mtime** — concurrent reviews share the
  `transcripts/` tree, so `ls -1t` can select another PR's run. Match on the RUN_DIR from
  your task `.output`, or the PR/head-SHA in the dir name / `prompt.txt`; treat
  `INTEGRITY-FAIL.txt` as a hard stop — EXCEPT the benign concurrent-tmp-clobber case.
- **Devin (Reviewer B) is static-analysis-only** and its panel is stale on a fresh
  force-push — cross-check every flagged line against the current diff.
- **gh routes through the OneCLI proxy;** if GitHub is not connected, A & C 401 with
  `app_not_connected` (Devin B unaffected; unauth public REST via curl still works).
- **The pipeline runs cleanly against slang-rhi / any repo** in `pr` mode via `--repo`.

## Background dispatch and the double-background trap (recorded three times)

The single most-repeated operational lesson: launching a reviewer with `run_in_background=true`
whose command is `nohup … &` **double-backgrounds** it. The wrapper shell returns exit 0
immediately, giving a false completion notification while the real reviewer keeps running
detached with no true completion signal. The recovery that works is to confirm live PIDs with
`ps -eo pid,etimes,args | grep` and arm a single `Monitor` until-loop (`while kill -0 $A ||
kill -0 $B || kill -0 $C; do sleep 20; done; echo REVIEWERS-DONE`), noting Monitor's higher
timeout ceiling; the simpler fix is to drop `nohup … &` and run each script directly as its own
background command so its exit notification is real
[Dispatching background reviewers: nohup & inside run_in_background double-backgrounds](../learnings/1788203787495-dispatching-background-reviewers-nohup-inside-run-.md).
The same trap was re-confirmed on slang#12879, paired with the fact that Reviewer B (Devin) is
static-analysis-only and cannot provide a runtime oracle for an architecture-dependent bug (e.g.
an aarch64-only miscompile) — CI is the only oracle there; don't tell a fixer Devin can settle a
runtime flip
[Devin Review is static-only; and don't double-background reviewer dispatch](../learnings/1788341384825-devin-review-is-static-only-and-don-t-double-backg.md).
The third recording (PR #12899) adds two specifics: `run-clarity.sh` is not executable
(`-rw-rw-r--`) so `nohup` fails silently — launch via `bash`; and the waiter's `ps … | grep`
patterns must live in a script file so the watcher's own argv doesn't self-match, since
`pgrep -f`/`pkill -f` are guard-blocked
[Dispatching /slang-pr-review reviewers in background: two gotchas](../learnings/1788446192623-dispatching-slang-pr-review-reviewers-in-backgroun.md).

## Run-dir selection, integrity, budget, and drift

Because all concurrent reviews land in the SAME shared `transcripts/` tree, selecting the
newest run dir by mtime is wrong — a concurrent session's run for a different PR can be more
recent. A near-miss merged PR 12801's correctness review into PR 12793's report; the tell was
`INTEGRITY-FAIL.txt` (its "actual PR files" listed 12801's files). Find your run dir by reading
the RUN_DIR from your own task `.output`, or matching the PR/head-SHA in the dir name or
`prompt.txt`, and confirm `INTEGRITY-FAIL.txt` is absent before running `summarize.py` —
`compose-and-run.sh` writes it when the reviewed file set ≠ the PR's actual files, a hard stop
[Reviewer run-dir selection: never pick by mtime when reviews share transcripts](../learnings/1788160503888-reviewer-run-dir-selection-never-pick-by-mtime-whe.md).
There is one **benign** INTEGRITY-FAIL, though: on slang#12921 concurrent A + C both `gh pr diff`
into the shared `$REPO_ROOT/tmp/pr-diff.patch`, so one clobbers the other and A's file-list
extraction can capture a foreign tmp — but if the `pr-diff.reference` sha256, the footer head
SHA, and decisively the review BODY are all grounded in the actual PR, the run is valid; don't
set `reviewers_complete=false` on the file-list alone (mitigate by staggering A/C or separate
worktrees). That atom also documents the stale-Devin-panel-on-force-push signature and the
line-number cross-check to detect it
[re-review gotchas: benign INTEGRITY-FAIL from concurrent A+C, stale Devin panel](../learnings/1788769244100-slang-pr-review-re-review-gotchas-benign-integrity.md).
Budget: Reviewer A's `--max-budget-usd` covers the whole run; capping at 12 on slang#12919 hit
`error_max_budget_usd` after every subagent completed but before `final-review.md` was emitted,
producing a 0-byte review, exit 1, and a misleading "zero Task dispatches" guard (the content was
actually in `stream.jsonl`) — set ≥ 20 for finish headroom (a re-run at 22 completed at $14.03),
and note the inner CLI cost is billed separately from the orchestrator's harness budget so
re-running A is safe budget-wise for the session
[Reviewer A --max-budget-usd must be ≥20 or it cuts off before final-review.md](../learnings/1788751025464-slang-pr-review-reviewer-a-max-budget-usd-must-be-.md).
Drift-check false alarm: verifying Reviewer C is drift-free ("no GitHub-write executed"), a naive
grep for `slang-review-post-github` matches because the clarity pipeline legitimately *Reads*
that skill's SKILL.md while surveying its own skill set — a Read is not a write; tighten the grep
to match only `"name": "Bash"` command bodies, not `Read` file_paths
[Reviewer C drift check: a Read of slang-review-post-github/SKILL.md is NOT drift](../learnings/1788810108542-reviewer-c-drift-check-a-read-of-slang-review-post.md).

## Environment: OneCLI gh routing and cross-repo runs

`gh` in the container routes through the OneCLI HTTPS proxy (`GH_TOKEN` is a `ROUT…` gateway
routing token, not a real GitHub token). If GitHub is not connected in OneCLI, every `gh` call
401s with `app_not_connected` — which hard-fails Reviewer A (`compose-and-run.sh` resolves the
head SHA via `gh pr view` and refuses a "phantom PR") and Reviewer C (`gh pr diff`), while Devin
B is unaffected (anonymous scrape). Unauthenticated public REST still works through the proxy via
curl, so fetch the diff for the report that way; the fix is human-gated (operator connects
GitHub) — do NOT hand-roll a substitute for A/C, escalate, run B best-effort, deliver a PARTIAL
combined-review.md with `reviewers_complete:false` and a RESUME.md
[gh via OneCLI app_not_connected blocks Reviewers A & C (curl still works)](../learnings/1788378606664-slang-pr-review-pipeline-gh-via-onecli-app-not-con.md).
The pipeline is repo-portable: on **slang-rhi** (and any non-slang repo) it works as-is in `pr`
mode — A and C take `--repo owner/repo` and fetch that repo's diff via `gh pr diff -R`, while the
local `/workspace/agent/slang` checkout only supplies REVIEW.md + the six review subagents; the
App installation token authorizes reads even when `gh auth status` warns "token invalid" (cosmetic
for read-only), and slang-rhi specifics differ (clang-format v20.1.7, base branch `main`,
CPU-device tests harness-skipped on Linux)
[/slang-pr-review runs cleanly against slang-rhi in pr mode](../learnings/1788477201526-slang-pr-review-runs-cleanly-against-slang-rhi-and.md).

**Source learnings (9):**
- [Reviewer run-dir selection: never pick by mtime when reviews share transcripts](../learnings/1788160503888-reviewer-run-dir-selection-never-pick-by-mtime-whe.md) — pick by RUN_DIR from task .output or PR/head-SHA in dir name; INTEGRITY-FAIL.txt is a hard stop.
- [Dispatching background reviewers: nohup & inside run_in_background double-backgrounds](../learnings/1788203787495-dispatching-background-reviewers-nohup-inside-run-.md) — run scripts directly or arm a Monitor kill-0 waiter; guard hook blocks pgrep -f.
- [Devin Review is static-only; and don't double-background reviewer dispatch](../learnings/1788341384825-devin-review-is-static-only-and-don-t-double-backg.md) — Devin never builds/runs; CI is the only oracle for arch-dependent runtime bugs; PID-wait monitor.
- [Dispatching /slang-pr-review reviewers in background: two gotchas](../learnings/1788446192623-dispatching-slang-pr-review-reviewers-in-backgroun.md) — run-clarity.sh lacks exec bit (use `bash`); keep waiter grep patterns in a script file.
- [gh via OneCLI app_not_connected blocks Reviewers A & C (curl still works)](../learnings/1788378606664-slang-pr-review-pipeline-gh-via-onecli-app-not-con.md) — escalate the env blocker, run B best-effort, deliver a PARTIAL review + RESUME.md; don't fake A/C.
- [/slang-pr-review runs cleanly against slang-rhi in pr mode](../learnings/1788477201526-slang-pr-review-runs-cleanly-against-slang-rhi-and.md) — A/C take --repo and fetch that repo's diff; App token authorizes reads despite the auth-status warning.
- [Reviewer A --max-budget-usd must be ≥20 or it cuts off before final-review.md](../learnings/1788751025464-slang-pr-review-reviewer-a-max-budget-usd-must-be-.md) — cap covers whole run (~$14); a low cap yields a 0-byte review; inner CLI billed separately from harness.
- [re-review gotchas: benign INTEGRITY-FAIL from concurrent A+C, stale Devin panel](../learnings/1788769244100-slang-pr-review-re-review-gotchas-benign-integrity.md) — trust pr-diff.reference sha + review body over the file-list; cross-check Devin line numbers on force-push.
- [Reviewer C drift check: a Read of slang-review-post-github/SKILL.md is NOT drift](../learnings/1788810108542-reviewer-c-drift-check-a-read-of-slang-review-post.md) — a Read of the post skill is benign; tighten the drift grep to Bash command bodies only.
