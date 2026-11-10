---
type: chain
title: slang#14053 — overloaded same-name `[shader("compute")]` entry points emit invalid CUDA/Metal/SPIR-V with no diagnostic
description: Human-filed (albertrodriguezclo) bug 2026-10-29, P2. Bot DRAFT PR #14221 review-complete (head c429a3999, MERGEABLE, 16 behind, no conflict). Ready-flip pending; the 11-09 weekly list left it out (25-row cap), so it carries to the 11-16 list. Parked after r2 (11-09), no timer. Owns side issues #14228/#14229/#14230 (no dispatch).
tags: [entry-points, diagnostics, cuda, metal, spirv, bug]
---

# slang#14053 — overloaded entry points with the same name

Dated history (every reading since 10-29): [[slang/14053-history-triage-to-ready.md]]. New dated entries go there; this file holds
current state only.

**Ask.** Two `[shader("compute")]` overloads of `Count` (different params) compile with exit 0 on cuda/metal/spirv
(reporter: master 43ac12323), and every target's output is invalid: duplicate `extern "C"` kernels (nvcc), a duplicate
mangled name (metal), two `OpEntryPoint ... "Count"` (spirv-val). The reporter wants a front-end diagnostic, or deterministic
renaming that reflection reports. A secondary ask (a default value on an entry-point param is silently dropped) was split
out as #14228.

**Cause (the triager's finding, 10-29).** Reproduced on v2026.20-77 (L40S); not a regression (2026.13.1 behaves the same).
It is wider than overloads: `A::K`/`B::K` in two namespaces collide too, as do DXIL/WGSL. Nothing checks uniqueness
(discovery slang-module.cpp:337, lowering slang-lower-to-ir.cpp:15328). `-entry Count` with overloads gives a misleading
E38000, because `findFunctionDeclByName` drops the `OverloadedExpr` (slang-check-shader.cpp:933). A vs+fs `Main` overload
is valid SPIR-V, so the rule is target-aware. **Approach C (chosen):** a link-time error in `checkEntryPointDecorations`
(slang-ir-entry-point-decorations.cpp:25), plus an `-entry` ambiguity error. A (front-end error) breaks API users who compile
one overload; B (renaming) conflicts with #13264. Related: #13882 (entry-point identity redesign), #12392/#12721, #7473, #13264.

## State (11-09 12:00Z, r2)

| item | state |
|---|---|
| GitHub | OPEN, Type=Bug, `reproduced`; assignee jkwak-work (a shepherd assignment by jhelferty-nv 11-02, not a stand-down). Bot triage comment 6589648302 (offers the draft PR; links #14228) |
| PR | **#14221** DRAFT, `fix/issue-14053`, head c429a3999 (merge 5e3cd0e69 with master 04d2726db). 11-09: `mergeable_state=behind`, 16 behind master, no conflict (verified). CI run 42067743915 gated at `wait-for-human-priority`. Explanation comment 6592904573 |
| Fix | E38016 `checkEntryPointNamesAreUnique` (SPIR-V per execution model, CUDA includes the OptiX prefix; GLSL, Slang VM, non-compute LLVM and a renamed `main` exempt); E38017 `-entry` ambiguity via `findFunctionDeclsByName`. 9 new tests; 38/38 PR lanes, 3477/3477 subset (the fixer's figures) |
| Review | R1/R2 REQUEST_CHANGES (fixed), **R3 APPROVE_WITH_NITS** (nits applied) — review complete |
| Gate | **review-complete bot draft, ready-flip pending: belongs on the 11-16 weekly list** (`weekly-undraft-list-4573`, Mon 09:00Z). The 11-09 list (dashboard seq 511974) left it out under its 25-row oldest-first cap. No per-PR un-draft ask (P2, not a regression) |
| Timer | none. Parked after r2 (11-09); the weekly list is the register. No r3: no fixer push or maintainer reply is pending |
| Sessions | fixer `sess-1793657193763-f9uw61` (pr-mapping owner); triager thread session `sess-1793310892824-ykqeww`; thread `gh-issue-shader-slang/slang-14053` |

## Side issues owned by this chain (their `issue_opened` webhooks need no dispatch)

- **#14228** — a default value on an entry-point parameter is accepted with no diagnostic but ignored by the kernel. Bot-filed
  11-03 ("Split from #14053"), `reproduced`, filed-only, low severity. Warn vs. document is a maintainer call
  (`getDefaultValueBlob` does report the default). Neighbours: #11106 (closed), #12356.
- **#14229** — generated `<name>_<N>` collides with a verbatim entry-point name (`helper` + `helper_0`; `main` + `main_0`) on
  CUDA/HLSL/WGSL/Metal/C++. Cause verified by Main 11-05 in slang-emit-c-like.cpp: `maybeMakeEntryPointNameValid` (:1129) and
  `generateEntryPointNameImpl` (:1145) write names verbatim, while `_generateUniqueName` (:1151) never reserves them. P3, emit
  naming, not a regression. jkwak-work self-assigned 11-04 (Q1 2027) → rung 4. Fixer held: maintainer-owned, and it builds on
  #14221's renamed-`main` rule.
- **#14230** — `[numthreads]`/`[ForceInline]` on a prototype have no effect (reflection `[4,1,1]`, SPIR-V `LocalSize 1 1 1`).
  Filed-only; merge-vs-diagnose is a maintainer design question. Assigned jkwak-work (Q4 2026). Neighbours: #12515, #14200.

## Binding decisions

- **Overlap with reporter PR #14147** (fixes #14137): it restructures `findFunctionDeclByName` in the same hunks. Whichever
  merges second rebases (by merge, not force-push).
- **#14229 waits until #14221 merges** and a maintainer or the operator asks; resume on a jkwak-work ask or an @nv-slang-bot mention.
- No second un-draft ask: the weekly-list policy ([undraft-asks-replaced-by-weekly-list](../orchestrator/undraft-asks-replaced-by-weekly-list.md)) covers it.

## Lessons

- A peer reply threaded to a one-shot task's session dies with that session (the fixer's 11-03 03:16Z relay to closed
  `i14053-r6-post-b43c`). Re-dispatch it to the canonical thread session.
- ⚠️ The `weekly-undraft-list-4573` prompt tells fixers to run `gh pr ready` after operator approval; fixer spines forbid that
  ([feedback_fixers_cannot_request_reviewers](../feedback_fixers_cannot_request_reviewers.md)). Fix the prompt before its first bulk approval.

## 11-06 23:09Z: reporter reviewed #14221 (positive), fixer replied (verified)

- Reporter albertrodriguezclo, comment 6697864708 (22:56Z), says "this covers what I hit". They are happy with either merge order against their #14147 and will rebase #14147 if #14221 goes first.
  They asked for the user-visible changes in one place in the description. This is not a stand-down.
- Fixer reply 6698056658 (23:08Z): #14147 is still needed, since the empty E30015 before E38000/E31006 persists at c429a39. The Summary now lists E38016/E38017/E39999 first.
  Head is unchanged at c429a3999, still a draft. The r2 re-chase on 11-09 and the weekly un-draft list are unchanged.
