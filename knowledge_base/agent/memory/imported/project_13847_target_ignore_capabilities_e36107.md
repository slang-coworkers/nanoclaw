---
type: project
name: project_13847_target_ignore_capabilities_e36107
description: "HUMAN-OWNED, nothing dispatched (10-21 22:44Z). slang#13847 (albertrodriguezclo, external): IgnoreCapabilities in TargetDesc::compilerOptionEntries does not silence E36107, because validateEntryPoint reports it against linkage->m_optionSet (confirmed on master ffbd1771e5, slang-check-shader.cpp ~2588-2627). Author filed it with their own fix PR #13848 (fix/target-ignore-capabilities, reviewer dshreiner-nv). Touches our parked #13638 chain: the triager's comment 6193471137 says the per-target option does not help, which goes stale if #13848 merges."
---

# slang#13847: target-level `IgnoreCapabilities` does not silence E36107

**10-21 22:44:03Z `issue_opened`.** Main webhook session `sess-1792622645965-eher28`. Live read at ~22:46Z: open,
0 comments, no labels, body unchanged from the payload. github-actions auto-assigned skiminki-nv.

**Claim checked on master `ffbd1771e5`.** In `validateEntryPoint` (`source/slang/slang-check-shader.cpp`), the
`EntryPointUsesUnavailableCapability` diagnostic, `diagnoseMissingCapabilityProvenance` and the generic-struct
`SeeUsingOf`/`SeeDefinitionOf`/`SeeDeclarationOfModifier` notes all pass `linkage->m_optionSet` (~2588–2627). The
profile-upgrade warnings in the same loop pass `target->getOptionSet()` (~2691). The report is accurate.

**Ownership.** The author opened **PR #13848** 18 s after the issue ("Fixes #13847"). It is not a draft, and
dshreiner-nv is the requested reviewer. Assignees are the author and skiminki-nv. It changes `slang-check-shader.cpp`
(+8/−6) and adds `tools/slang-unit-test/unit-test-target-ignore-capabilities.cpp`, which tests four cases: no option,
the session option, the target option, and the option on one of two targets.

**Disposition: held, nothing dispatched or posted.** A human filed the issue together with their own fix PR, so a
bot triage or fix would duplicate their work. This is the same pattern as #13845/#13846, from the same author on
the same day ([project_13845_bitcast_fold_quiets_signaling_nan](project_13845_bitcast_fold_quiets_signaling_nan.md)).

**Link to our #13638 chain.** Our triage comment on #13638 (6193471137, 10-15) states: "Setting `IgnoreCapabilities`
per target, through `TargetDesc::compilerOptionEntries`, does **not** help. The check reads the session-level option
set." That is true on master. If #13848 merges, the statement becomes stale. #13638 itself stays open and parked on
the capability-system maintainers (A defer / B opt-in / C document). The owner is the slang-triager, session
`sess-1792070271261-svtzet`, with re-check task `system:tasks:i13638-recheck-e622`. #13848 does not decide that
question: the issue body says it is about which option set the check reads, not when the check runs.

**Timer:** one-shot task `13848-merge-recheck-9ccf` (process-after 2026-10-28T09:00Z) checks whether #13848 merged.

**Resume on:** a maintainer asking the bot to act on #13847/#13848; or **#13848 merging**. In that case, tell the
#13638 triager owner (thread `gh-issue-shader-slang/slang-13638`, pin the session above) that the per-target
workaround line in 6193471137 now works on master and needs a correction.
