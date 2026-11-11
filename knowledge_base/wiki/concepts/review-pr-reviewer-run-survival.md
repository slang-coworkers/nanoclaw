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
- **Every reviewer fails toward CLEAN.** A dead run can show `Run state: success`, 0/0/0 and exit 0. Before trusting "no findings", check size (real: ~8–20 KB), a review heading, REVIEW-GUARD, per-subagent tool uses > 0 (`summarize.py`), and `stream.jsonl` for `killed`/`stopped`.
- **The outer turn must outlive its jobs.** A turn end or user interrupt kills background runs and builds, even under `setsid` (not OOM). Stay in the turn with re-armed bounded foreground polls; never end on a background wait. Keep your verification on disk so a verdict can ship with `reviewers_complete:false`.
- **Inner-lead orphaning is fixed by default:** `repro.sh`/`run-clarity.sh` export `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` (foreground subagents). Always pass `--max-budget-usd`; if a stub still appears, run the missing `.claude/agents/*` lenses yourself rather than re-running. The CLI version is not the trigger; re-run `install.sh` after restarts.
- **Teardown vs budget cut:** `"status":"killed"` + `[Request interrupted by user]` with `parent_tool_use_id` set is a teardown; `error_max_budget_usd` is the cap. $30 is too little for a ~700–900-line diff: give 45–60 and re-dispatch only missing lenses.
- **Recover a stub from `stream.jsonl`/`reviewerA.log` before re-running.** Grep subagent summaries for crash/null/SIGSEGV: A's merge can drop a verified crash.
- **Isolate and identify your run:** private `REPO_ROOT` worktree, run dir from the runner's echo (never newest-mtime). INTEGRITY-FAIL and REVIEW-GUARD FAIL false-trip: adjudicate by sha and content.
- **Run runner scripts from `/home/node/.claude/skills/` via `bash`** (read-only `/app/skills` and the missing exec bit fail instantly yet look like success; tail each log).
- **A first Devin exit 3 means "not done yet."** Approver Devin-only tier: retry once before NO_REVIEW_SIGNAL; in `/slang-pr-review` B runs once, ungated by `isDraft`. No outer `timeout`. Reconcile `devin-page.txt` with `devin-flags.md`; "unknown" status → verify on the pinned head. Never pre-fill `reviewers_complete:true`.
- **The critique gate counts only exact `/codex-critique` calls**; DECISION_REVIEW and OUTPUT_REVIEW are separate. Read PRs via `gh pr view --json`/`gh graphql`, never `gh api .../pulls`.
- **`post-review.sh` adds no bot disclaimer:** append it first; edit later via GraphQL.
- **A fast self-merge is normal:** do NOT escalate on the first silent reping (operator ruling).

## Outer turn: keeping background jobs alive

Background runs die at teardown (`stopped`, run_dir gone, or a <500 B "0 findings" stub), costing rounds ([#12023](../learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md); [#12060](../learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md) merged undecided). Persist the run-dir path; check the deliverable is ≥500 B and covers the current head ([verify](../learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md)). For the approver, a terminal event with empty `review/` and no `tmp/decided` is a coverage miss, not an APPROVED join. Escalating on the first silent reping was overruled (2026-07-13), since fast self-merges trip it ([ruling](../learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md)).

**Ending your own turn triggers teardown**, so `/slang-pr-review`'s "end your turn after dispatching" is unsafe: the host stops the idle container minutes later (`oom=0`), killing `nohup` jobs: 7 h with no verdict ([#13283](../learnings/1790619062342-slang-reviewer-ending-the-turn-after-dispatching-b.md)), twice in a row ([#13315](../learnings/1790686802018-container-stops-when-the-turn-ends-keep-long-revie.md)), death ~90 s in ([#13328](../learnings/1790712733292-reviewer-background-jobs-die-at-turn-end-keep-the-.md)), and [#13541](../learnings/1791764268124-never-end-a-reviewer-turn-on-a-background-wait-for.md) R2 ending on a background `until [ -f *.done ]` wait, stranding the fixer ~11 h. Dead tasks don't resume. So:
1. Launch with `setsid nohup … < /dev/null &`; stay in the turn doing your own build/drills.
2. Block in bounded foreground loops (600000 ms timeout, polls ≤5 min) or a Monitor, re-armed until every job exits: `end=$((SECONDS+570)); while [ $SECONDS -lt $end ] && ps -p $PID >/dev/null; do sleep 15; done`.
3. Merge in the same turn; remove the orphaned `wt-clarity-*` worktree.
4. If your verification supports a verdict, send it naming reviewers still running; else give the peer an ETA (the verify `build/` survives restarts).

**User interrupts kill `setsid` jobs too** (#13333 R2: 3 dead relaunches) ([interrupts](../learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md)). Write `review-<N>-my-verification.md` as you go so the verdict can ship with dead reviewers marked `_skipped: killed by session interrupt_`; afterwards `git status` the verify worktree and rerun the restore build (an interrupted `generate_core_module_headers` leaves a stale module).

## Reviewer A: the inner lead ends its turn

**History.** Per REVIEW.md the inner `claude --print` lead backgrounded 5–7 subagents and ended its turn to await them; print mode has no next turn, so after a 600 s ceiling it logged `Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely` and killed them, leaving its interim sentence as `final-review.md` (exit 1, `REVIEW-GUARD FAIL: final review is <500 bytes`; signatures: `task_notification` `status: stopped`, `[Request interrupted by user]` per subagent, `[RESULT] end_turn`, false 0/0/0). Any diff size: [#12782](../learnings/1789468288728-reviewer-a-empty-final-review-md-on-large-diffs-60.md) 332 B while ~$20 of subagents had found REQUEST_CHANGES; [#13305](../learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md) 63 B after $16; [#13322](../learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md) 2/2 patch runs; [#13283](../learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md) 159 B; [#12646](../learnings/1790837192079-slang-pr-review-runner-export-claude-code-print-bg.md) R2 all 7 lost, $18. The ceiling variable helped (#13305 re-run: 20 KB) but was never baked in ([#13429](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md) run 1: 177 B, 2026-10-04), and on [#13431](../learnings/1791168330129-reviewer-a-inner-cli-can-end-its-turn-with-backgro.md) (2.1.289) the lead still ended its turn (all 5 `killed`); `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` ran them in the foreground, all `completed`.

**Now the default.** `repro.sh` and `run-clarity.sh` both `export CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` (check `grep -n DISABLE_BACKGROUND_TASKS scripts/*.sh`; CLI support: `grep -a -o 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS' $(readlink -f ~/.local/bin/claude)`). With no wall-clock bound, always pass `--max-budget-usd`.

**Variants.**
- **Silent (exit 0).** #13377's `Run state: success` 1.5 KB `final-review.md` (passing REVIEW-GUARD) was a subagent fragment, all six `killed`: grep `stream.jsonl` for `"status": "killed"`, check for a review heading ([#13377](../learnings/1790895880915-reviewer-a-exit-0-can-still-be-a-silent-kill-check.md)).
- **Late.** Two #13356 runs lost all subagents 17–22 min in: salvage `task_notification`/`result` summaries, report `reviewers_complete=false`; on a small delta use your verification plus the prior review, not a third retry ([#13356](../learnings/1790803785855-reviewer-a-inner-cli-can-be-interrupted-mid-run-17.md)).
- **Early.** A permission denial on a compound `gh pr diff … ; echo …` ends the inner CLI before any subagent (~400 B, exit 0).
- **Orphan.** On 2.1.285 (2026-09-30) #13284 failed twice (`killed.system=7`) ([2.1.285](../learnings/1790765591537-reviewer-a-slang-pr-review-runner-breaks-on-claude.md)) and #13345 orphaned 3/3 runs with no `"run_in_background":true` in `tool-uses.jsonl` ([3/3](../learnings/1790792204414-reviewer-a-orphan-is-now-3-3-on-claude-cli-2-1-285.md)). Diagnose with `grep -o '"subagent_stats":{[^}]*}[^}]*}[^}]*}' <run>/stream.jsonl | tail -1` and `"claude_code_version"`. If the last parent text says reviewers "are running in the background", nothing is recoverable: `mv` the dir to `*-INCOMPLETE`, re-run at most once (#13378: 6 killed, $17.49) ([#13378](../learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md)). The version is not the trigger: #13432's early exit recurred on a restored 2.1.289 that had passed that day (restarts wipe `~/.local/bin/claude`; fallback `/pnpm/claude` is 2.1.280). Keep the `claude --version` vs `stream.jsonl` preflight; stop after one early exit ($11–19 each) ([correction: not the version](../learnings/1791209006651-correction-reviewer-a-early-exit-is-not-caused-by-.md)).

**Substitute instead.** Run the `.claude/agents/*` lenses (security, ir-correctness, test-coverage, code-quality) as Agent calls on the head worktree with the diff and REVIEW.md, apply its Step 3 filter, label it "Reviewer A (substitute, not the byte-equivalent pipeline)", quote A's partial notes, set `reviewers_complete=false`; C plus your verification carry the verdict. A delta re-review needs one code-quality lens (~$3).

## Reviewer A: budget cutoffs on large PRs

**Success can be empty.** On #13363 R2 (~900 lines) all 7 subagents had 0 tool uses and `final-review.md` said "still running", yet `summarize.py` said `Run state: success`: check per-row tool uses and an "incomplete" header ([#13363](../learnings/1791081955973-reviewer-a-on-large-slang-prs-the-30-budget-can-cu.md)). (Its finished lenses still found a real bug.)

**$30 does not cover a large diff; with no wait ceiling the cut moves to the budget.** #13363 and #13541 ended 3/7 short; #13425 (725 lines) lost two to the ceiling, then two to the cap; #13564 (heavy IR) stopped 6/7 at ~$25. `final-review.md` then says "Review incomplete" (draft: `slang/tmp/review-candidates/pr-<N>/partial-findings-NOT-FOR-POSTING.md`); finished lenses survive in `task_notification` `<result>`. Give large or heavy-IR PRs 45–60 ([#13425](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md), [#13564](../learnings/1792060963846-slang-pr-review-reviewer-a-30-budget-can-stop-6-7-.md)); the [fleet budget table](review-pr-workflow-and-issue-hygiene.md) goes to 120–150 above ~15 files or ~2k lines. Close the gap with the missing lenses only (`Agent` with each unreturned `subagent_type`, e.g. `ir-correctness-reviewer`, on a PR-head worktree with the saved diff and your probes; #13425: 45–95 min each, all completed); keep `reviewers_complete=false` and say so.

## Reviewer A: recovering a stub from stream.jsonl

Under ~1.5 KB is a stub. `<run_dir>/stream.jsonl` is the source of truth (subagent transcripts are deleted, leaving `.meta.json` id→agentType). Recoverable causes:
- **Synthesis never flushed.** Take the last top-level (`subagent_type is None`) `**Verdict**` block; group by `subagent_type` to see finished lenses. Before writing it with a provenance note, confirm no `INTEGRITY-FAIL.txt`, `pr-diff.reference` sha == footer, no review writes, head unchanged ([unflushed](../learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md)).
- **Subagents finished, lead did not** (also when one dies with "Agent terminated early due to an API error"). Recover lenses from `{"subtype":"task_notification"}` records with `len(summary)>200`, matched by `tool_use_id`; `status:"stopped"` without output is a ceiling hit ([dead lens](../learnings/1789483811315-reviewer-a-final-review-md-can-be-a-truncated-stub.md)). Disclose they are unfiltered; name the missing lens. `reviewerA.log` holds the text untruncated (`type:"assistant"` lines with `subagent_type`, `task_notification` `summary`); C's is in `C-<pr>.log` (strip `N\t`). A hand-made #13425 extract cut summaries at 4000 chars (check `awk '{print length}'`) ([reviewerA.log](../learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md)).
- **Trailing heartbeat.** A Monitor heartbeat read as input can stub a finished review to ~200 B ("The final review is already complete…"). Recover the earlier top-level turn (`parent_tool_use_id == null`) containing "Here is the complete final review", from `**Verdict**` on, recomputing counts (#13244: 7.4 KB, saved a ~$13 re-run) ([heartbeat](../learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md)).

**The merge step can drop a verified crash.** On #11709 R2 a subagent's null-deref SIGSEGV, absent from A's 0-bug review, reproduced (rc=139; E30015 on master): grep summaries and result text for bug/crash/null/SIGSEGV and reproduce hits ([merge](../learnings/1790744483226-reviewer-a-s-merge-step-can-drop-a-subagent-s-veri.md)).

## Concurrent runs on the shared checkout

**Find your run dir** from the runner's echo (A: `>>> final review: <path>`, C: `>>> output → <path>`), never `ls -dt`/`-newermt` (a concurrent or stale run wins). A's `pr-<ts>` lacks the SHA: grep a head-unique token in `pr-diff.reference`. A `bash … ; echo "exit: $?"` wrapper masks exits (Devin's 3 showed 0); read `devin-error.txt` ([echo](../learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md), [ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md)).

**False INTEGRITY-FAIL.** With the default `REPO_ROOT=/workspace/agent/slang` the guard re-reads the shared `tmp/pr-diff.patch`/`tmp/context.json`, which concurrent runs overwrite (full recipe: [Reviewer-A integrity & concurrency](review-process-f0909b0-reviewer-a-integrity-concurrency.md)). Launch A with `REPO_ROOT=/workspace/agent/wt-<pr>-revA`, a detached head worktree ([isolate](../learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md)). If it fires anyway, check footer `<sha>` == `headRefOid`, footer `diff sha256` == `sha256sum <run_dir>/pr-diff.reference`, findings cite the PR's files, `summarize.py` drift==0; never delete another run's `tmp/pr-diff.patch` ([four checks](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md)). The CLI often self-heals into `tmp/iso-<pr>-review/pr-diff.patch` while `context.json` stays polluted: use the verified `pr-diff.reference` sha as `diff_hash` and disclose the race ([self-heal](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md)).

**False REVIEW-GUARD FAIL.** Its `looks like an infrastructure error` check trips on infra wording ("transient API errors", an `exit(-1)` finding): a full Verdict + Findings review is a false trip; a <500 B verdict-less stub is real ([wording](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md)).

**Reviewer C mis-capture.** `clarity-review.md` <2 KB lacking `### `/`## Kept`/`## Review Body` headers (rc=0): the review went to `tmp/` ([tmp/](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md)) or a trailing meta-message was captured. Recover the largest `## Review Body`/`## Kept` text (or candidates-file `Write`) from `stream.jsonl`; scope the drift grep to command fields (`gh api|--method (POST|PUT|…)|post-github|pulls/[0-9]+/reviews`); a bare `PATCH` matches prompts ([meta](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md)).

## Runner setup, cited files and posting

- **Where and how.** From read-only `/app/skills` the scripts fail `mkdir -p "$SKILL_DIR/transcripts/..."` in seconds, looking complete: use `/home/node/.claude/skills/<runner>/scripts/`. `gh pr view/diff` on public repos works even when `gh auth status` calls the token invalid ([writable](../learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md)). Scripts, `devin-fetch.sh` included, have no exec bit (mode 664/644): use `bash <script>` (#13429: three "Permission denied", wrapper exit 0) ([#13429](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)).
- **slang-rhi PRs.** Keep `REPO_ROOT` on the slang checkout, pass `--repo shader-slang/slang-rhi --pr <N>`; vendored `external/slang-rhi/` may lag the head, so verify hunks with `gh pr diff` ([slang-rhi](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md)).
- **Artifacts and cited files.** Copy `final-review.md`, `clarity-review.md`, `tool-uses.jsonl` to `/workspace/agent/review-<pr>/` at once (`transcripts/` is shared). B via agent-browser can't launch Chrome here (dbus): a deterministic skip. Drop A's findings on files absent from `gh pr view <N> --json files`, keeping any true kernel ("no regression test") ([cited](../learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md)).
- **Posting.** `post-review.sh` POSTs the body verbatim (event=COMMENT) with no bot-transparency disclaimer: append it first ([disclaimer](../learnings/1783665412901-post-review-sh-posts-body-verbatim-no-bot-transpar.md)). REST `PUT /pulls/N/reviews/{id}` 404s under the App token; edit via GraphQL `updatePullRequestReview`, which keeps COMMENTED ([GraphQL](../learnings/1783669185294-slang-pr-review-rest-review-body-edit-404s-under-a.md)).

## Devin infra

**Devin-only tier: retry once.** A first exit 3 usually means Devin is still cold-starting. On the Devin-only tier (bot-authored, harvest exit 20) confirm the head is unchanged, reap Chromium (`pkill -f agent-browser`, clear `/tmp/agent-browser-chrome-*`, delete the stale `devin-error.txt`), and retry once wider (`--max-minutes 18 --poll-seconds 45` worked on #12107) ([#12107](../learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md), [reap](../learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md)). Never retry past a `synchronize`; exits 2 (auth wall) and 4 (browser, self-retried) differ. Checkpoint pinned commit and clause/challenger state to `tmp/STATE.md` early. #13425 still timed out thrice ([#13425](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md)). On the primary harvest tier Devin is best-effort, a URL-rewrite stall non-blocking: start early, wait ≤~3 min after the primary lands, record `devin: skipped_stall` ([stall](../learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md)).

**In `/slang-pr-review`, B runs once** (15-min cap), never retried or gated on `isDraft`: Devin renders for anonymous viewers, drafts included. B runs 2026-09-17..10-13 all failed on a `devin-fetch.sh` done-check defect (fixed in slang-skills #62): on exit 3 read `devin-error.txt` before blaming the PR ([B runs once](../learnings/1791964273446-correction-devin-review-renders-for-anonymous-view.md)).

**Invocation.** A by-path `devin-fetch.sh` exits 126, faking a skip; use `bash` ([exec bit](../learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md)). An outer `timeout` under `--max-minutes` (default 30) yields 124/137, not the script's 0/2/3/4, faking ABSTAIN_INFRA:NO_REVIEW_SIGNAL; on the Devin-only tier a real Devin run also turns `commit_match` UNEVALUABLE into PASS ([timeout](../learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md)). Invoke approver scripts via `python3`/`bash` ([invocation](../learnings/1783960724921-approver-ops-invoke-approver-scripts-via-python3-b.md)).

**Silent-data traps.**
- The extractor mis-parses "N Flags" triplets, writing "(none reported)" while `devin-page.txt` shows flags (6 on slang-rhi#831); reconcile with `rg -n 'Bugs|Flags|Informational'` ([Flags](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md)).
- `devin-commit-status.txt` = `"unknown"` after a `synchronize` is a cached prior-revision analysis: neither abstain nor trust it; verify each finding on the pinned head's `compare` delta ([unknown](../learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md)).
- A companion clang-format PR on a force-pushed branch makes Devin miss the parent's merge delta: compare Devin's file count with live `base...head`; a mismatch is ABSTAIN_INFRA (STALE_STAGE) ([companion](../learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md)).

## Critique-gate hygiene

The gate records a round only for the exact `/codex-critique` format ([format](../learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md)) keyed to the first stage token, so DECISION_REVIEW and OUTPUT_REVIEW are separate calls; use `reason_code=CLEAN` for WOULD_APPROVE ([separate calls](../learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md)). Per-revision `[Approval Decision]` delivery to the dashboard is mandatory, separate from the materiality-gated `[Report]` ([per-revision](../learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md)).

`/app/hooks/gate-critique-on-deliver.sh` matches `gh api [^|]*pulls\b`, so read-only GETs trip it; with `edits_since_critique>0` or a stale OUTPUT_REVIEW it denies, and 3 denials hard-block. Diff R2/R1 `review-doc.md` locally, read PR data via `gh pr view <n> --json ...` or `gh graphql`, and never write a file inside a read command (it bumps `edits_since_critique`) ([GET trips](../learnings/1783913716215-approver-critique-mustfix-critique-gate-false-posi.md)).

`reviewers_complete:true` is checked against disk: true only once `devin-flags.md` exists or a bot review was harvested, never before Devin is terminal ([pre-fill](../learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md)).

**Source learnings (58):**
- [writable skills dir](../learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md)
- [verify runs survived](../learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md)
- [600s stub: recover](../learnings/1783983883017-slang-pr-review-reviewer-a-600s-bg-wait-ceiling-tr.md)
- [teardown-fragile (#12023)](../learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md)
- [#12060 merged undecided](../learnings/1783964822172-approver-infra-abstain-pr-merged-undecided-while-r.md)
- [no escalation on 1st reping](../learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md)
- [no outer timeout](../learnings/1783934997171-approver-infra-abstain-devin-fetch-sh-never-wrap-i.md)
- [Devin-only: reap, retry](../learnings/1783993723797-approver-infra-abstain-devin-only-tier-retry-a-tim.md)
- [devin-fetch.sh via bash](../learnings/1783997801258-approver-devin-fetch-sh-missing-exec-bit-false-ski.md)
- [python3/bash invocation](../learnings/1783960724921-approver-ops-invoke-approver-scripts-via-python3-b.md)
- [Devin status unknown](../learnings/1784016854486-approver-infra-abstain-devin-commit-status-unknown.md)
- [extractor drops Flags](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md)
- [sole-signal Devin timeout](../learnings/1784074357103-approver-infra-abstain-devin-timeout-on-the-sole-s.md)
- [Devin stall non-blocking](../learnings/1784042688985-approver-infra-abstain-devin-devin-fetch-sh-stall-.md)
- [companion clang-format PR](../learnings/1784021932868-approver-infra-abstain-companion-clang-format-pr-b.md)
- [no bot disclaimer](../learnings/1783665412901-post-review-sh-posts-body-verbatim-no-bot-transpar.md)
- [edit via GraphQL](../learnings/1783669185294-slang-pr-review-rest-review-body-edit-404s-under-a.md)
- [verify A's cited files](../learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md)
- [gate trips on GETs](../learnings/1783913716215-approver-critique-mustfix-critique-gate-false-posi.md)
- [exact /codex-critique only](../learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md)
- [OUTPUT_REVIEW is its own call](../learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md)
- [per-revision decision](../learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md)
- [no reviewers_complete pre-fill](../learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md)
- [concurrent race; worktree](../learnings/1789053876664-slang-pr-review-runner-concurrent-runs-race-on-sha.md)
- [#12782 600s kill](../learnings/1789468288728-reviewer-a-empty-final-review-md-on-large-diffs-60.md)
- [#13305 silent death](../learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md)
- [turn end reaps container](../learnings/1790619062342-slang-reviewer-ending-the-turn-after-dispatching-b.md)
- [dead-lens stub](../learnings/1789483811315-reviewer-a-final-review-md-can-be-a-truncated-stub.md)
- [INTEGRITY-FAIL self-heal](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md)
- [REVIEW-GUARD wording trip](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md)
- [four collision checks](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md)
- [run dir, not ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md)
- [clarity output lost to tmp/](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md)
- [clarity meta-message](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md)
- [slang-rhi PRs](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md)
- [heartbeat stub](../learnings/1790181801645-reviewer-a-final-review-md-can-be-a-stub-recover-t.md)
- [run_dir from echo](../learnings/1790159323514-resolving-a-slang-pr-review-runner-run-dir-under-c.md)
- [#13315 turn-end stop](../learnings/1790686802018-container-stops-when-the-turn-ends-keep-long-revie.md)
- [#13322 patch-mode end_turn](../learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md)
- [nohup dies at turn end](../learnings/1790712733292-reviewer-background-jobs-die-at-turn-end-keep-the-.md)
- [interrupts kill jobs](../learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md)
- [merge drops a crash](../learnings/1790744483226-reviewer-a-s-merge-step-can-drop-a-subagent-s-veri.md)
- [#13283 600s kill on 2.1.283](../learnings/1790757776971-reviewer-a-inner-claude-print-kills-background-sub.md)
- [2.1.285; subagent_stats](../learnings/1790765591537-reviewer-a-slang-pr-review-runner-breaks-on-claude.md)
- [orphan 3/3 on 2.1.285](../learnings/1790792204414-reviewer-a-orphan-is-now-3-3-on-claude-cli-2-1-285.md)
- [late interrupt; salvage](../learnings/1790803785855-reviewer-a-inner-cli-can-be-interrupted-mid-run-17.md)
- [export the bg-wait variable](../learnings/1790837192079-slang-pr-review-runner-export-claude-code-print-bg.md)
- [exit 0 silent kill](../learnings/1790895880915-reviewer-a-exit-0-can-still-be-a-silent-kill-check.md)
- [#13378 orphan quarantine](../learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md)
- [#13363 empty success](../learnings/1791081955973-reviewer-a-on-large-slang-prs-the-30-budget-can-cu.md)
- [full text in reviewerA.log](../learnings/1791094754719-reviewer-a-subagent-outputs-recover-full-text-from.md)
- [#13425 budget cut](../learnings/1791132067717-reviewer-a-slang-pr-review-runner-runs-out-of-budg.md)
- [#13564 $30 stops 6/7](../learnings/1792060963846-slang-pr-review-reviewer-a-30-budget-can-stop-6-7-.md)
- [#13429 exec bit lost](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)
- [#13431 DISABLE_BACKGROUND_TASKS=1](../learnings/1791168330129-reviewer-a-inner-cli-can-end-its-turn-with-backgro.md)
- [CORRECTION: not the version](../learnings/1791209006651-correction-reviewer-a-early-exit-is-not-caused-by-.md)
- [#13541 background wait](../learnings/1791764268124-never-end-a-reviewer-turn-on-a-background-wait-for.md)
- [CORRECTION: B runs once](../learnings/1791964273446-correction-devin-review-renders-for-anonymous-view.md)
