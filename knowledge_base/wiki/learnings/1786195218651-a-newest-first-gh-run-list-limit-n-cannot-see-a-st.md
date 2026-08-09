---
title: "A newest-first `gh run list --limit N` cannot see a STUCK run — the blocker is old, so a page window is guaranteed to miss it"
type: learning
topic: misc
source: learnings/1786195218651-a-newest-first-gh-run-list-limit-n-cannot-see-a-st.md
---

# A newest-first `gh run list --limit N` cannot see a STUCK run — the blocker is old, so a page window is guaranteed to miss it

Burned a human-authorized CI rerun on a false "CI is quiet" reading. The status filter was correct; the **population depth** was wrong.

## What happened

I needed to know whether any higher-priority `ci.yml` run was active before rerunning a priority-yielded bot run. Checked:

```bash
gh run list -R shader-slang/slang --workflow ci.yml --limit 40 \
  --json databaseId,event,status --jq '[.[]|select(.status=="in_progress" or .status=="queued" or .status=="waiting")]|length'
# => 0
```

Zero active. I reasoned from the gate's own source (`yielded = bool(human or older_bot)`) that with empty lists it would proceed, and fired the rerun. **It yielded anyway:**

```
Yielding behind earlier bot CI #30098 (workflow_dispatch, waiting, by github-actions[bot])
Higher-priority CI is active. Marking this bot run for retry.
```

`#30098` was at **position 57** in the newest-first run list — my `--limit 40` stopped 17 short. It was `status=waiting`, created **>24h earlier**, and was the *sole* active run in the whole repo.

## Why this is structural, not bad luck

**The blocker in a starvation problem is by definition OLD.** A run that is stuck `waiting` or `queued` for a day keeps accumulating newer runs above it in a newest-first listing, so it sinks past any fixed `--limit`. The one region your page is guaranteed to miss is exactly where the blocker lives. The longer it's been stuck — i.e. the more it matters — the deeper it sits.

Meanwhile the server-side gate enumerates active runs with **no page limit**. So:

⭐ **My population and the gate's population were different populations.** I wasn't reading a stale value or the wrong field; I was answering a different question over a truncated set and treating the answer as authoritative.

## The subtle part worth internalizing

**I did include `waiting` in the status filter.** The filter was right. A correct filter over a truncated population still returns a false zero — and a false zero is the reassuring answer, so nothing prompts you to look harder.

⇒ **Bound the population before trusting a zero.** Prefer a query whose limit cannot silence the answer:

```bash
gh run list -R <repo> --workflow ci.yml --limit 100 --json databaseId,number,status \
  --jq '.[]|select(.status=="in_progress" or .status=="queued" or .status=="waiting")'
```

Better: when a server-side component already computes the thing you need, read *its* output (the gate job's log) rather than re-deriving it from a client-side sample you have to paginate yourself. Re-deriving means reproducing its population, and you probably won't.

## Also confirmed: `waiting` is a real active state

`status` can be `waiting` (not just `queued`/`in_progress`) — a run in that state blocks the priority gate exactly like a running one. Any "is CI busy?" check that omits `waiting` is wrong on top of any depth problem.

## Cost accounting

One attempt of a 30-attempt budget (eligibility intact), and `created_at` was preserved so the 12h escalation math was unaffected — recoverable. But I spent an operator's authorization on a prediction my own instrument could not support. Cheap fix: `--limit 100` plus a `select` on all three active states, or just read the gate's decision line.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786195218651-a-newest-first-gh-run-list-limit-n-cannot-see-a-st.md`_
