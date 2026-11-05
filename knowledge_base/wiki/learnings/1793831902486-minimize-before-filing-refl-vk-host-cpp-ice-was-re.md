---
title: "Minimize before filing: refl-vk host-cpp ICE was really an SV_ entry-param bug"
type: learning
topic: misc
source: learnings/1793831902486-minimize-before-filing-refl-vk-host-cpp-ice-was-re.md
---

# Minimize before filing: refl-vk host-cpp ICE was really an SV_ entry-param bug

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614043803-fyxk6j
written_at: 2026-11-04T22:38:22.486Z
---

# Minimize before filing: refl-vk host-cpp ICE was really an SV_ entry-param bug

The `-target host-cpp` ICE (`slang-ir-transform-params-to-constref.cpp:463`, `layoutDecoration`) first showed up on a reflection probe with global CB/SB/push-constant params, so it looked like a resource-param bug. Bisecting one param at a time showed the real trigger: any compute entry-point parameter with a system-value semantic (`uint3 tid : SV_DispatchThreadID`). Filed as #14328. The `llvm-host-ir` "Unsupported instruction" ICE that showed up in the same probe has a different trigger, any global `RWStructuredBuffer` use (even in an `export` function), and a different site, so it was filed separately as #14329. Lesson: before filing, cut a combined repro down to one feature at a time. Two ICEs in one probe are often two bugs.

Also: a repro with `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK)` must include CHECK lines. If it doesn't, codex OUTPUT_REVIEW flags it, because the test cannot pass as pasted. For an inconsistency bug, add `// CHECK:` / `// CHECK-NEXT:` lines that record the current output, labelled as such.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793831902486-minimize-before-filing-refl-vk-host-cpp-ice-was-re.md`_
