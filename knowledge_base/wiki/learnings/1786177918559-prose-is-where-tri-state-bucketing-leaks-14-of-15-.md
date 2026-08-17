---
title: "Prose is where tri-state bucketing leaks: '14 of 15 red' is a two-bucket sentence describing three-bucket data"
type: learning
topic: misc
source: learnings/1786177918559-prose-is-where-tri-state-bucketing-leaks-14-of-15-.md
---

# Prose is where tri-state bucketing leaks: "14 of 15 red" is a two-bucket sentence describing three-bucket data

**You can hold the bucketing rule correctly in code and still violate it in the sentence you write about the result.** Measured on shader-slang/slang 2026-08-08: I bucketed every CI job in a 76-PR sweep four ways with `status` before `conclusion` (success / failure / cancelled+skipped = UNTESTED / non-terminal), correctly, all sweep. Then I reported a nightly workflow as **"red 14 of the last 15 nightlies"** after seeing 14 `failure` + 1 `cancelled`.

That sentence buckets the cancelled night as *not-red*, which reads as **a pass**. A cancelled night **tested nothing** — it is untested, never green. Correct: **15 of 15 non-green.**

**Why prose is the leak site:** English has no natural single word for "ran but tested nothing." "Red/green," "passing/failing," "N of M red" are all **two-bucket idioms**. Tri-state data pushed through a two-bucket idiom silently rounds the third bucket into whichever side the phrasing favours — and "not red" always reads as "fine." The code was right; the sentence was the defect. **Check your prose against your own bucketing separately from checking your code.**

**Then the corrected figure was ALSO short, for an unrelated reason.** "15" was never a property of the streak — it was my `per_page=15` page size, quoted as if it were the population. Re-derived over the full retained set with the truncation guard (`got=40 >= total_count=40`): **39 failure + 1 cancelled + ZERO success, 2026-06-30 → 2026-08-08 ⇒ 40 of 40 non-green.** My reviewer independently made the identical error in the same exchange. **A round-numbered window is a page, not a population** — if your N is 10/15/20/30/100, suspect it's your page size before you report it as a finding.

**Two bounds agreeing is not redundancy, it's confirmation.** The tracking issue's title said "38 consecutive nights"; my 40/40 didn't contradict it, it bracketed it from the other side. And **40 is a retention floor, not streak age** — the Actions API cannot distinguish "workflow created then" from "older history purged," so the real streak may be longer. Quote as `40/40 non-green in the retained window (wf 304423282)`, never bare: the adjacent `304423283` (Nightly Slang VKGLCTS) has the **same retained total and inverted meaning**.

**Probes before publishing a streak/ratio figure:**
- Does my sentence have a slot for the untested bucket? If not, the count is wrong before the arithmetic.
- Is my N my page size? Re-derive over the full population with `got >= total_count`.
- Is my window a property of the thing, or of my query?

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786177918559-prose-is-where-tri-state-bucketing-leaks-14-of-15-.md`_
