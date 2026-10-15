---
type: project
name: project_13621_language_name_support_buckets
description: "slang#13621 (skiminki-nv, 10-14, self-assigned, label 'slang 202c'): classify every keyword/modifier/attribute/__-prefixed core decl as public / experimental / built-in-modules-only, with one enforcement source of truth. Maintainer-owned policy umbrella over #9055, #12547, #13550 -> held: NO dispatch, NO bot post."
---

# slang#13621: public / experimental / built-in-only buckets for language names

**10-14 09:22Z, `issue_opened`.** Live read at about 09:25Z showed: open, human author **skiminki-nv**, self-assigned
09:22:16Z, labeled `slang 202c` by the author at 09:22:28Z, 0 comments, no body edits. The 10,151-char body is the
same as the payload. Only my webhook session `sess-1791969727052-m6fxyk` was on `gh-issue-shader-slang/slang-13621`.
There was no task, no memory hit and no conversation hit.

**Disposition: held, nothing dispatched or posted.** This is the same class as #13550
([[project_13550_intrinsic_annotation_application_policy]]) and the #13591 batch
([[project_13591_ai_contributor_standards_batch]]). A maintainer filed a language-policy proposal, assigned it to
themselves, and tied it to the 202c language version. It asks the team three open questions: what counts as a
built-in module, whether a deprecated `__` alias is enough, and whether to use one experimental switch or one per
feature. The bot was asked for nothing. Step 1 (inventory) and the per-name issues are maintainer work, and a bot
triage comment on a 10 KB proposal would only add noise.

**Related issue states, 10-14:** #9055 open (jhelferty-nv, unassigned) · #12547 open (assigned to tangent-vector) ·
#13550 open, held by us · #13374 open (our bot filed it, assigned to jkwak-work) · #11129 closed (skiminki-nv, the
deprecation process).

**Code anchors I checked** (slang master `3fa2aa09c8`, 10-14). The issue's citations all hold:
- `g_parseSyntaxEntries` is at `slang-parser.cpp:11042`.
- `BuiltinOnlyModifierOnNonCoreDecl` is at `slang-check-modifier.cpp:1966`. The "`__intrinsic_type` … is valid user
  syntax" comment it mentions is at `:1960`.
- `FuncExtensionRequiresExperimentalFeature` is at `slang-check-decl.cpp:17101`, and
  `ApplyForBwdRequiresExperimentalFeature` is at `slang-check-expr.cpp:6280`.
- The issue says there are 120 `attribute_syntax` declarations. I count 110 in core, 8 in diff and 2 in hlsl, which is
  also 120.

**Resume** only on a comment that @-mentions @nv-slang-bot (for example, asking for the step-1 inventory table or a
per-name sub-issue), or on an operator ask. A mention arrives as a webhook, so no re-chase timer is needed.
