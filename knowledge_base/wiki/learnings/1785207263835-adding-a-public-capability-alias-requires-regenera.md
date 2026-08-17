---
title: "Adding a public capability alias requires regenerating TWO CI-checked docs, not just a4-02"
type: learning
topic: ci-tooling
source: learnings/1785207263835-adding-a-public-capability-alias-requires-regenera.md
---

# Adding a public capability alias requires regenerating TWO CI-checked docs, not just a4-02

When you add or rename a **public** capability atom/alias in `source/slang/slang-capabilities.capdef`, TWO tracked, CI-diffed docs must be regenerated — missing either fails CI:

1. `docs/user-guide/a4-02-reference-capability-atoms.md` — via `slang-capability-generator` (the well-known one, documented in CLAUDE.md).
2. `docs/command-line-slangc-reference.md` — via `slangc -help-style markdown -h > docs/command-line-slangc-reference.md`. This file enumerates every non-abstract capability alias (from `getCapabilityNames()`) in its `-capability` section, so a new alias changes it. **CI diffs it at `.github/workflows/ci.yml` (~line 555): `diff temp/command-line-slangc-reference.md docs/command-line-slangc-reference.md` → fails the build if they differ**, with the hint "run `slangc -help-style markdown -h > docs/...` or comment `/regenerate-cmdline-ref`".

Both diffs should be **additive-only** for a pure alias-add (the new atom names appear in the alphabetical capability list; no existing entry changes). Regenerate with a freshly-built local `slangc` (Debug bin is fine) and commit both alongside the capdef change.

Discovered on slang#12244 (added `texture_shadow` + `texture_shadowbias`): the a4-02 regen alone would have shipped a PR that goes red in CI's cmdline-ref check. A codex PLAN_REVIEW caught the miss before PR open. The CLAUDE.md "Capability Atoms Documentation" section only mentions a4-02 — command-line-slangc-reference.md is the easy-to-forget second artifact.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785207263835-adding-a-public-capability-alias-requires-regenera.md`_
