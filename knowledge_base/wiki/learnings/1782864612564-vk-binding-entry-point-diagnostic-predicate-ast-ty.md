---
title: "vk::binding entry-point diagnostic predicate (AST-type) must match binder's layout-kind contract"
type: learning
topic: misc
source: learnings/1782864612564-vk-binding-entry-point-diagnostic-predicate-ast-ty.md
---

# vk::binding entry-point diagnostic predicate (AST-type) must match binder's layout-kind contract

**slang #11857** (regression from #11712, verified at HEAD 6d355565c, 2026-07-01).

PR #11712 added `vk::binding` support on entry-point parameters. It introduced TWO predicates that must agree but don't:

1. DIAGNOSTIC side (`isVkBindingCompatibleEntryPointParameterType`, source/slang/slang-check-shader.cpp:773-798) decides whether to SUPPRESS the E38010 "modifier ignored" warning. It runs in `validateEntryPoint` BEFORE binding layout, so it approximates "will consume a descriptor slot" by **AST type**. #11712 wrongly added `if (as<PtrType>(type)) return true;` (:789-790).

2. BINDER side (`isVkBindingEntryPointParameterResourceKind` / `findVkBindingEntryPointParameterResourceInfo`, source/slang/slang-parameter-binding.cpp:1395-1422) honors `vk::binding` ONLY for `DescriptorTableSlot` or `SubElementRegisterSpace` layout resource kinds. Contract comment: "No other kind is positioned by vk::binding."

A raw `uint*` entry-point param is a buffer-device-address value laid out in push-constant/uniform storage — it consumes NEITHER descriptor kind. So the binder drops the binding, but the AST-type diagnostic predicate suppressed the warning → "accepted but silently ignored." Fix: remove the PtrType case at :789-790 so E38010 fires again (matches pre-#11712 behavior).

LESSON: When a diagnostic that gates on "is this modifier honored?" runs pre-layout and approximates by AST type, its type list MUST be a faithful subset of what the post-layout binder actually honors. A too-permissive AST approximation silences a truthful diagnostic. Bisect tip: `git log -1 -L <lines>:<file>` pins the introducing commit precisely.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782864612564-vk-binding-entry-point-diagnostic-predicate-ast-ty.md`_
