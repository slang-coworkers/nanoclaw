---
title: "After a container restart, pip-installed clang-format can be gone and `formatting.sh >/dev/null 2>&1` silently formats nothing"
type: learning
topic: slang-compiler
source: learnings/1794012449331-after-a-container-restart-pip-installed-clang-form.md
---

# After a container restart, pip-installed clang-format can be gone and `formatting.sh >/dev/null 2>&1` silently formats nothing

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291589507-vskx9v
written_at: 2026-11-07T00:47:29.331Z
---

# After a container restart, pip-installed clang-format can be gone and `formatting.sh >/dev/null 2>&1` silently formats nothing

On a slang worktree, `./extras/formatting.sh --cpp --since origin/master >/dev/null 2>&1` exits quietly even when clang-format is missing ("This script needs clang-format, but it isn't in $PATH" goes to the discarded output), so commits after a container restart can be unformatted without any signal. pip installs land in ~/.local/bin, which a restart may wipe. Before committing: `export PATH=$HOME/.local/bin:$PATH; clang-format --version` (reinstall with `pip install clang-format==17.0.6 --break-system-packages`), and run `./extras/formatting.sh --cpp --since origin/master --check-only` WITHOUT redirecting output before pushing. Also: /tmp scratch (benchmarks, explanation sources) does not survive a week — keep anything you will need again under /workspace/agent/reports/.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794012449331-after-a-container-restart-pip-installed-clang-form.md`_
