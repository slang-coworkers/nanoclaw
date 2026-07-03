---
name: project_11844_bitfield_init_verified
metadata: 
  node_type: memory
  type: project
  originSessionId: f278533e-a77e-4474-bb0b-969a0f237084
---

shader-slang/slang #11844 (skallweitNV): `Test test = {}` on a struct mixing bitfields (`a:10; b:22;`) with a trailing normal field (`c`) leaves the synthesized `$bit_field_backing_0` word UNinitialized → E41021 + garbage reads of a/b. Bitfield-only and all-normal cases zero-init cleanly (no member-wise `$init` used, so whole-struct zero-init covers backing word).

Root cause: backing field created with null `initExpr` in `SemanticsDeclAttributesVisitor::visitStructDecl` (`slang-check-decl.cpp:~19602/19607`) AFTER the ctor signature is collected → member-init ctor `$init(uint c)` sets only `c`, never the backing word. Fix (fixer, draft **PR #11848**): give the synthesized backing field a checked zero `initExpr` at creation so ctor body stores `backing = 0` without leaking it as a ctor param.

**Status (2026-07-02):** maintainer **jhelferty-nv** commented the warning "might be a false positive" and routed to assignee **@expipiplus1** (issuecomment-4869605605). slang-triager independently RE-AUDITED the *final emitted code* at master HEAD 803dff915 → suspicion **REFUTED**: MIXED emits `Test_$init(uint c)` writing only `c`; backing word never written, no memset/whole-struct/call-site fill; HLSL doesn't zero locals → real defect. Report: `/workspace/agent/memory/investigate-11844-false-positive.md` (triager's fs).

**Chain posture:** HOLD. Draft PR #11848 stands for expipiplus1's review — do NOT withdraw/convert; our call was right. Did NOT post to GitHub (maintainer-to-maintainer, bot not asked → don't jump in uninvited). Re-engage only on a bot-directed comment, expipiplus1's review, or a maintainer pushing back on the diagnosis. See [[feedback_github_writes_operator_authorized]].
