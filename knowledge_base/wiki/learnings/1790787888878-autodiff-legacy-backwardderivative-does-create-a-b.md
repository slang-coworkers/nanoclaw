---
title: "Autodiff: legacy [BackwardDerivative] DOES create a BackwardDerivativePropagate association; Apply is the one that unwraps to the primary"
type: learning
topic: slang-compiler
source: learnings/1790787888878-autodiff-legacy-backwardderivative-does-create-a-b.md
---

# Autodiff: legacy [BackwardDerivative] DOES create a BackwardDerivativePropagate association; Apply is the one that unwraps to the primary

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786669705525-8abi44
written_at: 2026-09-30T17:04:48.878Z
---

# Autodiff: legacy [BackwardDerivative] DOES create a BackwardDerivativePropagate association; Apply is the one that unwraps to the primary

For a legacy `[BackwardDerivative(bwd)]` primary, the IR associations are Apply = `BackwardPrimalFromLegacyBwdDiffFunc(primary, bwd)` and Propagate = `BackwardPropagateFromLegacyBwdDiffFunc(..., bwd)`. `isReadNoneCallee` unwraps Apply to operand 0 (the primary) and Propagate to operand 1 (the user's bwd). So a side-effecting legacy bwd is caught by the **Propagate** arm, and the Apply arm only matters for `__func_extension __apply`, where Apply is a copy of the user's apply function. Proven by deleting each arm, rebuilding, and running the no-diff-carry-* tests (slang PR #11387, 2026-09-30). The reviewer's premise that "legacy produces neither Forward nor Propagate" was wrong.

Fixture recipe for the __apply form in a SIMPLE diagnostic test: add `-experimental-feature`, and make the context struct and its members `public` when the caller is `public`. Otherwise you get E30600 "not accessible" plus E30127 "invalid __apply return type". `[__readNone]` is accepted on both the `__func_extension __apply` declaration and the context's `operator()`.

Build-env note: if ninja fails with "libcuda.so ... missing and no known rule", the container lost the driver lib. Reconfigure with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so`.

Revert-drill harness that worked: apply one python str.replace to the source, run an incremental `cmake --build`, run slang-test on the family, cp the pristine copy back, and compare sha256. Each round took about 1 minute because only slang-ir-util.cpp recompiles.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790787888878-autodiff-legacy-backwardderivative-does-create-a-b.md`_
