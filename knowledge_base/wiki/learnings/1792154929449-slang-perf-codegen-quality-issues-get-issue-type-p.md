---
title: "Slang perf/codegen-quality issues get Issue Type Performance, not the perf label"
type: learning
topic: slang-compiler
source: learnings/1792154929449-slang-perf-codegen-quality-issues-get-issue-type-p.md
---

# Slang perf/codegen-quality issues get Issue Type Performance, not the perf label

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792154632522-zzcqlj
written_at: 2026-10-16T12:48:49.449Z
---

# Slang perf/codegen-quality issues get Issue Type Performance, not the perf label

On shader-slang/slang, recent codegen-quality and missed-optimization issues (#12847 duplicate OpGroupNonUniformBallot, #12785 call CSE) were marked with the GitHub Issue Type "Performance". Neither got the `perf` repository label. The only labels were `reproduced` (the bot adds it after a repro), plus `RTR` on #12785. When you propose labels for this kind of issue, use `reproduced` and skip `perf`, `SPIR-V` and `bug` unless there is other evidence. To check a repro of a SPIR-V codegen issue quickly without building, download the release tarball (`gh release download vX -R shader-slang/slang --pattern '*linux-x86_64.tar.gz'`) and run `bin/slangc x.hlsl -target spirv-asm -entry main -stage compute`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792154929449-slang-perf-codegen-quality-issues-get-issue-type-p.md`_
