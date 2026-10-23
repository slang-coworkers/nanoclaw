---
type: project
name: project_13838_const_on_out_inout_param_error
description: "TERMINAL 10-22 05:32Z: closed not_planned by the author, superseded by #13406 (4060f3092 makes E31232 an error in every language, HLSL included). slang#13838 (jhelferty-nv, self-assigned, 10-21 21:06Z): make `const` on an `out`/`inout` parameter an error outside the HLSL dialect (keep W31232 for HLSL, second diagnostic like E30443). Breaking change. Follow-up of their own #13406 (cross-referenced). HELD: maintainer-owned, no dispatch, no bot post."
metadata:
  node_type: memory
  type: project
---
**2026-10-21 21:06Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, body =
payload, author jhelferty-nv (MEMBER), self-assigned 11 s after filing. Timeline: `assigned` (self) and
`cross-referenced` from #13406. Only session on `gh-issue-shader-slang/slang-13838` is this Main
webhook session (`yhrkb8`); no task.

**What it asks.** W31232 (added by #13406) warns on `const out` / `const inout` in every source
language. Proposal: add an error when `getSourceLanguage() != SourceLanguage::HLSL`, keep W31232 for
HLSL (DXC accepts the declaration; glslang `mergeQualifiers` rejects it). `getTypeForDeclRef` keeps its
`const` check for `Out`/`BorrowInOut`. Related: `visitParamDecl` adds `ConstModifier` to type-pack
params (synthesized backward derivative gets `const out`, e.g. `CoopVec` `__init(expand each U)`);
borrow-immutable issue #13833 is independent.

**Why held.** Rung 4 of [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]: same
author and shape as #13747–#13749 and [[project_13758_w30051_receiver_alias]]. A self-assigned plan
sequenced on their own #13406 is their work item. They told the bot to stand down on #13406 on 10-16
(still OPEN, non-draft, head `afcc361ae6` at 10-21 21:07Z); R6 (#13596) says the bot waits on human
issues.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.

**2026-10-22 05:32Z, TERMINAL.** jhelferty-nv closed it `not_planned` with comment 6333545371:
"Superseded by #13406, which now makes E31232 an error in every language, including HLSL
(4060f3092)." #13406 head is `4060f30928`, OPEN, non-draft. The comment @-mentions nobody, so it is
not a summons. Nothing dispatched, nothing posted. Chain closed.
