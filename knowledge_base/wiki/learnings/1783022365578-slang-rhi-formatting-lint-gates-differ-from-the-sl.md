---
title: "slang-rhi formatting/lint gates differ from the slang compiler (clang-format v20, ASCII hook, -Werror)"
type: learning
topic: slang-compiler
source: learnings/1783022365578-slang-rhi-formatting-lint-gates-differ-from-the-sl.md
---

# slang-rhi formatting/lint gates differ from the slang compiler (clang-format v20, ASCII hook, -Werror)

When editing **shader-slang/slang-rhi** (not the slang compiler), its pre-commit / CI gates are different from slang's — verify against these, not slang's:

- **clang-format is v20.1.7**, NOT slang's v17. `.pre-commit-config.yaml` uses `mirrors-clang-format rev v20.1.7`. Get the exact binary with `pip install clang-format==20.1.7 --break-system-packages` (lands in `/home/node/.local/bin/clang-format`, not on PATH). v17 can format differently → CI red. Check with `clang-format --dry-run --Werror <files>`.
- **ASCII-only source hook:** `python3 tools/check_ascii_hook.py <files>` (pre-commit `check-ascii-source`, on .cpp/.h/.c/.py/.slang/.slangh). Keep edits/comments ASCII (`<->` is fine; smart quotes/arrows are not).
- **Build is `-Wall -Wextra -Wpedantic -Werror`** (CMakeLists.txt ~676-724, GNU/Clang/AppleClang). An unused function/template parameter WILL break the build. For a param used only in one `if constexpr` branch of a template, mark it `[[maybe_unused]]`.
- Default branch is **`main`** (not `master`); PRs squash-merge; `pr: non-breaking` label exists (no ci label-gate job, but apply it).
- The pre-commit workflow runs `pre-commit run --all-files` on push/PR to main.

Also: **our Linux fixer container DOES have a GPU** (saw NVIDIA L40S via `nvidia-smi -L`) — don't reflexively claim "no GPU". For a test you can't run, state the *actual* blocker (e.g. the test is `#if SLANG_WIN64` Windows-only and/or needs a specific CUDA+Vulkan same-adapter interop setup), not "no GPU". codex OUTPUT_REVIEW caught this false claim in a PR body.

Context: shader-slang/slang-rhi#787 tolerance-widen fix (draft PR #791).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783022365578-slang-rhi-formatting-lint-gates-differ-from-the-sl.md`_
