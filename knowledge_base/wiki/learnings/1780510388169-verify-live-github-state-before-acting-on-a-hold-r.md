---
title: "Verify live GitHub state before acting on a 'hold/revert/change-posture' instruction — instructions can be stale"
type: learning
topic: verification
source: learnings/1780510388169-verify-live-github-state-before-acting-on-a-hold-r.md
---

# Verify live GitHub state before acting on a "hold/revert/change-posture" instruction — instructions can be stale

## Context
In shader-slang/slang#11410, the orchestrator sent a "change of posture" instruction (~36h after the fact): "hold the publish, do NOT put the operator card up yet, keep branch `fix/issue-11410`, do NOT use `dev/slang-fixer/*`." But the draft PR (#11422) had **already been opened** ~36h earlier on `dev/slang-fixer/issue-11410` — per the orchestrator's own *earlier* (msg 74) branch-name guidance, which msg 90 then reversed. The instruction's mental model was stale (pre-publish), reality was post-publish.

## Lesson
When a parent/peer instruction conflicts with what you last observed — **especially a "hold / stop / revert / don't-do-X" instruction that could post-date a terminal action (PR opened, push done, comment posted)** — do NOT act on it blindly ("ok, holding"). First verify the **live external state** read-only (`gh pr view <n> --json state,isDraft,headRefName,url`; `gh issue view <n> --json comments`), then surface the discrepancy with concrete facts and let the sender reconcile. Trust observed state over a possibly-stale instruction (Truthfulness invariant: "if a recalled memory/instruction conflicts with current information, trust what you observe now").

Here, verifying showed #11422 open/draft on the flagged branch + a maintainer comment already on the issue. Surfacing that (not papering over it) let the orchestrator independently re-verify and reconcile to "leave it open, branch is harmless."

## Secondary note: cross-instance branch conventions
`dev/slang-fixer/*` is the **prod** instance's branch convention; the **dev** instance uses `fix/issue-*`. A mismatch is NOT automatically a real collision — confirm (search for a duplicate PR/branch) before treating it as one. In #11410 it was cosmetic (no duplicate existed), so no rename/close was warranted. Don't take destructive action (close/rename/force-push) on a cosmetic concern.

## Also reaffirmed
Peer-reply routing pattern works correctly: reply to a peer/operator who pinged you with `in_reply_to=<their-msg-id>` and **no explicit `to`** — it routes on that peer's edge ("Message sent to (current conversation)"). A buddy-monitor flagging this as an invalid `to=?` is a false positive; round-trip replies confirm delivery.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1780510388169-verify-live-github-state-before-acting-on-a-hold-r.md`_
