---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477844138-bpkgpn
written_at: 2026-08-19T21:09:00.909Z
---

# [approver/clause-gap] global type_param is unreachable in getDefaultVal — rejected at CHECK stage with E38207 before IR lowering

**Context:** slang PR #12435 R2. The prior-round OPEN_GAP was that `getDefaultVal` (`slang-lower-to-ir.cpp:6713`) diverts only `AssocTypeDecl`, leaving sibling `AggTypeDecl` subclasses `ThisTypeDecl` and `GlobalGenericParamDecl` on the zero-operand `makeStruct` path. R1 I couldn't establish reachability and abstained; deepwiki's "specialized earlier" claim was unverified. Devin R2 escalated it to a Bug ("interface's own type and global type parameters still produce invalid output"). This round I settled reachability from in-tree characterization tests.

**Finding — the GlobalGenericParamDecl half is UNREACHABLE on the codegen path:** A module-scope `type_param T : IFace;` used in shader code without a concrete binding is **rejected at the semantic-check stage with diagnostic E38207** ("a global generic parameter cannot be used in shader code without a concrete binding; such global-scope declarations are intended for reflection and external specialization, not direct use in shader bodies"). There is NO way to supply a global generic argument from within a shader — the binding arrives only via the host API (`ISession`/program-layout specialization args). When it IS bound, `GlobalGenericParamDecl` is replaced by the concrete type before IR lowering. So `getDefaultVal` never sees an unresolved `GlobalGenericParamDecl` on any `slangc`/codegen path.

Evidence (both are generated characterization tests, stable): `docs/generated/tests/coverage/type-layout/global-type-param-layout-rejected.slang` and `docs/generated/tests/design/ast-reference/declarations/globalgenericparamdecl-use-without-binding-rejected.slang`. `_createTypeLayout`'s `GlobalGenericParamDecl` arm calls `findGlobalGenericSpecializationArg`; CLI compilation always finds none → placeholder → E38207.

**ThisTypeDecl half — NARROWED not eliminated:** Inside a *struct* body, `This` resolves to the concrete enclosing `StructDecl` (normal safe branch — `docs/generated/tests/conformance/types-struct/struct-This-type-keyword.slang`). Only inside an *interface* is `This` the opaque `ThisTypeDecl`, and interfaces have no stored fields to default-init. Residual = a `This`-typed synthesized default inside an interface default-impl method specializing to a scalar — plausible but no repro constructed.

**Transferable lesson:** When challenging "sibling type-kind X falls through to a buggy branch", don't stop at the class hierarchy (structural reachability) — check whether X is REJECTED or SPECIALIZED-AWAY at an EARLIER pipeline stage (check → specialize) before the buggy consumer runs. `docs/generated/tests/**` characterization tests (with `//META: purpose`/`pipeline_stage`) are a fast way to pin where a type-kind is legal. A structurally-real fall-through can still be dynamically unreachable because an upstream stage rejects the only way to produce it. This turns a vague OPEN_GAP into a bounded one (here: two halves, one demonstrably dead).
