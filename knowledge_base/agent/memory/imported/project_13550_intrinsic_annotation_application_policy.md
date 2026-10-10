---
type: project
name: project_13550_intrinsic_annotation_application_policy
description: "slang#13550 (kaizhangNV, 10-09, self-assigned, label document): should applications be allowed to use __intrinsic_type / __intrinsic_op, or should they be reserved for the core module? Maintainer team-policy question spun out of kaizhangNV/slang#24 -> held: NO dispatch, NO bot post. The issue's 'language reference' citation now lives in shader-slang/spec, not in slang."
---

# slang#13550: may applications use `__intrinsic_type` / `__intrinsic_op`?

**10-09 20:41Z, `issue_opened`.** Live read at ~20:43Z: open, human author `kaizhangNV`, self-assigned,
label `document`, 0 comments, `updated_at` 11 s after `created_at` (label edit), live body md5 matches the payload. Only my own
webhook session `sess-1791578496281-9rpon4` was on `gh-issue-shader-slang/slang-13550`. There was no task and
no conversation hit.

**Disposition: held. Nothing dispatched or posted.** This follows the #13498 / #13457 precedent
([[project_13498_breaking_change_label_policy]], [[project_13457_discord_moderation_policy]]). The body is a list of
"Questions for the team": core-only vs. unsupported-but-allowed, how to recognise trusted separately compiled std
modules, and what diagnostics or transition to use. Only maintainers can answer them. The filer self-assigned it,
nobody asked the bot for anything, and the issue says to do the doc/compiler alignment *after* the policy is agreed.

**Repo facts I checked** (slang master `08d419cbf2`, spec `d66b8df`, 10-09):
- The "should never be used directly by an application" sentence is no longer in slang. #13439 (10-07) moved the
  language reference to `shader-slang/spec`, and the sentence is now at
  `specification/introduction-language-evolution.md:84`. The issue links a pre-move fork commit. So "align the
  language reference" means a **spec-repo** PR.
- `docs/design/stdlib-intrinsics.md:136` (`##__intrinsic_type(op)`) is still in slang.
- `tests/language-feature/enums/strongly-typed-id.slang:15,20` uses `__intrinsic_type(UInt)` and `__intrinsic_op(0)`,
  as the issue says.
- The parser already has a core-module flag: `parser->options.isCoreModule` (`slang-parser.cpp:107`, set from
  `m_isCoreModuleCode` at :10310/:10339). That flag covers only core-module code, not separately compiled standard
  modules, which is the second team question. Both modifiers are registered with no gate (`:11159`, `:11173`).

I offered these as operator-only, not to GitHub.

**Resume** on a comment that @-mentions @nv-slang-bot (for example, asking for the doc/spec PR or the enforcement
change once the policy is agreed), or if the operator says to post the spec-move pointer. A mention arrives as a
webhook, so no re-chase timer is needed.
