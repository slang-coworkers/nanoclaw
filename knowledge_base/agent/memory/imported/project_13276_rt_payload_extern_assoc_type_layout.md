---
name: project_13276_rt_payload_extern_assoc_type_layout
description: "slang#13276 (tdavidovicNV, 09-28): closest-hit payload typed as an associated type of a link-time `extern struct` → SPIR-V emits an EMPTY entry-point body (silent miscompile), CUDA fails E99999 'user-defined varying parameter'; DXIL fine. Author claims RT manifestation of #8957/#9580 (lookupExternDeclRefType resolves Payload not its extern parent RayTracer). Routed to slang-triager; #12131 (jkwak-parked) still OPEN at dispatch."
metadata:
  node_type: memory
  type: project
---

**09-28 — issue_opened, routed to `slang-triager` on `gh-issue-shader-slang/slang-13276`.** Live read at dispatch:
open, 0 comments, created==updated 04:53:21Z, body matches payload, no labels.

Related state at dispatch (verified via gh): PR #12131 OPEN (head `ced217320c`, jkwak deferred ~2 sprints from 07-31),
#9580 / #8957 / #12134 all OPEN. Author (maintainer) supplied a *diagnostic-only* layout-resolver patch and explicitly
leaves implementation to the Slang team.

Triager asks: repro at ToT; two-state test against #12131 head (as done for [[project_12360_assoc_type_dyndispatch_specialize_av]]);
verify/refute the root-cause claim at claim precision; dedup vs #9580/#12134. No fixer auto-dispatch — area owned by
jkwak-work with an open design discussion (see [[project_9580_glsl_legalize_layout_mismatch]]).

**09-28 05:25 — TRIAGED, PARKED on jkwak-work design call.** Triager memo (verified by Main: comment
[5864017861](https://github.com/shader-slang/slang/issues/13276#issuecomment-5864017861) posted, labels
`reproduced`/`SPIR-V`/`cuda`/`raytracing` live). Reproduced at master `fd923329e`. Reporter's root cause CONFIRMED:
`lookupExternDeclRefType` resolves the `associatedtype` decl, never the extern lookup source → AssocTypeDecl branch gives
zero-size layout → `maybeCopyLayoutInformationToParameters` copies stale layout → SPIR-V demotes payload to `Private`
(ADCE deletes it, no diagnostic); CUDA hits `diagnoseUnsupportedUserVal`.
⭐ **#12131 does NOT fix it** (export-side only; with/without identical; positive control V2 proves #12131 works on the
export-side RT shape). ⭐ **jkwak's DRAFT PR #10877 (Closes #8957, head `4b8e719f5b`) DOES** — applies cleanly to master,
both entry points pass SPIR-V + CUDA, reflection correct. Dedup: same root as #8957 (extern side), not dup of #9580/#12134.
Decision for jkwak: land #10877 standalone vs fold into the single resolver Tess asked for on #12131. Suggested hardening:
SPIR-V should fail loudly instead of Private-demoting an RT varying with no RayPayload layout. Re-chase task set 10-05.

**10-05 re-chase — PARK SUPERSEDED by a human-owned fix.** No human comments on #13276/#10877/#12131/#8957 since 09-28,
but state moved: 09-28 jhelferty-nv labeled `RTR` + assigned kaizhangNV; 09-29 **jvepsalainen-nv self-assigned**,
milestone `Q4 2026 (Fall)`; 10-01 jvepsalainen-nv opened **PR #13370** (`Fixes #13276`, head `3c85a6cfa7`, non-draft,
CI green 61/1-skip, no human review yet). Approach = query-local link-time binding provider on `SubstitutionSet` +
shared `TypeLayoutContext::resolveLinkTimeType` for both layout and varying binding, plus the fail-loudly
`SLANG_RELEASE_ASSERT` in glsl-legalize. Doesn't mention #10877/#12131/#8957. Bot review on `0b5fe56b3d`: 🔴
`diagnoseCycle` release-abort through `DeclaredSubtypeWitness`. Routed to slang-triager on the canonical thread (pinned
`sess-1790571496244-95dzlc`) to re-classify as handed off, plus an optional two-state check of #13370 vs the 09-28 repro.
⭐ Lesson: a park on maintainer X's decision can be overtaken by maintainer Y taking ownership, so check the
assignee/milestone/cross-ref **timeline**, not just comments.

**10-05 06:13 — HANDED OFF to PR #13370, verified by Main** (comment 5864017861 updated in place 06:12:46Z, still the
only comment on the issue; it names #13370 and E38100; PR open, non-draft, head `3c85a6cfa7`, no reviewDecision). Triager
with/without check on GPU-free Release builds: PR head passes #13276 on SPIR-V + CUDA, reverted to merge base `d29f77efd`
fails, restored passes. #13370 also passes #12131's gh-9580 plain/generic/export-of-interface tests, #10877's gh-8957 and
gh-8957-glsl tests, the #8957 separate-module SPIR-V repro and the **#12134 base-interface repro (no other build passes
that one)**. The one failure is pre-existing: #12131's `gh-9580-assoc-type-of-export-nested` gives E38100 on the PR's merge
base, on master `6ba151dcf` and on the PR head; only #12131's head passes it. #10877 fails gh-9580-generic and #12134 (E99997).
#8957 on CUDA fails on every build, including a plain vertex shader, so it's unrelated. Open operator call: file the
E38100 nested case as its own issue? (Main's default is not to file. #12131 already has a regression test for it, and the
issue comment already raises it for maintainers.) Re-chase `rechase-slang-13276-pr13-36e0` is set for 10-12.
