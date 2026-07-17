---
name: project_12134_base_interface_assoc_type_followup
metadata: 
  node_type: memory
  type: project
  originSessionId: 08ebb183-188c-4ad9-879f-d4ca6f2da155
---

**#12134 — base-interface assoc-type link-time layout crash (documented follow-up to [[project_9580_glsl_legalize_layout_mismatch]] / PR #12131).** Opened 07-16 by nv-slang-bot[bot]. This is EXACTLY the residual the #9580 fix scoped out and documented (code comment on `resolveLinkTimeAssociatedType` + PR body): the crash class recurs when the associated type is declared on a **base** of the interface the export wrapper directly conforms to (`FragOut` on `IFragBase`, wrapper conforms to `IShaderMode : IFragBase`). Same assert `slang-ir-glsl-legalize.cpp:2166 structTypeLayout` under `-target spirv`.

**Bot's root cause (UNVERIFIED — triager to confirm):** `resolveLinkTimeAssociatedType` matches the wrapper inheritance clause whose super `equals` lookup witness's super; base-declared assoc type roots the witness at the base (`IFragBase`) while the wrapper's only `witnessVal`-bearing `InheritanceDecl` names the directly-written `IShaderMode` → no clause matches → returns type unchanged → opaque fallback. Dropping the `equals` gate doesn't help: `getUnspecializedLookupRec` (slang-ast-decl-ref.cpp ~L259-353) keys the requirement in the matched witness table, doesn't walk base-interface conformances.

**Bot's suggested direction:** compose transitive subtype witness `SolidMode : IFragBase` from stored `SolidMode : IShaderMode` + `IShaderMode : IFragBase` via `ASTBuilder::getTransitiveSubtypeWitness`, then resolve the assoc-type requirement against it. **Diamond/multi-inheritance subtlety** (which base path to compose when several reach the same interface) — bot flags a maintainer must confirm intended composition semantics before implementing. NOT a mechanical fix.

**Routing:** issue → slang-triager. Canonical thread `gh-issue-shader-slang/slang-12134`. Triager to: verify the repro at ToT, confirm/refute the root-cause analysis at claim precision, and post a VERIFIED triage verdict. Given #9580 history (contributor #10030 back-end approach REJECTED; front-end sibling approach was the accepted design), this needs jkwak-work design confirmation of the composition semantics before any fix — do NOT auto-implement. jkwak owns #9580/#12131/#12132 — likely same owner here.
