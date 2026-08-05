---
name: project_11844_bitfield_init_verified
description: "slang#11844: `Test t = {}` on a struct mixing bitfields with a trailing normal field leaves the synthesized $bit_field_backing_0 word uninitialized (E41021 + garbage); root cause = backing field created with null initExpr after ctor signature collection. State: our draft PR #11848 CLOSED unmerged, superseded by maintainer PR #11968 (identical files, `Closes #11844`, not yet merged as of the last note); issue stays OPEN. ⛔ jhelferty-nv's 'might be a false positive' was REFUTED by re-audit of emitted code. ⚠ Filename says 'verified' — that refers to the bug repro, not to a landed fix."
metadata: 
  node_type: memory
  type: project
  originSessionId: f278533e-a77e-4474-bb0b-969a0f237084
---

shader-slang/slang #11844 (skallweitNV): `Test test = {}` on a struct mixing bitfields (`a:10; b:22;`) with a trailing normal field (`c`) leaves the synthesized `$bit_field_backing_0` word UNinitialized → E41021 + garbage reads of a/b. Bitfield-only and all-normal cases zero-init cleanly (no member-wise `$init` used, so whole-struct zero-init covers backing word).

Root cause: backing field created with null `initExpr` in `SemanticsDeclAttributesVisitor::visitStructDecl` (`slang-check-decl.cpp:~19602/19607`) AFTER the ctor signature is collected → member-init ctor `$init(uint c)` sets only `c`, never the backing word. Fix (fixer, draft **PR #11848**): give the synthesized backing field a checked zero `initExpr` at creation so ctor body stores `backing = 0` without leaking it as a ctor param.

**Status (2026-07-02):** maintainer **jhelferty-nv** commented the warning "might be a false positive" and routed to assignee **@expipiplus1** (issuecomment-4869605605). slang-triager independently RE-AUDITED the *final emitted code* at master HEAD 803dff915 → suspicion **REFUTED**: MIXED emits `Test_$init(uint c)` writing only `c`; backing word never written, no memset/whole-struct/call-site fill; HLSL doesn't zero locals → real defect. Report: `/workspace/agent/memory/investigate-11844-false-positive.md` (triager's fs).

**TERMINAL — adopted (2026-07-07):** Peer review returned ✅ APPROVE_WITH_NITS (0 bugs, 3 reviewers); fixer resolved all nits in one round (push d429e2ad65: deterministic emit FileCheck gate + 64-bit/two-word/MSVC coverage, default-init reasoning folded into comment). Then maintainer **@expipiplus1 closed draft PR #11848 unmerged** with "Superseded by #11968 (same producer-side fix and tests, opened from a maintainer branch)." **Verified**: PR #11968 (expipiplus1, non-draft, open, `Closes #11844`) carries the IDENTICAL four files — `slang-check-decl.cpp` + `default-init-mixed{,-diagnostic,-emit}.slang`. Our fix + tests adopted wholesale onto a maintainer branch = best-case bot outcome. Clean supersede (not a counter-proposal) → no re-open, no bot reply. Issue #11844 stays OPEN, auto-closes when #11968 merges. Worktree wt-slang-11844 reaped. Chain closed. Next action only if #11968 stalls or a human comment re-opens.

**Re-confirmed 2026-07-07 (Main verified at HEAD):** #11844 issue OPEN; adopting PR **#11968** (expipiplus1, non-draft, OPEN, `Closes #11844`) — not yet merged; our draft #11848 CLOSED. jhelferty-nv's public "false positive?" question was answered on-thread by the triager (comment 4903097599): NOT a false positive — genuine uninitialized-data bug, and #11968 confirms by zero-initializing rather than suppressing. Merge of #11968 is maintainer-owned; nothing bot-side pending. Chain remains closed pending that merge.
