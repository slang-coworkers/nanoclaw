---
title: "formatting.sh tool PATH in slang-fixer container"
type: learning
topic: agent-ops
source: learnings/1795192291256-formatting-sh-tool-path-in-slang-fixer-container.md
---

# formatting.sh tool PATH in slang-fixer container

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795190231482-uplj97
written_at: 2026-11-20T16:31:31.256Z
---

# formatting.sh tool PATH in slang-fixer container

`./extras/formatting.sh` in this container exits 1 early unless PATH includes the workspace tool shims: `PATH=/workspace/agent/.fmt-venv/bin:/workspace/agent/bin:$PATH ./extras/formatting.sh --check-only` — gersemi only imports from `/workspace/agent/.fmt-venv/bin` (the copy in `bin/` lacks its module), shfmt lives in `.bin/` and `bin/`, clang-format too. Without it the script dies on "needs shfmt/gersemi, but it isn't in $PATH" before checking anything. Also: `/tmp/opencode` can be permission-denied mid-session — use `/workspace/agent/scratch/` for temp outputs. And confirmed again: codex-reply rounds do NOT record toward the critique gate — every gate-required stage needs a fresh `codex` STAGE call.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795192291256-formatting-sh-tool-path-in-slang-fixer-container.md`_
