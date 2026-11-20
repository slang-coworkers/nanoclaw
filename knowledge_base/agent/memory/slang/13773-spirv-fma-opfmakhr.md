---
type: project
title: "slang#13773 — SPIR-V fma(float) emits GLSL.std.450 Fma (not guaranteed fused); SPV_KHR_fma OpFmaKHR"
description: "Human issue (albertrodriguezclo): fma(float) should use SPV_KHR_fma OpFmaKHR since GLSL.std.450 Fma isn't required fused. Bot draft PR #13779 (4-commit series, chain pre-dates records; peer R1 APPROVE_WITH_NITS @ 9dcce58). 2026-11-17 base refresh: merge 2724a0975 clean, fma arms verified intact, tests green, CI run 44108603502 yielded-by-design; maintainer SPIR-V answers awaited; ready-flip weekly list. Sibling of bot-filed #14451."
---

**Issue #13773** (albertrodriguezclo, human, open): SPIR-V — `fma(float)` emits `GLSL.std.450 Fma`,
which Vulkan does not require to be fused; `SPV_KHR_fma` (`OpFmaKHR`) is.

**Chain provenance note:** pre-dates my records (like #13774/#13786/#13858) — earlier history on
GitHub + fixer group: draft PR #13779 (4-commit series; peer R1 APPROVE_WITH_NITS applied @
`9dcce58`). Sibling: bot-filed **#14451** (integer mad → fma family,
[14451 record](14451-spirv-integer-mad-emits-glsl-fma.md) — explicitly "not dups").

**2026-11-17 15:29Z fixer [Fix Report] — base refresh (Main-verified live).** Master `2a91af5b7`
merged clean at **`2724a0975`** (Main-checked: PR #13779 head matches, open draft, mergeState
BLOCKED = draft + pending checks by design); the PR's 4-commit series unchanged — all 3 fma arms
verified intact (`hlsl.meta.slang:12053/12078/12102`; master touched hlsl.meta.slang +513/−181
elsewhere) + repro test survived. Post-merge debug rebuild green; repro 2/2;
tests/hlsl-intrinsic 672/672; tests/glsl-intrinsic 250/250 (independently re-verified by the
CODE_REVIEW critique round). Explanation comment refreshed (cmt 6293499196, updated 15:24:34Z,
Main-checked). CI re-dispatched — run **44108603502** (Main-checked: `waiting` — priority-yielded
by design on a draft: `wait-for-human-priority` fails, jobs skipped; `retry-yielded-bot-ci` reruns /
aging force-runs — **green needs human CI prioritization or the undraft, not another rebase**).
**Human inputs awaited:** maintainer response on the reporter's SPIR-V answers (cmt 6294636041);
review/ready-flip (weekly undraft list — fixer never flips). PR no longer BEHIND.

Resume on: CI-outcome webhook, maintainer comment on the issue/PR, or the weekly undraft pass.
(A 15:29Z "status echo" restating this report was absorbed silently.)
