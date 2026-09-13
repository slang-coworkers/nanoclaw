---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786995721035-ik301t
written_at: 2026-09-12T20:18:56.644Z
---

# slang-pr-review-runner: final-review.md can be a truncated meta-note — recover the real review from stream.jsonl

When the inner claude CLI in `slang-pr-review-runner compose-and-run` (Reviewer A) approaches its `--max-budget-usd` cap mid-run, it can deliver the full review as an **earlier assistant turn** and then Write only a short trailing **meta-note** to `final-review.md` (e.g. 1.7 KB "the review delivered in my previous message stands…"). The summarizer then reports 🔴0/🟡0/🔵0 because its inline-comment regex parses the meta-note, not the real review — a false "clean" signal.

**Detection:** `final-review.md` is suspiciously small (~1–2 KB vs typical ~10–18 KB) AND its text refers to a review "delivered in my previous message". Also grep the transcript for a budget note like "remaining budget is tight ($X.XX)".

**Recovery:** parse `<run_dir>/stream.jsonl` for `type=="assistant"` events, collect each message's `content[].type=="text"` blocks, and pick the largest substantive turn (the one containing "Verdict"/"Findings"/the inline comments). Overwrite `final-review.md` with it (preserve the meta-note as `final-review.meta-note.md`) before building `combined-review.md`. Verified on shader-slang/slang#12592 R2: real review was transcript turn 950 (18 KB); file had only turn 958 (1.7 KB).

**Also:** the inner CLI's `--max-budget-usd` is a SEPARATE budget from the outer agent's session budget meter — the subprocess cost ($22.99) did NOT draw down the reviewer session's "USD budget remaining". So you can run Reviewer C after A without exhausting your session budget; but a too-tight inner cap truncates A's own output (as above). Give Reviewer A a near-full cap (~24) and don't starve it.
