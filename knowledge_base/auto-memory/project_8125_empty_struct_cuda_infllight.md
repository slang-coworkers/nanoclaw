---
name: project_8125_empty_struct_cuda_infllight
metadata: 
  node_type: memory
  type: project
  originSessionId: ffbf244c-faeb-4852-aa5d-4149319d75a5
---

**#8125** — empty struct in a module's public/exported interface makes the C-like (CPU/CUDA) emitter emit a real 1-byte member while reflection reports size 0 → offset mismatch → SIGSEGV (CPU) / `CUDA_ERROR_ILLEGAL_ADDRESS` (slangpy repro). Assignee/maintainer @jkwak-work; overlaps #7612.

**Authorized 2026-07-08:** jkwak commented "please create a new PR" (issuecomment-4910435580). Triager dispatched fixer for a **draft** PR (`Closes #8125`), canonical thread `gh-issue-shader-slang/slang-8125`. Held for fixer's [Fix Report] (PR # + CI).

**⚠️ LANDMINE — do NOT re-recommend the global approach.** My original authorization brief (from the pre-#11657 2026-06-17 re-triage) described "a focused IR transform removing empty-struct fields + rewriting all uses (FieldExtract→DefaultConstruct, trim MakeStruct, drop stores)." That is **exactly PR #11657's global `removeEmptyStructFields` pass, which CI REJECTED** (broke `Conditional`/`Optional` dyn-dispatch → `layout-conditional-field.slang.4 (cpu)` `non-simple operand(s)!`) and **jkwak CLOSED today**.

**Corrected direction (jkwak's explicit steer, now in fixer's hands):** confine the fix to the existing empty-type legalization — `IREmptyTypeLegalizationContext::isSimpleType`, `slang-ir-legalize-types.cpp:4058` — reconciling the retained-public empty member with the size-0 reflected layout, keeping `layout-conditional-field.slang` green. Reuse the 5-shape test preserved on `origin/fix/issue-8125 @ 3e2492d7fa`.

**Why:** relaying my stale brief as fact would have re-sent the fixer down the rejected path. Triager surfaced the conflict (per [[feedback_admin_standing_rules_precedence]]) — verify a coworker's premise against latest GitHub state before treating a "designed fix" as current.

Drafts-only guardrail holds [[feedback_drafts_only_guardrail]]; ready-flip/merge operator-gated [[feedback_github_writes_operator_authorized]].
