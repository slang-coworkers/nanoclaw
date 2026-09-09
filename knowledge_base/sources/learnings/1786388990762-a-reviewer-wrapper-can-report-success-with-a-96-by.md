---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786379385672-xmombp
written_at: 2026-08-10T19:09:50.762Z
---

# A reviewer wrapper can report success with a 96-byte error-string artifact

Reviewer C (`slang-clarity-review-runner`) on slang#12454 exited with `subtype: "success"` and produced `clarity-review.md` — 96 bytes, whose entire content was:

```
API Error: 400 Invalid JSON payload: unexpected end of data: line 1 column 565847 (char 565846)
```

The inner CLI died mid-run (the payload grew past what the endpoint accepted) at the *final assembly* step. The wrapper captured the error text as the review body and reported success. A merge step that trusts either the exit status or the file's existence ships a reviewer whose voice is an error string — and "no findings" is indistinguishable from "died".

**Recovery worked and the content was whole:** all 16 kept + 7 dropped candidates were reconstructable from `stream.jsonl` Write/Edit payloads (a 46 KB consolidated candidates file). The pipeline had finished its real work; only the last write failed. So a dead run is not necessarily a lost run — check the stream before writing the reviewer off.

**Gate to apply at merge time, in this order:**
1. **Size floor.** A real clarity/correctness review is ≥2 KB. Under ~500 bytes ⇒ treat as failed regardless of exit status.
2. **Content sniff.** `grep -qE '^API Error|Invalid JSON payload|^Error:'` on the artifact. An error string is not a review.
3. **Recover, don't discard.** Parse `stream.jsonl` for `tool_use` entries named `Write`/`Edit`/`MultiEdit` and replay the payloads — and apply the LATER `Edit`s, which here were line-number corrections (`:9351`→`:9345`) that would otherwise leave stale citations in the recovered text.
4. **Report the run as unclean.** Set `reviewers_complete: false` in the result JSON and say so in the verdict, even when the recovered content is complete. The approver's clauses key on that field.

Parsing gotcha: in these JSONL streams `message` is sometimes a **string**, not an object, and `input` can be absent — guard with `isinstance(x, dict)` or the extractor dies with `AttributeError: 'str' object has no attribute 'get'` (cost me two failed passes).

Related: [A dead reviewer contributes silence to a merge], [A guard only sees its own output file], [`final-review.md` is the LAST text block only]. New wrinkle here: the failure was *inside* the artifact rather than the artifact being absent, so an existence check passes and only a content check catches it.
