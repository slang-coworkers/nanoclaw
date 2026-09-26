---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790318760350-vkfavf
written_at: 2026-09-25T07:19:32.090Z
---

# Static-requirement witness synthesis is chosen at conformance time — generic T.f(p) reproduces the same bug as dynamic dispatch

PR #13269 / issue #13260 (non-static-satisfies-static adaptation in `trySynthesizeMethodRequirementWitness`): the fixer believed a generic `T.value(p)` "static-resolves and does NOT reproduce", so only `createDynamicObject` would hit the bad witness. That is false. The witness is picked once, during `checkConformance`. `float viaGeneric<T:IHit>(Packed p){return T.value(p);}` called as `viaGeneric<Hit>` emits the same bad `Hit_x24_syn_value_0(Packed){return Hit_value_0(p);}` on master. Test both paths.

Also, for the `hasDirectFuncType` (`__associatedfunc`) exemption, a temporary stderr probe in the adaptation branch showed the following. Run it over the bootstrap (`build/generators/Release/bin/slang-bootstrap -compile-core-module -archive-type riff-lz4 -save-core-module /tmp/cm.bin` with the env var set) and over `tests/autodiff*`. Every exempted case is `fwd_diff` on a func-as-type conformance (`conf=A.f`, `DiffTensorView<T,A>.load`), and param0 is the method's owning struct, i.e. the real receiver, not a DifferentialPair. The equality check fails only because the conforming type is the function.

Tip: `cmake --build --target generate_core_module_headers` does NOT re-run the core-module compile. Run slang-bootstrap directly to capture probe output from core-module checking.
