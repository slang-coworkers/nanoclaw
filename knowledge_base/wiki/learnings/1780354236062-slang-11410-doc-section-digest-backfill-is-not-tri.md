---
title: "slang 11410 doc_section_digest backfill is not trivial — semantics underspecified, no deterministic Python computation"
type: learning
topic: slang-compiler
source: learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md
---

# slang 11410 doc_section_digest backfill is not trivial — semantics underspecified, no deterministic Python computation

Follow-up to the #11410 doc_section_digest gap (learning 1780353662163). When triaging the *fix*, a deeper finding changes the recommended approach: "just backfill the 224 placeholders" is insufficient.

**Verified on shader-slang/slang master (HEAD b305a4df), `docs/generated/tests/cross-cutting/diagnostics-catalog/`:**
- Of the 99 non-zero `doc_section_digest` values, ONE digest (`90e08e71…`) is shared by **39** entries; the other **60** are unique-per-file. So even the "real" 31% are internally inconsistent — they were not all computed by the same rule.
- All 99 real + 219 of the 224 placeholders carry `doc_ref=source/slang/slang-diagnostics.lua` with **NO `#anchor`** (5 placeholders → `slang-misc-diagnostic-defs.h`). But `prompts/_common.md:261-263` defines the digest as the SHA-256 of an *anchor-pinned* doc section ("body lines from the heading whose id is the anchor…"). A flat catalog whose doc_ref is a bare file path has no such section.
- `regenerate.py` has NO per-entry digest function. It only has bundle-level `compute_watched_digest` (line 877), `compute_source_doc_digest` (line 895, hashes the whole source_doc), and `cmd_digest` (line 1450) — all bundle-scoped. The per-entry `doc_section_digest` is delegated to the LLM agent at generation time ("the agent can compute this directly from the doc file"), which is why output is inconsistent/placeheld.

**Implication for the fix:** the digest semantics are underspecified for this bundle. Real options are (B) define + implement a deterministic per-entry computation in Python keyed by `catalog_code`, backfill all 323, and make lint recompute-and-compare; or (C) scope the field down to optional and rely on the bundle-level digests already in `freshness.json`. It's a maintainer design call. Avoid the naive "backfill via LLM re-gen + reject-zeros lint" — it manufactures more unverifiable digests.

**Sequencing trap:** a hard "reject all-zeros" lint error cannot land alone — it immediately red-lines the 224 existing placeholders (`regenerate.py lint` fails for the bundle). Pair lint-hardening with the data fix, or make it warn-only until corrected.

This is the same root-cause CLASS as the presence-only-grep weakness in learning 1779985772055 (marked-block sha256 pattern): a presence check is too weak; only recompute-and-compare actually detects drift.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md`_
