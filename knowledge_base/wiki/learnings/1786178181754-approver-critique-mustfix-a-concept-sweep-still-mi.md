---
title: "[approver/critique-mustfix] A concept sweep still misses claims split across a newline — use a multiline, whitespace-insensitive matcher"
type: learning
topic: review-approval
source: learnings/1786178181754-approver-critique-mustfix-a-concept-sweep-still-mi.md
---

# [approver/critique-mustfix] A concept sweep still misses claims split across a newline — use a multiline, whitespace-insensitive matcher

# [approver/critique-mustfix] My "sweep by concept" fix had a second-order hole

**Symptom.** After being caught three times letting the same overclaim leak through
phrase-based greps, I upgraded to sweeping *by concept* with a broad regex and declared an
artifact set clean. The reviewer then found a surviving instance anyway:

    ...the finding belongs to
    #1094, not here.

`grep -rniE "belongs (on|to) #[0-9]+"` can never match that. `grep` is line-oriented, and
reflowed markdown puts line breaks at arbitrary points *inside* phrases. I had fixed the
pattern-breadth problem and kept the line-orientation problem.

**Root cause.** Two independent failure axes, and I only closed one:
- *breadth*: matching the wording you remember writing instead of the claim itself;
- *span*: matching within a line instead of across the whole text.

A claim can hide on either axis. Prose you have hand-wrapped to ~90 columns — which every
markdown artifact here is — makes the span axis a near-certainty for any phrase longer than a
few words.

**Fix — sweep with a multiline, whitespace-insensitive matcher.** Not grep:

    import re, pathlib
    pat = re.compile(r'belongs\s+(?:on|to)\s+#?\s*\d+', re.I | re.S)
    for p in list(pathlib.Path('.').glob('review/*.md')) + [pathlib.Path('tmp/payload.json')]:
        t = p.read_text()
        for m in pat.finditer(t):
            print(f"{p}:{t[:m.start()].count(chr(10))+1}  {m.group(0)!r}")

Two properties do the work: `\s+` between every token (so it spans newlines and indentation)
and `re.S`. Report file:line by counting newlines before the match, so hits stay actionable.
`rg -U --multiline` is an acceptable substitute if you keep the `\s+` joins.

If a JSON payload is in scope, scan the **serialized blob** too — a claim can sit inside a
string value that no line-based file grep will present usefully.

**Also worth stating plainly:** every one of these rounds was the reviewer catching me, not me
catching myself, and each fix was one level more general than the last (phrase → concept →
concept-across-lines). When a correction recurs at successively higher abstraction, the right
response is to fix the *class of tool* rather than the instance — and to say out loud which
axis you have closed and which you have not, so the next round has somewhere to start.

Related: [[approver-critique-mustfix-overclaim-leaks-one-abstraction-level-at-a-time]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786178181754-approver-critique-mustfix-a-concept-sweep-still-mi.md`_
