---
type: chain
title: slang#13409 — Metal groupshared load forwarded/moved across barrier; sibling #13412
description: canInstHaveSideEffectAtAddress exempts in-function roots from "call may write"; drafts #13421 (groupshared, Metal/CPU) + #13431 (pointer roots, #13412) both internally approved, awaiting CI release + human review
---

# slang#13409 (human-filed, girivs82, 2026-10-02) + sibling #13412

Live state only. Settled decisions, the review rounds, and the dated re-chase log through 10-14 are in
[[slang/13409-history-decisions-and-rechases.md]] (split 2026-10-15 by okf-synthesis).

**Root (triager; I checked the source at master `00febe288c`):** in the `kIROp_Call` arm of
`canInstHaveSideEffectAtAddress`, the "callee may write anything" check is skipped whenever
`isChildInstOf(getRootAddr(addr), func)`. On Metal and CPU, `groupshared` becomes a function-local `var`
with `AddressSpace::GroupShared` (`introduceExplicitGlobalContext`), so barriers and `[noinline]` calls are
treated as unable to touch it, and `tryRemoveRedundantLoad`, `processLoadUse` (simplifyForEmit) and DSE
miscompile the code. Broken since at least 2025.6.1. Sibling #13412: pointer roots
(loaded/computed/param) get the same exemption.

## Current state (as of the 2026-10-22 19:00Z re-chase; unchanged since 10-06 except #13465's label)

| PR | fixes | head | branch | reviewer | state |
|---|---|---|---|---|---|
| #13421 | #13409 | `c42049e18f` (3 commits) | `fix/issue-13409` | jhelferty-nv | draft, internal R2 APPROVE_WITH_NITS |
| #13431 | #13412 | `bf9f3fd05a` (8 commits, App-authored, CLA passes) | **`fix/issue-13412-v2`** | kaizhangNV | draft, internally approved |

- **No human review or non-bot comment** on either PR. Both 107 behind master on 10-22 (behind-only is not a
  state change). The two PRs conflict in the same `slang-ir-util.cpp` hunks, so they are reviewed together.
  #13409 and #13412 are in milestone Q4 2026.
- **CI has never run, and none is pending.** The old dispatch runs 37230791271 / 37334999072 are deleted
  (404) in the repo-wide Actions purge ([[slang/actions-run-history-gap-2026-10-01-07.md]]) — do not track
  or rerun those ids. `pull_request` CI skips drafts, so CI runs only on an un-draft or a fresh bot dispatch
  (throttled by wait-for-human-priority). A NEW non-PR-Maintenance run on either head is a state change.
- **Ready-flip** is the operator's decision (last raised 10-06 19:45Z). Its "not re-asked until CI green"
  gate is circular while both are drafts; that deadlock was reported once on 10-10 (dashboard msg 19, thread
  `-13409`) — do not re-report or re-ask.
- **CLA:** #13421 commits 1-2 are User `286953280` (unsigned-CLA identity), so `license/cla` is pending —
  not a merge block on slang. I did **not** authorize the re-author force-push; that decision belongs to the
  `rechase-cla-bot-identity-*` series. New commits use the App identity.
- **Follow-ups filed 10-06 by slang-triager** (filing only; no fix until #13421 and #13431 both land):
  - **#13465** — `undoParameterCopy` passes inout groupshared by address on Metal/CUDA. tangent-vector
    ruled `inout` an unchecked exclusive mutable borrow (comment 6044142513), so the repro is UB and a
    **diagnostic** is the direction. The triager's reply 6044596724 asks (Q1) whether to draft a call-site
    check PR and (Q2) whether the spec should state the rule. **Parked on tangent-vector** (still unanswered 10-22). A front-end
    diagnostic is NOT under the wait-for-both-PRs hold, but only starts if a maintainer asks for the PR;
    changes to `undoParameterCopy` or `slang-ir-util.cpp` still come back to me. Assignee jhelferty-nv.
    `Office-Tess` label removed 10-15 14:06Z by jhelferty-nv, with no comment. The same bulk pass removed it from
    #12640, #13480 and #13536. I reported it 10-16 (dashboard msg 9); do not re-report it.
  - **#13466** — `tryRemoveRedundantStore` drops a store a side-effect-free callee reads through a pointer
    (CPU lane gives 0, not 1; `-g2` hides it). Assignee kaizhangNV, milestone Q4. 0 comments.
- Branch `fix/issue-13412` @ `b106f7c2c8` is kept (superseded by `-v2`).

## Routing

- Non-bot human comment on #13409/#13421 → slang-fixer, thread `gh-issue-shader-slang/slang-13409`, pin
  `sess-1790967825882-vnvecr`. On #13412/#13431 → slang-fixer, thread `gh-issue-shader-slang/slang-13412`,
  pin `sess-1791143956141-rpnjyi`.
- Substantive human comment on #13465/#13466 → slang-triager, thread `gh-issue-shader-slang/slang-<N>`,
  pinned to `sess-1791142972332-o68o4g` (the triager that filed them). **Already routed — do not re-route:**
  6044142513 (msg 65).
- ⚠️ **Read the `-13412` triager session directly** (`sess-1791142972332-o68o4g`, last row seq 37 on 10-07):
  its 10-05 reports landed in a closed re-chase session of mine and went unseen for ~28 h.
- Once both PRs merge, ask the operator before routing any fix for #13465/#13466.

## Sessions / tasks

#13409 chain (thread `gh-issue-shader-slang/slang-13409`): fixer `sess-1790967825882-vnvecr`, triager
`sess-1790963826393-0y71gs`, reviewer `sess-1791004457668-whh9sf`. #13412 chain: triager
`sess-1791142972332-o68o4g`, fixer `sess-1791143956141-rpnjyi`, reviewer `sess-1791161961007-ef8i4w`.
Next re-chase: **`rechase-13421-13431-1346-480d`, 2026-10-24 19:00Z**. Done: `…-547f` (10-22, no change), `…-4ec6` (10-20, no change), `…-0f19` (10-18, no change), `…-b02d` (10-16), `rechase-13421-g1g2-13412-4e79`,
`rechase-13409-sibling-7aad`, `…-c551`, `…-cc6a`, `…-19cf`, `…-5086`.
