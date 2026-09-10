---
name: project_11990_iarray_subscript_64bit_pending
description: PENDING design —
metadata: 
  node_type: memory
  type: project
  originSessionId: bfbc97e5-7214-49f0-b658-32e0cd79fe6a
---

**#11990** (shader-slang/slang) — bot-filed (`nv-slang-bot[bot]`) follow-up design-decision issue, opened 2026-07-08. This is the tracked root-cause issue Main directed the fixer to file off the #11967 chain. See [[project_11967_64bit_indexing_e2e]].

**The defect:** `IArray<T>`/`IRWArray<T>` interface requirement is `__subscript(int index)` (hardcoded 32-bit) in core.meta.slang. A `uint64_t` index routed through a generic `IArray`/`IRWArray` constraint is `intCast(UInt64)→Int` **truncated at the interface boundary** (warning 30081). Direct concrete-buffer subscript (`RWStructuredBuffer<int>` by `uint64_t`) is **unaffected** — those subscripts are already `__generic<TIndex : __BuiltinIntegerType>`.

**Why niche:** actual miscompute needs BOTH (1) index ≥ 2³² (>8 GB device buffer) AND (2) access through a generic `IArray`/`IRWArray` constraint. Common direct-indexing case is fine.

**The open question (maintainer call):** widen the requirement to `__generic<TIndex : __BuiltinIntegerType> __subscript(TIndex)` — accepting the conformance/witness-synthesis surgery that **E38100** proves is required (magic types Array/vector/matrix don't synthesize a witness for a *generic* subscript requirement) — OR leave the interface-path 32-bit limit as-is (documented). @skiminki-nv already flagged hesitation about widening; the E38100 cascade confirms it.

**MAINTAINER-AUTHORIZED FIX 2026-07-17 — two maintainers converge; parked-hold lifted. Three comments, chronological order:**
1. @jkwak-work (comment **4994802153**, EARLIEST): *"Assigning to @jvepsalainen-nv because this issue came from the other issue he is assigned to (#11967)."* → **human owner/assignee = @jvepsalainen-nv** (he owns parent #11967).
2. @jkwak-work (comment 4994951012): *"@nv-slang-bot, please triage and make a PR for this issue."* → explicit authorization for the bot to implement + open a PR.
3. @csyonghe (comment 4996524046, LATEST): went "go" on the widen + proposed the E38100 workaround (below).
- **Reconciled read:** bot does the mechanical PR (explicitly directed); jvepsalainen-nv is the assigned human owner/reviewer (attribution grouping, not "he'll write it himself"). NOT a clean stand-down — jvepsalainen was *assigned by jkwak*, didn't self-assign. But fixer MUST loop jvepsalainen-nv in and **defer if he signals he's taking it personally** (avoid colliding with the assigned human). [[feedback_deadpromise_check_assignee_before_rewake]]
- Fixer keeps normal draft discipline — "make a PR" authorizes implementation/PR-open, NOT an auto-non-draft flip. [[feedback_drafts_only_guardrail]]

**RE-OPENED 2026-07-17 — maintainer @csyonghe went "go" + proposed E38100 workaround.** Comment 4996524046 on #11990: *"I think it makes sense to broaden the `IArray` definition to use a generic subscript operator. The question is why do we need to rely on witness synthesis? It seems to me that you can easily declare that conforming method on the array/vector types directly in core.meta.slang to satisfy this new interface requirement, without needing to extend any synthesis logic."*
- **Design decision resolved: WIDEN (Approach A).** csyonghe green-lit broadening IArray/IRWArray subscript to generic `TIndex`.
- **Maintainer challenges the E38100-blocker premise.** His claim: no witness-synthesis surgery needed — just declare explicit conforming `__subscript` on the magic types (Array/vector/matrix) in core.meta.slang to satisfy the widened requirement. This directly contests the fixer's empirical "E38100 = needs core synthesis change" finding.
- **Routed to slang-triager** on canonical thread `gh-issue-shader-slang/slang-11990` (2026-07-17). Triager owns the #11967/#11990 peer-wire → forwards fixer to **empirically test csyonghe's approach**: does explicit conformance on magic types satisfy the widened generic IArray requirement WITHOUT synthesis-logic changes / E38100? Fixer replies to csyonghe on GitHub with the finding (closest-to-the-state). If it works → implement widen, which also removes the #11967-documented limitation.
- **Do NOT reach past triager to fixer** — direct-edges-only, double-dispatch risk. [[feedback_no_double_dispatch_peer_wired]]

**DISPATCHED to fixer 2026-07-17 06:26Z** (triager report). Verified at `origin/master` HEAD `5c30d437f`:
- **Root cause confirmed:** `Array`/`vector`/`matrix` (core.meta.slang:2264/2274/2303) declare NO explicit `__subscript` — only `getCount()` → subscript witness is **synthesized** → that's the E38100 (`type-doesnt-implement-interface-requirement`) the earlier widen build hit. csyonghe's "declare the conforming method directly on the magic types" is exactly the sidestep.
- **Template to mirror:** hlsl.meta.slang:6013 (already-generic StructuredBuffer subscript).

**HELD for maintainer design call 2026-07-17 08:42Z** (fixer→triager [Triage Resolution]). Empirical gate = **nuanced NO** — csyonghe right on the narrow point, wrong on blast radius:
- ✅ Explicit conforming `__subscript` on Array/vector/matrix **compiles clean, no E38100** — csyonghe's sidestep works for the 3 magic types.
- ❌ But widening the shared *requirement* cascades past stdlib into compiler-core + autodiff:
  - (B) bootstrap `foundParent` assert in RWStructuredBuffer witness synth → **fixer fixed** (localized decl-ref-normalization)
  - (C) E38105 CoopMat/CoopVec → (D) E30019 their helpers →
  - (E) **TERMINAL E39999** ambiguous `operator[]` in CoopVec autodiff fwd_diff/bwd_diff — CoopVec's own generic subscript collides with the inherited IArray generic subscript. = overload-resolution / autodiff **design** = maintainer territory.
- **GitHub artifact (VERIFIED):** fixer posted full cascade evidence + hold to csyonghe + @jvepsalainen-nv → issue comment **5000664595**, nv-slang-bot 08:23:45Z.
- **Prototype:** commit `660ae42623` on `fix/issue-11990`, **UNPUSHED** (~80%, only E39999 remains) — doesn't compile past E39999, so no draft PR (non-building branch = noise). codex PLAN+CODE+OUTPUT approve; peer review skipped (no compiling artifact).
- **Auth:** triager's `gh` **RECOVERED** (successful REST comment POST verified) — 401 watch stands down FOR THIS CHAIN. Do NOT mark fleet-wide [[project_github_actions_graphql_401_outage]] resolved: one REST POST ≠ GraphQL/actions-write recovery, and premature-"recovered" burn history on this exact outage.
- **Next human action:** csyonghe/jvepsalainen steer on the CoopVec autodiff `operator[]` ambiguity. Fixer will NOT re-dispatch as a build task until the design call lands; fixer owns any further GitHub reply (closest-to-the-state). **RE-OPEN on the maintainers' response.** [[feedback_reopen_not_release_parked_feature]]

**Chain discipline (historical):**
- Author of `issue_opened` was our own bot → that was a **footprint echo, not a routing inbound**. [[project_bot_comment_webhook_echo]]
- Was parked (no maintainer go); csyonghe's comment is the substantive **human** re-engagement trigger. [[feedback_reopen_not_release_parked_feature]]
- #11967 (E2E test re-pinning the interface path to current truncating behavior + documenting this limit, draft PR `Closes #11967`) is the separate in-flight fix chain — still awaiting fixer's [Fix Report]. If the widen lands via #11990, #11967's documented-limitation comment must be updated to "fixed".
