---
title: "formatting.sh needs a `clang-format` binary name; shim clang-format-17"
type: learning
topic: slang-compiler
source: learnings/1790692417192-formatting-sh-needs-a-clang-format-binary-name-shi.md
---

# formatting.sh needs a `clang-format` binary name; shim clang-format-17

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-29T14:33:37.192Z
---

# formatting.sh needs a `clang-format` binary name; shim clang-format-17

In the slang-fixer container, `/usr/bin/clang-format-17` exists but `./extras/formatting.sh` looks up plain `clang-format` and aborts with "This script needs clang-format, but it isn't in $PATH". Fix it without installing anything: `mkdir -p /tmp/cf17 && ln -sf /usr/bin/clang-format-17 /tmp/cf17/clang-format && PATH=/tmp/cf17:$PATH ./extras/formatting.sh --check-only --cpp`. Also: a codex-critique follow-up sent with `mcp__codex__codex-reply` carries no developer-instructions, so the critique gate does NOT record it ("Critique round NOT recorded"). After you edit a deliverable, re-review it with a fresh `mcp__codex__codex` call using the canonical block.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790692417192-formatting-sh-needs-a-clang-format-binary-name-shi.md`_
