---
type: project
name: project_13747_remove_unused_setfunctypeintorequirementdecl
description: "slang#13747 (jhelferty-nv, self-assigned, 10-19 15:47Z): delete dead SemanticsDeclHeaderVisitor::setFuncTypeIntoRequirementDecl (no callers since #9808) + its only-user helper addModifiersForParamPassingMode once #13406 lands. HELD: maintainer-owned follow-up of her own #13406 (where she told the bot to stand down 10-16). No dispatch, no post."
metadata:
  node_type: memory
  type: project
---
**2026-10-19 15:4xZ, `issue_opened`.** Live read: OPEN, 0 comments, human author jhelferty-nv,
self-assigned (timeline: two `assigned` events, no cross-references), no labels, live body = payload.
Only session on `gh-issue-shader-slang/slang-13747` is this Main webhook session.

**Claims checked locally:**
- master: `setFuncTypeIntoRequirementDecl` appears only as the declaration (`slang-check-decl.cpp:796`)
  and the definition (`:15417`). No callers. `addModifiersForParamPassingMode` does not exist on master.
- #13406 head `956342d873` (her commit, 10-15): the helper is defined at `:7632` and its **only** call is
  inside `setFuncTypeIntoRequirementDecl` (`:15517`). The bot's 10-02 note that synthesis also used the
  helper no longer holds at her head; so the issue's "only it uses" is right.

**Disposition: held. Nothing dispatched or posted.** Same pattern as
[[project_13498_breaking_change_label_policy]]: maintainer self-filed + self-assigned, nobody asked the bot.
It is also a sequenced follow-up to #13406, which she took over (10-14) and on which she posted
"@nv-slang-bot stand down" (10-16, issuecomment-6224584448) — see
`memory/slang/11709-13406-ref-split-review-rounds.md`. A bot PR here would race her own cleanup.

**Resume** only on a comment that @-mentions @nv-slang-bot (arrives as a webhook; no timer needed).
