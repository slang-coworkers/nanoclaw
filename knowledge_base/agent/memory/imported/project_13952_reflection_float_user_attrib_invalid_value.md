---
type: project
name: project_13952_reflection_float_user_attrib_invalid_value
description: "HELD 10-26 17:53Z on maintainer direction: jhelferty-nv says folding float expressions across targets is complicated, @tangent-vector to comment. Draft PR #13953 @5511162cd by slang-fixer (sess-1792995246716-s93c3f), checker-side float folder; the folded value is stored in a dedicated serialized AST field. slang#13952 (Phillip-Bociu, external): reflection JSON userAttribs prints \"invalid value\" for a float attribute argument that is a constant expression (1.0 / 2.0) or a static const (FLOAT_VALUE); float literals and int expressions (INT_VALUE / 2) reflect correctly. Slang 2026.20, Windows."
---

# slang#13952: float user-attribute args reflect as "invalid value"

**10-26 06:05:47Z `issue_opened`.** Main webhook session `sess-1792994748635-jx8akq`, the only session on
`gh-issue-shader-slang/slang-13952`. Live read before dispatch: open, 0 comments, no labels, no assignee,
author_association NONE, body matches payload, empty timeline (no fix PR, no cross-reference).

**Report:** `[floatProbe(1, 1.0 / 2.0)]` and `[floatProbe(2, FLOAT_VALUE)]` (with
`static const float FLOAT_VALUE = 1.5`) emit `"invalid value"` in `-reflection-json` `userAttribs`;
`[floatProbe(0, 1.5)]` gives `1.500000`, `[intProbe(3, INT_VALUE / 2)]` gives `3`. So int constant folding
reaches attribute arguments and float folding does not.

**Routing:** human report with no owner → `slang-triager` on the canonical thread (rule 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)).

**10-26 06:08Z triager:** reports a repro on a local master build (both the `1.0 / 2.0` and `FLOAT_VALUE` cases print "invalid value"); it is tracing whether the checker or reflection owns the bug.

**10-26 06:13Z triage done** (memo saved in the triager's group; it was attached to msg 12): bug, P2, checker layer, not a regression, no
duplicate (related closed #5860 → PR #5888). Labels `reproduced` + Type=Bug. The bot triage comment was posted **06:14:31Z** (issuecomment-6409528587), 9 min after filing. That is current routing: the R6 gate PR nanoclaw#1993 is still a draft, as on #13916, so expect compliance-check to score it as an R6 FAIL. I read `comments: 0` at 06:13 and told the dashboard "no bot comment, per R6", which was wrong; I corrected it at 06:15. Lesson: a triager's [Triage] report can arrive before its GitHub post, so wait for the triager's final report before calling the GitHub artifact. I spot-checked the code on master 52e29ab43: `slang-check-modifier.cpp:1009-1024` folds only int/bool/enum params into
`intArgVals`, and float args stay `CheckTerm`+`coerce` exprs. `slang-reflection-api.cpp:375-399` reads only a bare
`FloatingPointLiteralExpr` or `ImplicitCastExpr(IntegerLiteralExpr)`. The triager handed off directly to slang-fixer, which has one
session on the canonical thread: `sess-1792995246716-s93c3f`.

**Watch at PR review:** approach A as written stores the folded value by rewriting `arg` into a synthetic
`FloatingPointLiteralExpr`. That is the CLAUDE.md "semantic-to-syntax reconstruction" red flag. The int sibling stores a semantic value
(`intArgVals`), and the memo already names the dedicated-field alternative as a judgment call. I did not message the fixer, because
its parent is the triager and messaging it would skip a tier. **06:14Z** the fixer claimed it (worktree `wt-slang-13952`, branch `fix/issue-13952`, Debug build) and pinged me directly, which opened a peer edge. I sent the storage note on that edge (in_reply_to 16) as advisory only.

**10-26 07:24Z draft PR #13953** "Fold floating-point user-attribute arguments for reflection", head 856185640, branch `fix/issue-13952`,
8 files (+183 in `slang-check-expr.cpp`, +5 in `slang-ast-modifier.h`). The `pr-mappings` row points to the fixer session. **Storage:**
a new serialized AST field, not a rewritten arg, which settles the watch item above. Full suite 11176/11179 on L40S. The 3 failures are
fp8 CUDA `INVALID_PTX`, the same known baseline as #13817/#13555/#13428 (fixer's receipts; I did not re-run them). The fixer posted
the draft status on the issue. **07:44Z fixer:** the field is `Attribute::floatArgVals`. CI run 40285591002 yielded at the priority
gate and waits on `falcor-ci`, the normal park for a bot draft (see #13771); it only needs operator action if it is still parked after the
ready-flip. slang-reviewer is reviewing (ETA ~90 min). **08:19Z R1 REQUEST_CHANGES** (slang-reviewer, three reviewers, reviewed 856185640). The reviewer sent the file to the fixer
(its session got an inbound at 08:19:52) and copied me. The repro and the new test pass. Must change: (1) bump
`k_min/k_maxSupportedModuleVersion` to 38 for the new FIDDLE field; the reviewer says a base-built `.slang-module` segfaults (rc=139) on the
head compiler. (2) Add a runtime operand-count check before `args[2]` in the `BuiltinOperatorExpr` arm. (3) Reword the "without wrapping"
comment; compound int operands give wrong values such as `(0u - 1u) / 2u` → 0.0, a bug that predates the PR (`BuiltinOperationIntVal::tryFoldImpl`
doesn't narrow), so file it separately. There are also test gaps (per-step rounding, spec-const/extern exclusions, E30002/E39999 diag tests) and
clarity items. R3 `true ? 1.0 : 2.0` is optional. These are the reviewer's findings; I did not re-verify them. **Next:** fixer revision → R2.

**08:41:42Z** the fixer filed must-change 3's producer bug as [slang#13954](project_13954_int_constant_fold_no_narrowing.md) (no fixer ordered).

Related reflection-JSON chain: [#12307](../project_12307_reflection_json_scope_representation.md).

**10-26 10:10–10:12Z:** the Fix Report at `0fa9fc615` reached me, not the triager, so I forwarded it. I asked the triager to check the disclosed "`float2` given `1` now reflects invalid value" against master. The triager confirmed on master `52e29ab43` that `[v2(1)]` reflects `1.0`, by accident: `slang-reflection-api.cpp:390-397` never checks the cast target. So it's a regression on working code. It went back to the fixer (msg 33): restore `1.0` with a pinning test and drop the disclosure. The label stays `pr: non-breaking`; `[floatProbe(1 / 0)]` still compiles after nit 1(a).
**10-26 10:36Z, triage resolved (fixed).** Draft #13953 is at `5511162cd`; the `[v2(1)]` regression is fixed and pinned by `[vectorProbe(1)]`. Label `pr: non-breaking`. PARKED on a maintainer: CI gate run 40307599399, review, mark ready.
**10-26 17:53:22Z maintainer comment, HELD.** jhelferty-nv (MEMBER) wrote on the issue
([issuecomment-6423398381](https://github.com/shader-slang/slang/issues/13952#issuecomment-6423398381)), verbatim: "Per internal
discussion, folding floating point expressions across targets is complicated. @tangent-vector to comment." It @-mentions a human,
not the bot, so it is not a summons (rule 5): no dispatch, no reaction, no post. The fixer is not told, because it is parked as a draft
and won't act. This puts the checker-side float folder (approach A) in question; tangent-vector will set the direction. Possible outcomes:
a reflection-only change, a target-aware fold, or not folding at all. Parked-register entry added to `supervisor-state.json`
`_meta.operator_decisions`; it also gates #13954. **Resume on:** tangent-vector's comment (the webhook comes to me; relay it verbatim to
the fixer on the canonical thread) or an @nv-slang-bot mention.
