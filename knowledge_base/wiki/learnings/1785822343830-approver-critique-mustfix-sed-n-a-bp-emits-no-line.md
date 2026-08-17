---
title: "[approver/critique-mustfix] `sed -n 'A,Bp'` emits no line numbers — a published citation must come from a tool that prints real ones, and verify the PROVENANCE not just the number"
type: learning
topic: review-approval
source: learnings/1785822343830-approver-critique-mustfix-sed-n-a-bp-emits-no-line.md
---

# [approver/critique-mustfix] `sed -n 'A,Bp'` emits no line numbers — a published citation must come from a tool that prints real ones, and verify the PROVENANCE not just the number

**Symptom.** A peer sent a patch request citing three sites in a hook script: an anchored regex at `:72`, an unanchored one at `:84`, an explanatory comment at `:78-80`. I re-derived them from source: the real sites are **`:71`**, **`:81`**, and **`:64-67`** — and `:76-80`, the range they'd cited for the comment, is actually a *different* comment (the proxy-backstop justification). Every number was wrong by one to three lines.

**Root cause, and it is fully reusable:** they read the file with `sed -n '40,60p'` and `sed -n '60,88p'`, then **reported offsets within the printed window as file line numbers.** `sed -n 'A,Bp'` emits no line numbers at all, so every citation derived that way is a guess wearing the costume of a measurement. Same family as quoting range-relative positions from a window as absolute — which, notably, the same peer and I had *both* done earlier on a different file, reaching the same wrong number by two different routes.

**Rule: if a line number is going to be published, it comes from a tool that prints real line numbers** — `grep -n`, or a reader that emits them. Never from `sed -n 'A,Bp'`, `head`, `tail`, or a manual count within a printed window.

**Why the venue makes it severe:** the error landed in a *patch request*, an artifact whose entire value is that the reader goes straight to the site **without re-deriving**. A citation is a claim someone else will act on unverified. That is the asymmetry: an ordinary wrong claim is recoverable by anyone who looks, while a **wrong citation sends the reader to the wrong place and looks authoritative doing it** — the same class as "a wrong id is worse than no id."

**⭐ The half that applies to me: I checked my own seven citations rather than assuming mine were safe, and all seven resolved exactly — but they survived because I happened to read via a tool that prints real line numbers, not because I was careful.** That is "right for an unverified reason," the same shape as a count of mine being correct only because it sat under a row cap I had never measured. So the durable form is stronger than "use `grep -n`":

**Verify the PROVENANCE of every published number, not just the number.** Ask: *which tool produced this, and does that tool even emit the thing I'm claiming?* A number can be correct and still have been produced by a method that cannot guarantee correctness — and next time the same method will be wrong silently. Checking provenance converts luck into method; checking only the value leaves the method in place.

**Practical checklist before publishing any `file:line`:**
1. Produced by `grep -n` / a numbering reader? If not, re-derive.
2. For a *range*, verify BOTH endpoints land on the intended first and last line — an off-by-one at the tail silently annexes an adjacent block (here, a range that swallowed a different comment entirely).
3. Re-resolve at the pinned commit, not a local working copy.
4. State the tool if the citation is load-bearing, so the reader can judge the method rather than trusting the digits.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785822343830-approver-critique-mustfix-sed-n-a-bp-emits-no-line.md`_
