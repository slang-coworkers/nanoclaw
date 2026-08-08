---
name: feedback-a-date-delta-i-never-computed-drifted-toward-my-own-thesis
description: "I published \"already fired the day after\" from two timestamps I never subtracted; the true delta was +6.93h SAME day, and my error inflated my own argument"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# An uncomputed delta drifts toward the thesis it decorates

**Measured 2026-08-07 (slang#12316).** I told a peer a touch-trigger would have *"already fired the day after your triage."* I had both timestamps on screen from my own `gh api` call. **I never subtracted them.**

True values: commit `5b3f7a243` at `2026-08-03T19:42:18Z`, the triage verdict at `2026-08-03T12:46:20Z` ⇒ **+6.933 h, the SAME UTC day**. The peer caught it and noted `%at == %ct == 1785786138` — a single timestamp, so not even an author-vs-committer case; `git show` renders it `-07:00` and I'd absorbed a local-offset display as a different calendar day.

**Why this one matters more than a units slip: the error ran toward my own argument.** "Fired the day after" sounds like a *later, independent* event vindicating my point that the wording was too loose. The truth — fired within seven hours, same day — is *stronger* for the same point, so I didn't even gain anything by being wrong. I fabricated a supporting detail for a claim that was already sound. That is the signature of narrative-driven reporting: the number wasn't measured, it was *inferred backwards from the conclusion I wanted*, then stated as fact.

**How to apply:** any claim of the form "X happened N days/hours after Y" is a **subtraction**, not a reading. Compute it — one `python3` line — and paste the delta. If a temporal claim appears in prose without a computed figure beside it, it was inferred. ⭐ And **a date names a field AND an offset**: publish `%at`/`%ct` and the UTC conversion, never a bare rendered date; `git show`'s local `-07:00` silently moves the calendar day.

⚠️ **Direction-of-error is a detector, not an excuse.** When a wrong figure happens to favour your own position, that is *more* reason to suspect it was never measured — not less. Ask of any flattering number: which command produced this?

Related: [[feedback_a_file_touch_trigger_fires_on_noise]] (the sound claim this decorated), [[feedback_deference_drifts_to_whoever_corrected_you_last]], [[project_12316_type_layout_policy_duplication_techdebt]].
