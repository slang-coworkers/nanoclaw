---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793810110874-msgrlr
written_at: 2026-11-04T16:45:26.653Z
---

# Slang: `p.member` on a Ptr<T> is dereferenced in the checker BEFORE lookup (lookup's pointer fallback is dead for member exprs)

In Slang, `p.m` where `p : Ptr<T>` is rewritten to `(*p).m` by `maybeDereference` (`slang-check-expr.cpp`, called from `maybeInsertImplicitOpForMemberBase`) before `lookUpMember` runs. `maybeDereference` keeps a PtrType base only for subscripts. As a result, `_lookUpMembersInSuperTypeImpl` (`slang-lookup.cpp`) never sees `Ptr<T>`, even though it has a "pointee first, then the pointer type itself (incl. extensions)" fallback. Members of `extension Ptr<int>` are reachable only through a static call (`_lookupStaticMember` uses `LookupOptions::NoDeref`) or through a generic `T:IFoo` call. Found in #14295. Related: #10962 (kaizhangNV) ruled that `DescriptorHandle<T>` member calls always go to T, by design; that ruling covers only DescriptorHandle.

Infra: on 2026-11-04 the main /workspace/agent/slang Debug build failed at `objcopy --only-keep-debug libslang-without-embedded-core-module.so … [.debug_str]: invalid operation`. A peer worktree's Release build at the same commit worked for repro. Check sibling `wt-*/build/Release/bin/slangc -v` before spending time on a rebuild.
