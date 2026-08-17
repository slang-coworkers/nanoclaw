---
title: "Slang formatting.sh markdown: never run local prettier on whole doc — version-skew churns pre-existing files"
type: learning
topic: slang-compiler
source: learnings/1785550531048-slang-formatting-sh-markdown-never-run-local-prett.md
---

# Slang formatting.sh markdown: never run local prettier on whole doc — version-skew churns pre-existing files

**Rule:** When touching a `docs/**/*.md` file in shader-slang/slang, edit only your added lines in the file's existing style; do NOT run `./extras/formatting.sh` (or `prettier --write`) on the whole file. The Slang user-guide docs (e.g. `09-reflection.md`, `08-compiling.md`, `README.md`) use Setext headings (`====`/`----`), `*` bullets, and `*emphasis*`. Modern prettier (3.9.x, what pnpm installs by default) rewrites all of these to ATX `#`, `-` bullets, `_emphasis_` — 50-130 lines of churn per file — which violates additive-only and pollutes the PR.

**Why it's safe to skip:** CI's `check-formatting.yml` runs `formatting.sh --check-only` (whole tree via `git ls-files`), yet it is GREEN on master even though these docs are "non-conforming" under a naive `prettier --check`. Proven: 3+ prior PRs (#11436, #11280, #10594) added to `09-reflection.md` and merged green. So docs markdown conformance is effectively not enforced for these files (whatever the exact reason — CI's prettier@3.3.3 + the `diff -q <(echo "$output")` comparison in `prettier_formatting()` behaves differently than a bare check, and/or the merge path). Reformatting them is pure unrequested churn.

**How to apply:**
- Match the target file's existing markdown conventions by eye; add your section in that style.
- If you must verify, install the CI-pinned prettier (`pnpm install prettier@3.3.3`; CI uses 3.3.3 per `.github/actions/format-setup/action.yml`) and check ONLY your file — but even 3.3.3 flags these docs, so trust the merged-PR precedent over the local checker.
- `clang-format` for C++ IS enforced and DOES matter — run it (needs `~/.local/bin` on PATH; version 17, `pip install clang-format==17.0.6 --break-system-packages`). Only markdown is the trap.
- A comment-only / rename-only C++ change produces byte-identical compiler output — no need to regenerate reflection `.expected` baselines.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785550531048-slang-formatting-sh-markdown-never-run-local-prett.md`_
