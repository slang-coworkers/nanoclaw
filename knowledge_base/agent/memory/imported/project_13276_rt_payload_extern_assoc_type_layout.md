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
