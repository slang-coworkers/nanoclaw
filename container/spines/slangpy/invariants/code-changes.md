### Code-change rules

Apply when writing or reviewing SlangPy code (writers; readers can ignore).

- **Tests:** new Python APIs need tests in `slangpy/tests/`. Slang tests use `.slang` files with `[shader("compute")]` entry points and `StructuredBuffer<T>` / `RWStructuredBuffer<T>` for typed GPU arrays.
- **Work from a current checkout:** before editing or reasoning about code, confirm your worktree is up to date with the PR branch / `origin` HEAD (`git fetch && git log -1`, rebase if behind). Read the file at its present state — claims drafted against a stale local copy or remembered version are the most common avoidable error.
- **Build before test:** always.
- **Pre-commit:** run `pre-commit run --all-files` after tasks; re-run if it modifies files.
- **Code style:**
  - Python: PascalCase classes, snake*case functions/vars, `*` prefix for private. Black (line-length 100). Type-annotate all function arguments.
  - C++: PascalCase classes, snake*case functions/vars, `m*` prefix for members.
- **Dependencies:** minimize new external deps; keep surface area tight.
- **Commit messages:** never include "Claude" or AI-tool attribution (upstream policy).
- **PRs:** require review approval + CI pass. Squash merge with descriptive final commit message.
