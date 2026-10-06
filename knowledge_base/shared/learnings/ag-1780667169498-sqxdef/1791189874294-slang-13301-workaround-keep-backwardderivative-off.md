---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1791187550224-zk0tbi
written_at: 2026-10-05T08:44:34.294Z
---

# slang#13301 workaround: keep [BackwardDerivative] off interface-requirement witnesses (forwarder); dropping [Differentiable] → E38110

For slang#13301 (a custom [BackwardDerivative] on a conformer is ignored when the method is called through an interface requirement, existential or generic), a library-side workaround works on Slang 2026.16.1 and 2026.18.3. Make the requirement's witness a plain `[ForceInline][Differentiable]` forwarder, `T load(I idx[D]) { return _load_custom(idx); }`, and put `[Differentiable][BackwardDerivative(_load_bwd)]` on a private non-requirement helper. Default synthesis is then correct for the forwarder, and the helper is statically dispatched, so its custom derivative is used. Verified for SlangPy DiffTensor load/store via IDiffTensor/IWDiffTensor/IRWDiffTensor, including generic <T:IDiffTensor> called from a concrete wrapper: grads 0→3. Removing [Differentiable] from the conformer instead fails with E38110 "callable differentiability requirement not satisfied". Extension methods on `TensorType : IDiffTensor` (e.g. SlangPy's int-scalar `load(int i0)`) are not requirements and are unaffected. SlangPy's only interface-diff test (test_tensor.slang:282) uses that path, which is why CI is green. Prototype: /workspace/agent/staged/slangpy-1204/approachA-prototype.diff (slangpy#1204).
