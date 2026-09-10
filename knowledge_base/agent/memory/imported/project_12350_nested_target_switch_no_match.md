---
name: project_12350_nested_target_switch_no_match
description: "#12350 nested __target_switch unmatched-case → E41011: ⛔CLOSED 08-04 22:33Z by jkwak-work as 'preferred behavior' = a REFUSAL stamped state_reason:completed. TERMINAL for the filed question (E41011 stays; default: break; is the sanctioned answer). ⚠️BUT the close is SCOPED — it postdates by 9min a SECOND case (silent fall-off of a non-empty arm) that jkwak himself asked for a diagnostic on 22min earlier (r3716544275, still isResolved:false on PR #12186) ⇒ that ask is LIVE on the review thread, NOT declined. My overclaim correction was applied + independently verified by the fixer."
metadata:
  type: project
  originSessionId: main-2026-08-04
---

# #12350 — nested `__target_switch`, no matching inner case → `E41011`

> ⛔ **CONTROLLING STATE — read this block first; everything below is the pre-close record.**
>
> **CLOSED 2026-08-04T22:33:36Z by `jkwak-work` (MEMBER):** *"Closing, because this is a preferred
> behavior."* (comment `5185359792`). `state_reason: **completed**`, `author != closed_by`.
> ⇒ **A REFUSAL wearing `completed`** — see [[feedback_state_reason_is_not_polarity_either]], to which
> this is now the confirming case for that polarity.
>
> **TERMINAL for the question as filed, and the answer is a decision, not a defect:** an unmatched inner
> `__target_switch` **keeps `E41011`**; direction 1 (silently no-op it) is **rejected**; jkwak's own
> **`default: break;`** (`r3716552042`) is the sanctioned shape. Our tier verified it works with a proper
> negative control (delete just that line ⇒ `E41011` returns) — `r3716605886`. **No fixer, no reopen, no
> further post on #12350.**
>
> ⚠️⚠️ **THE CLOSE IS SCOPED — DO NOT READ IT AS DISPOSING OF BOTH CASES.** At 22:11:31Z jkwak said
> (`r3716544275`): *"`break;` is missing at the end of the case-arm. In that case, Slang should **warn or
> error** and let the user know."* Our tier tested that distinct case and posted it to #12350 at 22:24:55Z
> (comment `5185295241`): falling off a **non-empty selected arm** silently branches past the switch
> (`slang-lower-to-ir.cpp:9447-9448`) with **no diagnostic at all** — byte-identical module with and
> without an explicit `break;` (both `304246d4a1a4af14…`), so the keyword is optional and a reader cannot
> tell which semantics they got. The close landed **9 minutes later and does not engage it.**
> ⇒ **The diagnostic ask is LIVE, on PR #12186's review thread `r3716544275`, `isResolved: false`.** The
> closed issue is NOT the live artifact for it. Do not infer the warning was declined; do not reopen
> #12350 to chase it (jkwak's call, and the *filed* question is genuinely answered).
>
> 🔒 **#12186 APPROVAL SURVIVED ALL OF THIS — verified after the close:** `reviewDecision: **APPROVED**`,
> head still **`65338dbef9`**, `mergeable: MERGEABLE`, `mergeStateStatus: BLOCKED`, `isDraft: false`. All
> four of jkwak's 08-04 reviews are **`COMMENTED`** ⇒ non-dismissing. **No push happened and none may** —
> RESUME for #12186 remains a **maintainer merge**, unchanged.


**Filed 2026-08-04T21:45:17Z by `nv-slang-bot[bot]`** (slang-fixer, session
`sess-1784687870891-dnkxu6`, working thread `gh-issue-shader-slang/slang-12185`).
State at filing: **open, 0 labels, 0 assignees, no milestone, 0 comments.**
Canonical thread `gh-issue-shader-slang/slang-12350`.

## Why this is NOT a zero-dispatch own-bot echo — criterion 1 only

Applies the [[project_12333_dev_null_output_path_tests]] test. Of its two
analogy-breakers, **exactly one holds**, and it is the decisive one:

1. ✅ **A maintainer explicitly commissioned it.** `jkwak-work`, review comment
   **`3716162234`** on PR #12186 @ 2026-08-04T21:03:12Z, `hlsl.meta.slang:27517`:
   *"@nv-slang-bot , I think we may need a new issue for this one… We may need to
   print a warning or implement the fall-through. **Please test the current status
   and file an issue.**"* — Main-verified verbatim via
   `gh api repos/shader-slang/slang/pulls/comments/3716162234`. The issue is a
   **requested deliverable**. ⭐*"bot-authored" describes the typist, not the
   originator.*
2. ❌ **NOT within bot reach.** The issue's own "possible directions" are three
   mutually-exclusive **semantics** options (no-op the unmatched switch / keep the
   error but make it actionable / require-or-warn a missing `default:`). Option 1
   silently converts today's diagnostic into accepted code — a language-semantics
   decision. The filing correctly declines to advocate.

⇒ **Disposition: NO fixer dispatch, NO re-triage, NO new GitHub comment.** The
issue body already *is* the triage writeup (repro + mechanism + expected-vs-actual
+ scope + directions), and the loop back to jkwak was already closed on the PR
(below). A bot-on-bot verdict comment would be pure noise. Same posting logic as
[[project_12210_autodiff_property_getter_frontend_crash]] (#12232) and
[[project_12320_coverage_macos_segfault_base_rate]], but reached by a *different*
route: those were parked for being structurally out of reach; this one is
**maintainer-gated on a semantics call**, which is a stronger reason and not the
echo rule.

## The reporting loop is already discharged — do not re-post

Bot reply **`3716420746`** (2026-08-04T21:48:17Z, `in_reply_to_id: 3716162234`)
answers jkwak in-thread on #12186: corrects his "unused cases are simply removed"
model (it *is* removal, but the observable outcome is a hard error, not silence),
names #12350, and explicitly leaves the choice to him and csyonghe. It also
volunteers that it had **predicted `MissingReturnError` and was wrong** — the
self-correction is in the public reply, which is the right place for it.
✅ `search/issues q=…12350 in:comments` → `total_count: 1`, that reply only.

## Main-verified receipts (2026-08-04, `gh api`; no local clone)

Fetched `source/slang/slang-ir-specialize-target-switch.cpp` from master via the
contents API and read :36–96. **Every mechanism claim in the body is byte-exact:**

- `else` branch at **:73** ✅ · `sink->diagnose(Diagnostics::ProfileIncompatibleWithTargetSwitch{…})`
  at **:82** ✅, guarded by `if (failedImplies)` at :79 ✅ · `builder.emitMissingReturn()`
  at **:87**, **unconditional** (outside the `failedImplies` guard) ✅ ·
  `isIncompatibleWith(cap) → continue` skip at **:41** ✅ · `failedImplies = true`
  set exactly when a case wins `isBetterForTarget` but `targetImpliesCapSet` is
  false ✅ — so the body's careful precision that **`E41011` is conditional on this
  shape**, not the universal "no case matches" outcome, is correct and is the
  non-obvious part worth keeping.
- The in-repo comment at :74-76 corroborates the intent: the guard exists so
  `__target_switch { case metal: return; }` does not error for a glsl target.

## ✅ RESOLVED — the overclaim was corrected AND independently verified by the fixer

**Outcome first (verified in the live body 22:33Z):** the fixer applied the correction, and did the run I
named rather than taking my capdef read on faith. The body now states the composition result explicitly —
*"nesting composes when both capabilities are supplied (`-capability spvDescriptorHeapEXT+spvBindlessTextureNV`):
compilation succeeds, with `111` and `222` emitted and `333` absent"* — and re-frames the single-capability
333 as *"correct rather than anomalous,"* citing `capdef:695/:703/:973/:977`. The "surprise"/"does not
compose" framing is gone; the observation is kept. ⭐**Routing it to the footprint owner rather than
patching over it produced a better artifact than my edit would have: I had the explanation, the fixer had
the build, and the both-caps run is now positive evidence in the issue instead of an absence I inferred
from the capability graph.** Original analysis below, kept for the reasoning trail.

### The overclaim as filed

The body flags as *"a second surprise… the nested arrangement does not compose the
way the pattern assumes"*: compiled **with** `-capability spvBindlessTextureNV` it
succeeds but returns **333** (the outer `default`), so the outer
`spvDescriptorHeapEXT` case *"is not selected there either."*

**That is not a surprise and not evidence of a nesting defect.** `capdef` is
decisive — Main-read from master:

```
def SPV_NV_bindless_texture: _spirv_1_0;                                  # :695
def SPV_EXT_descriptor_heap : _spirv_1_0;                                 # :703
def spvBindlessTextureNV : SPV_NV_bindless_texture;                       # :973
def spvDescriptorHeapEXT : SPV_EXT_descriptor_heap + SPV_KHR_untyped_pointers;  # :977
```

The two atoms are **siblings over `_spirv_1_0`, wholly disjoint** — `grep` over the
whole file finds `bindless_texture` on 3 lines and `descriptor_heap` on 2, with **no
line relating them**. So `-capability spvBindlessTextureNV` alone does **not** imply
`spvDescriptorHeapEXT`; the outer switch has no reason to select that case, and
falling to `default:` → `333` is exactly right. The observation is real, the
**interpretation** is wrong: it conflates "I passed the inner arm's capability" with
"the outer arm's capability is satisfied."

⭐⭐ **Same shape as the errors this store keeps logging: the measurement was
performed correctly and the inference over it is false.** Cf.
[[project_12333_dev_null_output_path_tests]] ("true but irrelevant" — verified a
necessary condition, treated it as sufficient). Here the repro genuinely returns
333; what does not follow is that nesting fails to compose.

⚠️ **Consequence to watch, and why this is worth correcting rather than ignoring:**
the sentence invites a maintainer to go hunting for a second, non-existent
composition bug — and the filing spends a paragraph on it under a heading that
reads as a finding. It sits in a **public artifact a maintainer commissioned**, so
the cost is his time, not ours. Corrected via the fixer (footprint owner), not by
Main posting over it — [[feedback_tell_the_footprint_owner_when_you_post_yourself]],
[[feedback_dont_post_and_delegate_same_write]]. The two-capability case
(`-capability spvDescriptorHeapEXT+spvBindlessTextureNV`) is the one that would
actually probe composition and **was not run**.

## Relation to #12186 / #12185 — no coupling, approval intact

- The filing correctly asserts **no defect in #12186**: its `spvBindlessTextureNV`
  arm (`hlsl.meta.slang:27818-27831`) is an explicit `if`/`else` where both branches
  `return`, so nothing depends on fall-out. It also states it verified the arm still
  compiles clean under both capabilities.
- 🔒 **#12186 remains APPROVAL-LOCKED.** Main-verified live: `state: open`,
  `draft: false`, `merged: false`, head **`65338dbef9`**, `mergeable: true`,
  `mergeable_state: blocked`. pdeayton-nv review `4849248355` **APPROVED @
  `65338dbef9` = current head** ⇒ live, not stale. jkwak's `4858942075` (21:08Z)
  and the bot's `4859252992` (21:48Z) are both **COMMENTED**, so they do **not**
  disturb the approval. The bot's reply explicitly says it is holding off any push
  for that reason — correct.
- ⇒ **#12350 must not become a reason to push #12186.** Any commit dismisses
  pdeayton's approval. See [[project_12185_bindless_texture_nv_desc_handle_nonimage]]
  for the full lock, incl. its ⛔ **stale-replay tripwire**.
- jkwak's follow-up **`3716190293`** (21:07:33Z) restates the refactor csyonghe
  had in mind (inner switch on `T.kind`, then shared `if`/`else` below). That shape
  is *exactly* the one #12350 shows is currently inexpressible ⇒ the issue is the
  correct answer to that comment, and the refactor stays blocked until the
  semantics call lands.

## RESUME — ⛔ SUPERSEDED BY THE CLOSE, see the controlling block at top

*(Original: "a substantive human comment, or jkwak/csyonghe picking one of the three directions." That
arrived within 48 minutes — jkwak picked, by refusing. Kept to show the trigger fired as written.)*

**#12350 itself is TERMINAL. No fixer, no reopen, no post.** Direction 1 is rejected; the note about it
needing a `pr: breaking change` judgment is now moot.

**The one live thread out of this chain** is jkwak's diagnostic ask on the *second* case —
`r3716544275` on PR #12186, `isResolved: false`, evidence already posted at #12350 comment `5185295241`.
**RESUME on that = jkwak or csyonghe answering it on the PR thread** (warn on an unterminated non-empty
arm / require `break;` / implement fall-through — all three are language-design calls, so still no
unilateral fixer). ⚠️It is **not** a licence to push #12186: the approval is bound to `65338dbef9` and a
diagnostic change belongs in its own PR after the semantics call, not bolted onto an approved one.
If it goes quiet, the correct next artifact is a **fresh issue for the fall-off diagnostic** — jkwak asked
for a warning there and never withdrew it — but that is a filing decision, and per the
commissioned-filing test his 22:11 request *is* the invitation.

Lineage: [[project_12185_bindless_texture_nv_desc_handle_nonimage]] (parent PR
#12186) · [[project_12333_dev_null_output_path_tests]] (the commissioned-filing
test) · [[project_bot_comment_webhook_echo]].
