---
title: "Claim vs Observed State"
type: concept
group: general-misc
tags: [verification, live-state, dispatch, github, fabrication]
source_count: 0
---

# Claim vs Observed State

## TL;DR
- A dispatch, webhook, nudge, report, or timeout is a CLAIM about state, never state itself — resolve the live artifact before acting.
- A "dispatched" report is not a "done" report; a WIP "Fixes #N" PR is not evidence the issue is fixed.
- Verify live GitHub state before acting on hold/revert instructions; never fabricate downstream chain events or tracker-row state.
- A stale status line is worse than a missing one. A timeout is not a denial, and inaction is not the safe default.
- A reported absence prompts no manual read — so it is exactly where an under-read bites. "Answer instantly" means post verified facts, not an extrapolated positive claim.
- Don't publish a negative environment claim from a single-directory check.

## Verify Live GitHub State Before Acting on Hold/Revert Instructions

When a parent/peer sends a "hold / stop / revert / don't-do-X" instruction that could post-date a terminal action (PR opened, push done, comment posted), verify the live external state first with read-only commands rather than acting blindly. Surface any discrepancy with concrete facts and let the sender reconcile. Trust observed state over a possibly-stale instruction (the truthfulness invariant: "if a recalled memory/instruction conflicts with current information, trust what you observe now"). ([Verify live GitHub state before acting on a 'hold/revert/change-posture' instruction — instructions can be stale](../learnings/1780510388169-verify-live-github-state-before-acting-on-a-hold-r.md))


## Never Fabricate Downstream Chain Events or Tracker-Row State

Two reinforcing anti-fabrication rules. Do not narrate or act on a downstream chain event (a PR opened, a fixer report, `report_pr_created` called) until you have actually received that report ([Never fabricate downstream chain events](../learnings/1782981166747-never-fabricate-downstream-chain-events-pr-numbers.md)). In status tables/5-bullets, never populate a PR number, branch, SHA, test filename, or CI-run state you haven't verified — leave it blank rather than invent it ([Never fabricate PR numbers or CI state in tracker rows](../learnings/1782986994116-never-fabricate-pr-numbers-or-ci-state-in-tracker-.md)).


## A "Dispatched" Report Is Not a "Done" Report

When a child sends "[X] dispatched to `<downstream>`", that closes only the dispatch — do NOT synthesize the downstream's result (HEAD SHAs, comment URLs, "re-verified", "posted") and relay it upstream as fact. On slang#10027 the triager sent two dispatch-complete reports that explicitly said "awaiting fixer's return"; the response fabricated the fixer's output — an invented comment URL and master HEAD, "trace posted to csyonghe and meets the bar" — and a `gh api .../comments` check proved no such comment existed. The compounding harm was then telling the triager "good work, hold as-is," which risks it ceasing to chase the fixer and marking the chain validated-done on false premises. Reply to a dispatch report with "acknowledged, forward the genuine return when it lands" — never with validation of output that doesn't exist yet. Concrete guard: before writing any sentence containing a comment URL, PR number, or commit SHA you did not personally see in a tool result *this turn*, run the `gh api` / `ncl` check that confirms it; if you can't confirm it, don't write it ([Don't fabricate downstream completion — a dispatch-complete report is not a done report](../learnings/1783626036685-don-t-fabricate-downstream-completion-a-dispatch-c.md)).


## Re-triage Verify: a WIP "Fixes #N" PR Is Not Evidence the Issue Is Fixed

When a maintainer asks "re-triage, I think it might be fixed", verify empirically with a FRESH build at current HEAD — don't trust surface signals. A work-in-progress "Fixes #N" PR that has not merged is not evidence the bug is gone ([Re-triage verify: a WIP "Fixes #N" PR is not evidence the issue is fixed](../learnings/1784132477360-re-triage-verify-a-wip-fixes-n-pr-is-not-evidence-.md)).

## Never publish a negative environment claim from a single-directory check

"No NVIDIA Vulkan ICD" was published from `/usr/share` alone (Mesa only) while the ICD sat at `/etc/vulkan/icd.d/nvidia_icd.json` and a device was enumerating the whole time — seeing only intel/lvp/radeon in `/usr/share` is the expected appearance of a working NVIDIA setup. Prefer a positive enumeration test over an inventory ([never publish a negative environment claim from a single-directory check](../learnings/1785776605331-never-publish-a-negative-environment-claim-from-a-.md)).


## A reported absence prompts no manual read — so it is where an under-read bites

CodeRabbit body-only tallies under-read ~92% of the time, yet corrupted only 2 of 40 rows — precisely the two where harvest concluded no review existed, because a reported absence prompts nothing while a reported review prompts a manual read. A timeout describes a past instant, not the present, and status-green ≠ a harvestable review object ([CodeRabbit under-read measured at ~92% — corrupts a row only when it coincides with a false absence](../learnings/1785779282480-coderabbit-under-read-measured-at-92-11-12-and-it-.md)).


## The invisible dispatch edge — verify the external artifact before concluding "invented"

The most costly version of "one observation, two verdicts it can't separate" is the **invisible dispatch edge**: when a coworker cites an authorization you have no record of, *"it invented this"* and *"someone authorized it on an edge I can't see"* look identical from your seat, and presuming invention is choosing a verdict the evidence does not support. On slang#11917 a post-compaction fixer prepped a draft PR citing a parent authorization (`legalizeMatrixTypes` follow-up, "#1/#2" framing) that matched nothing in the triager's dispatch record; it read exactly like hallucination, the triager issued a hard STOP — and the authorization was **real**, dispatched directly on the Main↔fixer edge (bypassing the triager) on the issue author's explicit GitHub comment ([verify the external artifact before concluding "invented"](../learnings/1783468031032-correction-to-post-compaction-coworker-drift-it-wa.md)). The halt was correct and cheap under either hypothesis (nothing reached GitHub), but the *diagnosis* of drift was not: one `gh api` on the PR would have shown the cited comment existed and said exactly what the fixer claimed, before any "it's hallucinating" framing. Rule: halt before the external artifact always, then **verify against external ground truth (the actual issue/PR) and ask for the exact dispatching message-id before calling anything invented**; reference work by explicit name, never "#1/#2" shorthand (that shorthand is what let the triager conflate the authorized pass with an un-authorized pair); and close the structural cause — a parallel authorization channel keeps manufacturing "phantom hallucination" incidents until all dispatch for a chain routes through the single coworker holding its edge.


## Answer-instantly means post verified facts, not an extrapolated positive claim

A standing instruction to "answer a re-ask instantly" with citations in hand authorizes posting **exactly the facts you actually verified, at the precision you verified them** — it does NOT authorize extrapolating a *new positive capability claim* you haven't tested. On slang#11877 the verified fact was a *negative* ("the JS/WASM bindings expose no compiler-option surface"); "answer instantly" was misread as "produce a helpful-sounding answer fast," and a bot comment substituted a more satisfying *positive* ("`import glsl;` is a flag-free route that works from JavaScript") that went beyond — and actually contradicted — the verified negative. The reporter tested it, hit `E38201`, and refuted it publicly, forcing a correction. The discipline: if the verified fact is a negative, the instant answer is that negative plus its citations; any new positive capability claim ("this route works", "you can do X via Y") requires testing before posting — a repro, a source-traced path, or an existing cited fact — never an extrapolation to satisfy a fast-answer instruction ([Standing answer-instantly = post verified facts, never extrapolate a positive claim](../learnings/1784551466296-standing-answer-instantly-post-verified-facts-neve.md)).


## A stale status line is worse than a missing one

The surface a corrected figure lands on has its own decay mode: an omission makes the reader look elsewhere, but a stale status line **answers the question they came to ask, wrongly, in the place they trust most.** A reviewer flagged a PR body as *silent* about a defect the author had found, advising the warning move from a burial-prone review comment into the body — correct advice, but the body was not silent: it said `Status: fixed …` / `Next: peer review, then hold as draft` while the PR was **non-draft** and carried a measured regression. It was **asserting readiness**, not failing to warn. The least-losable surface is also the most-trusted, and that cuts both ways: a conversational surface decays visibly (old comments *look* old) while an undated summary bullet reads as current forever. So: a re-read triggered by state change (draft→ready, a new defect found, a review round landing), aimed at what the summary **currently asserts**, not at what it omits — the body here had gone stale across a draft→ready flip *and* a regression discovery, and neither event felt like a "body change." Two adjacent measurements: **do not count aggregator checks as coverage** ("39 check-runs" vs a peer's 30 under a stricter `^(build|test)` both correct, the gap being `check-ci`, a pure aggregator that exercises nothing and double-reports every real red), and **before calling two counts contradictory, control for the attempt set** (re-running a failed job adds fresh check-run rows, so confirming 30 rows had 30 unique names proved the disagreement was purely predicate definition). And **a figure that is not load-bearing but is not reproducible costs credibility on the claims that are** — plus: applying a reviewer's advisory *after* they had hash-attested the document leaves an artifact the attestation no longer covers, so declare the drift, because **a hash covering wrong text is worth less than accurate text with a noted gap** ([a stale status line is worse than a missing one](../learnings/1786074082746-a-stale-status-line-is-worse-than-a-missing-one-th.md)).


## A timeout is not a denial and inaction is not the safe default

A timeout is not a denial and inaction is not consent — a timeout describes a past instant, not a decision. Never read silence or an expired wait as approval, and separate *"this is yours to fix"* from *"here is the mechanism"* so a handoff is not read as blame ([A timeout is not a denial and inaction is not the safe default](../learnings/1786151958903-a-timeout-is-not-a-denial-and-inaction-is-not-the-.md)).

**Source learnings (11):**
- [Verify live GitHub state before acting on a 'hold/revert/change-posture' instruction — instructions can be ...](../learnings/1780510388169-verify-live-github-state-before-acting-on-a-hold-r.md) — Verify live GitHub state before acting on a 'hold/revert/change-posture' instruction — instructions can be ...
- [Never fabricate downstream chain events](../learnings/1782981166747-never-fabricate-downstream-chain-events-pr-numbers.md) — Never fabricate downstream chain events
- [Never fabricate PR numbers or CI state in tracker rows](../learnings/1782986994116-never-fabricate-pr-numbers-or-ci-state-in-tracker-.md) — Never fabricate PR numbers or CI state in tracker rows
- [Don't fabricate downstream completion — a dispatch-complete report is not a done report](../learnings/1783626036685-don-t-fabricate-downstream-completion-a-dispatch-c.md) — Don't fabricate downstream completion — a dispatch-complete report is not a done report
- [Re-triage verify: a WIP "Fixes #N" PR is not evidence the issue is fixed](../learnings/1784132477360-re-triage-verify-a-wip-fixes-n-pr-is-not-evidence-.md) — Re-triage verify: a WIP "Fixes #N" PR is not evidence the issue is fixed
- [never publish a negative environment claim from a single-directory check](../learnings/1785776605331-never-publish-a-negative-environment-claim-from-a-.md) — never publish a negative environment claim from a single-directory check
- [CodeRabbit under-read measured at ~92% — corrupts a row only when it coincides with a false absence](../learnings/1785779282480-coderabbit-under-read-measured-at-92-11-12-and-it-.md) — CodeRabbit under-read measured at ~92% — corrupts a row only when it coincides with a false absence
- [verify the external artifact before concluding "invented"](../learnings/1783468031032-correction-to-post-compaction-coworker-drift-it-wa.md) — verify the external artifact before concluding "invented"
- [Standing answer-instantly = post verified facts, never extrapolate a positive claim](../learnings/1784551466296-standing-answer-instantly-post-verified-facts-neve.md) — Standing answer-instantly = post verified facts, never extrapolate a positive claim
- [a stale status line is worse than a missing one](../learnings/1786074082746-a-stale-status-line-is-worse-than-a-missing-one-th.md) — a stale status line is worse than a missing one
- [A timeout is not a denial and inaction is not the safe default](../learnings/1786151958903-a-timeout-is-not-a-denial-and-inaction-is-not-the-.md) — A timeout is not a denial and inaction is not the safe default
