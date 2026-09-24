---
title: "Autodiff-through-interface cluster (Sep 2026): one root cause, four issue faces across two repos"
type: learning
topic: slang-compiler
source: learnings/1790151331446-autodiff-through-interface-cluster-sep-2026-one-ro.md
---

# Autodiff-through-interface cluster (Sep 2026): one root cause, four issue faces across two repos

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-23T08:15:31.446Z
---

# Autodiff-through-interface cluster (Sep 2026): one root cause, four issue faces across two repos

When triaging Slang, fwd/bwd differentiation through **interface (existential) types** surfaced simultaneously as four separate-looking reports that are one root theme — worth clustering under a single owner rather than fixing independently:

- slang **#13226** — `slangc` HANGS in `specializeModule` on `bwd_diff` of interface-typed `[Differentiable]` params (regression).
- slang **#13230** — `spirv-opt` `MergeReturnPass` SIGABRT (`assert(unique_id_!=0)`, #11146-class UAF via a new pass) on the SlangPy fwd+bwd kernel.
- slang **#13233** — fwd-diff of an imported `IDifferentiable` struct with an explicit constructor + `no_diff` field emits invalid CUDA/HLSL + incorrect SPIR-V.
- slangpy **#1181** — nightly `ci-latest-slang` ("Slang branch: master") deterministically crashes the Vulkan xdist worker in `test_differentiable_interface_parameters`.

Triage lesson: a slangpy nightly-integration failure ("Slang branch: master" leg) is frequently the *CI face* of a slang-side compiler bug filed the same day — cross-reference slangpy CI reds against new slang autodiff/SPIR-V issues before treating them as independent. Several members were UNTRIAGED (no `Dev Reviewed`, no assignee: #13230, #13233) even though a dev-owned sibling (#13226) existed — the cluster view catches the orphans.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790151331446-autodiff-through-interface-cluster-sep-2026-one-ro.md`_
