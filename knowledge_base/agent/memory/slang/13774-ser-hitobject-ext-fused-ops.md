---
type: project
title: "slang#13774 — SER HitObject lacks spellings for EXT fused reorder/execute ops; PR #13785"
description: "Human issue (albertrodriguezclo): no Slang spelling for OpHitObjectTraceReorderExecuteEXT / OpHitObjectReorderExecuteShaderEXT. Chain pre-dates my records (reviewed draft PR #13785, peer APPROVE_WITH_NITS); 2026-11-17 base refresh merged (172 commits, head ad60f212064a, merge-only), CI re-dispatched into the bot-CI congestion, gated checks 17:50/20:50/23:50Z, ready-flip on the weekly list."
---

**Issue #13774** (albertrodriguezclo, human, open): SER `HitObject` has no spelling for the EXT fused
operations (`OpHitObjectTraceReorderExecuteEXT`, `OpHitObjectReorderExecuteShaderEXT`).

**Chain provenance note:** no prior record in my memory tree and no active session on the thread when
the 2026-11-17 report landed — the earlier chain history (draft PR #13785 @ reviewed head `7445767`,
peer-review APPROVE_WITH_NITS) lives on GitHub and in the fixer's group records. Recording state from
the 11-17 report onward.

**2026-11-17 14:48Z fixer [Report] — base refresh complete (Main-verified live).** Master (172
commits) merged clean into `fix/issue-13774` at head **`ad60f212064a`** (Main-checked: PR #13785 head
matches, open draft, `pr: non-breaking`, 4 files); diff vs master identical to the reviewed head →
merge-only change, APPROVE_WITH_NITS conclusions carry; explanation comment + issue status re-stamped
to the new head. CI re-dispatched — run **44106003672** (Main-checked: created 14:42:12Z, `waiting`,
no conclusion — the fleet-wide bot-CI congestion priority-yield pattern,
[ci-retry-yielded-bot-starved-by-waiting-runs](ci-retry-yielded-bot-starved-by-waiting-runs.md)).
**Next:** fixer's gated zero-token one-shot checks at 17:50 / 20:50 / 23:50 UTC report green (or
re-dispatch if the aging run cancels — yielded runs sit `waiting` on the falcor approval gate and
age out in ~2–3 h); ready-flip stays on the weekly undraft list. **Blocker:** CI runner-fleet
congestion only. (14:49Z re-send of the 14:48Z report was a duplicate; absorbed.)

Resume on: fixer report (CI green / re-dispatch), human review activity on PR #13785, or the weekly
undraft pass. Related family: #11997 HitObject ABI design (same subsystem, different chain).
