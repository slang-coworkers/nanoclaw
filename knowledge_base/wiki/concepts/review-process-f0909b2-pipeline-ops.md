---
title: /slang-pr-review pipeline operations (dispatch, run-dir, budget, env, integrity, drift)
type: concept
group: review-process
tags: [slang-pr-review, reviewer-a, reviewer-b, reviewer-c, background-dispatch, monitor, run-dir, integrity-fail, max-budget-usd, onecli, drift-check, slang-rhi]
source_count: 16
---

# /slang-pr-review pipeline operations (dispatch, run-dir, budget, env, integrity, drift)

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
- **Any runner script may lack the exec bit** — `run-clarity.sh` most often, but
  `compose-and-run.sh`, `devin-fetch.sh` and `wait-run.sh` too, recurring across days (exit 126
  `Permission denied`; the read-only skills mount drops the bit). Launch every one as `bash <script> …`, and read each reviewer log for the real
  exit code: a "completed (exit 0)" seconds after dispatch means the script never ran;
  a live run logs `>>> repro.sh:` at its head.
- **Never end the turn with only a background waiter armed** — a teardown drops the
  notification and the verdict sits unsent for hours. Record run dirs + next step in memory,
  then chain `bash wait-run.sh <dir> --timeout 540` (foreground Bash caps at 600 s; for longer,
  a `Monitor` until-loop on `<dir>/exit-status` + `kill -0`) or schedule an `ncl tasks` one-shot. After
  two `ECONNREFUSED` deaths, record Reviewer C as inconclusive instead of re-running.
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
The exec-bit loss is not specific to Reviewer C, and it keeps recurring (2026-09-30, 10-07, 10-10). Every script under `~/.claude/skills/slang-pr-review-runner/scripts/` (`compose-and-run.sh`, `devin-fetch.sh`, …) and `slang-clarity-review-runner/scripts/run-clarity.sh` has been found at mode 0664, so calling one by path, as the workflow prose shows, fails at once with exit 126 "Permission denied". That looks like an instant completion, and a background wrapper (`echo "exit=$?"`) still reports exit 0. Always launch them as `bash <script> …`; their internal sub-calls already use `bash "$HERE/repro.sh"`. After a background dispatch, read the `.done` exit code and the head of the reviewer log before you wait on it: a "completed" notification seconds after dispatch means nothing ran, and a `>>> repro.sh:` line at the log head is the positive liveness check ([log done-markers are the authoritative completion signal](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md); [slang-pr-review-runner scripts lack exec bit — invoke via bash](../learnings/1791669928517-slang-pr-review-runner-scripts-lack-exec-bit-invok.md); [also seen 2026-10-10 alongside the concurrent-run clobber](../learnings/1791605773844-slang-pr-review-runner-concurrent-reviewer-a-runs-.md)). Every A launch also needs `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` and a private `REPO_ROOT` worktree; the full survival launch line is on [reviewer-runner infra](review-process-f0909b1-reviewer-runner-infra.md). The 10-10 note also records an unrelated docs-link fact: ReadTheDocs `docs.shader-slang.org/en/latest/external/stdlib-reference/` returns 404, while `external/core-module-reference/` is live and is what shader-slang.org/docs/ links, so docs PRs should use core-module-reference.

The detached-run helpers added since then have the same exec-bit gap: on 2026-10-17 `wait-run.sh` (the blocking waiter for a `--detach` run dir, which exits 124 on its own `--timeout` and 125 when the wrapper pid is gone with no `exit-status`) failed with exit 126 "Permission denied", and it did again on 10-20 (the read-only skills mount drops the bit), so call it as `bash "$SKILL_DIR/scripts/wait-run.sh" <run-dir> --timeout 540`. Keep the timeout under 600: a foreground Bash call is capped at 600 s whatever timeout you pass, so a `--timeout 1200` wait gets moved to the background. For a longer wait, arm a `Monitor` until-loop on `<run_dir>/exit-status` plus a `kill -0 $(cat <run_dir>/pid)` liveness check ([reviewing a stale-CHECK refresh (side note: wait-run.sh exec bit)](../learnings/1792230096725-reviewing-a-stale-check-refresh-run-the-check-bloc.md), [skill scripts are not executable; invoke wait-run.sh via bash](../learnings/1792509790688-skill-scripts-under-claude-skills-are-not-executab.md)).

**Never end a reviewer turn with only a background waiter armed.** On slang#13700 R4 the turn ended on a `run_in_background` until-loop waiting for Reviewers A and C; the session was torn down at about 07:53Z, A had finished at 06:52Z, and nobody was left to act on it, so the verdict sat unsent for about 5 hours until a supervisor nudge caught it (#13541 went 11 h late the same way). A background-wait notification is not guaranteed to reach you across a teardown. Before ending a turn with reviewers still running, record the run dirs and the next step in memory (that cut recovery to about 10 minutes), and either schedule a one-shot re-check through `ncl tasks create --process-after` or keep the turn open with chained `bash wait-run.sh <run-dir> --timeout 540` calls; the full turn-survival recipe is on [reviewer-run survival](review-pr-reviewer-run-survival.md). The same atom bounds retries of a dead Reviewer C: an inner-CLI API `ECONNREFUSED` killed C three times in one day on three different heads, so after two such failures record C as inconclusive (`reviewers_complete=false`) rather than spend another 90 minutes per re-run ([don't end a reviewer turn waiting on a background job](../learnings/1792239292199-don-t-end-a-reviewer-turn-waiting-on-a-background-.md)).

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
Operating that cross-repo run in practice adds four caveats. (1) It's diff-based, so `--repo
shader-slang/slang-rhi` is enough — `compose-and-run.sh`/`run-clarity.sh` keep `REPO_ROOT` at the
compiler checkout as CWD but fetch the target via `gh pr diff -R` and write the right repo into
`tmp/context.json`, and REVIEW.md is diff-first. (2) But local `Read src/...` of slang-rhi files FAILS
(CWD is the compiler), so Reviewer A compensates via `gh api`/WebFetch of the PR-head source
(`raw.githubusercontent.com/.../<head_sha>/...`); to make the merge solid, ground the key correctness
claims yourself against the mounted `/workspace/agent/slang-rhi` checkout via a subagent — but that
mount can be on a STALE branch, so verify against the fetched PR head (`git fetch origin pull/<n>/head`),
not the working tree. (3) slang-rhi Devin (B) returns a clean pass FAST (0 bugs/flags, exit 0); the
genuine signal is the Bugs/Flags/Informational sections — its "AI Analysis" block often just echoes the
PR description. (4) Budget: cap A and C for a two-reviewer slang-rhi peer-review (the author used $10
each; a ~3-file diff cost A ≈ $3.6), though heed the ≥$20 finish-headroom floor above — a low cap risks
the pre-`final-review.md` abort on a larger diff. And on a fixer PEER-REVIEW handoff with no
`<github-post-authorized />`, return `combined-review.md` via `send_file` only (no GitHub post) —
slang-rhi is also typically App-write-limited, so `post-back.sh` would 403→exit 3
[running /slang-pr-review on a non-compiler repo (slang-rhi)](../learnings/1789377211919-running-slang-pr-review-on-a-non-compiler-repo-sla.md).

**Source learnings (16):**
- [Reviewer run-dir selection: never pick by mtime when reviews share transcripts](../learnings/1788160503888-reviewer-run-dir-selection-never-pick-by-mtime-whe.md) — pick by RUN_DIR from task .output or PR/head-SHA in dir name; INTEGRITY-FAIL.txt is a hard stop.
- [Dispatching background reviewers: nohup & inside run_in_background double-backgrounds](../learnings/1788203787495-dispatching-background-reviewers-nohup-inside-run-.md) — run scripts directly or arm a Monitor kill-0 waiter; guard hook blocks pgrep -f.
- [Devin Review is static-only; and don't double-background reviewer dispatch](../learnings/1788341384825-devin-review-is-static-only-and-don-t-double-backg.md) — Devin never builds/runs; CI is the only oracle for arch-dependent runtime bugs; PID-wait monitor.
- [Dispatching /slang-pr-review reviewers in background: two gotchas](../learnings/1788446192623-dispatching-slang-pr-review-reviewers-in-backgroun.md) — run-clarity.sh lacks exec bit (use `bash`); keep waiter grep patterns in a script file.
- [gh via OneCLI app_not_connected blocks Reviewers A & C (curl still works)](../learnings/1788378606664-slang-pr-review-pipeline-gh-via-onecli-app-not-con.md) — escalate the env blocker, run B best-effort, deliver a PARTIAL review + RESUME.md; don't fake A/C.
- [/slang-pr-review runs cleanly against slang-rhi in pr mode](../learnings/1788477201526-slang-pr-review-runs-cleanly-against-slang-rhi-and.md) — A/C take --repo and fetch that repo's diff; App token authorizes reads despite the auth-status warning.
- [Running /slang-pr-review on a non-compiler repo (slang-rhi)](../learnings/1789377211919-running-slang-pr-review-on-a-non-compiler-repo-sla.md) — diff-based (`--repo` enough); local Reads fail so ground claims against the fetched PR head, not the stale mount; Devin passes fast (read Bugs/Flags, not "AI Analysis"); cap A/C for budget but mind the ≥$20 floor; no `<github-post-authorized />` → `send_file` only.
- [Reviewer A --max-budget-usd must be ≥20 or it cuts off before final-review.md](../learnings/1788751025464-slang-pr-review-reviewer-a-max-budget-usd-must-be-.md) — cap covers whole run (~$14); a low cap yields a 0-byte review; inner CLI billed separately from harness.
- [re-review gotchas: benign INTEGRITY-FAIL from concurrent A+C, stale Devin panel](../learnings/1788769244100-slang-pr-review-re-review-gotchas-benign-integrity.md) — trust pr-diff.reference sha + review body over the file-list; cross-check Devin line numbers on force-push.
- [Reviewer C drift check: a Read of slang-review-post-github/SKILL.md is NOT drift](../learnings/1788810108542-reviewer-c-drift-check-a-read-of-slang-review-post.md) — a Read of the post skill is benign; tighten the drift grep to Bash command bodies only.
- [slang-pr-review-runner scripts lack exec bit — invoke via bash](../learnings/1791669928517-slang-pr-review-runner-scripts-lack-exec-bit-invok.md) — every runner script has been found at 0664 (09-30, 10-07, 10-10); exit 126 reads as an instant completion; launch via `bash`, check `.done` and the log head
- [Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md)
- [slang-pr-review-runner: concurrent Reviewer A runs clobber each other in the shared /workspace/agent/slang checkout](../learnings/1791605773844-slang-pr-review-runner-concurrent-reviewer-a-runs-.md)
- [Don't end a reviewer turn waiting on a background job; the session can be torn down and the verdict silently dropped](../learnings/1792239292199-don-t-end-a-reviewer-turn-waiting-on-a-background-.md) — #13700 R4 (5 h) / #13541 (11 h) late verdicts; memory note + `ncl tasks` one-shot or chained `wait-run.sh --timeout 540`; C inconclusive after 2 ECONNREFUSED deaths.
- [Reviewing a stale-CHECK refresh (side note: wait-run.sh lacks the exec bit)](../learnings/1792230096725-reviewing-a-stale-check-refresh-run-the-check-bloc.md) — `wait-run.sh` exits 126 Permission denied; call it as `bash …/wait-run.sh`.
- [Skill scripts under ~/.claude/skills are not executable; invoke wait-run.sh via bash](../learnings/1792509790688-skill-scripts-under-claude-skills-are-not-executab.md) — 2026-10-20 recurrence (also compose-and-run, run-clarity, devin-fetch); foreground Bash caps at 600 s, so use a Monitor until-loop on `exit-status` + `kill -0` for longer waits.
