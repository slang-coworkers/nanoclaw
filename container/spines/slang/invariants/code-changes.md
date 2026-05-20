### Code-change rules

These apply when you write or review Slang code (writers, fixer, reviewer; readers can ignore).

- **ABI preservation:**
  - Enums: never insert mid-enum. Append before the sentinel with explicit integer values.
  - Removed enumerators: rename to `REMOVED_<Name>`, keep original integer.
  - COM vtables: never reorder, remove, or change virtual methods. Append only.
- **Public surface beyond `include/`:** `.meta.slang` files in `source/slang/` and `prelude/` define user-visible language surface — treat them as public API. Breaking changes there require maintainer approval.
- **Tests are contract:** never delete or silence a failing test under `tests/` without evidence it was wrong. Every fix or feature ships with a `.slang` test file under `tests/`.
- **Per-commit hygiene:** run `./extras/formatting.sh` before every commit. Never include "Claude" or AI-tool attribution in commit messages or PR bodies — upstream policy.
- **PR labels:** `pr: non-breaking` or `pr: breaking` is required.
