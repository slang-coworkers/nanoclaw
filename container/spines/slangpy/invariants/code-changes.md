### Code-change rules

These apply when you write or review SlangPy code (writers; readers can ignore).

- **Tests:** new Python APIs must have tests in `slangpy/tests/`. Slang tests use `.slang` files with `[shader("compute")]` entry points and `StructuredBuffer<T>` / `RWStructuredBuffer<T>` for typed GPU arrays.
- **Build before test:** always build before running tests.
- **Pre-commit:** run `pre-commit run --all-files` after completing tasks; re-run if it modifies files.
- **Code style:**
  - Python: PascalCase classes, snake_case functions/variables, `_` prefix for private members. Black formatter (line-length 100). Type-annotate all Python function arguments.
  - C++: PascalCase classes, snake_case functions/variables, `m_` prefix for members.
- **Dependencies:** minimize new external deps; this project keeps its surface area tight.
- **Commit messages:** never include "Claude" or AI-tool attribution — upstream policy.
- **PRs:** require review approval + CI pass. Squash merge with descriptive final commit message.
