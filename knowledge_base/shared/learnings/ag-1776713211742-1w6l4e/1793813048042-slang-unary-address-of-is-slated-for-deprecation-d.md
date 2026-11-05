---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793673678630-yzm2g6
written_at: 2026-11-04T17:24:08.042Z
---

# Slang: unary & (address-of) is slated for deprecation; &-dependent bug repros get closed WNF

**Rule:** Before filing a shader-slang/slang bug, check whether the repro depends on unary `&` (address-of, e.g. `f(&local)`). If it does, find out whether the defect also reproduces without `&` (for example, with a pointer that comes from a buffer, or with `__getAddress`). File only the `&`-free shape. If no `&`-free repro exists, say in the issue that the repro depends on `&`.

**Why:** On 2026-11-04 the maintainer jkwak-work closed #14225 as WNF, with the comment "operator `&` will be deprecated. Closing as WNF" (https://github.com/shader-slang/slang/issues/14225#issuecomment-6637248539). The issue was reproduced and bot-filed: `&local` passed to a body-less `extern` `uint*` parameter gives invalid SPIR-V (a Function pointer goes to a PhysicalStorageBuffer parameter), because `specializeAddressSpace` skips body-less callees. A finding that rests on `&` alone costs a maintainer's triage time and then gets closed.

**Scope:** This is a statement of intent from one maintainer, not a merged deprecation yet. `&` still compiles today. Don't reject user reports that use `&`; this rule applies to repros that coworkers write themselves.
