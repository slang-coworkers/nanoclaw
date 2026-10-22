---
title: "PR Review Practices"
type: concept
group: review-process
tags: [pr-review, slang-reviewer, devin, reviewer-a, reviewer-b, reviewer-c, github, draft-pr, convergence, false-positives, a2a-review, fleet-contention, repo-root-isolation, pr-approver, shadow-mode, clause-gap, challenger, critique-gate, abstain-infra, head-pinning, human-calibration, memoization-safety]
source_count: 32
---

# PR Review Practices

The Slang coworker review pipeline runs three parallel reviewers — Reviewer A (correctness, `slang-pr-review-runner`), Reviewer B (Devin via `devin-fetch.sh`), and Reviewer C (clarity, `slang-clarity-review-runner`) — and merges their findings into a single `combined-review.md`. This page consolidates all operational lessons about running that pipeline correctly, interpreting results, avoiding common traps, and maintaining proper GitHub-vs-internal review hygiene.

> Related pages: [Run Recovery & Polling](review-pr-run-recovery-and-polling.md) · [Workflow & Issue Hygiene](review-pr-workflow-and-issue-hygiene.md) · [Severity & Scope Calibration](review-pr-severity-and-scope-calibration.md) · [Slang Code-Review Lenses](review-pr-slang-review-lenses.md) · [Branch Delivery & Diff Reading](review-pr-branch-delivery-and-diff-reading.md) · [Reviewer Pipeline Operations](review-pr-reviewer-pipeline-operations.md) · [Reviewer-Run Survival](review-pr-reviewer-run-survival.md) · [Harvest Tiers & Verdict Reporting](review-pr-harvest-tiers-and-verdict-reporting.md) · [Head-Pinning & Debounce](review-pr-head-pinning-and-debounce.md) · [Approver Decision & Shadow-Mode](review-pr-approver-decision-and-shadow-mode.md) · [Approver & CI Operational Notes](review-pr-approver-and-ci-operational-notes.md) · [Challenger Probes & Human Calibration](review-pr-challenger-probes-and-human-calibration.md).

## TL;DR
- **Every reviewer fails toward CLEAN.** Devin exit 0 is not a signal; Reviewer A can emit a 0-byte or budget-capped output; Reviewer C can skip environmentally. **Verify each reviewer produced findings before treating "no findings" as a result** — an absent reviewer and a clean reviewer are byte-identical downstream.
- **Watch the ARTIFACT, not the subagent.** A Devin subagent returns before `devin-fetch.sh` finishes; a detached reviewer's completion is proven by its exit marker, never by streamed JSON. Anchor monitors to exit markers.
- **Read the full page dump, not the summary file.** `devin-flags.md` can have an EMPTY `## Flags` section while `devin-page.txt` from the same run shows real findings — synthesizing from the summary records a false "0 findings" and carries a false-clean prior into the challenger.
- **Reviewer A needs an isolated checkout.** Fleet contention on a shared repo root corrupts runs; `$30` is too low a budget cap and produces silent truncation. Use fresh per-run out-dirs to avoid `/tmp` collisions.
- **Two bots agreeing measures shared priors, not correctness.** Independent bots flagging the same item is weak corroboration; read the human review thread before scoring any structure/maintainability gap.
- **A bot finding a named maintainer already overruled ON THIS PR is not an open gap** — but **lead with the technical grounds**, never the maintainer's preference. Maintainer preference is supporting context; a repo guideline is not cleared by taste alone.
- **A refuted 🔴 does not become WOULD_APPROVE**, and a standing human `CHANGES_REQUESTED` caps the verdict at ABSTAIN. Never round up.
- **A mid-iteration `diff_hash` mismatch is expected under debounce**, not a bug. Pin the head, byte-prove reviews against it, and re-verify a stale secondary reviewer's flags at the current head.
- **Re-review scope: redesign gaps and self-recommended nits do not reset the pipeline.** Additive nit rounds are fine; a full re-run is not.
- **The review signal is endpoint-split across three surfaces** (`pulls/N/reviews`, `pulls/N/comments`, `issues/N/comments`) and the harvest reads one. That split is a property of GitHub's data model, so **every consumer inherits the blind spot independently — fixing one instance is not fixing the class.**
- **A GitHub post gates on the literal marker, not on prose.** Post only in COMMENT state; never APPROVE/REQUEST_CHANGES from a runner.
- **Empirical probes can test the wrong sub-case.** A probe that varies the intended factor while holding the confound constant reads as decisive and proves nothing — name the factor and the confound before citing a control.
- **In an artifact where claims cite `file:line`, the UNCITED SENTENCE IS THE DEFECT** — in a document whose norm is citation, the citation outlier is where an inference got restated as an observation. Run that self-check mechanically over your own draft.
- **Recording is not routing.** Documenting a blocking infra defect any number of times never reaches a file only an operator can edit. The record serves the next agent; the escalation serves the fix — do both.
- **A stale webhook dispatch on an already-decided PR is a no-op plus a report, never a re-decision.** `record_decision` is idempotent per `(repo, pr, sha)`, so re-deciding CLOBBERS a human-joined calibration row with a verdict contaminated by post-hoc information.

## Reviewer B (Devin) Reliability

Devin is best-effort and must be self-verified before it contributes to any verdict.

**Premature scrape (the most common failure).** `devin-fetch.sh` can exit `rc=0` while the AI Analysis panel still shows `Generating...`. `devin-flags.md` then echoes the PR description under `## AI Analysis`, and `## Bugs` / `## Flags` read `(none reported)`: a false all-clear [exit 0 ≠ analysis complete](../learnings/1780870637455-slang-pr-review-reviewer-b-devin-fetch-exit-0-devi.md), [unknown + Generating](../learnings/1781179189519-devin-reviewer-unknown-commit-status-generating-we.md), [low-confidence empties](../learnings/1781192458084-devin-reviewer-devin-fetch-can-exit-0-while-analys.md), [false all-clear](../learnings/1781731413287-devin-reviewer-b-can-exit-rc-0-while-analysis-is-s.md), [0 bugs while Generating](../learnings/1782761345395-slang-pr-review-devin-can-report-0-bugs-while-anal.md), [scrape reliability](../learnings/devin-reviewer-scrape-reliability.md).

**Detection rule.** After every fetch, grep `## AI Analysis` for `Generating`, and check that the body is not a PR-description echo, that `## Flags` says "no flags" explicitly (not blank), and that the analysis names this PR's number. If any check fails, label B **INCOMPLETE / no signal**; never count `(none reported)` toward confidence. Healthy signals: synthesized prose, explicit "no flags", matching PR number, `devin-commit-status.txt` = "Analysis is up to date".

**Cross-PR contamination.** Concurrent fetches can all carry the same AI Analysis blob (whichever tab rendered first). Serialize fetches, or grep each file for its expected PR number [scrape reliability](../learnings/devin-reviewer-scrape-reliability.md).

**Stale across a push.** A re-run after a new commit can return the previous head's analysis: re-analysis is async, the manual re-run button is login-gated, and `devin-commit-status.txt` is often `unknown`. Probe with a **renamed symbol**: grep `devin-page.txt`/`devin-flags.md` for a symbol you know changed this round and confirm it is absent (#12202 r2 still cited `emitCoreOpSource`, renamed to `emitOpSource`). A stale pass corroborates the old findings, not the new code, so mark B "stale / not usable this round" and rely on your own read of the delta [stale cached analysis](../learnings/1784827155083-devin-re-run-after-a-push-can-return-stale-cached-.md).

**Draft status does not affect Devin.** It renders for anonymous viewers on drafts too. The "Generating..."/`unknown`/exit-3 results once blamed on drafts were `devin-fetch.sh` done-check defects (an early done-detector race; from 2026-09-17 a renamed heading and an unclicked "View results", fixed in slang-skills #62). A 0/0 scrape whose `## AI Analysis` echoes the description is still not an all-clear on any PR [drafts correction](../learnings/1791964273446-correction-devin-review-renders-for-anonymous-view.md), [budget-cap hypotheses](../learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md), [stacked-PR review](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md).

**"30m timeout" in `devin-error.txt`** is a templated "no Devin analysis available" message, not a wall-clock measurement. Treat B as skipped and proceed on A+C [#11815](../learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md).

**Devin earns its slot.** On slang#12052 (seeding `importedModulesList` from `getModuleDependencies()`), the fixer's report pre-empted a candidate-extension double-add, but Devin found a different double-add through `getAssociatedDeclsForDecl` (`slang-check-shader.cpp:3456`), a separate consumer of the same list. When a report claims "no double-add," check that it names every consumer it audited. The same PR merged before Reviewer A finished (its background shell was lost twice across session boundaries): when a review spans sessions, confirm `final-review.md` exists before assuming a verdict [#12052](../learnings/1784291828247-devin-can-surface-a-correctness-bug-the-fixer-s-pr.md).

## Reviewer C (Clarity) Failure and Recovery

A transient `API Error: The socket connection was closed unexpectedly` leaves `clarity-review.md` as an ~80–135-byte stub holding only the error. The file exists and the wrapper exits, so an "artifact present?" check silently loses a reviewer [socket drop](../learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md). **Detect** with `wc -c`: healthy output is 8–26 KB; under ~400–500 bytes, especially matching `API Error|socket connection`, is a crash.

**Recover before re-running.** The pipeline writes candidates to `<REPO_ROOT>/tmp/review-candidates/pr-<N>-clarity.md`, `pr-<N>-fine-grained-clarity.md`, and (if consolidation finished) `pr-<N>-clarity-workflow.md`. The crash usually lands after generation, so reassemble `clarity-review.md` from them under a "RECOVERED / un-consolidated" header instead of paying for a ~$2–5, 20–45 min re-run that may hit the same fault [recover candidates](../learnings/1781731735312-recover-slang-clarity-review-candidates-after-a-tr.md), [on-disk candidate file](../learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md). If the worktree is already GC'd, rebuild candidates from the run-dir's `stream.jsonl`: replay each candidate's last `Write`, then apply its `Edit`s in stream order (`replace(old,new,1)`). A drop mid-consolidation still leaves the generation passes complete, so the full pre-dedup candidate set is usually recoverable. Confirm no drift first (`grep -cE '"(gh api|gh pr|slang-review-post-github)"|--method (POST|PUT)|/reviews' tool-uses.jsonl` == 0) [stream.jsonl replay](../learnings/1784845681874-recover-a-dead-clarity-correctness-review-run-s-ca.md).

**Re-running** recovers cleanly; the fault is transient infra, not logic. Budget ≥50 min for the monitor (A ~20–30 min, C ~25–45 min) [socket drop](../learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md). The same holds for an explicit `CLARITY-INCOMPLETE`: on slang#13283 C failed twice after ~10–13 `api_retry`s ending in 503 `server_error`, and the third attempt succeeded in ~35 min. Grep the log for `api_retry`/`server_error` before suspecting a prompt or skill bug [C dies on 503s — retry](../learnings/1790622924515-slang-reviewer-an-executed-repro-beats-reviewer-a-.md).

## Reviewer A + C Parallelism and Checkout Isolation

`compose-and-run.sh` (A) and `run-clarity.sh` (C) both default to `REPO_ROOT=/workspace/agent/slang` and run `git fetch` + `git checkout -q origin/master` at startup. Launched together they race on `.git/index.lock`; the loser exits 128 with `fatal: Unable to create '.git/index.lock': File exists` and writes no output [index.lock collision](../learnings/1780769238745-slang-pr-review-reviewer-a-and-c-share-one-checkou.md). Point C at the existing clone `/workspace/agent/slang-clarity` (`REPO_ROOT=/workspace/agent/slang-clarity bash .../run-clarity.sh ...`): it already has the clarity skills and a valid `origin`, and is simpler than a worktree [slang-clarity as C's root](../learnings/1782586901771-reviewer-a-c-parallel-isolation-use-workspace-agen.md). Both runners read the PR via `gh pr diff`, so the startup checkout is their only contention; the separate clone also keeps C's `tmp/` files out of A's tree.

## Finding the Reviewer C Run Directory

Do not locate C's run-dir with `ls -dt transcripts/pr-* | head -1`: the newest dir can be a stale sibling (only `prompt.txt` + `stream.jsonl`), which yields a silently empty C section. Parse `run-clarity.sh` stdout instead (`grep -oE '>>> clarity review: .*' revC.log`), and likewise take A's `RUN_DIR` from `compose-and-run.sh` stdout [run-dir from stdout](../learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md).

## Drift-Checking Reviewer C

To confirm C made no GitHub writes, grep the **Bash command string** in `tool-uses.jsonl` for `gh (pr review|comment|issue comment)` or `gh api ... (--method|-X) (POST|PUT|PATCH|DELETE)`, not free text: a `Write` body containing "review" is a false positive. A clean run makes only `Read`, `gh pr diff/view`, and local `Write`s to `tmp/review-candidates/` [run-dir from stdout](../learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md), [detached completion](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md).

## Reviewer A False Positives and Budget Caps

**Condensed FileCheck tests.** The code-quality subagent's condensed view collapses own-line `//CHECK` directives onto the preceding source line, so `//CHECK-NOT` looks commented out and `@LINE-1` looks off by one. A's editorial pass normally drops these; trust its "Drop (false positive)" rows and confirm against `gh pr diff` before forwarding anything to the fixer [own-line //CHECK](../learnings/1781177378439-slang-reviewer-a-false-positives-on-own-line-check.md).

**Base tree vs diff.** Subagents sometimes reason from the local base checkout and claim a hunk, call site, or help text is missing or won't compile. The editorial filter usually catches these; verify any surviving claim against `gh pr diff` before escalating [review lenses](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md).

**Stacked PRs.** When base ≠ master, A checks out `origin/master` and applies the slice's diff. That yields false "missing symbol / runtime error" findings from code a lower slice changed, and drops correct findings A can't check without the PR-head tree. Self-verify stacked-sensitive items: fetch base and head into explicit refs and run `git diff base..head` before finalizing [stacked-PR review](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md).

**Budget death.** A run whose last `type:"result"` record is `is_error:true` + `subtype:"error_max_budget_usd"` died, not crashed, and wrote no `final-review.md`. `stream.jsonl` holds only unconcluded hypotheses that A's own editorial filter would have tested; never propagate them, and independently verify any high-stakes one [budget-cap hypotheses](../learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md). Diff size does not bound cost (six-subagent fan-out + deepwiki): the default `$30` cap died on a +24/−2 change (#12172, 58 turns). A single death can be re-run at `--max-budget-usd 40`–`50`; salvage from the run-dir's own `stream.jsonl`, never a shared `reviewerA.log` that later reviews clobber [$30 cap, no output](../learnings/1784816888015-reviewer-a-30-budget-cap-can-silently-produce-no-f.md).

**A bigger dollar cap is the wrong lever.** On PR #12336, run 1 died at $40.09 with a 0-byte `final-review.md`; run 2, on a smaller diff (2 files, +70/−8) with a $60 cap, cost **$81.60** and completed **0** domain passes. All eight lenses did 0.6–1.2 MB of exploration each and none emitted a `ReportFindings` block [fan-out cap destroys output](../learnings/1785839403586-a-budget-cap-on-a-fan-out-reviewer-pipeline-is-str.md). The pipeline fans out concurrently and unbounded, so spend scales with reviewer count × exploration depth, not diff size. The top-level cap trips only after the tokens are spent and kills subagents before their reporting step, so any cap lands where it destroys the artifact: the money goes on exploration, the value is in the final synthesis, and every added concurrent worker worsens the odds. A larger number buys the same failure. Fix the shape: dispatch only the rule-applicable lenses (two of run 2's weren't, burning 1.86 of 7 MB), run one lens per invocation with its own budget, and report incrementally. **A resource cap is safe only when the protected artifact is produced incrementally**; if the output exists only at the end, any cap is a coin-flip between "finished" and "spent everything for nothing." When a failure spent more on a smaller input, report spend-at-death and completed passes instead of re-running at a higher cap; per-subagent spend attribution is what separates "needed more budget" from "wrong shape."

## Reviewer A Flip-Flops Across Rounds

Each round is a fresh invocation with no memory of prior verdicts, so a finding can clear the 85-confidence floor one round and miss it the next. A round-N-1 "suggested fix" implemented exactly can return as a round-N gap; a round-3 Question can return as a round-8 Gap [flip-flops](../learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md). Log A's signed-off positions per round and treat a signed-off suggested fix as contractual: label a reversal as reviewer drift in the merged verdict and recommend ignoring it rather than sending the fixer round again. Monotonically shrinking gaps is convergence; bouncing means land and follow up. Devin is steadier (its flags carry persistence markers) but can re-flag items already addressed.

## Empirical Probes Can Test the Wrong Sub-case

"I ran it and it passed" is only as good as the test design. On #11234 a fixer's probe covered supplied default args but not omitted ones, falsely closing a Devin finding that persisted through rounds 2–6 until Reviewer A traced the code path [wrong sub-case](../learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md). When Devin keeps flagging despite an "I tested it" closure, enumerate the sub-cases of the structural concern (supplied/omitted, default/explicit, present/absent) and check the probe covers each. A green trend in rounds 1–5 says nothing about round N.

A negative test that "proves the gate works" is vacuous unless its path feeds the gated input; ask whether it would still pass with the guard removed. On #12206 R6 an XGLSLANG test asserted debug names survive on the direct SPIR-V path, but that path forwards only `getDownstreamArgs("spirv-opt")` while `-Xglslang` args sit in a separate `glslang` bucket it never reads, so deleting the gate leaves the test green. Trace which path the command runs, whether the input reaches the guard on it, and whether the test fails without the guard [vacuous gate test](../learnings/1784857152467-a-proves-the-gate-works-test-is-vacuous-unless-the.md).

## Verifying "Not Constructible / Defensive-Only" Claims

A claim that a requested test is "not constructible" or "unreachable", or that a guard is "defensive-only / document-don't-test", waives a reviewer artifact, so gate acceptance on independent adversarial verification. On #11450 the fixer claimed (verified three ways) that a cross-module negative test was impossible; it was constructible via plain transitive `import`. The fixer, Devin, and the clarity reviewer all converged wrong; only the correctness reviewer, trying an alternative construction, caught it. Agreement among several sources that "it's fine" is not confirmation when they share a blind spot. A wrong "why this guard exists" comment invites deleting the guard, so correct it when the real trigger differs [not constructible](../learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md).

## Convergence and When to Scope Down

Healthy convergence: finding counts fall monotonically and A/C disagreements disappear (e.g. 4 gaps → 2, one new → 1 → 0 nits) [converges](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md). If the re-push delta is `tests/**`-only (no `source/**`, `prelude/**`, `include/**`), the code verdict stands; a full A/C re-run re-derives it for ~$50 and an hour plus fresh hallucination risk. Verify the changed tests directly (does the new CHECK catch the regression class reviewers flagged?) and say you scoped down [test-only re-push](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md). Likewise for a comment-only re-push that does exactly what reviewers asked: confirm it is purely additive with zero code change, check placement, and sign off.

## A/C Convergence and Disagreement Adjudication

A and C independently flagging the same line is high-confidence and leads the combined report (#11815: both found a dead `Flavor::Simple` arm) [#11815](../learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md). On disagreement, "C says X, A says ¬X and shows code" almost always resolves to A: A's subagents ground claims in the diff bytes, while C uses a lower bar and broader coverage. On stacked PRs, self-verify against the stacked base and head refs [converges](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md), [stacked-PR review](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md).

Subagent convergence can still be wrong. On #11504 two of A's subagents (doc + cross-backend) called a test comment inaccurate, both anchored on the PR description's imprecise line citations; the comment was correct. Check an "inaccurate comment" flag against the comment text in the diff, and grep for other sites that could satisfy a general claim [inaccurate-comment flags](../learnings/1780769188437-slang-review-verify-inaccurate-comment-flags-again.md).

## Verifying Detached Background Reviewer Completion

Two traps when monitoring nohup-background reviewer jobs [detached completion](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md):

1. **Compaction can fire Monitor's timeout early.** After any compaction, re-check process and output state directly.
2. **`pgrep -fc 'pattern'` counts your own pipeline.** Use `ps aux | grep <pat> | grep -v grep`. Better, treat the wrapper's done-marker plus a non-empty output file as authoritative: A = `>>> repro.sh: done` + `final-review.md`; C = `>>> run-clarity.sh: done (rc=0)` + `clarity-review.md`; B = `>>> devin-fetch: …/devin-flags.md (N lines)` + `devin-flags.md`.

**Source learnings (32):**

- [Empirical "I tested it" probes can miss the wrong sub-case](../learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md)
- [Reviewer A flip-flops across rounds — log signed-off positions per round](../learnings/1779437432996-reviewer-a-claude-pr-review-subagents-can-give-inc.md)
- [PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md)
- [Verify "not constructible / defensive-only" claims that waive reviewer artifacts](../learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md)
- [Verify "inaccurate comment" flags against code text, not PR-body citations](../learnings/1780769188437-slang-review-verify-inaccurate-comment-flags-again.md)
- [Multi-round PR review converges; scope down when delta is comment-only](../learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md)
- [A budget cap on a fan-out reviewer pipeline is structurally guaranteed to destroy its output](../learnings/1785839403586-a-budget-cap-on-a-fan-out-reviewer-pipeline-is-str.md)
- [Reviewer A and C share one checkout — parallel runs collide on git index.lock](../learnings/1780769238745-slang-pr-review-reviewer-a-and-c-share-one-checkou.md)
- [Reviewer B (devin-fetch) exit 0 ≠ Devin analysis complete](../learnings/1780870637455-slang-pr-review-reviewer-b-devin-fetch-exit-0-devi.md)
- [Reviewer A budget-cap mid-analysis hypotheses are NOT findings](../learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md)
- [Reviewer A false positives on own-line //CHECK directives from prompt condensation](../learnings/1781177378439-slang-reviewer-a-false-positives-on-own-line-check.md)
- [Devin reviewer: 'unknown' commit-status + 'Generating...' = weak signal](../learnings/1781179189519-devin-reviewer-unknown-commit-status-generating-we.md)
- [devin-fetch can exit 0 while analysis still "Generating" — low-confidence](../learnings/1781192458084-devin-reviewer-devin-fetch-can-exit-0-while-analys.md)
- [Reviewer C (clarity) can drop with transient socket error — detect tiny output, just re-run](../learnings/1781213312260-slang-pr-review-reviewer-c-clarity-can-drop-with-t.md)
- [CLARITY-INCOMPLETE after repeated `api_retry`/503 `server_error` is transient; grep the log, then retry (third attempt succeeded).](../learnings/1790622924515-slang-reviewer-an-executed-repro-beats-reviewer-a-.md)
- [Stacked-PR review: Reviewer A checks out master, producing false positives + missed-drop](../learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md)
- [Devin reviewer (B) can exit rc=0 while analysis is still "Generating" — false all-clear](../learnings/1781731413287-devin-reviewer-b-can-exit-rc-0-while-analysis-is-s.md)
- [Recover slang clarity-review candidates after a transient API error](../learnings/1781731735312-recover-slang-clarity-review-candidates-after-a-tr.md)
- [Verifying detached background PR-reviewer completion (Monitor + pgrep gotchas)](../learnings/1782160447849-verifying-detached-background-pr-reviewer-completi.md)
- [Reviewer A + C parallel isolation: use /workspace/agent/slang-clarity as C's REPO_ROOT](../learnings/1782586901771-reviewer-a-c-parallel-isolation-use-workspace-agen.md)
- [slang-pr-review: scope a re-run to focused verification when re-push is test-only](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md)
- [Slang PR #11815 review — A∩C converge on dead Flavor::Simple arm; Devin "30m timeout" quirk](../learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md)
- [slang-pr-review merge step: find Reviewer C run-dir from stdout, and drift-grep tool NAME not content](../learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md)
- [slang Reviewer C clarity run: recover truncated output from on-disk candidate file](../learnings/1782739994323-slang-reviewer-c-clarity-run-recover-truncated-out.md)
- [slang-pr-review: Devin can report 0 bugs while analysis still "Generating…" — weak signal](../learnings/1782761345395-slang-pr-review-devin-can-report-0-bugs-while-anal.md)
- [Devin reviewer scrape reliability](../learnings/devin-reviewer-scrape-reliability.md)
- [Devin can surface a correctness bug the fixer's report didn't pre-empt (#12052 double-add via a different consumer); a review spanning session boundaries can merge before Reviewer A completes](../learnings/1784291828247-devin-can-surface-a-correctness-bug-the-fixer-s-pr.md)
- [Reviewer A $30 cap can exit error_max_budget_usd with NO final-review.md even on a tiny diff — re-run at 40, salvage run-dir stream.jsonl not shared logs](../learnings/1784816888015-reviewer-a-30-budget-cap-can-silently-produce-no-f.md)
- [Devin re-run after a push can return stale cached analysis — detect via renamed-symbol probe, not commit-status; don't fold a stale pass into approval](../learnings/1784827155083-devin-re-run-after-a-push-can-return-stale-cached-.md)
- [recover a dead clarity/correctness run's candidates by replaying Write/Edit tool calls from stream.jsonl](../learnings/1784845681874-recover-a-dead-clarity-correctness-review-run-s-ca.md)
- [a "proves the gate works" negative test is vacuous unless the tested path feeds the gated input — would it pass with the guard removed?](../learnings/1784857152467-a-proves-the-gate-works-test-is-vacuous-unless-the.md)
- [CORRECTION: Devin renders for anonymous viewers, drafts included](../learnings/1791964273446-correction-devin-review-renders-for-anonymous-view.md) — draft status does not affect Devin; the "inconclusive on drafts" pattern was a `devin-fetch.sh` defect.

_Catalog: [[wiki/index.md]]_
