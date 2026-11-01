---
type: chain
description: "Human-filed (pdeayton-nv, MEMBER, bot-ok) HLSL bug 10-30: sibling `for (int i…)` loops give E39999+E30200 under -lang hlsl, plus a silent miscompile. Long-standing FXC-style UnscopedForStmt leak. tangent-vector directed approach B (DXC scoping, breaking) → draft PR #14115, R1 APPROVE_WITH_NITS; PARKED on the operator un-draft (dashboard msg 191). Spawned #14118 and #14120."
tags: [hlsl, scoping, for-loop, frontend, r6-exempt]
resource: raw/triage-14099.md
---

# shader-slang/slang#14099 — HLSL sibling for-loop variable redeclaration

This chain also owns the two follow-ups it spawned: [[slang-14118-unbraced-body-local-visible-early.md]]
(PR #14119) and [[slang-14120-target-switch-catch-for-local-visible-early.md]] (parked). Both were
bot-filed by the triager session below, so **their `issue_opened` webhooks need no dispatch**.

## State (10-31 04:20Z)

| | |
|---|---|
| Issue | filed 10-30 19:47:08Z by pdeayton-nv (MEMBER, self-assigned), label `bot-ok` → R6 hold waived; labels `reproduced`+`bot-ok` |
| Triage | 10-30 20:13Z ready-for-fix, bug/high/frontend/P2; comment #issuecomment-6532516576; memo `raw/triage-14099.md` |
| Sessions | triager `sess-1793389741238-u9zfkk`; fixer `sess-1793391263352-okyiy6` (ag-1780667166439-vmjrwe); thread `gh-issue-shader-slang/slang-14099` |
| PR | **#14115** "Scope HLSL for-loop variables to the loop", DRAFT, branch `fix/issue-14099`, `pr: breaking change`, head **42f8ba6d0** (10 files +200/−86), pr-mapping → okyiy6 |
| Review | slang-reviewer R1 at ea4cbbfe0: **APPROVE_WITH_NITS 0/0/0** (`raw/combined-review-14115-r1.md`); N1–N5 + C004/FG003 applied in 42f8ba6d0 |
| CI | none real: dispatch run 41155151526 throttled (`wait-for-human-priority` failed, IS_THROTTLED_BOT, 40 jobs skipped). Un-drafting is the only CI path |
| Parked | **operator: un-draft #14115 and #14119** (dashboard msg 191 supersedes msg 147; I recommend (a) Main runs `gh pr ready`). Timer: one-shot `recheck-14115-ready-faff` 2026-11-02 17:00Z (covers #14115, #14119, #14120) |
| Human asks | pdeayton-nv: the rewritten #13219 test (`tests/spirv/debug-lexical-scope-unscoped-for.slang`, reads `i` after the loop); a maintainer: keep/drop the module-version 37→38 commit |

## Root cause and direction

- Not a regression: fails back to v2025.18.2; the for-scope leak dates to 2017 commit a40b66799.
  Reproduces on 2026.20-97; HLSL-only (`.slang` compiles, DXC 1.9 accepts).
- Root (triager's, matched by the fix): `ParseForStatement` (slang-parser.cpp:7801) builds an
  `UnscopedForStmt`; `checkRedeclaration` (slang-check-decl.cpp:14837) → E30200; `visitBlockStmt`
  (slang-check-stmt.cpp:128-145) hides only direct-child DeclStmts → E39999. Silent miscompile:
  `int i = 7; { value = i; for (int i…) {} }` binds the not-yet-declared inner `i`. Related #13752.
- Approaches: A (non-breaking, newest for-init redecl wins), B (DXC scoping, breaking), C (per-loop
  scope + lookup fallback). Dispatched A 10-30 20:14Z.
- **10-30 22:48:21Z tangent-vector (MEMBER) directed B:** "let's just fix this and implement the proper
  scoping all developers writing code these days expect … technically a breaking change … If the
  authors of FXC already moved on, I think we can too."
  https://github.com/shader-slang/slang/issues/14099#issuecomment-6535132734 — no bot mention, so no
  post-back authorization. Relayed verbatim 22:49Z (msg 31); the fixer stood A down before any PR.
- PR commits: failing repro test, parser fix (every `for` gets one scope shape), droppable commit
  removing dead `UnscopedForStmt` + module version 37→38. Full suite 11337/11340 (3 fp8 CUDA fail
  on master too). Reviewer N5: 8 other open PRs also bump to 38 (#14114 #14051 #13992 #13953 #13872
  #13792 #13564 #13425) and #13885 sets 39 — whichever lands second bumps by hand.

## Lessons

- `send_message` to a peer thread with unanswered inbound rows is refused without
  `in_reply_to=<seq>`; pass the latest peer row.
- A `workflow_dispatch` ci.yml run on a bot draft is throttled behind human PRs; "waiting on the
  Falcor gate" is a misreading. Do not re-dispatch — un-draft. A fixer cannot `gh pr ready`.
- Side finds go to the owning triager session to verify + dup-search + file; that session owns the
  new issue, so record ownership here before its webhook arrives.
