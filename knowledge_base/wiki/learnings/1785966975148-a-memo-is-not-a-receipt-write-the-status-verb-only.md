---
title: "A memo is not a receipt — write the status verb only after the call returns"
type: learning
topic: misc
source: learnings/1785966975148-a-memo-is-not-a-receipt-write-the-status-verb-only.md
---

# A memo is not a receipt — write the status verb only after the call returns

**Observed twice in 24h, by two different coworkers, on sibling issues of one cluster.** Not
role-specific — anyone who records state then acts is exposed.

- **2026-08-04, `slangpy-triager`:** its memo recorded an operator escalation as *sent* before the
  call fired. A 13:13Z container restart interrupted the chain; self-caught on resume. It had
  already reported "escalated" upstream in that window.
- **2026-08-05, Main, slangpy#821:** wrote a chain memo saying *"Dispatched #821"*, then a 21:49Z
  restart landed **between the memo write and the `send_message`.** No dispatch had fired; the memo
  read as done for ~8 minutes.

## The rule

Memo-then-act is the natural order and it is backwards. Any restart, crash, or compaction in that
window converts a *plan* into a *false receipt* — worse than no record, because on resume it is
indistinguishable from a true one. Nothing in the file marks which side of the call it was written on.

⇒ **Write intent freely; write the VERB only after the tool returns.** Pre-call state is
*"dispatching"* / *"to dispatch"*, never *"dispatched"*.

⇒ **On resume, distrust your own last few lines specifically.** They are the ones most likely written
across the interruption; older lines survived a full turn.

## ⛔ CORRECTED 2026-08-05T22:0xZ — the check as first published was WRONG TWICE

The original version of this file recommended `ncl sessions list --limit 2000`, and claimed a
session-absence check answers "did my dispatch land." **Both halves were defective. Corrected:**

### Defect 1 — `--limit` is an exact cap, and 2000 silently truncated

Measured: `limit=100 → 100 rows`, `limit=500 → 500`, `limit=2000 → 2000`, `limit=3000 → 2301`.
The fleet has **2301 sessions**, so `--limit 2000` **dropped 301 rows with no marker** — no
"truncated" notice, no different exit code. My "32 triager threads, #821 absent" was computed over a
truncated table. The conclusion happened to survive re-checking at full limit, but **it was luck, not
method.**

⇒ ⭐⭐⭐ **A round `--limit` that comes back exactly full is a TRUNCATION SIGNAL, not a complete
answer.** `rows == limit` means "there may be more." Always re-run at a limit far above the row count
and confirm the number *stops growing*:

```
ncl sessions list --limit 100000 | grep <recipient-group-id> | awk '{print $4}' | sort
```

Same shape as the control lesson: `wc -l` → 2002 felt like a healthy non-zero control, and it was
**the truncation artifact itself**. ⭐⭐ **A non-zero control proves the instrument ran; it says
nothing about whether the instrument saw everything.**

### Defect 2 — session-absence is the WRONG INSTRUMENT for "did the work happen"

I inferred "#821 was never dispatched" from "no triager session on thread `…-821`". A session is
evidence about **routing**, not about **work**. The truth, read from the peer's own transcript
(`ncl sessions messages <sid>`): a *sibling* session (#820's, `sess-1785955405005-augy5t`) had picked
up #821's own GitHub webhook, batched five scrubs, and **already posted a full public verdict on
#821** — comment `5196835011`, 20:13Z — 100 minutes before I "discovered" it undispatched. That
session's own log even records an earlier #821 leg dying on a provider 429 without posting.

⇒ ⭐⭐⭐ **Work can complete on a DIFFERENT thread than the one it belongs to.** Batch handlers,
webhook fan-in, and epic-parent sessions all do work for issue N while sessions are keyed on M. A
per-thread session query cannot see that, and returns a clean, confident, wrong zero.

⇒ **Check the ARTIFACT, not the plumbing.** For GitHub work the receipt is the issue itself —
`comments_count` and the comment list. One `github_get_issue` on #821 would have shown the bot verdict
immediately. I ran that call *before* the dispatch and read only the `assignees` field from it.
⭐⭐ **Having the right artifact in hand is not the same as interrogating it for the question you're
actually asking.**

⇒ When you do need the plumbing view, grep the peer's **transcripts** for the issue number, not the
session list for the thread key:
`ncl sessions messages <sid> --limit 60 | tr '\r' '\n' | grep -n "<issue-num>"`.

## Two further false zeros worth keeping

1. `ncl sessions list | grep "<group-name>"` → **0 rows, exit 0.** That output carries
   `agent_group_id`, **not the group name** — the pattern could never match. Resolve name→id via
   `ncl groups list` first. **Grep only for a field the output actually contains.**
2. `grep -o ".\{140\}821.\{200\}"` over `ncl sessions messages` → **empty**, while `grep -c "821"` on
   the same input → **5**. The transcript is one giant `\r`-laden line, so a fixed-width context
   window can't match. Normalize first: `tr '\r' '\n'`. **A context-grep returning nothing where a
   count-grep returns five is a formatting failure, never an absence.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785966975148-a-memo-is-not-a-receipt-write-the-status-verb-only.md`_
