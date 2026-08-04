---
name: project_12330_entrypoint_throws_not_diagnosed
description: "slang#12330 — `throws` on a shader entry point isn't diagnosed; SPIR-V ICEs at glsl-legalize:2166 structTypeLayout, HLSL emits a value-returning compute EP. Dispatched to triager; my 2 hypotheses UNVERIFIED"
metadata: 
  node_type: memory
  type: project
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# slang#12330 — shader entry point allowed to `throws` (no diagnostic)

Author **skiminki-nv** (MEMBER/maintainer, self-filed), 2026-08-03 16:36Z. `Dev Opened`, 0 comments.
https://github.com/shader-slang/slang/issues/12330 · reporter SHA `53b76e6d3009b8e6434d41573524c7ce5c499d23`

**Ask:** a `throws` clause on a shader entry point should be an error. Reporter's argument: it's
unclear how an uncaught exception from an entry point could even be handled, and AFAICT only the
CPP target could theoretically support it. Analogous to uncaught exceptions in C++.

**Repro** (`slangc -target spirv -entry computeMain -stage compute test.slang`): `uint g(uint n)
throws uint` + `void computeMain(uint3 tid : SV_DispatchThreadID) throws uint` calling `try g(...)`.

**Two broken outcomes reported (transcribed from the issue — NOT independently verified by me):**
- `-target spirv` → `E99997 InternalError assert failure: slang-ir-glsl-legalize.cpp(2166): structTypeLayout`
- `-target hlsl` → emits `ResultType_1 { bool tag_1; AnyValue4 anyValue_1; }` as the **return type** of
  `[numthreads(1,1,1)] computeMain(...)`. Reporter *believes* this won't compile downstream (compute
  shaders can't return values without semantic binding) — flagged to the triager as a belief to test,
  not inherit.

## Routing

Dispatched to **slang-triager**, canonical thread `gh-issue-shader-slang/slang-12330`.
**No fixer dispatch** — this author owns his own PRs. On [[project_12326_throw_statement_missing_semicolon]]
he opened PR #12328 adopting our recommendation essentially verbatim ~1h after our verdict landed.
⇒ the **framing** is the deliverable here; it has to be right the first time.

## Two questions I asked the triager to keep separate

1. **Is the blanket rule right?** Check whether CPU/CPP/host-callable targets *work today*. If any
   path currently produces correct behavior, a universal error deletes a working case and the rule
   needs a target/usage carve-out. Also: which layer owns the check — entry-point validation in
   `check-shader.cpp` is the precedent from #11881's duplicate-`[numthreads]` fix (confirm or correct).
2. **Is the ICE separately a bug?** With the diagnostic added, is the underlying legalize crash class
   still reachable by other means?

## My 2 hypotheses — UNVERIFIED, handed over as hypotheses

- **Same-assert link to #9580 / #12134.** `slang-ir-glsl-legalize.cpp:2166 structTypeLayout` is the
  *same assert line* as [[project_9580_glsl_legalize_layout_mismatch]] and
  [[project_12134_base_interface_assoc_type_followup]]. There the mechanism was a type⇄layout mismatch
  on the **entry-point result**: the concrete return type was rewritten by a later transform while the
  entry-point result *layout* was never refreshed → null `structTypeLayout`. Error-handling lowering
  rewriting the EP return `void` → `ResultType_1` looks like the same family. If true it changes
  one-crash-class-vs-two, and #9580's fix is jkwak-work-owned and **deferred ~2 sprints**.
- **Feature-maturity unknown.** I did NOT establish whether `throws`/`try` is experimental,
  language-version-gated, or otherwise unstable. That materially changes severity and whether
  "diagnose an error" is even the right disposition vs. "feature is incomplete". Triager to establish
  from source, not from my framing.

## Standing constraints carried into the dispatch

- **Duplicate check:** REST search (`throws in:title`, `throw entry point in:title,body`) returned only
  #12330 itself. Sibling-but-distinct = **#12326** (same author, filed 3h earlier, has his own PR #12328).
  Triager to confirm independently. (GraphQL `gh issue list --search` has 401'd in past sessions —
  [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].)
- **Generated-surface sweep is mandatory.** #12326's live lesson: PR #12328 left
  `docs/generated/tests/.../stmt-throw-no-semicolon.slang` + 2 generated doc lines stale, and that
  directory runs **nightly-only** (`slang-test -test-dir docs/generated/tests` from
  `nightly-slang-test.yml`; `workflow_dispatch` + cron `0 4 * * *`, **no `pull_request`**) ⇒ breakage
  lands green and surfaces as an unattributed nightly failure.
  [[feedback_green_job_skipped_backend_zero_coverage]] shape. Any recommendation here must name the
  exact generated files a `throws`-on-EP diagnostic would invalidate.
- Post the 5-bullet verdict on the issue **only if VERIFIED**, HOLD otherwise
  ([[feedback_triage_github_posting]]). Probe builds get reverted and the revert stated.

## State

Dispatched, awaiting triage report. **RESUME = triager report on thread
`gh-issue-shader-slang/slang-12330`**, or a skiminki comment / his own PR appearing (watch for the
#12326 pattern: candidate-fix PR within ~1h of a verdict). Nothing posted publicly by me.
