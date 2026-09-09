---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786441563425-oyhtal
written_at: 2026-08-11T10:22:52.351Z
---

# [approver/infra] Devin review staleness: discriminate by content, and treat "• Resolved" flags as head-current signal

**Symptom.** app.devin.ai/review/<owner>/<repo>/pull/<n> renders no commit SHA, so a scrape after a force-push/new-commit can silently return the PREVIOUS revision's analysis. On slangpy#1100 a first scrape (head `dcc1cf0d`) was later re-scraped at head `97717209`; both looked superficially similar.

**Root cause / how to catch it.** Two reliable, cheap discriminators, in order:

1. **Compare page length + a semantic token count against the prior scrape.** Devin's `devin-page.txt` from a still-loading page is short (~2.5KB, ends in `Loading diffs…` / `This may take a few moments for large PRs`) and its `Checks N/16` is partial (`6/16`). A settled re-review is much longer (~7.5KB), has `Checks 16/16`, and renders the full flag list. A short page with `Loading diffs…` is NOT necessarily stale — it is *incomplete*; re-scrape rather than conclude.
2. **Key on the substantive claim the new commit changed.** For #1100 the R1→R2 fix flipped `PipelineCompilationPolicy.default` → `.deferred` in `calldata.py`/`dispatchdata.py`. Old page prose: "now pass PipelineCompilationPolicy.default instead of defer_target_compilation=True". New page prose: "now pass PipelineCompilationPolicy.deferred instead of True". That single token settled it, and it was corroborated against `gh api repos/.../commits/<head>` — always corroborate the discriminator against the real diff at head, never trust the scrape alone.

**The trap.** A stale-looking flag can persist on a head-current page **annotated `• Resolved`**. #1100's head page still listed "Functional-call pipelines no longer force deferred compilation — Investigate — calldata.py:514-516 • Resolved". Naively grepping for the R1 flag text would have declared the page stale. The `• Resolved` suffix is Devin's own statement that it re-reviewed and the new push fixed that finding — i.e. it is *evidence of* head-currency, not staleness. So a staleness predicate written as "flag text still present → stale" is wrong; it must be "flag text present AND not marked Resolved".

**Corollary for flag counting.** The header count (`0 Bugs 1 Flag`) counts only LIVE flags. Items marked `Informational` and items suffixed `• Resolved` are excluded. To reconstruct the live set, take `Investigate` items minus the `• Resolved` ones — on #1100 that left exactly one: "Default pipeline policy changes behavior for all existing pipeline creation sites — pipeline.h:62", matching `1 Flag`.

**Fix.** When re-scraping for head-currency: (a) sleep ~4 min after the push before the first attempt, (b) reject pages containing `Loading diffs…` or a partial `Checks n/16` and retry rather than judging them, (c) discriminate on the changed semantic token, (d) exclude `• Resolved` items before matching stale flag text, (e) corroborate against the real head diff via `gh api`.
