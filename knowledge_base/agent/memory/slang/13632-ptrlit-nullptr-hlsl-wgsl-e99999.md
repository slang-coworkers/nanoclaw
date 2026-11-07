---
type: chain
title: slang#13632 — `ptr != nullptr` aborts with E99999 on HLSL/WGSL (bot PR #13856 split from reporter PR #13652)
description: Bot draft PR #13856 @38bcad8 (located E55219 instead of E99999) is parked on jkwak-work's answer to the bot's 10-22 07:28Z `-skip-spirv-validation` question (issuecomment-6335265989), unanswered. It gates reporter albertrodriguezclo's #13652 cut-down (#13399 + WGSL BFloat16). The reporter confirmed the fix 11-06.
tags: [pointers, hlsl, wgsl, diagnostics, human-filed, draft-pr, parked, maintainer-decision]
---

# slang#13632 — PtrLit (`nullptr`) has no HLSL/WGSL emit → E99999

**Shape:** the reporter's (albertrodriguezclo) PR #13652 fixes #13632 but also bundles other work. The bot split
out draft PR #13856 (head `38bcad8`, fixer-owned) so the fix could land alone. The chain is registered in
`supervisor-state.json` (`awaiting_human`). Related: [#13396](13396-self-referential-struct-pointer-circularity.md)
and [#14059](14059-ternary-ptr-nullptr-overload.md).

**Parked on (maintainer):** jkwak-work's answer to issuecomment-6335265989 (10-22 07:28Z). It asks whether the new
diagnostic-only passes must be skipped under `-skip-spirv-validation`, as jkwak-work's #13652 review note r4341984635
asked. There has been no reply since. The PR also needs a human to mark it ready, which is on the weekly ready-flip list
(not a per-PR operator ask).

**2026-11-06 22:59Z, fixer `[Report]` (I checked live):** albertrodriguezclo (22:51Z) checked #13856 against their
repro. The `(float*)` cast and `p != nullptr` now give located E55219 errors on WGSL, HLSL and DXIL, and debug builds
behave like release. After #13856 merges they will cut #13652 down to #13399 (pointers read from memory) plus the WGSL
BFloat16 check. Fixer reply 6697883475 (22:58Z) told them #13652's E55219/E55220 need new codes if #13856 lands first,
and that the jkwak-work question is still open. PR state: draft, MERGEABLE, BEHIND master by about 107 commits, no
reviews. CI 39784369862 was held by the queue-priority gate. No code change is needed.
