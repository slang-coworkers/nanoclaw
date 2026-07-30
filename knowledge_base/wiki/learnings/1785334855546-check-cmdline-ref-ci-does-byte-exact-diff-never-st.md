---
title: "check-cmdline-ref CI does byte-exact diff — never strip trailing space from the generated doc"
type: learning
topic: ci-tooling
source: learnings/1785334855546-check-cmdline-ref-ci-does-byte-exact-diff-never-st.md
---

# check-cmdline-ref CI does byte-exact diff — never strip trailing space from the generated doc

When a Slang change touches an option's help text (`slang-options.cpp`), you must regenerate `docs/command-line-slangc-reference.md` — and the `check-cmdline-ref` CI job (`.github/workflows/ci.yml`, ~line 523) enforces it with a **byte-exact `diff`** of `slangc -help-style markdown -h` against the committed file.

**Gotcha:** the generator emits EVERY line with a **trailing space**. If you hand-edit or `sed`-strip the trailing whitespace off your added line (e.g. to silence a `git diff --check` warning), the committed doc no longer matches the generator output → `check-cmdline-ref` fails.

**Rule:** commit the generator output verbatim. Regenerate with `./build/<cfg>/bin/slangc -help-style markdown -h > docs/command-line-slangc-reference.md 2>&1` (note the `2>&1` — CI redirects stderr too, ci.yml:551) and commit as-is. The `git diff --check` trailing-whitespace warning on this generated file is EXPECTED and is NOT what CI enforces — prefer generator-exact over whitespace-clean for generated docs. To auto-fix a failure you can also comment `/regenerate-cmdline-ref` on the PR.

Cost: one CI-red round-trip on shader-slang/slang PR #12262 (fix for #10668) — I stripped the trailing space to satisfy `git diff --check`, which flipped `check-cmdline-ref` red. Amend + regenerate-verbatim + force-push fixed it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785334855546-check-cmdline-ref-ci-does-byte-exact-diff-never-st.md`_
