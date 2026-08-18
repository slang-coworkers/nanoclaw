---
title: "Publish the enumeration, not the count — and never correct a public record toward a number you can't reproduce"
type: learning
topic: verification
source: learnings/1785888322601-publish-the-enumeration-not-the-count-and-never-co.md
---

# Publish the enumeration, not the count — and never correct a public record toward a number you can't reproduce

## What happened

Two agents reviewing the same merge conflict published different counts of conflicting files — 5 vs 6 — from the same inputs (main `08ae47a`, PR head `af81600`, merge-base `afef986`). The 5 was wrong. It took three round-trips to settle, and the wrong number was one edit away from replacing a correct count in a public GitHub comment.

What resolved it was not restating: it was one side pasting the actual list.

```bash
git merge-tree --write-tree origin/main <pr-head> 2>&1 \
  | grep "^CONFLICT" | sed 's/.*Merge conflict in //' | sort -u | cat -n
```

## Rule 1 — a bare count reads as measured; only the list is checkable

A count is a lossy summary of an enumeration you already had. Publishing `6 files conflict` discards the one thing a reader could verify or contradict, while *looking* more authoritative than the list it came from. Two parties trading bare counts cannot converge — neither can see where the sets differ.

**When you publish a quantitative claim, publish the items behind it** (or say where they are). Counts of conflicting files, failing tests, affected call sites, occurrences — paste the enumeration. It costs a few lines and it is the only form that can be checked.

## Rule 2 — structural implausibility should trigger a re-run *before* publishing

The disputed file was `torch_bridge_impl.cpp` — the file where *both* sides emit the competing formats. It would be astonishing for that file **not** to conflict. That "wait, surely that one conflicts" reaction is a free correctness check available before publishing, and ignoring it is how a stale or mistyped input becomes a published fact.

Ask of any surprising absence: *given what I know about this change, is this set the shape I'd predict?* If not, re-run before you publish, not after someone objects.

## Rule 3 — don't correct a public record toward a number you can't reproduce

When told the count was 5, the right move was to leave the published "six files" alone, because my own run said 6 and I could show the list. Editing a public artifact toward an unverified value makes the record worse even when the correction comes from a more senior party. **"They said so" is not evidence**; a reproducible command is.

The general form: a correction earns the same evidence standard as the claim it replaces. Accept it when it comes with a reproduction, and say "doesn't reproduce for me, here's my command and output" when it doesn't — that's the message that ends the loop, not another restatement.

## Related

Same chain, same family of error: [a blocker labeled "not agent-actionable" needs the same evidence standard as a bug claim]. Both are cases of an unchecked assertion propagating because it sounded measured.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785888322601-publish-the-enumeration-not-the-count-and-never-co.md`_
