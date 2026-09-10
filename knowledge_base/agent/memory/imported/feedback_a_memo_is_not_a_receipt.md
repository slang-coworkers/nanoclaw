---
name: feedback_a_memo_is_not_a_receipt
description: "A status verb written before the call fires survives as a false receipt. Write it only after the tool returns; on resume, verify your own last lines against a fleet-side enumeration."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 771a61c5-e510-491d-9a7d-355d99fd785c
---

# A memo is not a receipt — write the status verb only after the call returns

**Measured twice in 24 hours, by two different agents, on sibling issues of the same cluster.**

- **2026-08-04, `slangpy-triager` (disclosed to me):** its memo recorded an operator escalation as
  *sent* before the call fired — it hadn't. A 13:13Z container restart interrupted the chain; the
  agent self-caught on resume. It had already reported "escalated" to me in that window.
- **2026-08-05, ME, slangpy#821:** I wrote `project_slangpy_821_empty_body_scrub_cluster.md`
  containing *"Dispatched #821 only"*, then a 21:49Z restart landed **between the memo write and the
  `send_message`.** No dispatch had fired. The memo read as done for ~8 minutes.

## Why: memo-then-act is the natural order and it is backwards

You draft the record while the reasoning is hot, then execute. Every restart, crash, or compaction in
that window converts a *plan* into a *false receipt* — and a false receipt is worse than no record,
because on resume it is indistinguishable from a true one. Nothing in the file marks which side of
the call it was written on.

⇒ ⭐⭐⭐ **Write the intent freely; write the VERB only after the tool returns.** Phrase the
pre-call state as intent (*"dispatching"*, *"to dispatch"*), never as completion (*"dispatched"*).

⇒ ⭐⭐ **On resume, distrust your own last few lines specifically.** They are the ones most likely
written across the interruption. Everything older survived a full turn and is safer.

## The check — CORRECTED, because my first published version was wrong twice

Do **not** re-read your own memo to confirm your own memo. But the check I first recommended
(`ncl sessions list --limit 2000`, look for a session on the thread) was **defective in two
independent ways.** Both corrections matter more than the original lesson.

### ⛔ Defect 1 — `--limit` is an exact cap; 2000 silently truncated
Measured: `limit=100 → 100 rows`, `500 → 500`, `2000 → 2000`, `3000 → 2301`. The fleet has **2301**
sessions ⇒ `--limit 2000` **dropped 301 rows with no marker.** My "32 threads, #821 absent" was
computed over a truncated table; the conclusion survived re-checking at full limit by **luck, not
method**.
⇒ ⭐⭐⭐ **`rows == limit` is a TRUNCATION SIGNAL, not a complete answer.** Re-run far above the row
count and confirm the number stops growing: `ncl sessions list --limit 100000 | …`.
⇒ ⭐⭐ Worse: `wc -l` → **2002** was my "healthy non-zero control" — and it *was the truncation
artifact itself*. **A non-zero control proves the instrument ran; it says nothing about whether the
instrument saw everything.** Sharpens
[[feedback_control_the_instrument_not_the_reasoning]].

### ⛔ Defect 2 — session-absence is the WRONG INSTRUMENT for "did the work happen"
I inferred *"#821 was never dispatched"* from *"no triager session on thread `…-821`"*. A session is
evidence about **routing**, never about **work**. Truth, from the peer's own transcript: a **sibling**
session (#820's, `sess-1785955405005-augy5t`) picked up #821's own GitHub webhook, batched five
scrubs, and **had already posted a full public verdict on #821** — cmt `5196835011`, 20:13Z, **100
minutes before I "discovered" it undispatched.** That log also records an earlier #821 leg dying on a
provider 429 without posting.
⇒ ⭐⭐⭐ **Work can complete on a DIFFERENT thread than the one it belongs to** (batch handlers,
webhook fan-in, epic-parent sessions). A per-thread session query cannot see it and returns a clean,
confident, wrong zero.
⇒ ⭐⭐ **Check the ARTIFACT, not the plumbing.** For GitHub work the receipt is the issue:
`comments_count` + the comment list. I ran `github_get_issue` on #821 *before* dispatching and read
only `assignees` from it. **Having the right artifact in hand is not interrogating it for the question
you're actually asking.**
⇒ For the plumbing view, grep the peer's **transcripts** for the issue number, not the session list
for the thread key: `ncl sessions messages <sid> --limit 60 | tr '\r' '\n' | grep -n "<issue-num>"`.

## Two further false zeros

1. `ncl sessions list | grep "slangpy-triager"` → **0 rows, exit 0.** That output carries
   `agent_group_id`, **not the group name** — the pattern could never match. Resolve name→id via
   `ncl groups list` first. ⭐ **Grep only for a field the output actually contains.**
2. `grep -o ".\{140\}821.\{200\}"` over `ncl sessions messages` → **empty**, while `grep -c "821"` on
   the same input → **5**. The transcript is one `\r`-laden line, so a fixed-width context window
   cannot match. Normalize with `tr '\r' '\n'` first. ⭐ **A context-grep returning nothing where a
   count-grep returns five is a formatting failure, never an absence.**

## Related
- [[feedback_control_the_instrument_not_the_reasoning]]
- [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]
- [[feedback_a_guard_can_be_inert_and_read_as_passing]] — same family: a false receipt and a true one
  render identically, exactly as an inert guard renders as a passing one.
- [[project_slangpy_821_empty_body_scrub_cluster]] · [[project_slangpy_823_tensorview_interop_buffer_noncuda]]
