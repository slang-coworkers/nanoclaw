---
type: chain
title: "slang#13534 — allow link-time constants in vk::binding arguments"
description: Terminal record — fix shipped as draft PR #14549 (3 review rounds closed), resting on human maintainer review; A5 ast-reference regen is a precondition before undraft
---

# slang#13534 — link-time constants in `vk::binding` arguments

Feature ask: allow link-time constants (extern vals and expressions over them) as
`vk::binding()` arguments, resolved against the linked program at link time. Released
11-17 07:12Z (operator retro wave-2; #13487 did NOT cover the repro). Chain thread
`gh-issue-shader-slang/slang-13534`.

**TERMINAL on our side (r3 disposition + delta confirmation, 11-17 20:49Z [Fix Report], fixer chain):**

- **Fix:** draft PR **#14549**, head `ea0c6b5fd` (branch fix/issue-13534, 27 files /
  31 commits, label `pr: non-breaking`, opened 13:55Z at `f669ff8b1`).
  `GLSLBindingAttribute` stores `IntVal*` (null = unspecified = 0), resolved at all
  three parameter-binding sites against the linked program via a capped, exponent-safe,
  protocol-correct fixpoint; extern vals hold their initializer fold; new diagnostics
  **E39034** (unresolvable, remedy names all reachable causes), **E39035** (check-time
  GLSL offset path), **E39036** (resolved value outside [0, 2^32−1]); pre-PR diagnostic
  for non-constant arguments restored with an `IsErrorExpr` no-double-diagnosis guard;
  constant^power folds by repeated squaring; all polynomial arithmetic wraps unsigned.
- **Review:** 3 rounds, all REQUEST_CHANGES, all findings applied or dispositioned —
  r1 (1 bug/4 gaps/9 clarity), r2 (2 bugs/6 gaps incl. the A2 root-cause correction:
  the map held a self-`DeclRefIntVal`), r3 (2 bugs: silent-diagnostic regression
  restored + exponent-doubling hang closed by repeated squaring; 6 gaps + clarity
  sweep) — then the reviewer's **delta-only confirmation of the r3 disposition returned
  APPROVE_WITH_NITS** (both r3 bugs verified fixed by its own build/test runs:
  bindings 52/52, diagnostics 1085/1085, new tests 10/10, clang-format clean; its
  unit-test failures were attested test-server contention). The single nit (E39036
  could duplicate when both arguments were out of range) is applied with a
  both-out-of-range test, per the verdict's own "apply without another review round".
  **Review complete** — human review is the next stage.
- **Tests:** 19 `link-time-vk-binding*.slang` files; bindings 52/52;
  diagnostics+spirv+glsl+wgsl 2615/2615; unit 687/687 (r2 baseline, head covered by CI
  run 44164832442); full suite 12344/12348 — 3 pre-existing fp8-cuda PTX-JIT infra
  failures (identical to the r2 baseline) + 1 autodiff warped-sampling-1d (cuda)
  in-suite flake (passes standalone; the nit touches only binding resolution and
  cannot reach autodiff code; bindings+diagnostics re-run green at final head
  1143/1143). clang-format clean at head — the formatting venv binary lives at
  `/workspace/agent/.fmt-venv/bin` (plain PATH lookup fails; earlier rounds shipped
  unformatted for this reason).
- **Main-verified live (20:52Z):** PR #14549 open/draft head `ea0c6b5fd`; #13534 open
  (`reproduced`, `SPIR-V`); CI run **44171141264** at-head, status=`waiting` (not
  failed — priority gate pattern, green needs human prioritization or undraft;
  supersedes run 44164832442 at the pre-nit head); explanation comment
  6949951203 + refreshed PR description at head; side-file #14556 live and open.
- **⚠ E39034 collision (Main find, 20:13Z):** open draft PR **#14497** (the #14489
  chain, head `0d5034224`) ALSO adds E39034 in `source/slang/slang-diagnostics.lua`.
  Whichever merges second must renumber. Fixer and reviewers on both sides missed it;
  flagged to the operator 11-17. On a #14497 merge, the fixer gets a conflict signal
  via webhook and renumbers then.
- **Unresolved (A5):** `docs/generated/design/ast-reference/modifiers.md` still
  documents binding/set as `int32_t`; the generator's stages are contract-restricted
  to Claude-family model ids (regenerate.py:105), hand-editing is forbidden by the
  file's frontmatter, and the lint-only doc gate skips drafts. Needs a Claude-family
  regeneration pass or maintainer sign-off **before undraft**.
- **Declined (1):** C005 shared-core refactor of the twin polynomial walks — recorded
  in-code with the one-sentence why-duplication-is-kept note the finding offered as the
  alternative.
- **Side-find:** #14556 (pre-existing IR-lowering stack-exhaustion on self-referential
  `extern const` initializers, made reachable by this feature) — bot-filed 18:17Z,
  **filed-only per policy, no triage dispatched** (verified on the dashboard 18:17Z
  row).
- **Next:** human maintainer review of draft PR #14549; before undraft: A5 regen + CI
  green on 44171141264; on the weekly undraft list (carry-over added 11-17 with the A5
  precondition — not a plain ready row). #13534 auto-closes via the PR body on merge.
  **No timer** — maintainer-owned park; webhooks deliver everything; resume on human
  comment only.
