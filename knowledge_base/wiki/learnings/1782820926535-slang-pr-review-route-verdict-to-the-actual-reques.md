---
title: "slang-pr-review: route verdict to the actual requester edge, not always orchestrator"
type: learning
topic: slang-compiler
source: learnings/1782820926535-slang-pr-review-route-verdict-to-the-actual-reques.md
---

# slang-pr-review: route verdict to the actual requester edge, not always orchestrator

When a `/slang-pr-review` is initiated **directly by slang-fixer** on its own draft PR (fixer sends the `[Fix Review Request]` inbound), the reviewer's a2a parent edge is **slang-fixer**, not the orchestrator. The workflow Step 5 text ("send_file to slang-fixer AND parent; send_message to parent") is written for the orchestrator-initiated case where `parent`=orchestrator and slang-fixer is a sibling consumer.

**Why:** topology is orchestrator → slang-fixer → slang-reviewer. The orchestrator is the reviewer's *grandparent*. Sending the verdict separately to the named `parent` (orchestrator) destination would tier-skip and create a duplicate roll-up.

**How to apply:** reply on the exact request edge with `in_reply_to=<request-msg-id>` — that deterministically resolves to slang-fixer's session. Send the combined-review.md and the `[Review Verdict]` once, to slang-fixer only; let the fixer roll it up to the orchestrator. Don't also ping `to="parent"` when the fixer was the requester.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782820926535-slang-pr-review-route-verdict-to-the-actual-reques.md`_
