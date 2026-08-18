---
title: "slang#12054 SHIPPED: park-for-self-fix that flipped to maintainer-authorized bot draft — full lifecycle worked"
type: learning
topic: slang-compiler
source: learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md
---

# slang#12054 SHIPPED: park-for-self-fix that flipped to maintainer-authorized bot draft — full lifecycle worked

**Outcome (2026-07-13):** slang#12054 (MSVC Release+PDB disables /OPT:REF/ICF) MERGED via bot PR #12061, authored by nv-slang-bot, merged by maintainer @pdeayton-nv. Clean full lifecycle, no wasted cycle.

**The lifecycle that worked — a park is not a dead end:**
1. Triaged a well-scoped build/CMake fix by a CONTRIBUTOR who frequently self-fixes build issues → **parked at triaged, no bot fixer** (contributor-self-fix authorship-race guard, learning 1783416692832) + posted verified 5-bullet.
2. Author instead **@-mentioned the bot on the issue asking it to draft** ("please draft a PR for this. Make the fix for Release only...") — this is the explicit re-engage condition. The park correctly left that door open rather than force-dispatching.
3. Re-engaged: verified the authorization comment is real, posted "on it" ack, dispatched fixer with the maintainer's HARD constraints (scope + draft-only + report_pr_created).
4. Fixer opened draft PR; **maintainer flipped it ready himself + approved + merged**. Bot never merged or flipped ready — no-merge gate held throughout.

**Key process wins to repeat:**
- When a contributor self-fixer files a precise build issue, PARK don't dispatch — but keep the re-engage condition explicit ("maintainer asks bot to implement"). They often either self-fix OR delegate to the bot; parking serves both.
- A maintainer @-mention asking the bot to implement is FULL authorization to draft — no operator gate needed for the draft (only ready-flip/merge stay human).
- **Verify EVERY relayed state change live before forwarding upstream.** Caught the fixer's stale "held as DRAFT" (was actually maintainer-flipped-ready) AND a post-compaction "PR was never a draft" claim (timeline `ready_for_review` with no `convert_to_draft` proved it WAS a draft). Fixers that compact context mid-chain produce unreliable state narratives — the GitHub timeline is ground truth, not the fixer's memory.
- No "merged" comment on an auto-closed issue: the merged non-draft PR with `Fixes #N` IS the artifact; an extra issue comment is noise.

**Technical fix (reusable):** MSVC `/DEBUG` (from Release-PDB builds) flips `/OPT` defaults REF→NOREF, ICF→NOICF. Restore with `"$<$<CONFIG:Release>:/OPT:REF>"` + `"$<$<CONFIG:Release>:/OPT:ICF>"` co-located with the `/DEBUG` injection. Scope to `Release` ONLY (not RelWithDebInfo) because Release's CMake default carries `/INCREMENTAL:NO` while RelWithDebInfo's is `/INCREMENTAL`, and `/OPT:REF|ICF` under incremental linking = LNK4075.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md`_
