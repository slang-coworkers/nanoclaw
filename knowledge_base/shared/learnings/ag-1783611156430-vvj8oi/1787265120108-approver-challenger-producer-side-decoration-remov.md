---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787264048046-8shnnv
written_at: 2026-08-20T22:32:00.108Z
---

# [approver/challenger] producer-side decoration removal — weigh owner-intent vs documented consumer contract

## Symptom
PR #12304 (slang) removes the sole producer of `IRPublicDecoration` for user
`public` decls (`addLinkageDecoration`, `slang-lower-to-ir.cpp:~1432`) to fix
an empty-struct layout bug (#8125). Devin (head-current) and a prior-revision
challenger both flagged a 🔴: the removal strips the decoration from EVERY
plain-`public` decl, and CPU/CUDA emit keys host-visibility on it.

## Root cause / mechanism (verified at head)
`isPublicOrExportedFunc` (`slang-emit-cpp.cpp:957`, gates `static` emission),
`_isExported` (:2004), `_getExportStyle` (:2051) accept
`Public|EntryPoint|HLSLExport|DllExport|DllImport|Cuda*` but NOT plain
`ExportDecoration`/`ExternCppDecoration`. So a plain `public __extern_cpp`
function → emitted `static` post-change → not reachable via
`ISlangSharedLibrary::findFuncByName`. `docs/cpu-target.md` Visibility section
documents exactly `public`/`public __extern_cpp` as the CPU host-callable
export mechanism. PR updated no docs, added no test for that path.

## The decision tension
- 🔴 in the doc rules out WOULD_APPROVE (Step 3 never upgrades past a 🔴).
- BUT the change is architect-endorsed-as-INTENDED: csyonghe (MEMBER, designer)
  said `public`→`PublicDecoration`/export is "historical slop" to be removed,
  then APPROVED at the exact head; jkwak (MEMBER) dictated it; #12667 filed for
  cleanup; CI fully green. So BLOCK would be a false "verified defect" claim
  against explicit owner intent.
- Landed on ABSTAIN_POLICY / CHALLENGER_CONCERN: a genuine, mechanically-
  grounded, UNRESOLVED doc/visibility-contract regression concern I couldn't
  build-verify, on the fuzzy Devin-only tier. Uncertainty ⇒ ABSTAIN.

## How to catch it (transferable)
When a PR removes/relocates a decoration/flag at its PRODUCER, inventory ALL
consumers of that decoration (grep the op name tree-wide) AND check the
documented contract for the behavior those consumers implement. A green CI + a
maintainer approval do NOT prove a documented consumer contract survived if no
test exercises it (a negative-safety observation carries bits only if it could
have come out otherwise). Distinguish "architect says this is intended" (rules
out BLOCK) from "the documented downstream contract is silently regressed with
no doc/test update" (rules out APPROVE) → ABSTAIN so a human reconciles the two.
