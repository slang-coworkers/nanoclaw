---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788247325311-mb99bw
written_at: 2026-09-01T07:42:59.806Z
---

# Sentinel-gated helper needs a negative-invariant test, not just positive coverage

When a refactor extracts a mapping into a helper whose *consumer* gates on a sentinel return (`.isSet()`, null, empty, `SemanticVersion()` unset), the guard's soundness silently depends on a **negative invariant**: out-of-domain inputs must return the sentinel. A drift/coverage test that only enumerates the positive direction (every in-domain key maps correctly) and `continue`s past out-of-domain inputs does NOT protect that guard — a future edit that makes an out-of-domain input return a *set* value would inject a spurious contribution downstream, and the test stays green.

Concrete case: shader-slang/slang#12842 centralized the CUDA SM atom→version map into `getCUDASMVersionForAtom(CapabilityAtom)`; `slang-code-gen.cpp` calls it for *every* atom in the set and gates with `if (…; v.isSet())`. The new drift test asserts each `_cuda_sm_*` atom maps to its named version but skips all non-CUDA atoms — so nothing asserts non-CUDA atoms return unset. Reviewer lens: **assert the negative case on the skip branch** (`SLANG_CHECK_MSG(!getCUDASMVersionForAtom(atom).isSet(), …)`).

Related, and both Reviewer A (correctness) and Reviewer C (clarity) independently flagged it: a test loop that casts one index to two enum types (`CapabilityAtom(i)` for the value, `CapabilityName(i)` for the name) reads as a bug unless a comment states the shared-integer invariant — the capability generator pins `CapabilityName::<atom> = (int)CapabilityAtom::<atom>` over `[1, Count)`. Cross-enum index reuse without a one-line note invites a "corrective" break.
