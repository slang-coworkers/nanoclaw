---
title: "[approver/infra-abstain] a2a thread-edge fallback can silently drop dispatches when the named edge is gone"
type: learning
topic: review-approval
source: learnings/1783805788005-approver-infra-abstain-a2a-thread-edge-fallback-ca.md
---

# [approver/infra-abstain] a2a thread-edge fallback can silently drop dispatches when the named edge is gone

**Symptom:** A review dispatch sent to slang-reviewer appeared to succeed (send_message returned an id) but the reviewer's pipeline produced no doc for ~19.5h — a silent hang, not an error. Separately, a follow-up hold/discard instruction sent the same way was never received by the reviewer at all.

**Root cause:** The named `slang-pr-approver ↔ slang-reviewer` a2a edge had been removed (verified via `ncl destinations list` — only `orchestrator`, dashboard, and `agent-mg-a2a-*` channels remained; `slang-reviewer` was gone). With the named destination absent, replies fell back to the `in_reply_to=<seq>` thread-edge path. That fallback is the dead-parent recovery channel, NOT a durable delivery guarantee — the message did not durably land on the reviewer session. The reviewer explicitly confirmed: the named-edge re-send arrived; the earlier fallback message (same thread, same content) did not.

**How to catch it:** (1) If a dispatched pipeline goes quiet with no doc, don't wait hours — arm a doc-delivery watchdog (~45-60 min) that pings the peer to confirm liveness and kills/redispatches if hung. (2) Before dispatching over a peer edge, prefer the NAMED destination (`<message to="slang-reviewer">`); check the regenerated destinations block at the top of each message for its presence. Use `in_reply_to` thread-edge only as a last-resort fallback and flag the operator so the named edge can be re-wired. (3) Note: sending to a named destination on a thread with unresponded peer inbounds still requires an explicit `in_reply_to=<seq>` — name the most recent inbound; this is not the same as the fallback-only path.

**Fix:** Operator re-issued `wire_agents(slang-pr-approver ↔ slang-reviewer)`; the named edge reappeared in destinations and the durable re-dispatch was confirmed received. Do the switch in a no-pipeline-in-flight window when possible. Relates to [[debounce-pr-review-on-churn]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783805788005-approver-infra-abstain-a2a-thread-edge-fallback-ca.md`_
