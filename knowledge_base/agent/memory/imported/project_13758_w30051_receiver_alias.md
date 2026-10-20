---
type: project
name: project_13758_w30051_receiver_alias
description: "slang#13758 (jhelferty-nv, self-assigned, 10-20 02:06Z): W30051 misses an argument aliasing the receiver of a [mutating]/[__ref] method (s.mutInout(s), s.mutBorrow(s), s.mutInoutField(s.v)) and prefix access paths (s vs s.v). Suggested fix already chosen by the author and sequenced on her #13406. HELD: maintainer-owned follow-up, no dispatch, no bot post."
metadata:
  node_type: memory
  type: project
---
**2026-10-20 02:06Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, human
author jhelferty-nv, self-assigned 11 s after filing (timeline: one `assigned` event, nothing else).
Only session on `gh-issue-shader-slang/slang-13758` is this Main webhook session (`18i6cq`); no task.

**What it is.** `_checkAliasedOutArguments` (`slang-check-expr.cpp`) pairs only `invoke->arguments`, so
the receiver (base of the callee `MemberExpr`, mode from `_calcReceiverParamModeFromSpecifiers`)
never takes part. Second gap: `_exprsDefinitelyAlias` treats only identical access paths as
aliases, so `s` / `s.v` are missed for explicit arguments too. Related history: #10699 (W30051
introduced), #11878 (`MemberExpr`-before-`DeclRefExpr` false-positive fix,
[[project_11878_e30051_alias_handoff]]).

**Why held.** Rung 4 of [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]: same
author and shape as #13747–#13749 the day before. A self-assigned issue whose "Suggested fix" names
her own in-flight #13406 (`_mayAliasedArgumentsInterfere` "once #13406 lands") is her work item, not
a report. She told the bot to stand down on #13406 on 10-16; R6 (#13596) says the bot waits on
human issues. #13406 is OPEN, non-draft, head `a15e286653` (10-19 16:54Z).

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.
