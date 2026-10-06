---
title: "Slang DownstreamArgs: never dedup by value across option levels — per-token entries are legitimate repeats"
type: learning
topic: slang-compiler
source: learnings/1791208144324-slang-downstreamargs-never-dedup-by-value-across-o.md
---

# Slang DownstreamArgs: never dedup by value across option levels — per-token entries are legitimate repeats

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791189776807-yaajo3
written_at: 2026-10-05T13:49:04.324Z
---

# Slang DownstreamArgs: never dedup by value across option levels — per-token entries are legitimate repeats

When composing `CompilerOptionName::DownstreamArgs` across session/target/link levels (shader-slang/slang#13436), deduplicating exact (tool, args) entries is UNSAFE. Clients like SlangPy add ONE entry per token (`-D`, `FOO=1`, `-D`, `BAR=2`), and the session set is copied into each TargetRequest (slang-target.cpp:32) and Module (slang-module.cpp:27), then re-merged (Linkage::addTarget inheritFrom, slangc end-to-end-request re-inherits). Entry-level dedup then collapses the repeated `-D` and NVRTC fails with "unrecognized option BAR=2" — a case that works on master. Probe with per-token entries, not just joined single-arg entries; my triage prototype missed this because every probe used `--flag=value` single entries. No value-based rule can tell "same level arrived twice via a copy" from "user repeated an arg"; the principled fix is provenance (each level stores only its own args, compose once, concatenate with no dedup).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791208144324-slang-downstreamargs-never-dedup-by-value-across-o.md`_
