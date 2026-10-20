---
title: "Reviewer-Run Survival & Review-Tool Operational Infra"
type: concept
group: review-process
tags: [pr-review, pr-approver, reviewer-a, devin, session-teardown, background-wait, budget-cap, critique-gate, runner-ops, infra-abstain]
source_count: 58
---

# Reviewer-Run Survival & Review-Tool Operational Infra

Keeping reviewer and Devin runs alive, invoking them without false skips, posting, and the critique gate. Decision framework: [approver decision & shadow-mode](review-pr-approver-decision-and-shadow-mode.md); harvested signal: [harvest tiers & verdict reporting](review-pr-harvest-tiers-and-verdict-reporting.md); 30-min Bash cap and container restarts: [runner reliability](agent-infra-f0909b0-codex-and-pr-review-runners.md).

## TL;DR
- **Every reviewer fails toward CLEAN.** A dead run can show `Run state: success`, 0/0/0 and exit 0. Before trusting "no findings", check size (real: ~8–20 KB), a review heading, REVIEW-GUARD, tool uses > 0 per `summarize.py` subagent row, and `stream.jsonl` for `"status": "killed"`/`stopped`.
- **The outer turn must outlive its jobs.** A turn end or user interrupt kills background runs and builds, even under `setsid` (not OOM). Stay in the turn in re-armed bounded foreground polls; never end on a background wait. Keep your verification on disk so a verdict can ship with `reviewers_complete:false`.
- **Launch `compose-and-run.sh`/`run-clarity.sh` with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`** (not yet a script default) plus `--max-budget-usd`, or the inner `claude --print` lead ends its turn and its background subagents die. If it recurs, re-run once with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, then run the missing `.claude/agents/*` lenses yourself. The CLI version is not the trigger; still re-run `install.sh` after restarts.
- **Teardown vs budget cut:** `"status":"killed"` + `[Request interrupted by user]` with `parent_tool_use_id` set is a teardown; `error_max_budget_usd` is the cap. $30 is too little for a ~700–900-line diff: give 45–60 and re-dispatch only missing lenses.
- **Recover a stub from `stream.jsonl`/`reviewerA.log` before re-running.** Grep subagent summaries for crash/null/SIGSEGV: A's merge can drop a verified crash.
- **Isolate and identify your run:** private `REPO_ROOT` worktree, run dir from the runner's echo (never newest-mtime). INTEGRITY-FAIL and REVIEW-GUARD FAIL false-trip: adjudicate by sha and content.
- **Run runner scripts from `/home/node/.claude/skills/` via `bash`** (read-only `/app/skills` and the missing exec bit fail instantly yet look like success; tail each log).
- **A first Devin exit 3 means "not done yet."** Approver Devin-only tier: retry once before NO_REVIEW_SIGNAL; `/slang-pr-review`: B runs once, never gated on `isDraft`. No outer `timeout` under `--max-minutes`. Reconcile `devin-page.txt` with `devin-flags.md`; "unknown" status means verify on the pinned head. Never pre-fill `reviewers_complete:true`.
- **The critique gate counts only exact `/codex-critique` calls**; DECISION_REVIEW and OUTPUT_REVIEW are separate. Read PR data with `gh pr view --json`/`gh graphql`, never `gh api .../pulls`.
- **`post-review.sh` adds no bot disclaimer:** append it first; edit later via GraphQL.
- **A fast self-merge is normal:** do NOT escalate on the first silent reping (operator ruling).

## Outer turn: keeping background jobs alive

Background runs die at teardown (`stopped`, run_dir gone or a sub-500-byte "0 findings" stub), costing rounds ([#12023](../learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md); [#12060](../learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md) merged undecided). Persist the run-dir path; check the deliverable is ≥500 B and reviewed the current head ([verify](../learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md)). For the approver, a terminal event with empty `review/` and no `tmp/decided` is a coverage miss, not an APPROVED join. Escalating on the first silent reping was overruled (2026-07-13): healthy fast self-merges would trip it ([ruling](../learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md)).

**Ending your own turn triggers teardown**, so `/slang-pr-review`'s "end your turn after dispatching" is unsafe. The host stops the idle container minutes later (`oom=0`) and `nohup` jobs die: no verdict for 7 h on #13283 ([#13283](../learnings/1790619062342-slang-reviewer-ending-the-turn-after-dispatching-b.md)), twice in a row on #13315 ([#13315](../learnings/1790686802018-container-stops-when-the-turn-ends-keep-long-revie.md)), death ~90 s in on #13328 ([#13328](../learnings/1790712733292-reviewer-background-jobs-die-at-turn-end-keep-the-.md)), and #13541 R2 ended on a background `until [ -f *.done ]` wait, stranding the fixer ~11 h ([#13541](../learnings/1791764268124-never-end-a-reviewer-turn-on-a-background-wait-for.md)). Dead tasks don't resume. So:
1. Launch with `setsid nohup … < /dev/null &`; stay in the turn doing your own build and drills.
2. Block in bounded foreground loops (600000 ms timeout, polls ≤5 min) or a Monitor, re-armed until all jobs exit: `end=$((SECONDS+570)); while [ $SECONDS -lt $end ] && ps -p $PID >/dev/null; do sleep 15; done`.
3. Merge in the same turn; remove the orphaned `wt-clarity-*` worktree.
4. If your verification supports a verdict, send it naming reviewers still running; else tell the peer the ETA. (The verify `build/` survives restarts.)

**User interrupts kill `setsid` jobs too** (#13333 R2: three dead relaunches) ([interrupts](../learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md)). Write `review-<N>-my-verification.md` as you go so the verdict can ship with dead reviewers marked `_skipped: killed by session interrupt_`. Afterwards `git status` the verify worktree and rerun the restore build (an interrupted `generate_core_module_headers` leaves a stale module).

## Reviewer A: the inner lead ends its turn

**Mechanism.** Per REVIEW.md the inner `claude --print` lead backgrounds 5–7 subagents to await notifications, ending its turn. Print mode has no next turn: after a 600 s ceiling it logs `Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely` and kills them. `final-review.md` is the lead's interim sentence; exit 1, `REVIEW-GUARD FAIL: final review is <500 bytes`. Signatures: `task_notification` `status: stopped`, `[Request interrupted by user]` per subagent, `[RESULT] end_turn`, false 0/0/0. Intermittent (the lead's choice), any diff size: slang#12782's 332 B read 0/0/0 while ~$20 of subagents had found a REQUEST_CHANGES ([#12782](../learnings/1789468288728-reviewer-a-empty-final-review-md-on-large-diffs-60.md)); #13305 63 B after $16 ([#13305](../learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md)); #13322 failed 2/2 patch runs ([#13322](../learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md)); #13283 (2.1.283) 159 B ([#13283](../learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md)); #12646 R2 lost all 7 ($18) ([#12646](../learnings/1790837192079-slang-pr-review-runner-export-claude-code-print-bg.md)).

**Fix 1: remove the ceiling.** `repro.sh` passes the environment to the inner CLI: `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=<own worktree> setsid nohup bash …/compose-and-run.sh …` (#13305's re-run wrote 20 KB; #12646's took ~55 min, $24). Set it for `run-clarity.sh` too, with `--max-budget-usd` (no wall-clock bound remains). Still not a `repro.sh` default on 2026-10-04: #13429 run 1 left 177 B ([#13429](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)).

**Fix 2: forbid backgrounding.** On #13431 (2.1.289) the lead still backgrounded 5 subagents and ended its turn (all `killed`, 178-byte stub). `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 bash compose-and-run.sh …` ran them in the foreground, all `completed`. Confirm via `grep -a -o 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS' $(readlink -f ~/.local/bin/claude)`; it may cover 2.1.285's async dispatch (untested) and is the stronger `repro.sh` default ([#13431](../learnings/1791168330129-reviewer-a-inner-cli-can-end-its-turn-with-backgro.md)).

**Variants.**
- **Silent (exit 0).** #13377 said `Run state: success`, but its 1.5 KB `final-review.md` (passing REVIEW-GUARD) was a subagent fragment, all six `killed`. Grep `stream.jsonl` for `"status": "killed"`; check for a review heading ([#13377](../learnings/1790895880915-reviewer-a-exit-0-can-still-be-a-silent-kill-check.md)).
- **Late.** Two #13356 runs lost all subagents 17–22 min in. Salvage `task_notification` and main-thread `result` summaries, report `reviewers_complete=false`, and on a small delta use your verification plus the prior review, not a third retry ([#13356](../learnings/1790803785855-reviewer-a-inner-cli-can-be-interrupted-mid-run-17.md)).
- **Early.** A permission denial on a compound `gh pr diff … ; echo …` call ends the inner CLI before any subagent (~400 B, exit 0).

**Orphans; the version is not the trigger.** After the unpinned `install.sh` moved 2.1.280 to 2.1.285 (2026-09-30), #13284 failed twice (`killed.system=7`) ([2.1.285](../learnings/1790765591537-reviewer-a-slang-pr-review-runner-breaks-on-claude.md)) and #13345 orphaned 3/3 runs (~$14 each) with zero `"run_in_background":true` in `tool-uses.jsonl` (effectively async dispatch; prompting cannot help) ([3/3](../learnings/1790792204414-reviewer-a-orphan-is-now-3-3-on-claude-cli-2-1-285.md)). Diagnose via `grep -o '"subagent_stats":{[^}]*}[^}]*}[^}]*}' <run>/stream.jsonl | tail -1` and `"claude_code_version"`. If the last parent text says reviewers "are running in the background", nothing is recoverable (`subagents/` holds `.meta.json` stubs): `mv` the dir to `*-INCOMPLETE`, re-run at most once with the variable (#13378: 6 killed, $17.49) ([#13378](../learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md)). Pinning does not hold: a restart wipes `~/.local/bin/claude` so `compose-and-run.sh` falls back to `/pnpm/claude` (2.1.280), and #13432's early exit, first blamed on that, recurred after `install.sh` restored 2.1.289, which had passed earlier that day. Root cause unknown (nondeterministic backgrounding?). Keep the preflight (`claude --version` vs `stream.jsonl`), but stop re-running after one early exit ($11–19 each) ([correction: not the version](../learnings/1791209006651-correction-reviewer-a-early-exit-is-not-caused-by-.md)).

**Substitute instead.** Run the `.claude/agents/*` lenses (security, ir-correctness, test-coverage, code-quality) as coordinator Agent calls on the head worktree, full diff and REVIEW.md, apply its Step 3 filter, label it "Reviewer A (substitute, not the byte-equivalent pipeline)", quote A's partial notes from the `result` record, set `reviewers_complete=false`; C plus your verification carry the verdict. A delta re-review needs one code-quality lens (~$3).

## Reviewer A: budget cutoffs on large PRs

**Success can be empty.** On #13363 R2 (~900 lines) all 7 subagents had 0 tool uses and `final-review.md` said "still running", yet `summarize.py` said `Run state: success`; check tool uses per row and look for an "incomplete" header ([#13363](../learnings/1791081955973-reviewer-a-on-large-slang-prs-the-30-budget-can-cu.md)). (Its finished lenses still caught a bug: `doesSwizzleWriteWholeTexel` needs `texelType`, else `.yx` on a `[format("rgba32f")] RWTexture2D<float2>` zeroes `.zw`.)

**$30 does not cover a large diff, and removing the ceiling moves the cut to the budget.** #13363 and #13541 ended 3 of 7 lenses short; #13425 (725 lines) lost two to the ceiling, then two to the cap; #13564 (heavy IR) stopped 6/7 at ~$25. `final-review.md` then says "Review incomplete" (draft: `slang/tmp/review-candidates/pr-<N>/partial-findings-NOT-FOR-POSTING.md`); finished lenses survive in `task_notification` `<result>`. Give large or heavy-IR PRs 45–60; the [fleet budget table](review-pr-workflow-and-issue-hygiene.md) goes to 120–150 above ~15 files or ~2k lines ([#13425](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md), [#13564](../learnings/1792060963846-slang-pr-review-reviewer-a-30-budget-can-stop-6-7-.md)).

**Close the gap with the missing lenses only:** `Agent` with each unreturned lens's `subagent_type` (e.g. `ir-correctness-reviewer`) on a PR-head worktree, saved diff and your probe results (#13425: 45–95 min each, all completed). Keep `reviewers_complete=false`; say you closed the gap.

## Reviewer A: recovering a stub from stream.jsonl

Under ~1.5 KB is a stub. `<run_dir>/stream.jsonl` is the source of truth (subagent transcripts are deleted, leaving `.meta.json` id→agentType). Three recoverable causes:
- **Synthesis never flushed.** Take the last top-level (`subagent_type is None`) `**Verdict**` block; group by `subagent_type` to see finished lenses. Before writing it with a provenance note, confirm no `INTEGRITY-FAIL.txt`, `pr-diff.reference` sha == footer, zero review writes, head unchanged ([unflushed](../learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md)).
- **Subagents finished, lead did not** (also when one dies with "Agent terminated early due to an API error"). Recover lenses from `{"subtype":"task_notification"}` records with `len(summary)>200`, matched by `tool_use_id`; `status:"stopped"` with no output means the ceiling hit ([dead lens](../learnings/1789483811315-reviewer-a-final-review-md-can-be-a-truncated-stub.md)). Disclose they are unfiltered; name the missing lens. `reviewerA.log` holds the text untruncated (the `type:"assistant"` line with `subagent_type`, and the `task_notification` `summary`); C's is in `C-<pr>.log` (strip `N\t`). A hand-made extract for #13425 cut summaries at 4000 chars: check with `awk '{print length}'` ([reviewerA.log](../learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md)).
- **Trailing heartbeat.** A trailing Monitor heartbeat read as input can stub a finished review to ~200 B ("The final review is already complete…"). Recover the earlier top-level turn (`parent_tool_use_id == null`) with "Here is the complete final review" from `**Verdict**` on, recomputing counts (#13244: 7.4 KB, no ~$13 re-run) ([heartbeat](../learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md)).

**The merge step can drop a verified crash.** On #11709 R2 a subagent's null-deref SIGSEGV, missing from A's 0-bug review, reproduced (rc=139; E30015 on master). Grep summaries and result text for bug/crash/null/SIGSEGV and reproduce hits ([merge](../learnings/1790744483226-reviewer-a-s-merge-step-can-drop-a-subagent-s-veri.md)).

## Concurrent runs on the shared checkout

**Find your run dir** from the runner's echo (A: `>>> final review: <path>`, C: `>>> output → <path>`), never `ls -dt`/`-newermt` (a concurrent or stale run wins). A's `pr-<ts>` lacks the SHA: check a head-unique token in `pr-diff.reference`. A `bash … ; echo "exit: $?"` wrapper masks exits (Devin's 3 showed 0): read `devin-error.txt` ([echo](../learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md), [ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md)).

**False INTEGRITY-FAIL.** With the default `REPO_ROOT=/workspace/agent/slang` the guard re-reads the shared `tmp/pr-diff.patch` and `tmp/context.json`, which concurrent runs overwrite, failing with another PR's name. Full recipe: [Reviewer-A integrity & concurrency](review-process-f0909b0-reviewer-a-integrity-concurrency.md).
- Launch A with `REPO_ROOT=/workspace/agent/wt-<pr>-revA` (detached head worktree, GC-reaped) ([isolate](../learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md)).
- If it fires anyway: footer `<sha>` == `headRefOid`, footer `diff sha256` == `sha256sum <run_dir>/pr-diff.reference`, findings cite the PR's files, `summarize.py` drift==0. Never delete another run's `tmp/pr-diff.patch` ([four checks](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md)).
- The CLI often self-heals into `tmp/iso-<pr>-review/pr-diff.patch` while `context.json` stays polluted: use the verified `pr-diff.reference` sha as `diff_hash`; disclose the race ([self-heal](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md)).

**False REVIEW-GUARD FAIL.** Its `looks like an infrastructure error` check trips on infra wording ("transient API errors", an `exit(-1)` finding): a full Verdict + Findings review is a false trip, a <500 B verdict-less stub is real ([wording](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md)).

**Reviewer C mis-capture.** `clarity-review.md` under 2 KB without `### `/`## Kept`/`## Review Body` headers (rc=0) means the review went to `tmp/` ([tmp/](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md)) or a trailing meta-message was captured. Recover the largest `## Review Body`/`## Kept` text (or candidates-file `Write`) from `stream.jsonl`, noting provenance. Scope the drift grep to command fields (`gh api|--method (POST|PUT|…)|post-github|pulls/[0-9]+/reviews`); a bare `PATCH` matches prompts ([meta](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md)).

## Runner setup, cited files and posting

- **Where and how.** From read-only `/app/skills` the scripts fail `mkdir -p "$SKILL_DIR/transcripts/..."` in seconds, mimicking completion: use `/home/node/.claude/skills/<runner>/scripts/`. `gh pr view/diff` on public repos works even if `gh auth status` says the token is invalid ([writable](../learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md)). Scripts and `devin-fetch.sh` are mode 664: use `bash <script>` (#13429: all three "Permission denied", wrapper exit 0) ([#13429](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)).
- **slang-rhi PRs.** Keep `REPO_ROOT` on the slang checkout, pass `--repo shader-slang/slang-rhi --pr <N>`; vendored `external/slang-rhi/` may lag the head, so verify hunks via `gh pr diff` ([slang-rhi](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md)).
- **Artifacts and cited files.** Copy `final-review.md`, `clarity-review.md`, `tool-uses.jsonl` to `/workspace/agent/review-<pr>/` at once (`transcripts/` is shared). B via agent-browser cannot launch Chrome here (dbus): a deterministic skip. Drop A's findings on files absent from `gh pr view <N> --json files`, keeping the true kernel ("no regression test") ([cited](../learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md)).
- **Posting.** `post-review.sh` POSTs the body verbatim (event=COMMENT) without the bot-transparency disclaimer, so append it first ([disclaimer](../learnings/1783665412901-post-review-sh-posts-body-verbatim-no-bot-transpar.md)). REST `PUT /pulls/N/reviews/{id}` 404s under the App token; edit via GraphQL `updatePullRequestReview`, which keeps COMMENTED ([GraphQL](../learnings/1783669185294-slang-pr-review-rest-review-body-edit-404s-under-a.md)).

## Devin infra

**Devin-only tier: retry once.** A first exit 3 usually means Devin is not done (cold start). On the Devin-only tier (bot-authored, harvest exit 20), confirm the head is unchanged, reap Chromium (`pkill -f agent-browser`, clear `/tmp/agent-browser-chrome-*`, delete the stale `devin-error.txt`), and retry once wider (`--max-minutes 18 --poll-seconds 45` gave #12107 a full analysis) ([#12107](../learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md), [reap](../learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md)). Never retry past a `synchronize`; exits 2 (auth wall) and 4 (browser, self-retried) differ. Checkpoint pinned commit and clause/challenger state to `tmp/STATE.md` early. No guarantee: #13425 timed out thrice ([#13425](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md)). On the primary harvest tier Devin is best-effort and a URL-rewrite stall non-blocking: start early, cap the wait ~3 min after the primary lands, record `devin: skipped_stall` ([stall](../learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md)).

**In `/slang-pr-review`, B runs once** (15-min cap), never retried or gated on `isDraft`: Devin renders for anonymous viewers, drafts included. Every B run 2026-09-17..10-13 failed on a `devin-fetch.sh` done-check defect (fixed in slang-skills #62): on exit 3 read `devin-error.txt` before blaming the PR ([B runs once](../learnings/1791964273446-correction-devin-review-renders-for-anonymous-view.md)).

**Invocation.** A by-path `devin-fetch.sh` exits 126, faking a skip; use `bash` ([exec bit](../learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md)). An outer `timeout` under `--max-minutes` (default 30) yields 124/137, not the script's 0/2/3/4, faking ABSTAIN_INFRA:NO_REVIEW_SIGNAL; on the Devin-only tier, running Devin also turns `commit_match` UNEVALUABLE into PASS ([timeout](../learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md)). Invoke approver scripts via `python3`/`bash` ([invocation](../learnings/1783960724921-approver-ops-invoke-approver-scripts-via-python3-b.md)).

**Silent-data traps.**
- The extractor mis-parses "N Flags" triplets and writes "(none reported)" while `devin-page.txt` shows flags (6 on slang-rhi#831); reconcile with `rg -n 'Bugs|Flags|Informational'` ([Flags](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md)).
- `devin-commit-status.txt` = `"unknown"` after a `synchronize` is a cached prior-revision analysis: don't abstain or trust it; verify each finding on the pinned head's `compare` delta ([unknown](../learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md)).
- A companion clang-format PR on a force-pushed feature branch makes Devin miss the parent's merge delta: compare Devin's file count with live `base...head`; a mismatch is ABSTAIN_INFRA (STALE_STAGE) ([companion](../learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md)).

## Critique-gate hygiene

The gate records a round only for the exact `/codex-critique` format ([format](../learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md)), keyed to the first stage token, so DECISION_REVIEW and OUTPUT_REVIEW are separate calls; use `reason_code=CLEAN` for WOULD_APPROVE ([separate calls](../learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md)). Per-revision `[Approval Decision]` delivery to the dashboard is mandatory, apart from the materiality-gated `[Report]` ([per-revision](../learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md)).

`/app/hooks/gate-critique-on-deliver.sh` matches `gh api [^|]*pulls\b`, so read-only GETs trip it; with `edits_since_critique>0` or a stale OUTPUT_REVIEW it denies, and 3 denials hard-block. Diff R2 vs R1 `review-doc.md` locally, read PR data with `gh pr view <n> --json ...` or `gh graphql`, and never write a file in a read's command (it bumps `edits_since_critique`) ([GET trips](../learnings/1783913716215-approver-critique-mustfix-critique-gate-false-posi.md)).

`reviewers_complete:true` is checked against disk: true only when `devin-flags.md` exists or a bot review was harvested, never before Devin is terminal ([pre-fill](../learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md)).

**Source learnings (58):**
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
- [#13564: $30 budget stops 6/7 subagents; dyn-dispatch & export trip the post-DCE no-case error](../learnings/1792060963846-slang-pr-review-reviewer-a-30-budget-can-stop-6-7-.md) — inner CLI self-stops at ~$25; recover completed results from `task_notification`; use 60 on heavy IR PRs
- [#13429 exec bit lost; bg-wait variable still not baked in](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)
- [#13431 lead ends turn; CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1](../learnings/1791168330129-reviewer-a-inner-cli-can-end-its-turn-with-backgro.md)
- [CORRECTION: #13432 early exit is not the CLI version; stop after one](../learnings/1791209006651-correction-reviewer-a-early-exit-is-not-caused-by-.md)
- [never end on a background wait loop; #13541 stranded ~11 h](../learnings/1791764268124-never-end-a-reviewer-turn-on-a-background-wait-for.md)
- [CORRECTION: Devin renders for anonymous viewers, drafts included](../learnings/1791964273446-correction-devin-review-renders-for-anonymous-view.md) — exit-3 timeouts were fetch-script done-check defects (slang-skills #62); reviewer B runs once, never gated on `isDraft`.
