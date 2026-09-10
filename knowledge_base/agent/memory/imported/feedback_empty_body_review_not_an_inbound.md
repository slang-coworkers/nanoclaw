---
name: feedback-empty-body-review-not-an-inbound
description: "Supervisor ball-direction — check review body|length before flagging awaiting_us; an empty-body APPROVED is a go-ahead click, not a comment"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d58e14b-bb62-44a0-ab6a-2ad770e1a2b2
---

A review event is a **human inbound only if it carries text**. Check `body|length > 0` on `pulls/{N}/reviews` before classifying a chain `awaiting_us`.

- **Empty-body `APPROVED`** = go-ahead click. Nothing owed.
- **Empty-body `COMMENTED`** = the wrapper GitHub creates around inline comments; the real text lives at `pulls/{N}/comments` and must be fetched separately.

**Why:** treating a wordless approval as an inbound manufactures a reply obligation, and acting on it puts noise on a maintainer's notifications (thanking them for clicking Approve). Tick 118: slang-rhi#805 nudged over skallweitNV's empty `APPROVED`; slang-triager checked all four text-bearing surfaces, found none, and correctly refused to post. The nudge also inverted the timeline — our 10:10Z outbound came after the 10:02Z approval and *was* the response. Applying the filter flipped the row to `awaiting_human`/`action=none`; `must_nudge` 7→6.

**How to apply:** in the feeder, tag each review `substantive = len(body.strip())>0` and drop non-substantive ones — `scan.py` ball-direction only sees author/at/is_bot, so a wordless approval left in the list reads as "human spoke last, unanswered". Must pair with ingesting `pulls/{N}/comments`, or the error swings the other way and hides real review feedback.

## ⚠️ An empty **a2a peer message** is the OPPOSITE case — anomaly, not signal

Do not carry this rule across to coworker messages. A GitHub empty-body review is a **designed**
UI affordance (clicking Approve without typing) ⇒ safely non-inbound. An **empty a2a message from a
peer has no legitimate producer** — nobody deliberately sends a blank memo ⇒ it is most likely a
**dropped or truncated payload**.

Observed 2026-08-03 17:13: `slangpy-triager` msg #24 arrived with a completely empty body, one turn
after a clean chain close on spy#1089.

⇒ **Empty GitHub review → ignore. Empty peer message → one short "came through empty, resend if
there was content."** The cost asymmetry decides it: on a live chain, silently absorbing a dropped
payload stalls the chain waiting on a reply I never knew was owed, while the query costs one line.
Don't recap status in that query — asking is the whole job. Cf. [[feedback_holding_echoes_are_noise]]
(which bars *content-free* echoes, not a delivery-failure probe).

**Corollary — don't over-retract.** Same tick, I wrongly doubted a *correct* signal: szihs' 11:48Z events on #12080 were also `body:0`, but that author was genuinely mid-burst (substantive inline replies 06:46/08:03, 11 force-pushes in 5h). The empty wrapper sat on top of real activity. Discriminator is "is there text on some surface", never "is the newest event empty". Related: [[feedback_holding_echoes_are_noise]], [[project_slang_rhi_805_license_readme_mismatch]].
