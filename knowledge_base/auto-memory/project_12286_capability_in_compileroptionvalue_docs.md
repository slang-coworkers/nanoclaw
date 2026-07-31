---
name: project_12286_capability_in_compileroptionvalue_docs
description: "slang#12286 — how to specify a capability via CompilerOptionValue; docs/API-discoverability, answered"
metadata: 
  node_type: memory
  type: project
  originSessionId: 83554de5-347a-4a1b-bc4d-2628602d8e21
---

# #12286 — Unclear how to specify a capability in CompilerOptionValue

**Repo:** shader-slang/slang · **Reporter:** fixgoats (assoc NONE, external) · **thread:** gh-issue-shader-slang/slang-12286
**Class:** documentation / API-discoverability · **Severity:** low / P3 · **Not a dup** of #12257 / #12205.

**Problem:** User wants to declare a capability (`spvGroupNonUniformArithmetic`) via the
compilation API to suppress the "shader needs X" warning. slang.h doc comment for
`CompilerOptionName::Capability` says `intValue0` encodes a `CapabilityName` enum value —
but that enum is internal and not shipped in the Vulkan SDK, so users can't find the int.

**Answer (triager, VERIFIED @HEAD 7c58a326b):** No code change needed — a STRING-name path
already exists. Set `entry.value.kind = String; entry.value.stringValue0 = "spvGroupNonUniformArithmetic"`.
Consumed at `TargetRequest::getTargetCaps()` (slang-target.cpp:224) via `findCapabilityName()`.
Or resolve the int at runtime via the PUBLIC `IGlobalSession::findCapability(name)` (slang.h:4192).
Already documented for `vk_mem_model` in docs/user-guide/a2-01-spirv-target-specific.md:17-28.

**Recommended = Approach A:** post the string recipe as the answer (user's preferred no-code
outcome) + optional small doc clarification (slang.h:~1023 comment is misleading; comment-only
= non-breaking). Rejected B (ship `CapabilityName` publicly — ints are version-unstable by design).

**State (2026-07-30):** ANSWERED + docs-fix DRAFTED. Triager posted answer 5-bullet on issue
(refreshed in place to point at PR). Fixer opened **draft PR #12287** (`Closes #12286`,
`pr: non-breaking`, base master, MERGEABLE). Triager reviewed APPROVE (codex + self re-verify:
string path slang-target.cpp:223→findCapabilityName; findCapability slang.h:4186; atom real
capdef:822).

**SCOPE CORRECTION (2026-07-30 15:29):** maintainer **jkwak-work** (PR inline r3683967248)
asked to NOT touch include/slang.h — "not a user-facing document." Fixer reverted the header
(commit `d06fb113e5`). PR #12287 is now **docs-only, +2/−0**, sole file
`docs/user-guide/a2-01-spirv-target-specific.md` (one clarifying paragraph beside the
vk_mem_model example); slang.h byte-identical to base. Prior APPROVE still holds (surviving
paragraph was part of approved diff; codex re-approved reduced diff). Triager refreshed #12286
comment in place → docs-only scope + rationale. The earlier `SlangCapabilityID`-vs-
`CapabilityName` header-comment nit is now MOOT (header reverted). Chain HOLDS at
"docs-only fix in draft, held pending review"; drafts-only guardrail respected.

**Latent aside (NOT this fix, unverified):** slang-options.cpp:4584 CLI OptionsParser reads
`atom.intValue` ignoring `kind` — String-kind Capability via that CLI path would register ID 0;
does NOT affect the API path. Candidate for a separate issue if confirmed.

**RESOLVED via reporter self-fix (2026-07-30 18:17Z) — CHAIN CLOSED.** Maintainer jkwak-work
CLOSED our draft PR #12287 (mergedAt=null) in favor of a PR the ORIGINAL REPORTER wrote:
@fixgoats opened **PR #12295** ("Clarify how to set capabilities in the user guide",
`Closes #12286`, non-breaking, ready-for-review, +1/−1 in docs/user-guide/08-compiling.md).
Our triage answer + fixer's PR were the catalyst; reporter's own PR is the surviving artifact.
Triager refreshed #12286 comment in place → thanks reporter, points at #12295, dropped closed
#12287. Verdict unchanged and correct (string-name path / findCapability, docs-only). Fixer
stood down + cleaned up worktree/sentinel.

**Resume / next human action:** review + merge **PR #12295** (fixgoats; OP-gated; issue
auto-closes on merge). Nothing bot-side pending. Substantive human reply re-opens.
Related: [[project_12257_compileroptionname_serialization_audit]], [[project_12205_capability_aggregation_doc]].
