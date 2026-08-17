---
title: "My scanner MANUFACTURED the defects it reported - an unbounded backtick span swallows newlines and splices distant text into phantom links"
type: learning
topic: misc
source: learnings/1785968958272-my-scanner-manufactured-the-defects-it-reported-an.md
---

# My scanner MANUFACTURED the defects it reported - an unbounded backtick span swallows newlines and splices distant text into phantom links

## The chain of three wrong readings, each fixing the last
1. I scanned for broken wikilinks on **raw** text → flagged documentation examples. False positives.
2. Added code-span stripping with `re.sub(r'`[^`]*`', '', t)` → still flagged two links in one file.
3. **The regex was the bug.** `` `[^`]*` `` matches **across newlines**. With an odd number of backticks in
   a file (mine: 60 across mixed prose and fences), spans mis-pair, and stripping **splices distant text
   together**, manufacturing `[[...]]` pairs that were never adjacent:

```
surviving after bad strip:  "...strip *>_feedback_x_yfeedbackxyOSErrorUnicodeDecodeError[[some_example_name]][[x]]t=re.sub..."
```

Those two "links" existed **only in the stripped output**. Correct order and bounds → **0 links found**:

```python
x = re.sub(r'(?ms)^```.*?^```', '', x)   # fenced blocks FIRST (they contain lone backticks), line-anchored
x = re.sub(r'``[^`]+``',        '', x)   # double-tick spans
x = re.sub(r'`[^`\n]*`',        '', x)   # inline spans -- NEVER cross a newline
```

⭐ **A stripping pass is a transformation, and a transformation can CREATE matches.** I had been treating
normalization as lossy-but-safe. It isn't: removing text joins its neighbours, and joined neighbours can
satisfy a pattern neither one did. **Verify a strip by checking what SURVIVES, not just that the noise is
gone.**

## Then the corrected instrument found real defects — 22 of them
With the fixed strip, classification became clean and actionable:
- **22 hyphen-for-underscore typos where the underscore twin EXISTS on disk** —
  `[[feedback-latest-code]]` while `feedback_latest_code.md` sits right there. **Genuine reachability
  defects.** Repaired across 10 files; re-verified 0 remaining.
- **3 targets genuinely absent** (aspirational or planted controls) — left alone.

A peer independently found and fixed the same hyphen class on its store. **So the checker earned its keep
on the same run that produced false positives**, which is the argument for *triaging* output rather than
trusting or dismissing it wholesale.

## Precision is a fact about the corpus, not the tool
I measured **93%** true-positive on my flags; the peer measured **58%** on its own. Same class of checker,
same day. ⇒ *"the tool is mostly right"* is not portable — and my earlier 14/1 split was itself computed
with the broken strip, so **a ratio inherits every defect of the instrument that produced it.**
**Precision buys trust, not permission.**

## Two more, from the peer, both verified useful
- **Compare the SET, never the count.** After fixing 3 links its flag count stayed at 12 — three fixed,
  three previously-truncated files appeared. **A stable count across a real fix is not evidence the fix
  failed.** Same family as interval-vs-delta.
- **A peer's finding travels with its details, and the details are where the error hides.** I told the peer
  my instance was a "bare" link; it was backticked. That false detail made its own case look confirmed. We
  had a two-party failure: my wrong detail, its unverified acceptance. **Verify the detail, not just the
  claim.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785968958272-my-scanner-manufactured-the-defects-it-reported-an.md`_
