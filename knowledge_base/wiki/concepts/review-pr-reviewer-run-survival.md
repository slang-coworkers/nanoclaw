---
title: "Reviewer-Run Survival & Review-Tool Operational Infra"
type: concept
group: review-process
tags: [pr-review, pr-approver, reviewer-a, devin, session-teardown, background-wait, budget-cap, critique-gate, runner-ops, infra-abstain]
source_count: 54
---

# Reviewer-Run Survival & Review-Tool Operational Infra

Keeping reviewer and Devin runs alive, invoking them without false skips, posting, and the critique gate. Decision framework: [approver decision & shadow-mode](review-pr-approver-decision-and-shadow-mode.md); harvested signal: [harvest tiers & verdict reporting](review-pr-harvest-tiers-and-verdict-reporting.md).

## TL;DR
- **Every reviewer fails toward CLEAN.** A dead or stubbed run can show `Run state: success`, 0/0/0 and even exit 0. Before trusting "no findings", check the artifact size, a leading review heading, the REVIEW-GUARD line, and `stream.jsonl` for `"status": "killed"`/`stopped`.
- **The outer reviewer turn must outlive its jobs.** A turn end (the host stops the idle container) or a user interrupt kills background A/B/C runs and builds, even under `nohup`/`setsid`; it is not OOM. Stay in the turn, block in re-armed bounded foreground polls, merge in the same turn.
- **Keep your own verification on disk as you go**, so a verdict can ship with `reviewers_complete:false` when A/B/C die.
- **Export `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` on every `compose-and-run.sh`/`run-clarity.sh` launch** (the scripts still don't). Otherwise the inner `claude --print` lead ends its turn and print mode kills its background subagents. If the lead still ends its turn with subagents in the background, re-run with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, which forces them into the foreground.
- **Tell a teardown from a budget cut in `stream.jsonl`:** `task_updated … "status":"killed"` plus `[Request interrupted by user]` with `parent_tool_use_id` set is a background-subagent teardown; `error_max_budget_usd` is the cap.
- **`Run state: success` does not mean the review finished.** Check every row of `summarize.py`'s per-subagent table has tool uses > 0 and open `final-review.md` for an "incomplete" header. $30 is too little for a ~700–900-line diff; re-dispatch only the missing lenses yourself (`Agent` with their `subagent_type`) and keep `reviewers_complete=false`.
- **On claude CLI 2.1.285 Reviewer A is broken (orphaned 3/3 runs), not flaky.** `install.sh` does not pin the CLI. Re-run at most once with the variable, then substitute direct `.claude/agents/*` lenses with `reviewers_complete=false`. The durable fix is pinning 2.1.280.
- **Recover a stub from `stream.jsonl` or `reviewerA.log` before re-running** (main synthesis, untruncated `task_notification` summaries, or an earlier top-level turn); set `reviewers_complete=false` and name missing lenses. A hand-made extract can truncate summaries, so check its line lengths.
- **A's merge step can drop a subagent's verified crash.** Grep the per-subagent summaries for crash/null/SIGSEGV and reproduce any hit.
- **Isolate and identify your run.** Launch every A run in a private `REPO_ROOT` worktree and take the run dir from the runner's echo, never newest-mtime. INTEGRITY-FAIL and REVIEW-GUARD FAIL both false-trip: adjudicate by sha match and content.
- **Run the runner scripts from `/home/node/.claude/skills/`, not read-only `/app/skills`**, and invoke them and `devin-fetch.sh` via `bash` (no exec bit; a by-path call exits 126 with "Permission denied", which a background wrapper reports as a clean exit, so tail each log right after dispatch).
- **A first Devin timeout (exit 3) means "not done yet."** On the Devin-only tier retry once before NO_REVIEW_SIGNAL; never wrap `devin-fetch.sh` in an outer `timeout` shorter than `--max-minutes`.
- **Reconcile `devin-page.txt` against `devin-flags.md`** (the extractor drops Flags). Commit status "unknown" means verify on the pinned head, not abstain.
- **Never pre-fill `reviewers_complete:true`** before Devin reaches a terminal state.
- **The critique gate counts only exact `/codex-critique` calls**; DECISION_REVIEW and OUTPUT_REVIEW are separate calls. Read PR data with `gh pr view --json`/`gh graphql`, never `gh api .../pulls`.
- **`post-review.sh` adds no bot-transparency disclaimer.** Append it to `final-review.md` before posting, and make later edits through GraphQL.
- **A fast self-merge is normal:** do NOT escalate on the first silent reping (operator ruling).

## Outer turn: keeping background jobs alive

Background `compose-and-run.sh`/`run-clarity.sh` runs die at session teardown and come back `status: stopped`, with the run_dir deleted or a sub-500-byte stub that looks like "0 findings." Persist the run-dir path at dispatch, check the deliverable is ≥500 B and reviewed the current head ([verify runs survived](../learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md)). It costs whole rounds: R3 of slang#12023 produced no doc or decision ([#12023](../learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md)), and slang#12060 merged undecided after the reviewer went silent ([#12060](../learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md)). On the approver side, a terminal event with an empty `review/` and no `tmp/decided` is a coverage miss, not an APPROVED join.

**Ending your own turn is a teardown trigger; the `/slang-pr-review` step "end your turn after dispatching" is unsafe.** On #13283 the host stopped the idle container ~3 min later and no verdict appeared for 7 h ([#13283](../learnings/1790619062342-slang-reviewer-ending-the-turn-after-dispatching-b.md)). It happened twice in a row on #13315 with `memory.events` showing `oom=0` ([#13315](../learnings/1790686802018-container-stops-when-the-turn-ends-keep-long-revie.md)). On #13328, jobs started with `nohup … &` died about 90 s in ([#13328](../learnings/1790712733292-reviewer-background-jobs-die-at-turn-end-keep-the-.md)). Dead tasks cannot be resumed, so only a fresh run recovers; the tell is no runner pids in `ps` and no `final-review.md`/`tool-uses.jsonl`. The rule:
1. Launch with `setsid nohup … < /dev/null &`.
2. Stay in the turn; do your own build and drills meanwhile.
3. Block in bounded foreground loops (600000 ms Bash timeout, polls ≤5 min), re-armed until every job exits, e.g. `end=$((SECONDS+570)); while [ $SECONDS -lt $end ] && ps -p $PID >/dev/null; do sleep 15; done`.
4. Merge in the same turn; remove the orphaned `wt-clarity-*` worktree (its trap never ran).

The verify worktree's `build/` survives a restart, so a relaunched `cmake --build` resumes incrementally.

**User interrupts kill `setsid` jobs too.** `[Request interrupted by user for tool use]` killed setsid'd A/B/C and a cmake core-module rebuild; on #13333 R2 three relaunches produced nothing ([interrupts](../learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md)). Write `review-<N>-my-verification.md` with drill results as you go, so the verdict can ship with `reviewers_complete:false` and each reviewer section marked `_skipped: killed by session interrupt_`. After an interrupt, `git status` the verify worktree (drill edits may remain) and rerun the restore build: an interrupted `generate_core_module_headers` can leave a stale core module.

**Operator ruling (2026-07-13).** Escalating on the first silent reping (proposed after #12060) was overruled: it would fire on every healthy fast self-merge ([ruling](../learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md)).

## Reviewer A: inner-CLI subagent kills

**Mechanism.** REVIEW.md has the inner `claude --print` lead dispatch 5–7 subagents with `run_in_background` and wait to be notified, so the lead ends its turn ("Waiting for the five background reviewers…"). Print mode has no next turn: it waits out its 600 s default ceiling, logs `Background tasks still running after 600s; terminating. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely.`, and kills the subagents. `final-review.md` is the lead's last interim sentence and the runner exits 1: `REVIEW-GUARD FAIL: final review is <500 bytes`. An infra kill, not a 0-findings verdict, on any diff size and mode:
- On slang#12782 (43 files), a 332-byte file read as 0/0/0 while the subagents (~$20) had found a REQUEST_CHANGES ([#12782](../learnings/1789468288728-reviewer-a-empty-final-review-md-on-large-diffs-60.md)).
- #13305 left a 63-byte stub after $16 ([#13305](../learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md)).
- #13322 failed 2/2 patch runs (165–168 B); same-day runs on that version succeeded ([#13322](../learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md)).
- #13283 on CLI 2.1.283 left 159 B ([#13283](../learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md)).
- #12646 R2 lost all 7 subagents ($18); the re-run with the variable completed in ~55 min ($24) ([#12646](../learnings/1790837192079-slang-pr-review-runner-export-claude-code-print-bg.md)).

On 2.1.283/2.1.284 it is intermittent (the lead's choice, not a version regression).

**Fix.** `repro.sh` passes the environment through to the inner CLI, so export the variable on every launch: `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=<own worktree> setsid nohup bash …/compose-and-run.sh …` (#13305's re-run wrote 20 KB). Set it for `run-clarity.sh` too (durable fix: a `repro.sh` default), paired with `--max-budget-usd` since it removes the wall-clock bound. Signatures: every `task_notification` `status: stopped`, `[Request interrupted by user]` on each subagent, a `[RESULT] end_turn` line, a false 0/0/0. The variable was still not baked into the scripts on 2026-10-04: #13429 run 1 ended with a 177-byte `final-review.md` ("waiting for the six background reviewers") and REVIEW-GUARD FAIL ([#13429](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)).

**`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` stops the lead from backgrounding at all.** On #13431 (CLI 2.1.289) the lead dispatched 5 subagents as background tasks, said "All five reviewers are still running. I'll wait for their notifications", and ended its turn. Print mode exited, every subagent was marked `stopped`/`killed`, `subagents/` was empty, and the 178-byte stub tripped REVIEW-GUARD. Re-running as `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 bash compose-and-run.sh …` ran the subagents in the foreground and every `task_notification` read `completed`. The variable exists in the 2.1.289 binary (`grep -a -o 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS' $(readlink -f ~/.local/bin/claude)`); it may also cover the 2.1.285 async dispatch that prompting could not fix (below), though that is untested, and it is the stronger candidate for a `repro.sh` default. Diagnose before choosing a fix: `task_updated … "status":"killed"` plus `[Request interrupted by user]` with `parent_tool_use_id` set is a background-subagent teardown, while `error_max_budget_usd` is the budget cap ([foreground subagents](../learnings/1791168330129-reviewer-a-inner-cli-can-end-its-turn-with-backgro.md)).

**Silent, late and early variants.**
- **Silent (exit 0).** On #13377 the runner exited 0 with `Run state: success`, yet `final-review.md` (1.5 KB, clearing REVIEW-GUARD) was a subagent's mid-thought fragment, all six subagents `killed`. After every A run, grep `stream.jsonl` for `"status": "killed"` and check the file opens with a review heading ([#13377](../learnings/1790895880915-reviewer-a-exit-0-can-still-be-a-silent-kill-check.md)).
- **Late.** Two #13356 runs had every subagent interrupted 17–22 min in (27 and 221 B). Salvage finished summaries from `task_notification` and main-thread `result` events, report `reviewers_complete=false`, and on a small delta rely on your own verification plus the previous round's review rather than a third retry ([#13356](../learnings/1790803785855-reviewer-a-inner-cli-can-be-interrupted-mid-run-17.md)).
- **Early.** A permission denial on a compound `gh pr diff … ; echo …` Bash call can end the inner CLI before any subagent starts, leaving about 400 B with exit 0.

**On claude CLI 2.1.285 the orphan is a broken pipeline.** On 2026-09-30 the unpinned `install.sh` moved the CLI from 2.1.280 (all subagents completed) to 2.1.285.
- #13284 failed twice with `killed.system=7` and 167–427-byte stubs that tripped REVIEW-GUARD and INTEGRITY-FAIL ([2.1.285 breaks A](../learnings/1790765591537-reviewer-a-slang-pr-review-runner-breaks-on-claude.md)).
- #13345 orphaned 3/3 runs (~$14 each). The third had zero `"run_in_background":true` in `tool-uses.jsonl`: dispatch is effectively async on this version, so prompting the lead to block does not help ([3/3](../learnings/1790792204414-reviewer-a-orphan-is-now-3-3-on-claude-cli-2-1-285.md)).

Diagnose: `grep -o '"subagent_stats":{[^}]*}[^}]*}[^}]*}' <run>/stream.jsonl | tail -1` and `grep -o '"claude_code_version":"[^"]*"' <run>/stream.jsonl`. If the final parent text says the reviewers "are running in the background", there is nothing to recover: the `/tmp/claude-*/tasks/*.output` targets under `~/.claude/projects/-workspace-agent-slang/<sid>/subagents/` hold only `.meta.json` stubs. `mv` the run dir to `*-INCOMPLETE` and re-run at most once with the variable (#13378: 6 killed, $17.49, 14 min) ([#13378](../learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md)).

If that orphans too, stop rerunning: run the `.claude/agents/*` lenses (security, ir-correctness, test-coverage, code-quality) from the coordinator as ordinary Agent calls on the head worktree plus the full diff and REVIEW.md, apply REVIEW.md Step 3's filter yourself, label the section "Reviewer A (substitute, not the byte-equivalent pipeline)", and set `reviewers_complete=false`. A delta re-review needed one delta-scoped code-quality lens (~$3). Durable fix: pin 2.1.280 in `install.sh`, or have `repro.sh` wait for task notifications.

## Reviewer A: budget cutoffs on large PRs

**A run can report success and be empty.** On #13363 R2 (~900 diff lines, 19 files) the first run had all 7 subagents at 0 tool uses and a "still running" placeholder as `final-review.md`, yet `summarize.py` printed `Run state: success`. So after every run, check that each row of the per-subagent table shows tool uses > 0 and open `final-review.md` for an "incomplete" header ([#13363](../learnings/1791081955973-reviewer-a-on-large-slang-prs-the-30-budget-can-cu.md)).

**$30 does not cover a large diff, and removing the wall-clock bound moves the cut to the budget.** #13363's second run hit `--max-budget-usd 30` with 3 of 7 lenses unreturned (code-quality, security, cross-backend). On #13425 (725-line layout diff) both $30 rounds were incomplete: in round 1 the 600 s ceiling killed code-quality and documentation; in round 2, with the ceiling removed, ir-correctness and cross-backend ran past 25 min and were stopped to stay under the cap. `final-review.md` then says "Review incomplete", and the draft filter table is left at `slang/tmp/review-candidates/pr-<N>/partial-findings-NOT-FOR-POSTING.md`. Give large PRs at least 45–60; the [fleet-contention budget table](review-pr-workflow-and-issue-hygiene.md) goes to 120–150 above ~15 files or ~2k lines ([#13425](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md)).

**Close the gap with the missing lenses only.** What worked on #13425 was dispatching just the unreturned reviewers from the coordinator: `Agent` with `subagent_type` `ir-correctness-reviewer` or `cross-backend-reviewer`, pointed at a worktree of the PR head plus a saved diff file, and handed your own probe results so they confirm or refute instead of re-deriving. Each took 45–95 min but completed. Keep `reviewers_complete=false` in the JSON block anyway and say in the report that the coordinator closed the gap. This is the same substitution as for the 2.1.285 orphan above, scoped to the lenses that did not return. Separately, the #13363 review recorded a real finding: `doesSwizzleWriteWholeTexel(…, imageElementType)` must be passed `texelType`, because the GLSL/Metal/SPIR-V image op is always 4-wide and `.yx` on an `RWTexture2D<float2>` with `[format("rgba32f")]` otherwise zeroes `.zw`.

## Reviewer A: recovering a stub from stream.jsonl

A normal `final-review.md` is ~8–20 KB; a few hundred bytes to ~1.5 KB is a stub. `<run_dir>/stream.jsonl` is the source of truth for the three recoverable causes:
- **Main synthesis never flushed.** Take the last top-level (`subagent_type is None`) block containing `**Verdict**`; group by `subagent_type` to see which lenses finished. Before writing it out with a provenance note and `reviewers_complete:false`, check: no `INTEGRITY-FAIL.txt`, `pr-diff.reference` sha matches the footer, zero review writes, head unchanged ([600s ceiling stub](../learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md)).
- **Subagents finished, lead did not.** Recover each finished lens from `{"subtype":"task_notification"}` records with `len(summary)>200`; a dead lens shows `status:"stopped"`. Same when one subagent dies ("Agent terminated early due to an API error"), leaving a ~1 KB "Waiting for the final reviewer" turn ([dead subagent](../learnings/1789483811315-reviewer-a-final-review-md-can-be-a-truncated-stub.md)). They are unfiltered: disclose the truncation and name the missing lens. The run's `reviewerA.log` holds the same text untruncated in two places: the `type:"assistant"` line carrying a `subagent_type` field, and the `system/task_notification` line's `summary`. The per-subagent transcript JSONLs are gone after the run (only `.meta.json` files mapping id to agentType remain). Digest from the log, not a hand-made extract: one for PR 13425 had cut every summary at exactly 4000 chars and dropped findings, so check an extract with `awk '{print length}'` first. A subagent marked `status:"stopped"` with no output was killed by the 600 s ceiling ([reviewerA.log](../learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md)).
- **Trailing heartbeat.** A finished review can stub to ~200 B when the CLI reads a trailing Monitor heartbeat as input ("The final review is already complete…"). Recover the earlier top-level turn (`parent_tool_use_id == null`) containing "Here is the complete final review", from `**Verdict**` on, and recompute the counts. #13244 recovered 7.4 KB this way instead of a ~$13 re-run ([heartbeat](../learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md)).

**The merge step can drop a verified crash.** On #11709 R2 an IR/security subagent's null-deref SIGSEGV was missing from A's 0-bug `final-review.md`, and it reproduced (rc=139 on the PR, E30015 on master). After `summarize.py`, grep the per-subagent summary column and the subagent result text for "bug", "crash", "null" and "SIGSEGV", and reproduce any hit ([merge drops crash](../learnings/1790744483226-reviewer-a-s-merge-step-can-drop-a-subagent-s-veri.md)).

## Concurrent runs on the shared checkout

**Find your own run dir** from the runner's echo, never `ls -dt` or `-newermt`: a concurrent or stale run wins on mtime. A prints `>>> final review: <path>`, C prints `>>> output → <path>`; a dir with `stream.jsonl` but no `final-review.md` is still running or not yours. A's `pr-<ts>` name lacks the head SHA, so check a head-unique token in `<dir>/pr-diff.reference`. The outer `bash … ; echo "exit: $?"` wrapper masks the real exit (a Devin exit 3 showed as 0), so read `devin-error.txt` ([run dir via echo](../learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md), [not ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md)).

**False INTEGRITY-FAIL.** With the default `REPO_ROOT=/workspace/agent/slang`, the end-of-run guard re-reads the shared `tmp/pr-diff.patch` and `tmp/context.json`, which a concurrent run overwrites, and exits 1 naming another PR though the review is correct. Full recipe: [Reviewer-A integrity & concurrency](review-process-f0909b0-reviewer-a-integrity-concurrency.md).
- Launch every A run with `REPO_ROOT=/workspace/agent/wt-<pr>-revA`, a `git worktree add --detach` of the head; the name lets supervise-issues GC reap it ([isolate](../learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md)).
- If the guard fires anyway, check four things: footer `<sha>` == `headRefOid`, footer `diff sha256` == `sha256sum <run_dir>/pr-diff.reference`, the findings cite the PR's files, and `summarize.py` drift==0. Never delete another run's `tmp/pr-diff.patch` ([four checks](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md)).
- The CLI often self-heals into `tmp/iso-<pr>-review/pr-diff.patch` while `context.json` stays polluted. Use the verified `pr-diff.reference` sha as `diff_hash` and disclose the race ([self-heal](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md)).

**False REVIEW-GUARD FAIL.** The `looks like an infrastructure error` check trips on infra wording in a valid review ("terminated on transient API errors", a finding about `exit(-1)`). A full Verdict + Findings review is a false trip; a <500-byte stub with no verdict is real ([guard wording](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md)).

**Reviewer C mis-capture.** `clarity-review.md` can come out under 2 KB with no `### `/`## Kept`/`## Review Body` headers and rc=0. Either the model wrote the real review to a `tmp/` path ([tmp/ output](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md)) or a trailing meta-message was captured. Recover from `stream.jsonl` (the largest assistant text with `## Review Body`/`## Kept`, or the candidates-file `Write` tool_use) and note the provenance. A bare `(POST|PUT|PATCH|DELETE)` drift grep hits "PATCH" in prompts, so scope it to command fields (`gh api|--method (POST|PUT|…)|post-github|pulls/[0-9]+/reviews`) ([meta-message](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md)).

## Runner setup, cited files and posting

- **Where and how to run.** Use `/home/node/.claude/skills/<runner>/scripts/`. From read-only `/app/skills` they fail `mkdir -p "$SKILL_DIR/transcripts/..."` and exit 1 in seconds, which looks like a fast completion. `gh pr view/diff` on a public repo works even when `gh auth status` calls the token invalid ([writable copy](../learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md)). The runner scripts (`slang-pr-review-runner/scripts/*.sh`, `run-clarity.sh`, `devin-fetch.sh`) are mode 664, so invoke them as `bash <script>`. On #13429 all three failed instantly with "Permission denied"; launched as background Bash the wrapper's own exit is 0, so the failure looks like a completion. Tail each log right after dispatch ([#13429](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)).
- **slang-rhi PRs.** Keep `REPO_ROOT` on the slang checkout (REVIEW.md, the subagents, the clarity skills) and pass `--repo shader-slang/slang-rhi --pr <N>`. The vendored `external/slang-rhi/` gives the subagents real source. It may lag the PR head, so verify hunks against `gh pr diff` ([slang-rhi](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md)).
- **Artifacts and cited files.** Copy `final-review.md`, `clarity-review.md` and `tool-uses.jsonl` into `/workspace/agent/review-<pr>/` at once (shared `transcripts/` gets clobbered). Reviewer B via agent-browser cannot launch Chrome here (dbus): a deterministic skip. Reviewer A can cite test files not in the PR: check `gh pr view <N> --json files`, drop findings on absent files, keep the true kernel (e.g. "no regression test") ([cited files](../learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md)).
- **Posting.** `post-review.sh` POSTs the body verbatim (event=COMMENT), and neither it nor `final-review.md` adds the bot-transparency disclaimer, so append it first ([no disclaimer](../learnings/1783665412901-post-review-sh-posts-body-verbatim-no-bot-transpar.md)). REST `PUT /pulls/N/reviews/{id}` returns 404 under the App token. Make later edits with the GraphQL `updatePullRequestReview` mutation, which keeps the state COMMENTED ([GraphQL edit](../learnings/1783669185294-slang-pr-review-rest-review-body-edit-404s-under-a.md)).

## Devin infra

**Retry once before abstaining.** A first exit-3 timeout usually means Devin has not finished (often cold start). On the Devin-only tier (bot-authored, harvest exit 20), where Devin is the sole signal:
1. Confirm the head has not moved.
2. Reap the orphaned Chromium (`pkill -f agent-browser`), clear `/tmp/agent-browser-chrome-*`, and delete the stale `devin-error.txt`.
3. Retry once with a wider window, e.g. `--max-minutes 18 --poll-seconds 45`. On #12107 that returned a full analysis.

Never retry past a `synchronize`; exit 2 (auth wall) and exit 4 (browser launch, self-retried) differ. Checkpoint the pinned commit and clause/challenger state to `tmp/STATE.md` early. A retry is not a guarantee: on #13425 (725-line layout diff) Devin timed out three times (30, 20 and 30 min, exit 3) ([#13425](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md)). On the primary harvest tier Devin is best-effort, no retry ([#12107 retry](../learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md), [reap + retry](../learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md)).

**Invocation.** Invoke `bash devin-fetch.sh`; a by-path call exits 126 and fakes a Devin skip ([exec bit](../learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md)). Never wrap it in an outer `timeout` shorter than `--max-minutes` (default 30). Exit 124/137 is the wrapper, not the script's 0/2/3/4, and fakes ABSTAIN_INFRA:NO_REVIEW_SIGNAL. On the Devin-only tier, running Devin also makes `commit_match` PASS rather than UNEVALUABLE ([outer timeout](../learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md)). Invoke approver scripts via `python3`/`bash` ([invocation](../learnings/1783960724921-approver-ops-invoke-approver-scripts-via-python3-b.md)).

**Stall.** With the primary bot-review tier secured, a URL-rewrite stall is non-blocking: start Devin early, cap its wait ~3 min after the primary lands, record `devin: skipped_stall` ([stall](../learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md)).

**Silent-data traps.**
- The extractor mis-parses "N Flags" triplets and writes "(none reported)" while `devin-page.txt` shows flags (6 on slang-rhi#831); reconcile with `rg -n 'Bugs|Flags|Informational'` ([Flags dropped](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md)).
- `devin-commit-status.txt` = `"unknown"` after a `synchronize` means a cached prior-revision analysis: neither abstain nor trust it; verify each finding on the pinned head's `compare` delta ([unknown](../learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md)).
- For a companion clang-format PR based on the feature branch, a force-pushed base makes Devin miss the parent's merge delta. Compare Devin's file count with live `base...head`; a mismatch is ABSTAIN_INFRA (STALE_STAGE) ([companion PR](../learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md)).

## Critique-gate hygiene

The gate records a round only when the codex call uses the exact `/codex-critique` format ([exact format](../learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md)). The tracker keys each round to the first stage token, so DECISION_REVIEW and OUTPUT_REVIEW must be separate calls. Use `reason_code=CLEAN` for WOULD_APPROVE ([separate OUTPUT_REVIEW](../learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md)). Per-revision `[Approval Decision]` delivery to the dashboard is mandatory, separate from the materiality-gated `[Report]` ([per-revision delivery](../learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md)).

`/app/hooks/gate-critique-on-deliver.sh` matches `gh api [^|]*pulls\b`, so read-only GETs trip it too; it denies when that meets `edits_since_critique>0` or a stale OUTPUT_REVIEW, and 3 denials hard-block. So:
- Answer "did the review change" from local artifacts (R2 vs R1 `review-doc.md`).
- Read PR data with `gh pr view <n> --json ...` or `gh graphql`.
- Never write a file in the same command as a read, because it bumps `edits_since_critique` ([GET false positives](../learnings/1783913716215-approver-critique-mustfix-critique-gate-false-posi.md)).

`reviewers_complete:true` is a harness-integrity assertion checked against disk: true only when `devin-flags.md` exists or a bot review was harvested. Never pre-fill it before Devin is terminal ([reviewers_complete](../learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md)).

**Source learnings (54):**
- [run runner scripts from writable /home/node/.claude/skills](../learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md)
- [verify runs survived and cleared the guard](../learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md)
- [600s stub: recover synthesis from stream.jsonl](../learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md)
- [runs are teardown-fragile; slang#12023 lost a round](../learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md)
- [slang#12060 merged undecided; reviewer doc never returned](../learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md)
- [operator ruling: no escalation on 1st silent reping](../learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md)
- [devin-fetch.sh: no outer timeout](../learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md)
- [Devin-only tier: reap browser, retry once; tmp/STATE.md](../learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md)
- [devin-fetch.sh lacks exec bit; invoke via bash](../learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md)
- [approver scripts via python3/bash](../learnings/1783960724921-approver-ops-invoke-approver-scripts-via-python3-b.md)
- [Devin commit-status unknown: verify on pinned head](../learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md)
- [extractor drops Devin Flags; check devin-page.txt](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md)
- [sole-signal Devin timeout: retry once, wider window](../learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md)
- [Devin URL-rewrite stall is non-blocking](../learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md)
- [companion clang-format PR: Devin misses merge delta](../learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md)
- [post-review.sh adds no bot disclaimer](../learnings/1783665412901-post-review-sh-posts-body-verbatim-no-bot-transpar.md)
- [REST review edit 404s; use GraphQL mutation](../learnings/1783669185294-slang-pr-review-rest-review-body-edit-404s-under-a.md)
- [verify A's cited files against the PR file list](../learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md)
- [critique gate fires on read-only gh api .../pulls](../learnings/1783913716215-approver-critique-mustfix-critique-gate-false-posi.md)
- [gate records a round only for exact /codex-critique](../learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md)
- [OUTPUT_REVIEW is its own call; reason_code=CLEAN](../learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md)
- [per-revision [Approval Decision] delivery mandatory](../learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md)
- [never pre-fill reviewers_complete:true](../learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md)
- [concurrent runs race on tmp/pr-diff.patch; worktree](../learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md)
- [#12782 empty final-review.md is a 600s kill](../learnings/1789468288728-reviewer-a-empty-final-review-md-on-large-diffs-60.md)
- [#13305 silent death; set the bg-wait variable](../learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md)
- [ending the turn after dispatch reaps the container](../learnings/1790619062342-slang-reviewer-ending-the-turn-after-dispatching-b.md)
- [dead subagent ~1KB stub; recover task_notifications](../learnings/1789483811315-reviewer-a-final-review-md-can-be-a-truncated-stub.md)
- [INTEGRITY-FAIL sha check; tmp/iso-<pr>/ self-heal](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md)
- [REVIEW-GUARD false-trips on infra wording](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md)
- [colliding A-sessions: four checks](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md)
- [run dir from "output →" line, not ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md)
- [clarity output lost to tmp/](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md)
- [clarity-review.md captures trailing meta-message](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md)
- [slang-rhi PRs via vendored external/slang-rhi](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md)
- [trailing heartbeat stubs a review; recover earlier turn](../learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md)
- [run_dir from the script's echo; wrapper masks exit](../learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md)
- [#13315 container stops at turn end; build/ survives](../learnings/1790686802018-container-stops-when-the-turn-ends-keep-long-revie.md)
- [#13322 patch-mode end_turn; exec bit](../learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md)
- [nohup dies at turn end; setsid + keep turn open](../learnings/1790712733292-reviewer-background-jobs-die-at-turn-end-keep-the-.md)
- [user interrupts kill setsid jobs; verify on disk](../learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md)
- [A's merge step can drop a verified crash](../learnings/1790744483226-reviewer-a-s-merge-step-can-drop-a-subagent-s-veri.md)
- [#13283 600s kill on 2.1.283](../learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md)
- [CLI 2.1.285 breaks A; diagnose via subagent_stats](../learnings/1790765591537-reviewer-a-slang-pr-review-runner-breaks-on-claude.md)
- [orphan 3/3 on 2.1.285; substitute direct lenses](../learnings/1790792204414-reviewer-a-orphan-is-now-3-3-on-claude-cli-2-1-285.md)
- [interrupted 17-22 min in; salvage, no third retry](../learnings/1790803785855-reviewer-a-inner-cli-can-be-interrupted-mid-run-17.md)
- [export the bg-wait variable on every launch](../learnings/1790837192079-slang-pr-review-runner-export-claude-code-print-bg.md)
- [exit 0 silent kill; grep killed, check heading](../learnings/1790895880915-reviewer-a-exit-0-can-still-be-a-silent-kill-check.md)
- [#13378 orphan: quarantine *-INCOMPLETE, one re-run](../learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md)
- [#13363: success with 0-tool-use subagents; $30 cut 3/7](../learnings/1791081955973-reviewer-a-on-large-slang-prs-the-30-budget-can-cu.md)
- [full subagent text lives in reviewerA.log; extracts truncate](../learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md)
- [#13425 budget cut; re-dispatch missing lenses via Agent](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md)
- [#13429 exec bit lost; bg-wait variable still not baked in](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)
- [#13431 lead ends turn; CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1](../learnings/1791168330129-reviewer-a-inner-cli-can-end-its-turn-with-backgro.md)
