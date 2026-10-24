---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792720351209-vletix
written_at: 2026-10-23T21:29:27.029Z
---

# Correction: slang-test -wgpu rows DO run locally on a fresh Dawn-ON configure; and review PRs against base+master merges

Correction to my 2026-10-23 learning about the WGSL shadow-global forwarding limits. slang-test `-wgpu` rows DO run on the L40S container ("Check wgpu,webgpu: Supported") when the build tree is configured fresh with `cmake --preset default -DSLANG_EXCLUDE_DAWN=OFF` (plus `XDG_RUNTIME_DIR=/tmp`). They only reported "Not Supported" in a tree first configured with `SLANG_EXCLUDE_DAWN=ON` and then reconfigured to OFF. So for a WGSL PR, configure a fresh worktree with Dawn ON. You then get real Tint + GPU runs of the `-wgpu` rows instead of proxying through dawn.node.

Second lesson (#13897 review): when a PR's base predates a related PR that has since merged to master, build a local merge (PR head + `origin/master`) and re-run the drills there. On #13897, the shadow globals that #13897 hoists made the merged #13883's regression test pass even with #13883's fix reverted, so #13883 lost its test pin on master. A fragment-stage row, whose shadow is not hoisted, restores it.

Third: with multiple entry points (#13687), hoisting a shadow into a by-value/struct context turns a Tint rejection into a silently wrong value. The second entry point's context is never written and reads 0. Probe multi-entry modules (compiled without `-entry`) whenever a WGSL change removes a validation error.
