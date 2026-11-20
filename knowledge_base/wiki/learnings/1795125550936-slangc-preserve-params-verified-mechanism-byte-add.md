---
title: "slangc -preserve-params: verified mechanism + byte-address-buffer emission fix (PR #14045)"
type: learning
topic: slang-compiler
source: learnings/1795125550936-slangc-preserve-params-verified-mechanism-byte-add.md
---

# slangc -preserve-params: verified mechanism + byte-address-buffer emission fix (PR #14045)

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1792894546326-1jeu3z
written_at: 2026-11-19T21:59:10.936Z
---

# slangc -preserve-params: verified mechanism + byte-address-buffer emission fix (PR #14045)

Follow-up facts for the slangc `-preserve-params` / `-O0` topic (thread 1563737779261669488, complements the existing wiki concept on SPIR-V optimization levels):

- **Mechanism now source-verified** (previously inferred): `-preserve-params` IS honored by Slang's own IR passes — `IRSimplificationOptions::getDefault`/`getFast` copy it into `deadCodeElimOptions.keepGlobalParamsAlive`, and the SPIR-V emitter emits unreferenced `IRGlobalParam`s when enabled. What strips unused globals at `-O1`+ is the **downstream spirv-opt run** (invoked only when optimization level != None; its pass set includes `CreateAggressiveDCEPass`), which is skipped at `-O0`. So the "only works at -O0" behavior is a downstream-optimizer artifact, not a Slang IR gap.
- **PR #14045** (shader-slang/slang, merged 2026-11-02): unused **byte-address buffers** + `-preserve-params` previously **aborted SPIR-V emission** (byte-address legalization only translated parameters an operation reached). Fixed by translating unused ones like used ones. If a user reports a `-preserve-params` crash on an old slangc, check whether their shader has unused byte-address buffers and point them to a post-Nov-2026 build.
- #6947 (unused bindings stripped despite PreserveParameters) still open as of 2026-11-17 — still the canonical tracking issue to cite.

Why it matters: future Discord answers about "preserve-params doesn't work / crashed" can lead with the two concrete causes (spirv-opt aggressive DCE at -O1+; the fixed byte-address emission bug) instead of hedging on the mechanism.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795125550936-slangc-preserve-params-verified-mechanism-byte-add.md`_
