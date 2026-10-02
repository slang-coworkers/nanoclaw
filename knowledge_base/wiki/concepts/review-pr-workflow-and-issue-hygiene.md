---
title: "PR Review Workflow and Issue Hygiene"
type: concept
group: review-process
tags: [pr-review, github, draft-pr, a2a-review, slang-reviewer, fleet-contention, repo-root-isolation, reviewer-a, reviewer-b, reviewer-c, head-pinning, markdown-links, community-fix, sibling-stack]
source_count: 34
---

# PR Review Workflow and Issue Hygiene

Rules for running the GitHub side and the `/slang-pr-review` pipeline. The bot touches GitHub only when a human explicitly invites it. Readiness comes from live GitHub state. You don't duplicate or pre-empt someone else's fix. "No findings" counts only once you've proved the reviewer ran. Review lenses and severity calibration are on sibling pages.

## TL;DR
- **An internal APPROVE (a2a, pipeline, codex) changes nothing on GitHub.** Report readiness from `gh pr view <n> --json isDraft,reviewDecision,reviews,mergeable,statusCheckRollup`. Check any "N reviewers APPROVE" against GitHub before posting it.
- **Never add a reviewer to a draft PR.** Never tell a fixer to mark a PR ready-for-review: drafts-only is admin-set, and RFR is an operator exception. **Hold unsolicited GitHub reviews** when the repo runs its own PR bot.
- **A combined review sent to a fixer for a contributor-owned PR is advisory:** no push, no post. The reviewer→fixer `send_file` can mint an `engage_mode=always` wiring that feeds a taskless-fixer echo loop. Only deleting the wiring (operator-gated) stops it.
- **Render every issue, PR and review reference as a markdown link** in user-facing replies.
- **Auto-close keywords fire even inside a negation.** Write "part of #N", then check that `closingIssuesReferences` is empty.
- **Don't duplicate or pre-empt a fix.**
  - A community PR is open: post the triage 5-bullet and hand off "review and land."
  - A MEMBER self-assigned and self-diagnosed: hold the bot PR.
  - A sibling PR is tightening the primitive you reuse: stack on its branch.
- **A maintainer's literal suggestion is a request, not a spec.** Enumerate every read site of a changed predicate first.
- **Runner scripts take flags only.** Take the run dir from the `>>> output →` line.
- **Every reviewer fails toward CLEAN, and exit 0 proves nothing.** Any of these means the run failed; salvage from `stream.jsonl` or re-run once:
  - `final-review.md` is under 500B.
  - Subagents show 0 tokens.
  - The tail says "I'll wait for the background agents."
  - The body is only a recap.
- **Under fleet contention, give Reviewer A a private `REPO_ROOT` worktree and a budget of 60** (120–150 for large PRs).
- **Adjudicate an INTEGRITY-FAIL with the per-run `pr-diff.reference`.** It is neither a verdict nor noise.
- **A dead gh token on the public slang repo doesn't block review.** Fetch unauthenticated and run A and C in `--mode patch`.
- **B (Devin, no dbus) or C (sandbox write denial) can be blocked by the environment.** Mark it `_skipped`, don't retry, and set `reviewers_complete=false`.
- **Under debounce, expect a mid-iteration `diff_hash` mismatch.** Name each reviewer's SHA. Re-run A only for a material delta.
- **A GitHub post needs the literal `<github-post-authorized />` marker; prose isn't enough.** Post in COMMENT state only.

## GitHub State vs Internal Review

An APPROVE from slang-reviewer, the A/B/C pipeline or codex is not a GitHub review. The PR stays `REVIEW_REQUIRED` with 0 formal reviews until a maintainer submits one. A maintainer who comments "seems reasonable" or un-drafts the PR hasn't approved it either ([a2a ≠ reviewDecision](../learnings/1782148692608-internal-a2a-review-github-reviewdecision.md)).

**Decision:** report the two systems separately, for example "internal: APPROVE_WITH_NITS; GitHub: REVIEW_REQUIRED, 0 approvals, 2 requested." A peer's "N reviewers APPROVE" describes its internal pipeline. Before approval language goes on a public issue, confirm it with `gh api repos/<o>/<r>/pulls/<n>/reviews --jq '.[]|"\(.user.login)\t\(.state)"'`. On #11764, "3 reviewers APPROVE" turned out to mean two bot COMMENTED reviews on GitHub. Only a comment's creator can PATCH it ([verify "N APPROVE"](../learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md)). Read verdicts from `latestOpinionatedReviews`, not `latestReviews`; the branch-delivery page explains why.

## Draft PR and Unsolicited-Review Hygiene

**Never add a reviewer to a draft PR.** Each add notifies the person, which is spam for a bot draft they never asked to see. Use `gh pr create --draft` with no `--reviewer`, and never `--add-reviewer` or set `requested_reviewers`. The internal review chain runs over a2a and doesn't need any of this ([no reviewer on drafts](../learnings/1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human.md)).

**Never tell a fixer to mark a PR ready-for-review.** Drafts-only is admin-set, and RFR is a case-by-case operator exception. Escalate to the operator instead ([no RFR instruction](../learnings/1780418605612-don-t-instruct-coworkers-to-mark-prs-ready-for-rev.md)).

**Hold unsolicited reviews on human-contributor PRs.** shader-slang/slang already runs `claude-pr-review.yml`, so a second bot COMMENT review only duplicates it. Post only on an explicit `@nv-slang-bot` invitation or operator authorization. Keep `combined-review.md` on disk ([hold unsolicited](../learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md)).

## Contributor-Owned PRs: Advisory Review and the Echo Loop

Sometimes slang-fixer gets a combined verdict for a contributor-owned PR, and the dispatch has no `MODE=pr-review-fix` plus human request (#11779). That verdict is advisory. The fixer doesn't push to a contributor's branch and doesn't post on GitHub. Posting belongs to the review workflow, which is gated on the marker or a real `@nv-slang-bot` tag. A take-over needs operator or maintainer authorization arriving on the fixer's own parent edge, not from the reviewer peer ([contributor PR is advisory](../learnings/1782719999000-slang-fixer-a-contributor-pr-combined-review-is-ad.md)).

**The echo-loop trap.** The reviewer's Step-5 `send_file(to="slang-fixer", …)` mints a reviewer→fixer wiring with `engage_mode=always`. After that, any traffic wakes a fixer that has no task. Its "holding silently" status comes back on the same channel and wakes it again, so the loop sustains itself (about 60 rounds on #11779).
- **What doesn't stop it:** reviewer silence, `ncl groups restart`, and `ncl destinations remove`.
- **What does:** `ncl wirings delete <wiring-id>` (operator-gated).
- **From the reviewer side:** send any real A/B decision to the operator via `ask_user_question`, with "leave with author" as the default. Flag the wiring id to the orchestrator once, then ignore the noise.
- **Prevention:** skip the fixer fan-out for contributor-owned or draft PRs ([fan-out echo loop](../learnings/1782720540038-reviewer-combined-review-fan-out-can-trigger-a-tas.md)).

## Issue and PR References

**Markdown links.** In user-facing replies, render issues, PRs and reviews as `[<repo>#<num>](url)`. The dashboard renders them as clickable links. Bare URLs are fine in tool payloads and scratchpad ([markdown links](../learnings/1779362752977-always-use-markdown-links-for-issues-and-reviews.md)).

**Auto-close keywords.** GitHub's parser is lexical, so any `close/fix/resolve #N` adjacency registers a closing reference. "This PR does **not** close #N" closes #N on merge, and partial-fix PRs are the usual victims. Write "part of #N" or "tracking issue: #N", then check `gh pr view --json closingIssuesReferences` ([keyword in a negation](../learnings/1789173822407-github-parses-close-fixes-keyword-even-inside-a-ne.md)).

## Don't Duplicate or Pre-empt Someone Else's Fix

**A community fix PR is open.** Post the triage 5-bullet anyway ("triaged → PR #X already fixes this, pending review"). The PR predates the issue and carries no `Fixes #N`. Tell the fixer to review and land it, not to write a competing PR ([community fix PR](../learnings/1781125005627-triaging-an-issue-that-already-has-a-community-fix.md)).

**A MEMBER self-assigned and self-diagnosed.** A bot PR would pre-empt the assignee. Stage a read-only briefing, hold the PR, and route a go/no-go to the parent. Release the PR only if the author asks for help, declines, or lets the issue go stale (NO-GO on slang#13030) ([defer to the MEMBER](../learnings/1789193900433-defer-bot-fixer-pr-when-a-member-self-assigned-sel.md)).

**A sibling PR is tightening the primitive you reuse: stack on it.** On #11861, the new struct-field recursion in `isVkBindingCompatibleEntryPointParameterType` reused a leaf that still returned `true` for `PtrType`. That would make `struct { uint* p; }` wrongly suppress E38010, which is the bug sibling #11870 was removing. Duplicating that fix means conflicts, and guarding around the leaf ships a known defect. Instead:
1. `git reset --hard origin/<sibling-branch>`.
2. Re-apply your delta.
3. Open with `--base <sibling-branch>`.
4. Note in the body that the sibling merges first.

The recursion is then a faithful subset by construction. **Tell:** your code reuses X, X is too permissive, and another open PR is already fixing X ([stack on a sibling](../learnings/1782882818697-stack-a-pr-on-a-sibling-instead-of-duplicating-its.md)).

## Applying Maintainer Suggestions Safely

On PR #11628 (WGSL emitter), a maintainer suggested simplifying a predicate. The predicate was read at two sites, and one of them ran for all ops, including `GlobalParam`. There the simpler form misfired ([literal suggestion can be unsafe](../learnings/1781640634164-a-maintainer-s-literal-review-suggestion-can-be-lo.md)). **Decision:**
- Enumerate every read site, especially in fall-through `if/else if` chains.
- Adopt the suggestion's shape, but keep the one load-bearing guard.
- Prove behavior is unchanged at each site.
- Say in the thread what you kept and why.

## /slang-pr-review Runner: Invocation, and Failing Toward CLEAN

**Invocation.** The runner scripts parse flags only. The `run-clarity` in SKILL.md's `argument-hint` is the skill verb. Passing it to the script exits 1 with `error: unknown flag run-clarity`. Call `bash scripts/run-clarity.sh --mode pr --pr <N> --repo <owner/repo>`; `compose-and-run.sh` behaves the same way ([flags only](../learnings/1785192373525-slang-clarity-review-runner-script-takes-flags-not.md)). Take the run dir from the script's `>>> output → <dir>` line. `ls -dt transcripts/*` can grab a stale run; after one failed call it picked an unrelated pr12031 transcript ([capture the run dir](../learnings/1783663020500-slang-clarity-review-runner-script-takes-flags-dir.md)).

**Exit 0 proves nothing. Two failure signatures:**
- **Premature stop.** On #11870, a run exited 0 after 52s and 13 turns. It left a 96B `final-review.md`, `stop_reason: tool_use`, and zero subagents. An identical re-run produced a 6 KB review. To check, grep `stream.jsonl` for `subagent_type`; `tool-uses.jsonl` can be empty even on healthy runs. Re-run once, and fall back to B, C and a manual read only if the re-run also stops ([premature stop](../learnings/1782878676585-reviewer-a-slang-pr-review-runner-premature-termin.md)).
- **Background orphan.** The one-shot `claude --print` sometimes launches the six `.claude/agents/*` as background tasks and ends with "I'll wait for the background agents to complete." No later turn comes, so the extractor saves a ~188B mid-stream thought. `summarize.py <run_dir>` then shows one subagent with tokens and the rest at 0. Move the dir to `*-INCOMPLETE` and re-run; `pr-diff.reference` is unaffected. On IR or gating PRs, the orphaned lenses are the ones that matter (#11476) ([background orphan](../learnings/1784339218928-slang-pr-review-reviewer-a-can-exit-0-yet-be-incom.md)). Since claude CLI 2.1.285 the orphan is no longer occasional (3/3 runs); the current handling (export `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, one re-run, then direct lenses) is on [reviewer-run survival](review-pr-reviewer-run-survival.md).

**Salvage before re-running.**
- **Budget kill.** On `Run state: error_max_budget_usd`, `final-review.md` is missing. Keep the last substantive `stream.jsonl` text per `subagent_type`, plus the orchestrator's own blocks, which often hold the strongest lead (#11945). Hand-write `final-review.md` with a partial-run banner, and mark concerns traced in source but not verified as "VERIFY" ([budget salvage](../learnings/1783266318751-reviewer-a-error-max-budget-usd-salvage-subagent-f.md)).
- **Recap capture.** When the coordinator adds a turn after a subagent stops, `final-review.md` holds a ~1 KB recap (1156B vs an 11K review on #11921). Take the largest of the last ~6 top-level assistant text blocks, and cross-check it against `summarize.py` counts ([recap capture](../learnings/1783042659846-slang-pr-review-runner-final-review-md-can-capture.md)).
- **Container restart.** A restart wipes `/tmp`, which silently kills a `run_in_background` waiter. Rebuild state from `ps aux` and the log mtimes under `/workspace/agent/review-<PR>/`. A's `transcripts/pr-<TS>/final-review.md` and B's `--out` dir survive. C's run dir may not, but `slang-clarity/tmp/review-candidates/pr-<PR>-clarity-workflow.md` does ([restart kills the waiter](../learnings/1782829576352-slang-pr-review-a-container-restart-kills-the-comp.md)).
- **Post-back.** `cleanup.sh` and `post-review.sh` lack the execute bit, so run them with `bash` ([no execute bit](../learnings/1782986622527-slang-pr-review-runner-post-back-scripts-lack-exec.md)).

**Devin on a fresh draft.** `devin-fetch.sh` can exit 0 while `## AI Analysis` still reads "Generating…" and shows no flag anchors. A "Bugs (none)" at that point is a false all-clear. Re-open the page in the same agent-browser session, poll `innerText` until the "Generating…" text clears (~30s), click the Bugs/Flags toggles, and re-scrape (#11839). `agent-browser eval` escapes its JSON, so a `grep -q '"gen":false'` never matches; use `json.loads` ([Devin re-scrape](../learnings/1782820288016-devin-re-scrape-recovery-fresh-draft-pr-renders-wi.md)).

## Fleet Contention: Isolation, Budget, INTEGRITY-FAIL, gh Outage

**Isolation.** Reviewer A (`repro.sh`) `cd`s into the shared `/workspace/agent/slang` and stages `tmp/{pr-diff.patch,pr-files.txt,context.json}`. A concurrent run overwrites those files, and A then reviews the wrong diff; on #11615 a subagent reviewed #12029 ([clobbered staging](../learnings/1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s.md)). **Decision:** run `git worktree add --detach <iso> origin/master` and then `REPO_ROOT=<iso> bash scripts/compose-and-run.sh …`. Remove the worktree afterwards. REVIEW.md and `.claude/agents/*` are git-tracked, so the worktree has them. C isolates itself and B is read-only, so only A needs this. The older advice to isolate C is superseded. One gotcha from it still applies: a linked worktree's `.git` is a file, so use `git rev-parse --git-dir` rather than `[ -d .git ]` ([isolate C, superseded](../learnings/1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-.md)).

**Budget.** At `--max-budget-usd 30`, even a 3-file PR ran out after 118 Grep and 116 Read calls; use 60 for small PRs ([REPO_ROOT + budget](../learnings/1783620361461-reviewer-a-slang-pr-review-runner-needs-isolated-r.md)). #11615 (40 files, +3490/−1656) had spent about $63 when it was killed before synthesis. After a kill like that, INTEGRITY-FAIL and "0-byte review" fire only as side effects. Use 120–150 for more than ~15 files or ~2k diff lines. Watch for `"subtype":"error_max_budget_usd"`. Finished subagent reports survive in the `summary`/`result` fields of `task_notification` events ([$30 cap](../learnings/1783629924272-slang-pr-reviewers-die-on-30-budget-cap-for-large-.md)).

**INTEGRITY-FAIL: adjudicate it.** The post-run guard re-reads the shared `tmp/pr-diff.patch`, so contention can raise a false positive after the CLI has already self-healed into `tmp/iso-<pr>-review/`. Check three things:
1. Does `sha256sum <run_dir>/pr-diff.reference` match `gh pr diff <N>` and C's run-dir hash?
2. Which PR's files does `final-review.md` discuss?
3. In `stream.jsonl`, did subagents bail with "does not match"? That is correct behavior. Findings on the wrong files mean a real wrong-diff review ([INTEGRITY-FAIL recipe](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md)).

If the diff is confirmed, report the findings as valid with `reviewers_complete:false` and a one-line run-note, and pass the verified `diff_hash` to the approver. If not, re-run in isolation (#13227) ([tmp race](../learnings/1790108064998-slang-pr-review-runner-integrity-guard-exit-1-can-.md)).

**gh quirks and outages.** `gh auth status` can say "token invalid" while reads still work, so test an actual read. The `From <sha>` header in `gh pr diff --patch` is the first commit, not the head; use `headRefOid` ([clobbered staging](../learnings/1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s.md)). If the token really is dead, public slang still gets a full review (#12208):
1. `git -c credential.helper= fetch origin pull/<N>/head:<ref>`, then check the SHA.
2. `git diff <base> <head> > pr.patch`.
3. Run A and C with `--mode patch --patch pr.patch`.
4. Scrape Devin anonymously.
5. Use the patch sha256 as the `diff_hash` ([patch-mode fallback](../learnings/1784856118074-slang-pr-review-gh-token-invalid-patch-mode-fallba.md)).

## Environmental Skips and `reviewers_complete`

**B (Devin).** Chrome can fail to launch with `Failed to connect to the bus: … /run/dbus/system_bus_socket` and exit 1. That is not the exit-2 auth wall or the exit-3 timeout; the image is missing dbus. Mark B `_skipped: agent-browser Chrome cannot launch (no dbus, infra)_`. If Devin coverage is required, request headless Chrome and dbus via `install_packages`. The wrapper can report exit 0 while the script wrote `REVIEWER_B_EXIT=1`, so check that `devin-flags.md` exists ([Devin no dbus](../learnings/1783630449263-reviewer-b-devin-fails-at-chrome-launch-in-reviewe.md)).

**C (Clarity).** The signature is `CLARITY-INCOMPLETE: clarity-review.md is <N>B (floor 500B)` plus a wall of `permission_denials` in `stream.jsonl`. The inner CLI sandbox denied every file write, and the pipeline can't run without writing files. This failure is deterministic. Mark C `_skipped: clarity pipeline blocked by inner-CLI sandbox file-write denial_` and proceed on A ([C sandbox writes](../learnings/1783627611526-clarity-reviewer-reviewer-c-fails-when-inner-cli-s.md)).

**Honesty rule.** `reviewers_complete` is true only when A, B and C are all complete and drift is 0. A reviewer that was dispatched but skipped makes it `false`, and the approver then leans ABSTAIN. Add `reviewer_status: {A_correctness, B_devin, C_clarity: complete|skipped_*|failed}` ([false on any skip](../learnings/1783631862638-combined-review-result-json-reviewers-complete-fal.md)).

## Mid-Iteration `diff_hash` Mismatch Is Expected

Under debounce, A can finish on an older commit while only C re-runs after a push. RESULT_JSON takes `diff_hash` from A's marker, so the approver's `commit_match` clause flags the gap (#12029: A at `43c9a077`, HEAD at `ac959d7`). That is expected behavior. The header should say which SHA each reviewer ran and how many inert pushes A is behind. Re-run A (about $20 and 20–30 min) only for a material delta. A fork-head PR hits `head_provenance` under `allow_fork_head=false` and gets ABSTAIN_POLICY; a human approves those ([mid-iteration mismatch](../learnings/1783631632879-mid-iteration-pr-combined-review-diff-hash-reviewe.md)).

## GitHub Posts Gate on the Literal Marker, Not Prose

The COMMENT-state post in `/slangpy-pr-review` and `/slang-pr-review` runs only when the dispatch contains the literal `<github-post-authorized />` marker. The marker is machine-checkable proof that a human tagged `@nv-slang-bot`. A prose "go ahead, post it" is not proof, so the reviewer skips the post; re-send with the marker. Runners post `event=COMMENT` only (slangpy-samples#52). For a Git-LFS asset, the diff and `gh api …/contents` show only the pointer. Fetch the object via the LFS batch API (`…/info/lfs/objects/batch`, `operation:download`) and check its sha256 against the oid ([marker gate](../learnings/1783639327701-slangpy-pr-review-github-post-gates-on-literal-mar.md)).

**Source learnings (34):**

- [a2a review ≠ reviewDecision](../learnings/1782148692608-internal-a2a-review-github-reviewdecision.md) — internal APPROVE leaves PR REVIEW_REQUIRED; report live state
- [Verify "N reviewers APPROVE"](../learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md) — check reviews API; post only what GitHub supports
- [No reviewer on a draft PR](../learnings/1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human.md) — adding a reviewer notifies (spams) the human
- [Don't instruct RFR](../learnings/1780418605612-don-t-instruct-coworkers-to-mark-prs-ready-for-rev.md) — drafts-only is admin-set; RFR is an operator exception
- [Hold unsolicited reviews](../learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md) — repo runs its own PR bot; keep the artifact on disk
- [Contributor-PR review is advisory](../learnings/1782719999000-slang-fixer-a-contributor-pr-combined-review-is-ad.md) — no push, no GitHub post on a contributor-owned PR
- [Fan-out echo loop](../learnings/1782720540038-reviewer-combined-review-fan-out-can-trigger-a-tas.md) — only deleting the always-engage wiring stops it
- [Markdown links](../learnings/1779362752977-always-use-markdown-links-for-issues-and-reviews.md) — render refs as [repo#N](url) in user-facing replies
- [Close keyword inside a negation](../learnings/1789173822407-github-parses-close-fixes-keyword-even-inside-a-ne.md) — "does not close #N" still closes; check closingIssuesReferences
- [Issue with a community fix PR](../learnings/1781125005627-triaging-an-issue-that-already-has-a-community-fix.md) — post the triage bullet; hand off "review and land"
- [Defer to a self-assigned MEMBER](../learnings/1789193900433-defer-bot-fixer-pr-when-a-member-self-assigned-sel.md) — hold the bot PR; route a parent go/no-go
- [Stack on a sibling PR](../learnings/1782882818697-stack-a-pr-on-a-sibling-instead-of-duplicating-its.md) — --base the sibling branch; faithful subset by construction
- [Literal suggestion can be unsafe](../learnings/1781640634164-a-maintainer-s-literal-review-suggestion-can-be-lo.md) — enumerate every read site of a reused predicate
- [run-clarity.sh takes flags](../learnings/1785192373525-slang-clarity-review-runner-script-takes-flags-not.md) — a leading run-clarity word exits 1 at once
- [Capture the run dir](../learnings/1783663020500-slang-clarity-review-runner-script-takes-flags-dir.md) — use the `>>> output →` line, not ls -t
- [A premature termination](../learnings/1782878676585-reviewer-a-slang-pr-review-runner-premature-termin.md) — exit 0, <500B, no subagent_type, ~13 turns; re-run once
- [A background-subagent orphan](../learnings/1784339218928-slang-pr-review-reviewer-a-can-exit-0-yet-be-incom.md) — "I'll wait for the background agents" = orphaned; re-run
- [A budget-kill salvage](../learnings/1783266318751-reviewer-a-error-max-budget-usd-salvage-subagent-f.md) — last text per role; partial banner; label unverified VERIFY
- [final-review.md recap capture](../learnings/1783042659846-slang-pr-review-runner-final-review-md-can-capture.md) — take the largest recent top-level text block
- [Restart kills the waiter](../learnings/1782829576352-slang-pr-review-a-container-restart-kills-the-comp.md) — recover reviewer outputs from persistent paths
- [post-back lacks execute bit](../learnings/1782986622527-slang-pr-review-runner-post-back-scripts-lack-exec.md) — invoke sub-steps with bash
- [Devin re-scrape](../learnings/1782820288016-devin-re-scrape-recovery-fresh-draft-pr-renders-wi.md) — poll until "Generating…" clears; eval JSON is escaped
- [Clobbered shared staging](../learnings/1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s.md) — private REPO_ROOT for A; gh auth/format-patch quirks
- [$30 cap + wrong-diff](../learnings/1783629924272-slang-pr-reviewers-die-on-30-budget-cap-for-large-.md) — 120–150 for big PRs; salvage task_notification text
- [A: isolated REPO_ROOT + budget](../learnings/1783620361461-reviewer-a-slang-pr-review-runner-needs-isolated-r.md) — worktree inherits REVIEW.md; budget 60 minimum
- [Isolate C (core superseded)](../learnings/1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-.md) — kept for: a linked worktree's .git is a file
- [INTEGRITY-FAIL recipe](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md) — hash pr-diff.reference; read stream.jsonl bail/iso evidence
- [INTEGRITY-FAIL tmp race](../learnings/1790108064998-slang-pr-review-runner-integrity-guard-exit-1-can-.md) — valid findings + reviewers_complete:false + run-note
- [Patch-mode fallback](../learnings/1784856118074-slang-pr-review-gh-token-invalid-patch-mode-fallba.md) — dead gh token: unauth fetch + `--mode patch`; Devin via URL
- [Devin: no dbus](../learnings/1783630449263-reviewer-b-devin-fails-at-chrome-launch-in-reviewe.md) — Chrome can't launch; image gap; mark _skipped_
- [C: sandbox blocks writes](../learnings/1783627611526-clarity-reviewer-reviewer-c-fails-when-inner-cli-s.md) — deterministic; mark _skipped_, proceed on A
- [reviewers_complete=false on any skip](../learnings/1783631862638-combined-review-result-json-reviewers-complete-fal.md) — add a reviewer_status sub-object
- [Mid-iteration diff_hash mismatch](../learnings/1783631632879-mid-iteration-pr-combined-review-diff-hash-reviewe.md) — expected under debounce; call out each reviewer's SHA
- [Marker gate, not prose](../learnings/1783639327701-slangpy-pr-review-github-post-gates-on-literal-mar.md) — re-send with the marker; verify LFS objects by oid
