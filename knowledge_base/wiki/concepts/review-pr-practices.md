---
title: "PR Review Practices"
type: concept
group: review-process
tags: [pr-review, slang-reviewer, devin, reviewer-a, reviewer-b, reviewer-c, github, draft-pr, convergence, false-positives, a2a-review]
source_count: 38
---

# PR Review Practices

The Slang coworker review pipeline runs three parallel reviewers — Reviewer A (correctness, `slang-pr-review-runner`), Reviewer B (Devin via `devin-fetch.sh`), and Reviewer C (clarity, `slang-clarity-review-runner`) — and merges their findings into a single `combined-review.md`. This page consolidates all operational lessons about running that pipeline correctly, interpreting results, avoiding common traps, and maintaining proper GitHub-vs-internal review hygiene.

## Reviewer B (Devin) Reliability

Devin (Reviewer B) is best-effort and must be self-verified before it contributes to any verdict.

**Premature scrape — the most common failure mode.** `devin-fetch.sh` can exit `rc=0` while Devin's AI Analysis panel is still rendering (`Generating...`). When this happens, `devin-flags.md` echoes the PR description back verbatim under `## AI Analysis`, and `## Bugs` / `## Flags` show `(none reported)` — which looks like a clean all-clear but means nothing. Observed repeatedly: [slang PR review: Reviewer B (devin-fetch) exit 0 ≠ Devin analysis complete](../learnings/1780870637455-slang-pr-review-reviewer-b-devin-fetch-exit-0-devi.md), [Devin reviewer: 'unknown' commit-status + 'Generating...' = weak signal, not a clean bill](../learnings/1781179189519-devin-reviewer-unknown-commit-status-generating-we.md), [Devin reviewer (devin-fetch) can exit 0 while analysis still 'Generating' — treat empty Bugs/Flags as low-confidence](../learnings/1781192458084-devin-reviewer-devin-fetch-can-exit-0-while-analys.md), [Devin reviewer (B) can exit rc=0 while analysis is still 'Generating' — a false all-clear](../learnings/1781731413287-devin-reviewer-b-can-exit-rc-0-while-analysis-is-s.md), [slang-pr-review: Devin can report 0 bugs while analysis still 'Generating…' — treat as weak signal](../learnings/1782761345395-slang-pr-review-devin-can-report-0-bugs-while-anal.md), [Devin reviewer scrape reliability](../learnings/devin-reviewer-scrape-reliability.md).

**Detection rule:** After every devin-fetch, grep `devin-flags.md` for `Generating` in the `## AI Analysis` section. Also check: is the AI Analysis body just a PR-description echo? Is `## Flags` blank whitespace rather than an explicit "no flags"? Does the PR number appear inside the analysis blob? If any check fails, label Reviewer B **INCOMPLETE / no signal** in the merged verdict — never fold `(none reported)` into a confidence count.

**Cross-PR contamination.** When devin-fetch runs concurrently for multiple PRs, all `devin-flags.md` files can contain the same AI Analysis blob (from whichever tab rendered first). Serialize Devin fetches, or grep each file for the expected PR number to confirm the page content matches the URL [Devin reviewer scrape reliability](../learnings/devin-reviewer-scrape-reliability.md).

**Draft PRs.** Devin analysis is typically inconclusive on draft PRs — the page shows "Generating...", commit-status "unknown." Treat B as best-effort-skipped on any draft [slang-pr-review: Reviewer A budget-cap mid-analysis hypotheses are NOT findings — re-run + independently verify](../learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md), [Stacked-PR review: Reviewer A checks out master, producing predictable false positives + a missed-drop; coordinator must self-verify against the real base/head](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md).

**Healthy Devin scrape signals:** `## AI Analysis` has synthesized prose (not diff fragments); `## Flags` explicitly says "no flags" (not blank); the PR number in the analysis text matches the URL; `devin-commit-status.txt` says "Analysis is up to date" [Devin reviewer scrape reliability](../learnings/devin-reviewer-scrape-reliability.md).

**"30m timeout" in devin-error.txt** is a templated message meaning "no Devin analysis available for this PR" — not a literal 30-minute wall-clock measurement. Treat B as best-effort-skipped and proceed on A+C [Slang PR #11815 review — A∩C converge on dead Flavor::Simple arm; Devin '30m timeout' quirk](../learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md).

## Reviewer C (Clarity) Failure and Recovery

Reviewer C can die mid-run from a transient `API Error: The socket connection was closed unexpectedly`. The failure leaves `clarity-review.md` as a tiny stub (~80–135 bytes) containing only the error string — even though the wrapper exits and the file exists. A naive "artifact present?" check would silently lose a whole reviewer [slang-pr-review Reviewer C can die mid-run on a transient API socket error — detect via tiny clarity-review.md, retry recovers](../learnings/1780603736166-slang-pr-review-reviewer-c-can-die-mid-run-on-a-tr.md), [slang-pr-review: Reviewer C (clarity) can drop with transient socket error — detect tiny output, just re-run](../learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md).

**Detection:** After C finishes, check `wc -c clarity-review.md`. Healthy output is multi-KB (8–26 KB). A file under ~400–500 bytes, especially one containing `API Error|socket connection`, means the run crashed.

**Recovery without re-running:** The clarity pipeline writes intermediate candidate files to `<REPO_ROOT>/tmp/review-candidates/pr-<N>-clarity.md`, `pr-<N>-fine-grained-clarity.md`, and (if consolidation completed) `pr-<N>-clarity-workflow.md`. The crash typically hits after generation but before consolidation, so the raw candidates usually survived. Reassemble `clarity-review.md` from those files with a "RECOVERED / un-consolidated" header rather than burning another ~$2–5/~20–45 min re-run that may hit the same fault [Recover slang clarity-review candidates after a transient API error instead of re-running](../learnings/1781731735312-recover-slang-clarity-review-candidates-after-a-tr.md), [slang Reviewer C clarity run: recover truncated output from on-disk candidate file](../learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md).

**If re-running:** a single re-run recovers cleanly — the error is transient infra, not a logic problem. Budget ≥50 min for the monitor; C routinely runs longer than A (Reviewer A ~20–30 min; Reviewer C ~25–45 min) [slang-pr-review: Reviewer C (clarity) can drop with transient socket error — detect tiny output, just re-run](../learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md).

## Reviewer A + C Parallelism and Checkout Isolation

Reviewer A (`compose-and-run.sh`) and Reviewer C (`run-clarity.sh`) both default to `REPO_ROOT=/workspace/agent/slang` and each runs `git fetch` + `git checkout -q origin/master` at startup. When launched simultaneously, they race on `.git/index.lock` — the loser exits 128 with `fatal: Unable to create '.git/index.lock': File exists` and produces no output file [slang PR-review: Reviewer A and C share one checkout — parallel runs collide on git index.lock](../learnings/1780769238745-slang-pr-review-reviewer-a-and-c-share-one-checkou.md).

**Preferred fix:** point Reviewer C at a separate existing clone — `/workspace/agent/slang-clarity` — via `REPO_ROOT=/workspace/agent/slang-clarity bash .../run-clarity.sh ...`. That clone already has the clarity skills and a valid `origin`, so no setup is needed. This is simpler than the git-worktree approach [Reviewer A + C parallel isolation: use /workspace/agent/slang-clarity as C's REPO_ROOT](../learnings/1782586901771-reviewer-a-c-parallel-isolation-use-workspace-agen.md).

Both runners operate via `gh pr diff` in `pr` mode, so their only git contention is the startup fetch/checkout — separate checkout dirs eliminate it entirely. C should also use its own separate clone to avoid writing `tmp/` files into A's tree [slang Reviewer C clarity run: recover truncated output from on-disk candidate file](../learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md).

## Finding the Reviewer C Run Directory

Do NOT use `ls -dt transcripts/pr-* | head -1` to locate Reviewer C's run directory at the merge step. The newest-by-mtime directory can be a stale sibling dir (e.g. one containing only `prompt.txt`+`stream.jsonl` with no `clarity-review.md`), causing a silent empty/MISSING C section in the combined report.

**Reliable method:** parse the run-clarity.sh stdout, which prints `>>> clarity review: <abs path>/clarity-review.md` on its last lines. Grep that from the captured log: `grep -oE '>>> clarity review: .*' revC.log`. Same principle applies to Reviewer A: parse the `RUN_DIR` from `compose-and-run.sh` stdout rather than `ls -t` [slang-pr-review merge step: find Reviewer C run-dir from stdout, and drift-grep tool NAME not content](../learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md).

## Drift-Checking Reviewer C

To verify C made no GitHub writes (`gh pr review`, `gh issue comment`, `gh api ... POST/PUT/PATCH/DELETE`), grep `tool-uses.jsonl` for the **Bash command string** — specifically `gh (pr review|comment|issue comment)` or `gh api ... (--method|-X) (POST|PUT|PATCH|DELETE)`. Do NOT match free text in the file: a `Write` call whose body contains the word "review" will produce a false positive. On clean runs, C makes only `Read` + `gh pr diff/view` (reads) + local `Write` calls to `tmp/review-candidates/` [slang-pr-review merge step: find Reviewer C run-dir from stdout, and drift-grep tool NAME not content](../learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md), [Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md).

## Reviewer A False Positives and Budget Caps

**Subagent prompt condensation false positives.** Reviewer A's code-quality subagent can produce false positives on FileCheck test files: `//CHECK` directives on their own lines get collapsed onto the preceding source line in the condensed view, making `//CHECK-NOT` look commented-out and `@LINE-1` look off-by-one. Reviewer A's own editorial/filter pass normally catches and drops these — trust the editorial table's "Drop (false positive)" rows for FileCheck-test findings; do NOT forward them to the fixer without confirming against the real `gh pr diff` [slang Reviewer A false positives on own-line //CHECK directives from prompt condensation](../learnings/1781177378439-slang-reviewer-a-false-positives-on-own-line-check.md).

**Base-tree vs diff confusion.** Reviewer A's subagents sometimes reason from the local base checkout instead of the diff, producing false-positive "compile error at line X" or "the feature/help-text doesn't exist" claims. The editorial-filter stage catches these, but when a subagent claims a hunk doesn't exist or a call site is broken, verify against `gh pr diff` before escalating [PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md).

**Stacked PRs.** On a stacked PR (base ≠ master), Reviewer A checks out `origin/master` and applies `gh pr diff` (scoped correctly to the slice). This causes two predictable failures: (1) false-positive "missing symbol / runtime error" findings reasoned from master code that a lower slice changed; (2) genuinely-correct findings dropped because A cannot fetch the PR-head tree. Reviewer A's editorial rules usually self-drop the false positives, but the coordinator must self-verify stacked-context-sensitive items by fetching the stacked base+head into explicit refs and running `git diff base..head` before finalizing the merged verdict [Stacked-PR review: Reviewer A checks out master, producing predictable false positives + a missed-drop; coordinator must self-verify against the real base/head](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md).

**Budget cap mid-analysis.** When Reviewer A terminates with `error_max_budget_usd` (check the final `"subtype"` in the stream/log), it dies before writing `final-review.md` — leaving only mid-analysis hypotheses in `stream.jsonl`. Those are unconcluded hypotheses the orchestrator would have disproved in its own editorial filter. Re-run A at a higher cap (e.g. `--max-budget-usd 50`) and independently verify any high-stakes hypothesis against the actual source — do not propagate mid-analysis guesses into the verdict [slang-pr-review: Reviewer A budget-cap mid-analysis hypotheses are NOT findings — re-run + independently verify](../learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md).

## Reviewer A Flip-Flops Across Rounds

Reviewer A is a fresh subagent invocation each round with no memory of prior verdicts. The same finding can land above the 85-confidence floor one round and below it the next. Observed patterns: a "suggested fix" from round N-1 that was implemented exactly by the fixer gets re-raised as a gap in round N; the same code comment flagged at Question-confidence (round 3) gets re-raised as a Gap (round 8) [Reviewer A (claude-pr-review subagents) can give inconsistent advice across rounds — log signed-off positions per round](../learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md).

**How to apply:** Log Reviewer A's signed-off positions per round. When round N flags something round N-1 explicitly approved, label it reviewer drift in the merged verdict rather than asking the fixer to iterate again. A's signed-off "suggested fix" from round N-1 is contractual — if the fixer implemented it and round N flips, note the flip-flop and recommend ignoring. Convergence (gaps monotonically shrinking) is good; bouncing is a signal to land + follow-up rather than chase A's latest set [Reviewer A (claude-pr-review subagents) can give inconsistent advice across rounds — log signed-off positions per round](../learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md).

Devin (Reviewer B) is more stable round-to-round because its flag set is carried with persistence markers, though it can re-flag items the fixer already addressed.

## Empirical Probes Can Test the Wrong Sub-case

"I ran the test and it passed" is only as good as the test design. On Slang PR #11234, a fixer's empirical probe covered one of two sub-cases (supplied default args) but not the other (omitted default args), leading to a false closure of a Devin finding that persisted across rounds 2, 3, 5, 6 before Reviewer A traced the actual code path in round 6 [Empirical 'I tested it' probes can miss the wrong sub-case — Devin's persistent flags deserve scrutiny even when initial reading says misread](../learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md).

When Devin persistently flags something across multiple rounds despite an empirical "I tested it" closure, ask: does the test design cover all sub-cases of the structural concern Devin is naming? For any "X with feature Y" flag, enumerate all usage combinations (supplied/omitted, default/explicit, present/absent) and verify the probe covers each. Don't let convergence trend bias judgment — rounds 1–5 trending green doesn't mean round N is green [Empirical 'I tested it' probes can miss the wrong sub-case — Devin's persistent flags deserve scrutiny even when initial reading says misread](../learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md).

## Verifying "Not Constructible / Defensive-Only" Claims

When an implementer claims a reviewer-requested test is "not constructible," "unreachable," or a guard is "defensive-only / document-don't-test," **gate acceptance on independent adversarial verification — never rubber-stamp the claim.** The claim is load-bearing because it waives an artifact a reviewer asked for.

On Slang #11450, the fixer claimed a cross-module negative test was not constructible (verified 3 ways). Round-2 adjudication refuted the claim: the test is constructible via plain transitive `import`. Convergence of multiple independent sources on "it's fine" is NOT confirmation — they can share a blind spot: here the fixer, Devin, and the clarity reviewer all converged wrong; only the dedicated correctness reviewer, investigating an alternative construction, caught it [Verify 'not constructible / defensive-only' claims that waive reviewer artifacts](../learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md).

A wrong "why this guard exists" comment is worse than none: it invites a future maintainer to delete the guard. When the real triggering mechanism differs from the documented one, the comment must be corrected [Verify 'not constructible / defensive-only' claims that waive reviewer artifacts](../learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md).

## Convergence and When to Scope Down

Multi-round review converges when finding counts decrease monotonically and A/C disagreements disappear. A template trajectory for a healthy convergence: 4 gaps → 2 gaps (one new) → 1 gap → 0 nits [Multi-round PR review converges; scope down to targeted verify when delta is comment-only](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md).

**Scope-down rule:** When the fixer's re-push delta is `tests/**`-only (no `source/**`, `prelude/**`, `include/**` changed), the prior code verdict still stands. Running a full A/C pipeline re-run mostly re-derives the same verdict, re-incurs subagent-hallucination risk, and wastes ~$50 and an hour. Instead, fetch the changed test files and verify the test logic directly: does the new CHECK encoding actually catch the regression class the reviewers flagged? Report transparently that you scoped to focused verification [slang-pr-review: scope a re-run to focused verification when the re-push is test-only](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md).

Similarly, when a fixer re-push is comment-only and implements exactly what reviewers asked for, a full pipeline re-run produces no new signal. Verify the diff is that narrow (pure additive comment, zero code change), confirm placement, and sign off [Multi-round PR review converges; scope down to targeted verify when delta is comment-only](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md).

## A/C Convergence and Disagreement Adjudication

Strong A/C convergence (both A and C independently flag the same line) is high-confidence and should lead the combined report. On PR #11815, both reviewers independently identified a dead `Flavor::Simple` arm — this concretely confirms the heuristic [Slang PR #11815 review — A∩C converge on dead Flavor::Simple arm; Devin '30m timeout' quirk](../learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md).

When A and C disagree, the meta-bias "C says X, A says ¬X and shows code" almost always means A — A's subagents ground claims in the actual diff bytes; C applies a lower confidence bar and broader coverage. To resolve A↔C disagreements on stacked PRs, the coordinator must self-verify against the stacked base+head refs (see above) [Multi-round PR review converges; scope down to targeted verify when delta is comment-only](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md), [Stacked-PR review: Reviewer A checks out master, producing predictable false positives + a missed-drop; coordinator must self-verify against the real base/head](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md).

**Convergent false positive.** Multi-subagent convergence does not guarantee correctness. On PR #11504, two of A's subagents (doc + cross-backend) independently flagged a test comment as inaccurate, anchoring on the PR description's imprecise line citations rather than the comment text itself. The comment-as-written was correct; both subagents shared the same anchoring error. Rule: verify a "comment inaccurate" flag against the exact comment text in the diff, and grep for OTHER sites that might satisfy a general claim [Slang review: verify 'inaccurate comment' flags against code text, not PR-body citations](../learnings/1780769188437-slang-review-verify-inaccurate-comment-flags-again.md).

## Verifying Detached Background Reviewer Completion

Two traps when monitoring nohup-background reviewer jobs [Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md):

1. **Context compaction kills in-flight Monitor.** A large compaction event can fire Monitor's timeout early. After any compaction, re-check process/output state directly rather than trusting the monitor.
2. **`pgrep -fc 'pattern'` false counts.** The pattern string appears in your own command pipeline → pgrep counts your own shell invocation. Use `ps aux | grep <pat> | grep -v grep` instead. Better still, treat the authoritative completion signal as the wrapper's done-marker in its log plus a non-empty output file: A = `>>> repro.sh: done` + `final-review.md`; C = `>>> run-clarity.sh: done (rc=0)` + `clarity-review.md`; B = `>>> devin-fetch: …/devin-flags.md (N lines)` + `devin-flags.md`.

## GitHub reviewDecision vs Internal A2A Review

An internal a2a coworker APPROVE (slang-reviewer, codex) does NOT change the PR's GitHub state — it stays `REVIEW_REQUIRED` with 0 formal reviews until a maintainer submits an actual GitHub review. A maintainer commenting "seems reasonable" or un-drafting the PR is also NOT a GitHub Approve.

**Rule:** Report PR readiness from live GitHub state — `gh pr view <n> --json isDraft,reviewDecision,reviews,mergeable,statusCheckRollup` — never from the internal review verdict alone. In human-facing comments, say "internal a2a review passed; awaiting formal GitHub review/CI" rather than "reviewer-approved" or "N reviewers APPROVE" [Don't conflate internal a2a review with GitHub reviewDecision in human-facing comments](../learnings/1780509591502-don-t-conflate-internal-a2a-review-with-github-rev.md), [Internal a2a review ≠ GitHub reviewDecision](../learnings/1782148692608-internal-a2a-review-github-reviewdecision.md), [Internal agent-review APPROVE is not a GitHub maintainer approval](../learnings/1782465097683-internal-agent-review-approve-is-not-a-github-main.md), [Verify 'N reviewers APPROVE' against GitHub reviewDecision before posting it as a public verdict](../learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md).

Before posting "N reviewers APPROVE" on a public issue, verify with `gh pr view <n> --json reviewDecision,reviews,latestReviews,reviewRequests` and `gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq '.[]|"\(.user.login)\t\(.state)"'`. Post only what GitHub state supports [Verify 'N reviewers APPROVE' against GitHub reviewDecision before posting it as a public verdict](../learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md).

## Draft PR Hygiene

**Never add a reviewer to a draft PR.** Adding a reviewer fires a GitHub notification to that person every time — for a bot-authored draft they haven't asked to review, that is spam. Concretely: `gh pr create ... --draft` with no `--reviewer` flag; never `gh pr edit <n> --add-reviewer <user>`; never populate `requested_reviewers` via REST/GraphQL. The internal coworker peer-review chain (slang-reviewer) runs over a2a and does not require GitHub's PR-reviewer mechanism [Never add a reviewer to a draft PR — it spams the human](../learnings/1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human.md).

**Never instruct a fixer to mark a PR ready-for-review.** Fixers operate under an admin-set drafts-only constraint. Ready-for-review flips are a case-by-case operator exception. If expediting via RFR seems warranted, escalate to the human operator; only they can grant the exception. Don't instruct a coworker to override its own admin-set safety constraints [Don't instruct coworkers to mark PRs ready-for-review (drafts-only is admin-set)](../learnings/1780418605612-don-t-instruct-coworkers-to-mark-prs-ready-for-rev.md).

**Hold unsolicited reviews on human-contributor PRs.** When shader-slang/slang already runs its own production review bot (`claude-pr-review.yml`), nv-slang-bot posting an additional COMMENT review duplicates coverage and adds noise. Default to holding the GitHub post unless there's an explicit `@nv-slang-bot` invitation or operator authorization. The review artifact (combined-review.md) still has internal value; keep it on disk for a maintainer who later asks [Hold unsolicited reviews when repo runs its own PR bot](../learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md).

## Markdown Links for Issues and Reviews

When listing or referencing GitHub issues, PRs, or review URLs in any user-facing reply, always render them as markdown links — `[short-label](url)` — not bare URLs or plain references. The dashboard renders markdown; clickable labels like `[slang#10747](url)` let the user jump directly to the source. Link the issue/PR cell using `[<repo>#<num>](url)` in tables; link the title or a short anchor for PR reviews. Bare URLs are fine in tool-call payloads or scratchpad [Always use markdown links for issues and reviews](../learnings/1779362752977-always-use-markdown-links-for-issues-and-reviews.md).

## Triaging Issues with an Existing Community Fix PR

When a GitHub issue is a tracking issue for an already-open community fix PR, two mistakes are easy to make [Triaging an issue that already has a community fix PR — review, don't duplicate](../learnings/1781125005627-triaging-an-issue-that-already-has-a-community-fix.md):

1. Skip the triage 5-bullet on the issue. Wrong — post it anyway (verdict = "triaged → PR #X already fixes this, pending review"), because the PR predates the issue and carries no `Fixes #N` link.
2. Tell the fixer to write a competing PR. Wrong — the handoff should be "review and land" the existing one. Make this loud: a complete, tested PR already exists; duplicating wastes work and steps on a contributor.

## Stack on a Sibling PR Instead of Duplicating Its Fix

When a reviewer (human or codex) flags that your fix reuses a shared primitive that is *too permissive*, AND a **sibling PR is already tightening that exact primitive**, stack your branch on the sibling's branch rather than duplicating the change or preserving the defect behind a flag. On #11861/#11870, #11861 added struct-field recursion to `isVkBindingCompatibleEntryPointParameterType`, reusing a per-field leaf that still returned `true` for `PtrType` — so `struct { uint* p; }` would inherit that over-broadening and wrongly suppress E38010, a *new* instance of the exact bug sibling #11870 (`fix/issue-11857`) was already removing. Of the three options — duplicate the leaf removal (merge conflict, two PRs editing the same lines, unclear ownership), preserve the bug + add a guard (ships a known defect — a methodology red flag), or **stack** — stacking won: `git reset --hard origin/<sibling-branch>`, re-apply the delta, open with `--base <sibling-branch>`, so the recursion is a faithful subset *by construction* (the offending leaf is already gone in the base), zero duplication, sibling keeps ownership. Note in the PR body that it rebases onto master once the sibling merges, and that the sibling merges first. **Tell:** "your new code reuses X, and X is too permissive" + another open PR is already fixing X = the stack signal; the faithful-subset property (predicate ⊆ what the real consumer honors) is easiest to guarantee by building on the branch that already tightened the shared primitive ([Stack a PR on a sibling instead of duplicating its fix (faithful-subset coordination)](../learnings/1782882818697-stack-a-pr-on-a-sibling-instead-of-duplicating-its.md)).

## Reviewer A's Lens: Extracted Matchers and Normalize-Before-Match

Two reviewer lenses that frequently surface on refactor PRs [PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md):

**Pure-matcher unit tests are not integration coverage.** Unit tests prove the extracted helper is correct but say nothing about the call-site wiring, ordering, or precedence. For slang-test specifically, a `-dry-run` black-box check (asserting the subtest is absent from dry-run stdout) exercises the real scheduling path without running tests.

**Normalize-before-match blind spot.** When CLI entries are canonicalized before storage (e.g. via `Path::simplify`) but the matcher compares by exact string against an assembled display name, the normalization round-trip is a silent gap. On Windows `kPathDelimiter` is `\`; strings assembled with `/` from a source `filePath` can fail to match. Any "match a user-supplied string against an internal string" feature — check whether one side is normalized and the other isn't, and whether the author only tested on the platform where normalization is a no-op.

## Applying Maintainer Suggestions Safely

A maintainer's literal code suggestion is a request to honor, not a spec to paste. On PR #11628 (WGSL emitter), applying a maintainer's predicate-simplification literally would have introduced a regression: the predicate was read in TWO places, and one of those sites ran for ALL ops (including `GlobalParam`) where the simpler form fired incorrectly [A maintainer's literal review suggestion can be locally unsafe — verify all read sites of a reused predicate](../learnings/1781640634164-a-maintainer-s-literal-review-suggestion-can-be-lo.md).

**Rule:** Before applying a predicate or condition change, enumerate every site that reads it — especially in fall-through `if/else if` chains where safety at one site doesn't imply safety at another. Adopt the spirit (use their helper/shape), keep the one guard that's actually load-bearing, prove behavior is unchanged at all read sites, and tell them in-thread exactly what you kept and why.

## Null-Possible Invariant Audits

When a PR establishes a new null-possible invariant for a member (e.g. "`m_param` can be null during result legalization") and adds a safe-access helper, grep the whole file for `<member>->` and confirm each remaining raw dereference is either unreachable under the new condition or asserts/uses the helper. Missing a sibling site reads as either an oversight or a latent crash of the same class as the bug just fixed. Both Reviewer A and C flagging the same untouched sibling site is a strong convergence signal [PR-review heuristic: when a fix adds a null-possible invariant + helper, audit ALL structurally-identical sites](../learnings/1781792411472-pr-review-heuristic-when-a-fix-adds-a-null-possibl.md).

## Reviewer-Traced Unreachable Paths

A code-reading reviewer can trace a plausible bug path that is foreclosed upstream by the front-end. Before adding a regression test for a reviewer-traced "gap," try to construct the triggering input and compile it. If it's rejected upstream (e.g. E30702 for `SV_DepthGreaterEqual` as input), the gap is unreachable — say so with the diagnostic code as evidence, and don't ship a test that can't compile [Depth SV semantics are output-only (E30702) — a reviewer-traced 'inout duplicate' gap can be unreachable](../learnings/1782175276058-depth-sv-semantics-are-output-only-e30702-a-review.md).

This applies with full force to **🔴 crash / infinite-recursion / spurious-diagnostic findings**, which read as blocking. On #11873 (vk::binding on resource-containing struct params), Reviewer A produced a confident 🔴 stack-overflow with a detailed code trace (cited `slang-ir-check-recursion.cpp`, exact line numbers, a sibling-guard comparison) — and it was a false positive because **both of its repros don't compile**. The front-end guards pre-empt the predicate entirely: a value-recursive `struct S { S next; }` entry param hits fatal E39997 "maximum type nesting level exceeded" (bounded at `kMaxTypeNestingDepth = 128`) before `validateEntryPoint` runs; the same struct as a *global* hits E41001 but a global isn't an entry param so the predicate never runs on it (the case A wrongly generalized from); cyclic inheritance hits E39999; interface-before-struct-base hits E30820 (so `findBaseStructType`'s `getFirstOrNull()` is correct by construction). Rule: for any reviewer crash/recursion/spurious-diagnostic claim, **compile the exact repro against a built slangc before treating it as blocking** — a confident code trace is not proof the input is reachable, because automated reviewers reason from source and miss earlier front-end rejections. Don't pass A's 🔴/high-🟡 through verbatim; add a coordinator verification addendum backed by a compiled repro. (Reviewer C correctly dropped the same termination concern here — its instinct beat A — though C's stated mechanism was imprecise; the real guard is the E39997 depth limit. Reviewer B echoed the PR body: weak signal, consistent with this file family.) ([Reviewer A (nv-slang-bot) can emit confident false-positive crash bugs whose repros do not compile — always compile the repro](../learnings/1782885111139-reviewer-a-nv-slang-bot-can-emit-confident-false-p.md))

Corollary decision (same #11873 / PR): when a reviewer flags a new recursive walk for "missing a cycle/depth guard that sibling functions carry," do NOT reflexively add the guard — first check whether the divergent input is rejected by an EARLIER fatal front-end diagnostic before your code runs (here E39997/E39999 reject value-recursive/cyclic types before `validateEntryPoint`, so a visited-set would be dead code under correct input). The decision that held (codex + 3-reviewer APPROVE_WITH_NITS): omit the guard and **document the termination invariant at the function** ("descends a finite acyclic structure; cycles rejected earlier by E39997/E39999") — CLAUDE.md forbids guards never hit under correct input and changes with no failing test. Also reinforced: **trust codex's CONTENT verdict over the PostToolUse hook's stage-verdict parse** — the hook parsed the stages as "approve" while codex's content verdict was request-changes for a real, harness-verified item (an unnecessary `non-exhaustive` on a DIAGNOSTIC_TEST, which `slang-test` reports as a failure); a DIAGNOSTIC_TEST should use plain `diag=CHECK` unless you deliberately leave diagnostics unmatched ([Don't add a recursion guard for input an earlier fatal diagnostic already rejects](../learnings/1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f.md)).

## FileCheck Test Nuances

Several review-time FileCheck lessons apply across the review pipeline [slang-pr-review: scope a re-run to focused verification when the re-push is test-only](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md):

- For a per-entry-point availability error, split into separate entry points with per-entry filecheck prefixes to isolate each case.
- For a module-wide semantic error, use ordered (non-DAG) `CHECK:` lines, each pinning a distinct `expected/got` pair. Unanchored `CHECK-DAG: <code>` is the anti-pattern: a subset of cases can satisfy all DAG lines, silently missing a regression.
- A comment containing a literal `CHECK:`/`CHECK-DAG:` token is parsed by FileCheck as a real directive — reword such comments.

## /slang-pr-review runner operational traps

Running the three-reviewer `/slang-pr-review` pipeline surfaces several reproducible traps. **Reviewer C invocation:** call `bash run-clarity.sh --mode pr --pr N --repo owner/repo` — do NOT prefix with the literal word `run-clarity` ([slang-clarity run-clarity.sh: pass --mode directly, NOT the run-clarity subcommand word](../learnings/1782832548664-slang-clarity-run-clarity-sh-pass-mode-directly-no.md)). **Isolation:** Reviewer A (`compose-and-run.sh`) and Reviewer C (`run-clarity.sh`) both default to `REPO_ROOT=/workspace/agent/slang` and each does `git fetch/checkout origin master`; run Reviewer C in its own **git worktree** so parallel runs don't clobber each other's checkout ([Isolate Reviewer C in a git worktree for parallel /slang-pr-review runs](../learnings/1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-.md)). **Reviewer A premature termination:** a run can report `completed (exit 0)` in ~52s yet be incomplete — treat a suspiciously fast exit-0 as a failed run and re-dispatch ([Reviewer A (slang-pr-review-runner) premature-termination signature: exit-0 but incomplete](../learnings/1782878676585-reviewer-a-slang-pr-review-runner-premature-termin.md)). **Recovery:** a container restart kills the completion-waiter, but reviewer outputs survive on persistent paths — recover them rather than re-running ([slang-pr-review: a container restart kills the completion-waiter; recover reviewer outputs from persistent paths](../learnings/1782829576352-slang-pr-review-a-container-restart-kills-the-comp.md)). **Devin on fresh drafts:** on a freshly-opened draft PR, `devin-fetch.sh` can exit 0 with `## AI Analysis` still "Generating…" (the done-detector race); re-scrape, and mind the escaped-JSON grep gotcha ([Devin re-scrape recovery: fresh draft PR renders with NO flag anchors; escaped-JSON grep gotcha](../learnings/1782820288016-devin-re-scrape-recovery-fresh-draft-pr-renders-wi.md)).

## Re-review scope: redesign gaps + self-recommended nits don't reset the pipeline

When a fixer reworks a PR in response to feedback and re-requests review, the re-run must do **two** things: (1) confirm the round-1 findings are actually closed, and (2) look for NEW gaps the redesign introduced — not just re-check the old list ([Re-review after a PR redesign: check for gaps the redesign introduced, not just old ones closed](../learnings/1782873135829-re-review-after-a-pr-redesign-check-for-gaps-the-r.md)). But when a follow-up commit *only* incorporates a nit the reviewer itself recommended (e.g. a doc comment from a Reviewer C clarity finding), do **not** re-run the full three-reviewer pipeline — just verify the recommended change landed ([Reviewer: a self-recommended comment addition does not reset the PR review pipeline](../learnings/1782857285922-reviewer-a-self-recommended-comment-addition-does-.md)).

## slang-pr-review-runner operational traps (post-back, salvage, recap capture)

More runner traps. `post-back.sh` invokes `cleanup.sh`/`post-review.sh` directly but they **lack the execute bit** — call sub-steps with `bash` ([1782986622527-slang-pr-review-runner-post-back-scrip](../learnings/1782986622527-slang-pr-review-runner-post-back-scripts-lack-exec.md)). Reviewer A can end with `Run state: error_max_budget_usd` before writing `final-review.md`; the subagent final texts are **recoverable from `stream.jsonl`** ([1783266318751-reviewer-a-error-max-budget-usd-salvag](../learnings/1783266318751-reviewer-a-error-max-budget-usd-salvage-subagent-f.md)). And `final-review.md` can capture the coordinator's trailing recap instead of the review body when a subagent is stopped/times out and the coordinator emits a follow-up turn ([1783042659846-slang-pr-review-runner-final-review-md](../learnings/1783042659846-slang-pr-review-runner-final-review-md-can-capture.md)).

---
**Source learnings (49):**
- [Always use markdown links for issues and reviews](../learnings/1779362752977-always-use-markdown-links-for-issues-and-reviews.md)
- [Empirical "I tested it" probes can miss the wrong sub-case](../learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md)
- [Reviewer A flip-flops across rounds — log signed-off positions per round](../learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md)
- [PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md)
- [Don't instruct coworkers to mark PRs ready-for-review](../learnings/1780418605612-don-t-instruct-coworkers-to-mark-prs-ready-for-rev.md)
- [Verify "not constructible / defensive-only" claims that waive reviewer artifacts](../learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md)
- [Don't conflate internal a2a review with GitHub reviewDecision](../learnings/1780509591502-don-t-conflate-internal-a2a-review-with-github-rev.md)
- [Reviewer C can die mid-run on a transient API socket error](../learnings/1780603736166-slang-pr-review-reviewer-c-can-die-mid-run-on-a-tr.md)
- [Never add a reviewer to a draft PR](../learnings/1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human.md)
- [Verify "inaccurate comment" flags against code text, not PR-body citations](../learnings/1780769188437-slang-review-verify-inaccurate-comment-flags-again.md)
- [Multi-round PR review converges; scope down when delta is comment-only](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md)
- [Reviewer A and C share one checkout — parallel runs collide on git index.lock](../learnings/1780769238745-slang-pr-review-reviewer-a-and-c-share-one-checkou.md)
- [Reviewer B (devin-fetch) exit 0 ≠ Devin analysis complete](../learnings/1780870637455-slang-pr-review-reviewer-b-devin-fetch-exit-0-devi.md)
- [Triaging an issue that already has a community fix PR](../learnings/1781125005627-triaging-an-issue-that-already-has-a-community-fix.md)
- [Reviewer A budget-cap mid-analysis hypotheses are NOT findings](../learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md)
- [Reviewer A false positives on own-line //CHECK directives from prompt condensation](../learnings/1781177378439-slang-reviewer-a-false-positives-on-own-line-check.md)
- [Devin reviewer: 'unknown' commit-status + 'Generating...' = weak signal](../learnings/1781179189519-devin-reviewer-unknown-commit-status-generating-we.md)
- [devin-fetch can exit 0 while analysis still "Generating" — low-confidence](../learnings/1781192458084-devin-reviewer-devin-fetch-can-exit-0-while-analys.md)
- [Reviewer C (clarity) can drop with transient socket error — detect tiny output, just re-run](../learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md)
- [Stacked-PR review: Reviewer A checks out master, producing false positives + missed-drop](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md)
- [A maintainer's literal review suggestion can be locally unsafe](../learnings/1781640634164-a-maintainer-s-literal-review-suggestion-can-be-lo.md)
- [Devin reviewer (B) can exit rc=0 while analysis is still "Generating" — false all-clear](../learnings/1781731413287-devin-reviewer-b-can-exit-rc-0-while-analysis-is-s.md)
- [Recover slang clarity-review candidates after a transient API error](../learnings/1781731735312-recover-slang-clarity-review-candidates-after-a-tr.md)
- [PR-review heuristic: when a fix adds a null-possible invariant, audit ALL structurally-identical sites](../learnings/1781792411472-pr-review-heuristic-when-a-fix-adds-a-null-possibl.md)
- [Internal a2a review ≠ GitHub reviewDecision](../learnings/1782148692608-internal-a2a-review-github-reviewdecision.md)
- [Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md)
- [Depth SV semantics are output-only (E30702) — a reviewer-traced "inout duplicate" gap can be unreachable](../learnings/1782175276058-depth-sv-semantics-are-output-only-e30702-a-review.md)
- [Hold unsolicited reviews when repo runs its own PR bot](../learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md)
- [Verify "N reviewers APPROVE" against GitHub reviewDecision before posting](../learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md)
- [Internal agent-review APPROVE is not a GitHub maintainer approval](../learnings/1782465097683-internal-agent-review-approve-is-not-a-github-main.md)
- [Reviewer A + C parallel isolation: use /workspace/agent/slang-clarity as C's REPO_ROOT](../learnings/1782586901771-reviewer-a-c-parallel-isolation-use-workspace-agen.md)
- [slang-pr-review: scope a re-run to focused verification when re-push is test-only](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md)
- [Slang PR #11815 review — A∩C converge on dead Flavor::Simple arm; Devin "30m timeout" quirk](../learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md)
- [slang-pr-review merge step: find Reviewer C run-dir from stdout, and drift-grep tool NAME not content](../learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md)
- [slang Reviewer C clarity run: recover truncated output from on-disk candidate file](../learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md)
- [slang-pr-review: Devin can report 0 bugs while analysis still "Generating…" — weak signal](../learnings/1782761345395-slang-pr-review-devin-can-report-0-bugs-while-anal.md)
- [Devin reviewer scrape reliability](../learnings/devin-reviewer-scrape-reliability.md)
- [slang-clarity run-clarity.sh: pass --mode directly, NOT the run-clarity subcommand word](../learnings/1782832548664-slang-clarity-run-clarity-sh-pass-mode-directly-no.md)
- [Isolate Reviewer C in a git worktree for parallel /slang-pr-review runs](../learnings/1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-.md)
- [Reviewer A premature-termination signature: exit-0 but incomplete](../learnings/1782878676585-reviewer-a-slang-pr-review-runner-premature-termin.md)
- [slang-pr-review: container restart kills completion-waiter; recover outputs from persistent paths](../learnings/1782829576352-slang-pr-review-a-container-restart-kills-the-comp.md)
- [Devin re-scrape recovery: fresh draft PR renders with NO flag anchors; escaped-JSON grep gotcha](../learnings/1782820288016-devin-re-scrape-recovery-fresh-draft-pr-renders-wi.md)
- [Re-review after a PR redesign: check for gaps the redesign introduced, not just old ones closed](../learnings/1782873135829-re-review-after-a-pr-redesign-check-for-gaps-the-r.md)
- [A self-recommended comment addition does not reset the PR review pipeline](../learnings/1782857285922-reviewer-a-self-recommended-comment-addition-does-.md)
- [Stack a PR on a sibling instead of duplicating its fix (faithful-subset coordination)](../learnings/1782882818697-stack-a-pr-on-a-sibling-instead-of-duplicating-its.md)
- [Reviewer A can emit confident false-positive crash bugs whose repros don't compile — always compile the repro](../learnings/1782885111139-reviewer-a-nv-slang-bot-can-emit-confident-false-p.md)
- [Don't add a recursion guard for input an earlier fatal diagnostic rejects; trust codex content verdict over hook stage-parse](../learnings/1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f.md)
- [post-back scripts lack execute bit — invoke sub-steps with bash](../learnings/1782986622527-slang-pr-review-runner-post-back-scripts-lack-exec.md)
- [Reviewer A error_max_budget_usd salvage: subagent final texts recoverable from stream.jsonl](../learnings/1783266318751-reviewer-a-error-max-budget-usd-salvage-subagent-f.md)
- [final-review.md can capture the coordinator's trailing recap, not the review body](../learnings/1783042659846-slang-pr-review-runner-final-review-md-can-capture.md)
_Catalog: [[wiki/index.md]]_
