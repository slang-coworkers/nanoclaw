---
name: PENDING operator decision — #11528 Gap C spirv-val token fix
description: Verified conformance bug in MERGED slang code (#11542); fixer parked; operator go/no-go on a follow-up fix PR outstanding
type: project
originSessionId: 43bedef2-9dcf-4531-bd2e-53b4b0a47e9b
---
shader-slang/slang#11528 (Support VK_KHR_shader_abort) shipped via merged PR #11542 (2026-06-16). jkwak-work's 2026-06-23 comment (just the `SPV_KHR_abort.asciidoc` spec link) is reference material, NOT a re-open — chain resolved, triager posted a verified GitHub verdict (issue comment 4784413276, HEAD-checked @ f1142612a).

**Gap C (verified by Main at claim-precision, 2026-06-23):** merged `source/slang/slang-emit-spirv.cpp` emits `OpExtension "SPV_KHR_shader_abort"` (1 occurrence; `shader_abort` is the *Vulkan* name), but the SPIR-V registry token / the exact spec jkwak linked is `SPV_KHR_abort` — 0 occurrences of the correct token in the file. A module declaring this extension would fail `spirv-val`. Fix = one-line token correction + a FileCheck/spirv-val test.

**State:** slang-fixer PARKED (triager won't dispatch without go). Operator go/no-go via `ask_user_question` TIMED OUT 2026-06-23 (~23:36Z, no response). Defaulted to Main's recommendation = HOLD.

**Why:** issue is closed/shipped and the human author (jkwak) is actively engaged — proactively opening a bot PR on his merged feature is a scope/courtesy call, not just a gated write. The gap is already publicly flagged on GitHub, so an active author can self-fix.

**How to apply:** do NOT re-dispatch the fixer for Gap C without an explicit operator go. If the operator returns and says fix-pr → relay to slang-fixer (draft PR, `gh pr ready`/merge stay gated) on thread `gh-issue-shader-slang/slang-11528`. If a substantive new comment lands (e.g. jkwak self-fixes or asks the bot to), re-evaluate on merits. The GitHub Gap C flag is the standing artifact meanwhile.
