---
name: project_12460_empty_generic_param_list_outermost_gate
description: "slang#12460 (bot-filed, OPEN, triaged+commented by slang-triager 08-10 22:20Z): empty generic param list. Main-verified on own edge: the Release SIGSEGV discriminator is NOT 'nested' but genericIsOutermost==false at slang-check-overload.cpp:1223 — outermost path returns at :1248 and never reaches the :1257 copy loop. Prediction test Plain.Inner<> (non-generic parent => still outermost) => rc=0 held. Issue's own 'wider nested shape compiles clean in Release' is FALSE on my edge (139)."
metadata:
  node_type: memory
  type: project
  title: "slang#12460 — empty generic <>; the crash gate is outermost-ness, not nesting"
  tags:
    - slang
    - frontend
    - overload-resolution
    - generics
    - live-chain
    - severity-escalation
  originSessionId: 2628b509-7166-44aa-a59f-641fdc293b4d
---

# slang#12460 — the Release-crash discriminator is `genericIsOutermost`, not "nested"

**Chain state 2026-08-10:** filed by `nv-slang-bot[bot]` 21:06:32Z. `slang-triager` triaged and posted
[comment 5246686078](https://github.com/shader-slang/slang/issues/12460#issuecomment-5246686078) at
22:20:27Z (bug / high / P2 / frontend, added `regression` label). No fixer dispatched at that point.
Verified at master `1ca1aa50e`.

## What the triager got right, re-measured on my own edge

Filesystem pinned FIRST (`findmnt` → `/dev/vda1[…/groups/main] /workspace/agent`) before disputing or
adopting anything — the anchor-A discipline, and this time it certified a peer's report instead of
inverting it.

Its headline **severity correction reproduces exactly here**: a zero-parameter generic nested in a
generic parent SIGSEGVs Release `slangc`, silently.

| shape | Release rc |
|---|---|
| `Wrap<>` (empty, outermost) | 0 |
| `Outer<>.Inner<int>` (empty **outer**, used non-empty) | 0 |
| `Plain.Inner<>` (empty, parent is a **non-generic** struct) | **0** |
| `Outer<int>.Inner<>` | **139** |
| `Outer<>.Wrap<>` | **139** |
| `use<>(6)` (empty **function**, file scope) | 0 |

3/3 runs, and 139 on hlsl/spirv/glsl/metal, zero stdout and zero stderr bytes. Controls
`Outer<int>.Inner<int>` and `Outer<int>.Inner` both exit 0.

## ⭐ The refinement: "nested" is a proxy; the real gate is outermost-ness

`slang-check-overload.cpp:1189-1196` walks `parentDecl` looking for `as<GenericDecl>(p)` and sets
`genericIsOutermost`. At **:1223** `if (genericIsOutermost)` the outermost path calls
`trySolveGenericArguments` and **`return true` at :1248** — it never reaches the copy loop
`for (auto arg : substArgs)` at **:1257**. Only a non-outermost generic falls through to :1257, which
is the line the triager measured as the out-of-bounds read.

⭐⭐ **This predicts the coordinates rather than correlating with them.** The falsification test:
`struct Plain { struct Inner<> { … } }` is *nested* but its parent is not a `GenericDecl`, so the walk
leaves `genericIsOutermost == true` ⇒ **predicted rc=0, measured rc=0.** "Nested" would have predicted
a crash. So the discriminator is the outermost gate, not nesting depth.

⇒ **Any patched-build verification must include a NON-OUTERMOST shape**; `Plain.Inner<>` is the
matching negative control. A fix verified only on `Wrap<>` + `Plain.Inner<>` would pass while the
segfault survives.

## A false claim in the issue body, still uncorrected there

The description says *"A wider shape (nested `Outer<>` containing a `Wrap<>`, plus a generic function
`use<>`) also compiles clean in Release and folds to the right value."* On my edge that exact shape is
**rc=139**. The reporter's own wider-shape control contradicts its severity conclusion; the triager
found the crash via a different shape (`Outer<int>.Inner<>`) and did not notice the body already
contained a counterexample to itself.

## Regression-window claims: which are checkable on a shallow clone

My clone is **shallow** — `.git/shallow` present, 37 commits, root `0864e60e6`.

- ⛔ **`git merge-base --is-ancestor 855b1a262 HEAD` → rc=1 ("not an ancestor")**, which is FALSE as a
  fact about master. Control: `--is-ancestor 0864e60e6 HEAD` → YES, so the instrument works *inside*
  the graft and silently voids outside it. Tag containment likewise: `v2025.13` / `v2025.13.1` came
  back "undeterminable", only `v2025.13.2` → YES ⇒ **I cannot confirm the clean tag boundary the
  triager reports.** Not refuted — unmeasurable here. See
  [[feedback_shallow_clone_makes_your_head_the_graft_root]].
- ✅ The **content** claim needs no ancestry and holds: `git show 855b1a262^:…/slang-parser.cpp`
  carries `// For now assume all generics have at least one argument` at line **2361**, and at
  `855b1a262` the same grep returns **0**. That is the load-bearing half of the regression finding.

## Staleness scoping — my binary, and a caveat on the triager's

My `build/Release/bin/slangc` mtime is **2026-08-04 07:50:48**, HEAD commit date **2026-08-10**, so the
binary predates HEAD (the [[feedback_a_repro_binary_is_not_the_sha_you_checked_out]] trap). Scoped
rather than assumed: of the 3 post-binary commits touching the relevant files, `0864e60e6` is the
**graft root** (shows as +15836 insertions = whole-file, not an edit), and `d2b405d31` / `19d1d4065`
touch `slang-parser.cpp` only in switch/throw statement parsing — **0** diff mentions of
`parseGenericApp` or `ParseGenericDeclImpl`. So the binary is valid for these claims.

⚠️ The triager reported `git log --since` on `slang-check-overload.cpp` as **EMPTY** with a tree-wide
control of 16. On my edge the same query returns **1** — and that 1 is the graft root. Its conclusion
survives, but **a clean `--since` result on a shallow clone is partly an artifact of the graft, not
evidence of a quiet file.** Report the root commit alongside such a result.

## Recommended fix (triager's A, which I authorized)

Assert **presence, not count**: `SubstitutionSet::findGenericAppDeclRef(GenericDecl*)`
(`slang-ast-decl-ref.cpp:883`) already returns nullptr-vs-pointer, so it distinguishes *no
specialization* from *specialization with zero arguments*. `tryGetGenericArguments`
(`slang-ast-decl-ref.cpp:814`) returns the empty view via its **found** path at :833, not a not-found
fallback — so an empty view is legitimate data, and the assert at :1186 is the only step that
disagrees.

Language question (should `<>` be rejected at all) is routed to a maintainer on the issue and is
**independent of the code fix** — a silent segfault should not wait on a language call, and
programmatic/reflection-generated empty applications stay reachable whatever the syntax decision.

Related: [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]] (the live-state gate that
opened this chain), [[feedback_mechanism_must_predict_observed_coordinates]].
