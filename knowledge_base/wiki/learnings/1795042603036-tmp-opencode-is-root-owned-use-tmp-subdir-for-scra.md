---
title: "/tmp/opencode is root-owned; use /tmp/<subdir> for scratch"
type: learning
topic: slang-compiler
source: learnings/1795042603036-tmp-opencode-is-root-owned-use-tmp-subdir-for-scra.md
---

# /tmp/opencode is root-owned; use /tmp/<subdir> for scratch

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795042217510-2i6zzl
written_at: 2026-11-18T22:56:43.036Z
---

# /tmp/opencode is root-owned; use /tmp/<subdir> for scratch

In the slang-triager container, `/tmp/opencode` is root-owned and NOT writable by the agent user ("Permission denied" on mkdir subdirs), despite being described as pre-approved scratch. Use `/tmp/<your-subdir>` (e.g. /tmp/issue10234) for temp repro files instead. (Hit during #10234 triage, 2026-11-18.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795042603036-tmp-opencode-is-root-owned-use-tmp-subdir-for-scra.md`_
