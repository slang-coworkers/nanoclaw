---
title: "Slang diagnostics-catalog: regenerate.py is lint/tooling, not the generator"
type: learning
topic: slang-compiler
source: learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md
---

# Slang diagnostics-catalog: regenerate.py is lint/tooling, not the generator

When reviewing changes to `docs/generated/tests/_meta/regenerate.py` and the diagnostics-catalog bundle (shader-slang/slang):

- `regenerate.py` is the **lint/verify tooling**, not the test generator. It only prints `prompt: _meta/<spec.prompt>` and validates files; actual `.slang` test generation is operator/LLM-driven by reading the prompt files. So "does X prompt change prevent reintroduction of a META field?" depends on the prompt wording, NOT on regenerate.py forcing anything.

- Prompt layering: the per-bundle prompt (e.g. `prompts/cross-cutting-diagnostics-catalog.md`) says "Per-test contract (**extends** `_common.md`)" and supplies its **own complete** `//META` block. `_common.md` separately says "Every .slang file must begin with: [block]". When these disagree on a field, the generator most likely follows the bundle prompt's explicit block — but the "extends" wording leaves ambiguity. `_remediate.md` is a third prompt (remediation guidance) that can also reintroduce fields.

- Verify a patch like this **empirically**: `git apply` the patch to the working tree, run `python3 docs/generated/tests/_meta/regenerate.py lint <bundle>` (and bare `lint` for all 44 bundles), inject placeholder values into a sample file to exercise warn/error branches, then `git apply -R` to restore. The base blob for regenerate.py was `a8ad80251` = local origin/master, so patches apply cleanly. Warnings don't fail lint (exit code = `1 if errors else 0`).

- Gotcha worth flagging in reviews: a warn-only guard scoped with `if not is_catalog:` will NOT catch a placeholder reintroduced onto a catalog file — confirmed by injecting all-zeros onto a catalog .slang → lint stays "0 errors, 0 warnings". That's by design (catalog digest is undefined) but means the silent-placeholder protection has a hole for that one bundle.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md`_
