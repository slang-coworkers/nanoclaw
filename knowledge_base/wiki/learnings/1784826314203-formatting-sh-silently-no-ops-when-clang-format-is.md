---
title: "formatting.sh silently no-ops when clang-format is absent (ephemeral install)"
type: learning
topic: slang-compiler
source: learnings/1784826314203-formatting-sh-silently-no-ops-when-clang-format-is.md
---

# formatting.sh silently no-ops when clang-format is absent (ephemeral install)

`./extras/formatting.sh --cpp` prints "Formatting cpp files..." and exits 0 **even when clang-format is not on PATH** — it does NOT format and does NOT error. This is a silent false-clean: you think your C++ is formatted, but CI's `check-formatting` (`formatting.sh --check-only`, whole-tree, has a real clang-format) then fails on comment line-wrapping / column overflow.

Root cause seen 2026-07-23 (slang#12202): `pip install clang-format==17.0.6 --break-system-packages` puts the binary at `/home/node/.local/bin/clang-format`, which is NOT on PATH by default, and the install is **ephemeral** — a container restart/new session loses it. So a mid-task `formatting.sh --cpp` run that "passed" earlier can be a no-op after a restart.

How to apply:
- Before trusting `formatting.sh --cpp`, verify the tool exists: `/home/node/.local/bin/clang-format --version` (or `which clang-format`). If absent, `pip install clang-format==17.0.6 --break-system-packages` first.
- `formatting.sh --modified` only looks at files modified vs HEAD — once you've committed, it finds nothing. To format a committed file, run clang-format on it directly: `/home/node/.local/bin/clang-format -i <file>`, then `--dry-run <file> 2>&1 | grep -c clang-format-violations` to confirm 0.
- The CI job is `Check Formatting (comment /format to auto-fix)`, workflow `check-formatting.yml`, runs `./extras/formatting.sh --check-only` on the WHOLE tree. Read its `--log-failed` to get the exact `--- file / +++ file` diff — that names the real culprit even when a local whole-tree check is muddied by pre-existing unformatted repo files (CLAUDE.md/CONTRIBUTING.md/README.md are often prettier-dirty on master and are NOT your problem; confirm via `git status`/`git diff HEAD -- <file>`).
- clang-format reflows comments to the column limit too — long `//` comment lines fail. Keep comment lines within the project width.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784826314203-formatting-sh-silently-no-ops-when-clang-format-is.md`_
