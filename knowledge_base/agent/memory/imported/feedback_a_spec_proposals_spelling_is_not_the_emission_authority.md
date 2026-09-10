---
name: feedback_a_spec_proposals_spelling_is_not_the_emission_authority
description: "When emitting a named constant for a downstream compiler, the authority is the SHIPPED version you pin — not the spec proposal. In-tree proof: hlsl-specs 0035 says F8_E4M3FN (17x), DXC ships F8_E4M3, Slang emits F8_E4M3."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# The proposal is not the emission authority — the pinned toolchain is

Generated source must be consumed by a *specific version* of a downstream compiler. Its spelling of
a named constant is a property of **that build**, not of the standards document that proposed it.
Proposals get renamed before shipping, and the rename is invisible unless you read the shipped
header.

## In-tree proof (slang, verified 2026-08-06 at `d7d59f374`)

Slang emits `dx::linalg::ComponentType::*` names into HLSL for DXC. For FP8:

- **Proposal** (microsoft/hlsl-specs 0035): `F8_E4M3FN` — 17 occurrences, **never** bare `F8_E4M3`.
- **Shipped DXC** (`v1.9.2602`, pinned at `cmake/FetchDXC.cmake:49`): `DxilConstants.h` spells
  `F8_E4M3`, zero `FN`.
- **Slang** emits `"F8_E4M3"` (`slang-emit-hlsl-prelude.cpp:408`) — i.e. it already follows DXC over
  the proposal.

So the disagreement is not hypothetical; it is live, and the resolution already in the tree is
"follow the shipped compiler."

⚠ Two further traps found in the same read, both worth checking by construction:

1. **The spellings are hardcoded, not read from a vendored header.** The pinned DXC's vendored
   `dx/linalg.h` has **no `ComponentType` enum at all** — only the older SM 6.9 `DATA_TYPE_*` enum,
   with `ComponentType::X` appearing solely in trailing comments. ⇒ grepping the vendored header for
   the name you intend to emit can return 0 for a name that is nonetheless correct, *and* can
   return 0 for one that is wrong. It does not discriminate. Read the enum definition
   (`DxilConstants.h`), not the convenience header.
2. **The pinned version may not have the constant yet.** `ComponentType` ends at `F8_E5M2 = 22`;
   `grep -c BFloat16` = **0** (non-zero control `F8_E5M2` = 1). A feature can be fully specified,
   with a value stated three times in the proposal, and still be unspellable by the compiler you
   ship against.

## How to apply

⛔ **Before emitting a named constant for a downstream toolchain: read the enum in the version you
pin, and cite the pin.** Say *"confirmed against DXC `<version>` at `<file:line>`"* — never
*"per the proposal"*. If the pinned version lacks the constant, the correct move is to **defer the
spelling to whenever that version is adopted**, not to guess from the proposal.

This is the concrete reason behind Slang's standing rule (`CLAUDE.md`, "HLSL named-constant
emission rule") to map an enum to a *source name* rather than a hardcoded integer: the mapping table
is the single place the pinned-version spelling is recorded, so it is the one place to re-verify on
a toolchain bump. The rule protects against integer drift; **this** lesson is that the name side
needs a version citation too.

Related: [[project_12411_coopvec_bfloat16]],
[[feedback_published_negative_env_claims_need_rederivation]] (a `grep` returning 0 against the wrong
artifact is the same failure class — the instrument's negative result was never distinguishable from
its own inapplicability).
</content>
