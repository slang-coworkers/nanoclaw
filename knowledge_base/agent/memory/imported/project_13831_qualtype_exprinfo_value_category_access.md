---
type: project
name: project_13831_qualtype_exprinfo_value_category_access
description: "slang#13831 (jhelferty-nv, self-assigned, 10-21 21:06Z): replace QualType's isLeftValue/isReadOnlyMemoryLocation/isWriteOnly/hasReadOnlyOnTarget flags with an ExprInfo {value category, access}, so a non-adjacent swizzle (v.xz) fails __ref in the front end regardless of base access. Design follow-up of her #13406 (isReadOnlyMemoryLocation + its TODO exist only on #13406 head afcc361ae6). Held 10-21; #13406 MERGED 10-22 08:47Z; milestoned Q4 2026 10-23. 10-29 11:33Z operator asked for triage -> slang-triager verdict 11:41Z: enhancement/low/P3, all 6 stage claims reproduce; parked on the author, nothing posted. Sibling #13837 held by Main k1g05q."
metadata:
  node_type: memory
  type: project
---
**2026-10-21 21:06Z, `issue_opened`.** Live read 21:1xZ: OPEN, 0 comments, MEMBER author jhelferty-nv,
self-assigned at 21:06:47Z (timeline actor = herself), no labels. Only cross-reference is her own sibling
#13837 (filed 6 s later). Only session on `gh-issue-shader-slang/slang-13831` is this Main webhook
session `rcxq4l`.

**Claims checked locally** (master `aeca046bfa`, #13406 head `afcc361ae6`):
- master's `QualType` has `isLeftValue`, `hasReadOnlyOnTarget`, `isWriteOnly`
  (`slang-ast-support-types.h:634-636`); `isReadOnlyMemoryLocation` and the `ExprInfo` TODO
  (`:643-656`) exist only on #13406's head. So the work starts from #13406, not master.
- `CheckSwizzleExpr` is at `slang-check-expr.cpp:8699` / `:8813` on #13406's head.

**Disposition: held. Nothing dispatched or posted.** Same pattern as
[[project_13747_remove_unused_setfunctypeintorequirementdecl]] and [[project_13758_w30051_receiver_alias]]:
maintainer self-filed + self-assigned design follow-up to her own #13406, where she told the bot to stand
down (10-16, issuecomment-6224584448; see `memory/slang/11709-13406-ref-split-review-rounds.md`). It bumps the
module version (serialized fields) and would race her open PR.

Sibling #13837 (front-end E30119 check for `__ref_writeonly` reads) is held by Main `k1g05q`, which reported
the batch and logged both in [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new_case_log]].

**Resume** only on a comment that @-mentions @nv-slang-bot (arrives as a webhook; no timer needed) or an
operator ask.

## 2026-10-29: hold lifted by an operator ask

- Operator (dashboard msg 48, 11:33Z, part of a bulk batch of ~8 "New issue to triage" asks) asked:
  "Triage subsystem + severity + next step. Report back with your verdict on the canonical thread."
- Live read: still OPEN, 0 comments, assignee jhelferty-nv, milestone **Q4 2026 (Fall)** (set by her
  10-23 20:46Z). #13406 **merged 10-22 08:47Z**, so `isReadOnlyMemoryLocation` and the `ExprInfo` TODO are
  now on master (`01dcd35682`, `slang-ast-support-types.h:652-656`). jkiviluoto-nv referenced the issue
  from a fork commit 10-22 (`0bd71cd709`; the fork API gave 401, content unread).
- Dispatched slang-triager on `gh-issue-shader-slang/slang-13831`, **read-only, no GitHub post** (no
  `<github-post-authorized />`): maintainer-owned + milestoned, and a bot triage comment on her own design
  issue is noise (R6, #13596). Verdict goes to the operator on the dashboard thread; a GitHub post only if
  the operator asks for one.
- **11:41Z triage verdict** (slang-triager, memo `groups/slang-triager/memory/issues/triage-13831.md`):
  enhancement / low / frontend + AST serialization / P3. All 6 stage claims reproduce on `01dcd35682`
  (`__ref_readonly` also needs `-experimental-feature`). Module version bump 37/37 -> 38/38 confirmed.
  Extra case the issue doesn't list: a property with a setter passed to `__ref` moves E40008 -> E30047.
  Recommended: staged split (PR1 enums + legacy accessors, version bump; PR2 checks + tests). #13837 and
  #13833 change the same code. I spot-checked `CheckSwizzleExpr` (:8797), the ref-arg check (:4432) and
  `slang-ir.h:2254-2255` on master. **Parked on jhelferty-nv; nothing posted.** A GitHub post only on an operator ask.
