---
name: project-11782-conditional-symbolic-flag-spirv-ice
description: "#11782 Conditional<T,flag> symbolic-flag ICE — reproduced, in fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: a66ff7d3-b244-49ea-a293-35d9f00706b3
---

# shader-slang/slang#11782 — `Conditional<T,hasValue>` symbolic-flag SPIR-V ICE

Generic fn/method taking `const Conditional<int, flag>` where `flag` is a bool
value-param stays **symbolic** through the enclosing generic → unlowered
`makeConditionalValue` survives to SPIR-V emit → abort
`E99997 Unhandled local inst in spirv-emit: makeConditionalValue`.

**Mechanism (source-verified):** `slang-ir-lower-conditional-type.cpp:74-75,107-109`
lowers only a *literal* `hasValue`; leaves the inst when flag is still symbolic.
`slang-emit-spirv.cpp:4832` has no handler → abort.

**Real trigger is SIMPLE** (triager corrected the earlier autodiff/higher-order/
set-spec hypothesis): a plain **un-monomorphized enclosing generic**
(`outer<T>` / `Grid<T>`) whose `inner<true>(...)` call keeps the flag symbolic.

**Timeline:** parked 06-26 "Needs reporter feedback" (couldn't repro from snippet);
07-23 reporter LDAP delivered 2 minimal in-tree repros (free-fn + generic-struct-method)
→ REPRODUCED @HEAD 56eb1aa08, labels flipped (`reproduced`), confirmation
[cmt 5055856994](https://github.com/shader-slang/slang/issues/11782#issuecomment-5055856994).

**⚠️ STATE — REPLY-ONLY STANDS (Main ruling 07-23 08:0xZ; corrects the "in fix" line below).** #11782 is **assigned to szihs (OPEN), no PR, no `fix/issue-11782` branch** (Main-verified 07-23 07:5xZ; labels `Dev Reviewed`+`reproduced`, updated 07:52Z). Main's prior directive **id=36 (2026-07-13): REPLY-ONLY, don't author heavy work — contributor szihs owns it.** That condition is UNCHANGED — reproduction advancing (2 in-tree repros @HEAD 56eb1aa08 today) makes it *ready-to-fix* but does NOT release szihs's ownership ([[feedback_reopen_not_release_parked_feature]]: a state change on the issue ≠ release; [[feedback_deadpromise_check_assignee_before_rewake]]: assignee owns ⇒ stand down).

**GOVERNANCE CONFLICT resolved (fixer escalation msg 57354):** slang-triager dispatched a fresh `[Triage handoff]` (07:54Z) routing #11782 to `/slang-fix-issue` (author fix + draft PR) — but the triager is group-scoped and **never saw id=36** (invisible-authorization, same class as the #11917 id=45 incident [[project_11917_pass_gating_epic]]). **slang-fixer correctly HELD** (no worktree/build/PR/GitHub post) per its competing-PR rule + id=36, and escalated to Main for the tiebreak. **Main RULING: reply-only STANDS** — do NOT author a competing bot draft PR on szihs's assigned+owned issue. Fixer may OPTIONALLY post ONE brief offer to szihs (the ready Approach A/B fix; are-you-working-it / want-the-bot) — light-touch per [[feedback_contributor_pr_offer_brief]], not required. **→ Fixer took the offer 07-23 08:01Z: posted ONE short deferential comment to szihs ([issuecomment-5055921225](https://github.com/shader-slang/slang/issues/11782#issuecomment-5055921225)) — reproduced @HEAD, root cause, A/B ready, "working it or want the bot?"; no @-reviewer, no assignment change, PR untouched. Ball now in szihs's court; do NOT re-offer.** Triager told to stand down the fix-dispatch. **Release trigger = an explicit maintainer/szihs "bot, take it"** (the #8125 pattern) OR szihs un-assigns. Triage memo is EXCELLENT (root cause + Approach A producer-side monomorphization + B diagnostic guard) — preserved for instant pickup on release.

**Fix approaches (from the strong triage memo, held not dispatched):** A = producer-side monomorphization of the enclosing generic before conditional-lowering; B = defensive diagnostic guard.

Related split-off [[project-11784]] (bwd_diff `.get()` ICE) tracked separately.
