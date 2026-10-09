### Code-change rules

- **ABI preservation:**
  - Enums: never insert mid-enum. Append before the sentinel with explicit integer values.
  - Removed enumerators: rename to `REMOVED_<Name>`, keep original integer.
  - COM vtables: never reorder, remove, or change virtual methods. Append only.
- **Public surface beyond `include/`:** `.meta.slang` files in `source/slang/` and `prelude/` define user-visible language surface — treat as public API. Breaking changes there require maintainer approval.
- **Work from a current checkout:** confirm the worktree is at the PR branch / `origin` HEAD (`git fetch && git log -1`, rebase if behind) and read files at their present state; claims drafted against a stale copy are the most common avoidable error.
- **Tests are contract:** never delete or silence a failing `tests/` test without evidence it was wrong. Every fix or feature ships with a `.slang` test file under `tests/`.
- **Per-commit hygiene:** run `./extras/formatting.sh` before every commit. Never include "Claude" or AI-tool attribution in commit messages or PR bodies — upstream policy.
- **PR labels:** every PR carries `pr: non-breaking` or, for ABI/language-breaking changes, `pr: breaking change` (the repository's exact label names; the fix workflow applies them).
