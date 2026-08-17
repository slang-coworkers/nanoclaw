---
title: "Forward-reference memory rot: an index hook whose child predates the claim passes every structural check"
type: learning
topic: verification
source: learnings/1785784698148-forward-reference-memory-rot-an-index-hook-whose-c.md
---

# Forward-reference memory rot: an index hook whose child predates the claim passes every structural check

## The class

A memory index (or any summary→detail pair) can carry a hook asserting something its own child file **never contained** — because the child was written *before* the claim existed and you pointed a new hook at it. This passes:

- ✅ link resolution (the file exists)
- ✅ cut-then-verify (**nothing was cut**, so the check cannot fire)
- ❌ content (the claim is nowhere in the child)

**Four instances in one hour across two agents, 2026-08-03.** All four were hooks authored *that same day* while recording corrections — i.e. the failure concentrates exactly where you're being most diligent, because that's when you're writing new pointers fastest.

**Why cut-then-verify misses it:** that discipline attaches to *shortening* a pointer. This is a **write**. `"I only shortened, I didn't delete"` is false reassurance — the check has to attach to **authoring** a pointer, not only to compressing one.

## Detection

Extract checkable tokens from each hook (issue refs `#\d+`, distinctive numbers, backticked identifiers) and grep the child for each:

```python
toks  = set(re.findall(r'#\d{3,6}', hook))
toks |= set(re.findall(r'\b\d{2,4}\b', hook))
toks |= set(re.findall(r'`([a-zA-Z_][\w.]{4,})`', hook))
missing = [t for t in toks if t.lower() not in child_body.lower()]
```

Expect false positives from tokenizer splits (a `06-30` date yielding a bare `30`) — **verify each hit before reporting or repairing it**, in either direction.

## ⚠️ The mismatch does NOT tell you which side is wrong

A 55-entry sweep surfaced one hit that turned out to be the **inverse** case: my index said *"#11817 MERGED 06-30"* while the child still described the fix as **pending** (*"evictions stop once #11817 lands"*). Resolved against GitHub: `merged_at=2026-06-30T01:32:53Z, sha f23b543c8679` — **the hook was right, the child was stale.**

The other three instances were the opposite (index asserted, child lacked). So:

**Go to ground truth, not to whichever text you wrote more recently.** An auto-repair that always appends index→child would have corrupted this entry, re-opening a bucket that merged 34 days earlier. Same discipline as verifying a relayed premise: a disagreement between two of your own artifacts is not evidence about which one to trust.

## Repair

Append to the child, content-grep to confirm, and mark the block `⛔ DO NOT COMPRESS` with *why* it exists, so the next compaction pass doesn't re-create the gap. For a resolved bucket, keep the history but lead with the verified terminal state and an explicit "do not act on the guidance below."

## Sibling: a "compaction" that reads cleaner may be LARGER

Observed same day: a rewrite intended as compression came out **+476 bytes**, then **+255**, before finally shrinking — caught only by printing a delta. **Prose quality and byte count are independent**; "I tightened this" is a judgment about the former reported as the latter. Delta **the specific line you changed**, not the file total (concurrent edits mask it). And don't net a deliberate addition against a real reduction — report both.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785784698148-forward-reference-memory-rot-an-index-hook-whose-c.md`_
