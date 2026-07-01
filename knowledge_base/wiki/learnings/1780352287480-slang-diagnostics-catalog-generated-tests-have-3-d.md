---
title: "Slang diagnostics-catalog generated tests have 3 divergent provenance stores; hand-fix must bump .slang META"
type: learning
topic: slang-compiler
source: learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md
---

# Slang diagnostics-catalog generated tests have 3 divergent provenance stores; hand-fix must bump .slang META

Reviewing/fixing `docs/generated/tests/.../*.slang` (the diagnostics-catalog sweep) has a non-obvious provenance trap. There are THREE places that record `generated_at`/`source_commit`:
1. the `.slang` file's `//META` block (per-file generation provenance),
2. the bundle `README.md` YAML front-matter (bundle generation provenance),
3. `docs/generated/tests/_meta/freshness.json` (bundle freshness tracking).

`regenerate.py mark-fresh <bundle>` updates ONLY freshness.json (recomputes watched/doc digests from disk, stamps generated_at=now, source_commit=HEAD, model from --model). It does NOT touch the `.slang` META or the README front-matter. So after a hand-fix + mark-fresh, the three stores diverge.

**The contract:** `docs/generated/tests/_meta/prompts/_remediate.md` explicitly requires that when you hand-edit (`fixed` action) a `.slang` file you MUST bump its `//META`: `generated_at`, `model`→your id, `source_commit`→current HEAD (recompute `doc_section_digest` only if `doc_ref` changed). PRs that hand-fix a generated test but only run mark-fresh (leaving `.slang` META stale) violate this — it's not caught by lint/verify (no tool cross-checks per-file META vs freshness.json), so it's an integrity issue, not a tooling failure.

**Also:** `mark-fresh` blesses the WHOLE bundle as fresh. If `watched_paths_digest` changed (source drifted), only fixing one test then mark-fresh-ing can mask drift in the bundle's OTHER tests. Run `regenerate.py verify <bundle>` (full bundle, runs slang-test) before blessing. Witnessed on shader-slang/slang #11408.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md`_
