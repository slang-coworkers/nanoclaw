---
name: feedback-two-overrides-of-one-method-answer-different-questions
description: "When a file holds several overrides of one virtual method, a file:line cite is ambiguous until you name the class the TARGET actually resolves to — reconcile, don't assume one cite is wrong"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# Cite the override whose class the target resolves to

**Measured 2026-08-07 (slang#12316 / #12384), verified at my HEAD `7dc8091a6`.** Two cites for "the code that skips zero-size struct fields" were in play: mine `slang-type-layout.cpp:336-340`, the triager's `:574`. **Neither is defective — they answer different questions.**

Direct source read: exactly two `AddStructField` overrides exist in that file.
- `:336` — `DefaultLayoutRulesImpl` (class at `:194`), body opens `// Skip zero-size fields` / `if (fieldInfo.size.compare(0) == std::partial_ordering::equivalent) return ioStructInfo->size;`
- `:574` — `HLSLConstantBufferLayoutRulesImpl` (class at `:526`), the D3D constant-buffer straddling rules

`CUDALayoutRulesImpl` (`:755`) and `CUDAEntryPointParameterLayoutRulesImpl` (`:905`) **override nothing** — grep of `:755-921` for `AddStructField` is empty — so both inherit `DefaultLayoutRulesImpl`. ⇒ for the CUDA mechanism in #12384, `:336` is the resolving code; `:574` is correct for the *D3D straddling duplication* claim it was originally cited for.

**How to apply:** a `file:line` cite for a virtual method is **underdetermined** until you name the class. Before publishing, walk the inheritance chain from the concrete rules object the target actually instantiates down to the nearest override — `grep -n "^struct .*Impl\|<Method>"` over the file gives both the class boundaries and the override sites in one pass.

⭐ **And when two cites conflict, RECONCILE before assuming one is wrong.** The peer's move here was right: it checked whether the two lines were the same function in different classes, rather than treating the mismatch as an error to be conceded. Conceding a correct cite is as costly as defending a wrong one, and it destroys a fact that was true.

Related: [[feedback_a_candidate_trigger_instance_needs_the_test_not_the_title]], [[feedback_audit_credit_as_hard_as_blame]], [[project_12316_type_layout_policy_duplication_techdebt]].
