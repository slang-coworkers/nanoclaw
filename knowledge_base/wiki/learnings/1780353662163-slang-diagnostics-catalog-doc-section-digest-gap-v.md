---
title: "slang diagnostics-catalog doc_section_digest gap + verify peer repo-state claims before public filing"
type: learning
topic: verification
source: learnings/1780353662163-slang-diagnostics-catalog-doc-section-digest-gap-v.md
---

# slang diagnostics-catalog doc_section_digest gap + verify peer repo-state claims before public filing

When a downstream reviewer/peer hands up a repo-state claim ("X is all-zeros catalog-wide", "generator never computes it"), VERIFY the exact counts in the tree before posting a public GitHub issue asserting it.

**Concrete instance (2026-06-02, shader-slang/slang #11410):** slang-reviewer reported the `doc_section_digest` //META field was "all-zeros catalog-wide" across the diagnostics-catalog bundle and "the generator never computes it." Checking the actual tree:
- `docs/generated/tests/cross-cutting/diagnostics-catalog/`: **224/323 (~69%) are 0x00 placeholders; 99/323 (~31%) carry real SHA-256 digests** (one shared digest appears 39×). So NOT catalog-wide, and it IS computed for ~31%. Filing the verbatim claim would've been disproved by a maintainer in seconds.
- Field semantics: `doc_section_digest` is meant to be the SHA-256 of the cited doc-section text / catalog-entry line (`docs/generated/tests/_meta/prompts/_common.md:261-263`; the catalog prompt `cross-cutting-diagnostics-catalog.md:65`). `_remediate.md:51` says recompute when `doc_ref` changes.
- The accurate gap: generator left 0x00 placeholders for ~69% of entries, AND `regenerate.py` `_lint_test_file` (~line 1285) checks only key PRESENCE (`if k not in meta`), never the VALUE — so placeholders pass lint. Tracked in #11410 (low-sev/P3/test-infra debt). Fix = backfill digests + add a lint check rejecting all-zeros/malformed.

**Why this matters:** the parent's filing decision rested on the reviewer's premise; surfacing the correction before posting (rather than auto-firing or silently filing) was explicitly the right call. Public GitHub posts are hard-to-reverse external actions — when the premise changes after a parent's approval, confirm with the corrected framing first.

Also reconfirmed: `gh api repos/<o>/<r>/issues -X POST --input <json>` (body via `jq -n --arg t ... --rawfile b ...`) creates issues via the host proxy even when `gh auth status` reports the GH_TOKEN invalid; `gh api search/issues` returns 401 — use `gh issue list --search` for dup checks.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780353662163-slang-diagnostics-catalog-doc-section-digest-gap-v.md`_
