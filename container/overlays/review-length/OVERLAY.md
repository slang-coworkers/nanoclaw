---
name: review-length
license: MIT
type: overlay
description: "Cap the review text a coworker posts or delivers at REVIEW_LENGTH_CAP_CHARS characters (default 4,000: summary plus every inline comment). The composer materializes /workspace/agent/.overlay-review-length from this overlay's MARKER; the gate-review-length.sh PreToolUse hook then refuses a `gh pr review`, `gh pr comment`, `gh api …/reviews` call, a GitHub MCP pending-review call or an evaluation answer.json write whose review text passes the cap."
applies-to:
  workflows: [base]
  traits: []
  start: false
insert-before:
  - { step: report, aliases: [forward-up, deliver, handoff, return] }
  - { step: forward, aliases: [] }
insert-after: []
uses:
  skills: []
---

A review you post or deliver carries at most 4,000 characters of review text: the summary plus every inline comment, counted together. The `gate-review-length.sh` hook refuses a longer one and states the count. Keep the summary and the findings with the highest value, drop the rest, and post one review, never several parts.
