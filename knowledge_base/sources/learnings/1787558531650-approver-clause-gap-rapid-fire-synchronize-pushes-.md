---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786733963343-zvxvjy
written_at: 2026-08-24T08:02:11.650Z
---

# [approver/clause-gap] Rapid-fire synchronize pushes: re-verify the LIVE head at RECORD time, not just at staging — a critique-gated decision can outlast its own head

**PR:** shader-slang/slang#12421 (re-land macro-expansion-stack diagnostics). Over one session the branch was pushed 4 heads deep — 8cd02a1b → c3098e55 → 6d8ba878 → b0b1a559 — while I was mid-decision on each. Final decision recorded: ABSTAIN_POLICY/OPEN_GAP on the settled head b0b1a559.

**Symptom.** I staged and fully investigated a BLOCK on c3098e55 (a verified obfuscation null-deref 🔴), ran three critique rounds to correct the derivation, and only at the OUTPUT_REVIEW step did codex check the LIVE head and find it had already advanced to 6d8ba878 — my decision had gone stale *during its own critique*. If codex hadn't re-checked, I'd have recorded a per-commit ledger row for a commit that was no longer the head, and (worse) the very bug I was blocking on had been FIXED in the push that superseded it.

**Root cause.** The dispatch-discipline rule "a dispatch is a claim about state; verify the head before acting" is usually read as a STAGING-time check. But a critique-gated decision (BLOCK / WOULD_APPROVE) can take many minutes and several codex rounds. On an actively-iterating PR the head can move *between staging and record*. The head check must fire at BOTH ends: once to stage, and AGAIN immediately before record_decision.

**How to catch it (mechanical).** Make the head re-check part of the record step itself: right before `record_decision`, run `gh pr view <pr> --json headRefOid` and assert it equals the staged commit_sha; if not, abandon and re-stage on the live head. I did this on the final head (verified b0b1a559 unchanged at record time) and it's now my standing pre-record gate. Codex's OUTPUT_REVIEW independently caught the drift the one time I forgot — a good reason the critique gate reads live state, not just the artifact.

**Bonus calibration (re-land quality signal).** This same PR shows a re-land converging under review pressure: the obfuscation crash (which I'd have blocked) was fixed via a principled LocPair split (originalLoc = raw IR dedup key; definitionLoc = unmapped loc for SourceView lookup) PLUS a positive-control regression test (tests/obfuscate/obfuscate-macro-body-loc.slang runs -obfuscate on a macro-expanded shader — the exact trigger). When a producer change breaks an unchanged downstream consumer's loc→view assumption, the correct fix is to carry BOTH the raw key and the resolved value on the pair, not to unmap in place (which would corrupt the dedup key / obfuscation identity — the helper findSourceViewThroughExpansion's own doc says obfuscation must use findSourceViewRecursively directly).

**Also:** never trust Devin's `• Resolved`/unresolved tags when its commit-status is "unknown" — verify each flagged 🔴 against source at the pinned head. Here Devin still listed the obfuscation crash as a Bug (unresolved-looking in the raw list) while the primary review + my source read both confirmed it fixed; and Devin mislabeled the experimental-rich-flag :402 loss as "default output" when the default text path was actually converted.
