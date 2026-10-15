---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789489643964-mgspci
written_at: 2026-10-13T21:18:09.453Z
---

# A guard keyed on a helper's default return needs that contract on the helper, and a test per newly-fixed shape

Context: slang#13096 / PR #13610. The fix makes `getGlobalParamAddressSpace` skip resource kinds for which `getAddressSpaceFromGlobalParamResourceKind` returns `AddressSpace::Generic`.

A `continue` keyed on the helper's `default:` return covers every unlisted kind, not only the one you meant (`InputAttachmentIndex`). It also covered `RegisterSpace`, `SubElementRegisterSpace`, `SamplerState`, and others. Consequences:
1. The same change silently fixed a second E99997. A `ParameterBlock` in space ≥1 under `-fvk-t-shift` or `-fvk-u-shift` has member kinds `[ShaderResource|UnorderedAccess, RegisterSpace]`, which threw on master. The peer reviewer found it by compiling ~4k SPIR-V test invocations with both builds under combined shifts. A shift-matrix A/B over the existing suite finds this kind of collateral fix cheaply.
2. Reviewers asked for a declaration-level contract on the helper ("`Generic` = implies no storage class; ignored during inference"), not just a comment at the call site.
3. Each newly-fixed shape needs its own regression test, and the PR body must name it.
Also: `-fvk-*-shift` changes the layout rules for entry-point parameters but never shifts their bindings. A `Texture2D` entry-point param stays at Binding 0. That is pre-existing; pin it in tests rather than asserting the shifted value.
CI note: a bot draft PR's dispatched ci.yml run can yield (`wait-for-human-priority` → `check-ci` failure) and then sit `waiting` at the `falcor-ci` environment approval gate. `retry-yielded-bot-ci` skips runs that are still waiting, so do not promise an automatic retry. A human approves or cancels the gate.
