---
type: chain
title: slang#14327 — generic `sizeof(T)`/`alignof(T)` with T=bool gives 4, concrete `sizeof(bool)` gives 1
description: Bot-filed 2026-11-04 22:28:40Z by slang-triager, side-find (1)+(2) of the #14157 bool-size answer. Bug + `reproduced`. issue_opened needed NO dispatch (chain-owned); FILED-ONLY, no fixer. Siblings #14328 (host-cpp ICE) and #14329 (llvm-host-ir) filed the same minute.
tags: [sizeof, alignof, bool, layout, generics, ir-peephole, docs, side-find, filed-only]
---

# slang#14327 — `sizeof(bool)` differs between concrete and generic paths

**Bug (issue body; triager's repro on master `d6ad99cb3`, cpu/cuda/vk on L40S).** Concrete `sizeof(bool)` /
`alignof(bool)` = 1, `sizeof(bool3)` = 3; inside a generic, `sizeof(T)`/`alignof(T)` with T=bool = 4, bool3 = 12.
Same on every target. Cause (code reading): front end folds concrete `sizeof` from `BaseTypeInfo`
(`slang-base-type-info.cpp:9`, host C++ `sizeof(bool)`); generic `sizeof(T)` is folded by IR peephole
(`slang-ir-peephole.cpp:324`) with IR natural layout `BASE(Bool, 4)` (`slang-ir-layout.cpp:129`). Related: #13858
(same two-path mismatch for static members), #12316 (front-end/IR layout duplication). The issue deliberately does
not pick 1 or 4 — a maintainer decision.

**Also in the body (fixable without the decision):** `docs/user-guide/02-conventional-features.md:75-84` table,
`docs/target-compatibility.md:216` CUDA bool comment, `CUDALayoutRulesImpl` comment `slang-type-layout.cpp:778-779`.

**Origin.** Side-finds of the [#14157](14157-metal-wgsl-bab-bool-bitcast.md) answer to jkwak-work (cmt 6643360049).
Same batch: #14328 (`-target host-cpp` assert `layoutDecoration`, system-value param) and #14329 (`-target llvm-host-ir`
"Unsupported instruction" for global `RWStructuredBuffer`). All three are owned by the #14157 triager chain.

**GitHub (11-04 22:28Z).** Open, Type=Bug, `reproduced`, 0 comments, no assignee. Issue body is the resumable artifact.

**Decision (11-04, Main): no dispatch, filed-only.** Needs a maintainer value decision (1 vs 4) before any fixer. The
docs/comment part could be a small standalone fix, but no go-ahead yet. **Resumes on:** a human comment, a maintainer
decision/`bot-ok`/assignment, or an operator go-ahead. #14328/#14329 `issue_opened` webhooks: same — no dispatch.
