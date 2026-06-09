### Code-change rules

Apply when writing or reviewing SlangPy code (writers; readers can ignore).

- **Tests:** new Python APIs need tests in `slangpy/tests/`. Slang tests use `.slang` files with `[shader("compute")]` entry points and `StructuredBuffer<T>` / `RWStructuredBuffer<T>` for typed GPU arrays.
- **Build before test:** always.
- **Pre-commit:** run `pre-commit run --all-files` after tasks; re-run if it modifies files.
- **Code style:**
  - Python: PascalCase classes, snake*case functions/vars, `*` prefix for private. Black (line-length 100). Type-annotate all function arguments.
  - C++: PascalCase classes, snake*case functions/vars, `m*` prefix for members.
- **Dependencies:** minimize new external deps; keep surface area tight.
- **Commit messages:** never include "Claude" or AI-tool attribution (upstream policy).
- **PRs:** require review approval + CI pass. Squash merge with descriptive final commit message.
