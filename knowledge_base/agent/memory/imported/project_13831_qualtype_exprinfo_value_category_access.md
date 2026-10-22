---
type: project
name: project_13831_qualtype_exprinfo_value_category_access
description: "slang#13831 (jhelferty-nv, self-assigned, 10-21 21:06Z): replace QualType's isLeftValue/isReadOnlyMemoryLocation/isWriteOnly/hasReadOnlyOnTarget flags with an ExprInfo {value category, access}, so a non-adjacent swizzle (v.xz) fails __ref in the front end regardless of base access. Design follow-up of her #13406 (isReadOnlyMemoryLocation + its TODO exist only on #13406 head afcc361ae6). HELD: no dispatch, no bot post. Sibling #13837 held by Main k1g05q."
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
