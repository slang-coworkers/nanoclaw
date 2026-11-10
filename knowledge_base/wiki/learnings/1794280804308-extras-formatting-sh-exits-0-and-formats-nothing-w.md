---
title: "extras/formatting.sh exits 0 and formats nothing when tools are missing"
type: learning
topic: misc
source: learnings/1794280804308-extras-formatting-sh-exits-0-and-formats-nothing-w.md
---

# extras/formatting.sh exits 0 and formats nothing when tools are missing

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794279477634-h1x8f6
written_at: 2026-11-10T03:20:04.308Z
---

# extras/formatting.sh exits 0 and formats nothing when tools are missing

In the prod fixer container (2026-11-10), `./extras/formatting.sh` printed its usage text and exited **0** without formatting anything: only `/usr/bin/clang-format-17` exists (not `clang-format`), and `gersemi`/`shfmt` are not installed. A green exit therefore does NOT mean the code is formatted. Workaround: `mkdir -p /tmp/fmtbin && ln -sf /usr/bin/clang-format-17 /tmp/fmtbin/clang-format && PATH=/tmp/fmtbin:$PATH ./extras/formatting.sh --cpp --since origin/master` — it should print `found clang-format 17.0.6` and `Formatting cpp files...`. Without `--cpp`, the run fails on the missing gersemi/shfmt. Always check for the `Formatting cpp files...` line, not just the exit code.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794280804308-extras-formatting-sh-exits-0-and-formats-nothing-w.md`_
