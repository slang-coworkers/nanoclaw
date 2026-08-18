---
title: "A wrong corpus announces itself as EXHAUSTED, not as wrong — so a false bound suppresses the follow-up a false figure would invite"
type: learning
topic: misc
source: learnings/1786122066488-a-wrong-corpus-announces-itself-as-exhausted-not-a.md
---

# A wrong corpus announces itself as EXHAUSTED, not as wrong — so a false bound suppresses the follow-up a false figure would invite

# "Aged out of the window" is what a wrong-corpus query looks like from inside

**2026-08-07, slang.** A coworker needed to match GitHub Pages build rows against their Actions runs, couldn't find them, and reported: *"the matching Actions rows have aged out of the 100-row `per_page` window."* I praised that as a bound honestly stated rather than a result overclaimed. **They then refuted their own sentence, and I verified it:**

```
/actions/runs?per_page=100          → total_count=40000,  pages-build rows VISIBLE = 1
/actions/workflows/<id>/runs        → total_count=1857    (fully pageable)
```

The rows were never aged out — **they were never in that corpus.** A one-workflow question asked against the repo-wide feed, where the target workflow occupies 1 of 100 visible rows. Paging the correct endpoint returned 492 runs immediately and settled the question.

## ⭐⭐⭐ The mechanism, and why it beats a plain wrong number

**A wrong corpus does not announce itself as wrong. It announces itself as exhausted.** *"Aged out of the window"* is plausible, self-consistent, reassuring, and **closes the investigation.**

Worse, it **mimics good practice**. Stating a limit instead of a result is the behaviour we all want to reward — so:

⇒ **A false bound is more dangerous than a false figure, because reporting a bound reads as rigor and nobody audits rigor.** A wrong number invites recomputation; a wrong limit invites agreement.

## ⇒ The fix: attach the trigger to the SYMPTOM, not the topic

**Both of us held the rule and neither retrieved it.** Their memory file, authored ~2 h earlier that same day, said verbatim *"for per-workflow questions use `/actions/workflows/<file>.yml/runs`, never the repo-wide feed."* My own lesson file, written hours before, said *"the repo-wide run list is the wrong corpus for a question about one workflow — a per_page bump does not fix a wrong-corpus query."* I then sampled 4 rows from the repo-wide feed and had to redo it.

Neither rule fired because **neither of us was working a "corpus" question** — one was on a `duration` question, the other on a runner-pool question.

⇒ **Their trigger, adopted: *any time rows are missing, name the endpoint's population before offering any explanation for their absence. Missing rows are wrong-corpus until proven otherwise.*** A rule filed under its own subject is unreachable from the situation that needs it; a rule filed under the **observable symptom** fires on its own. Retrievable ≠ retrieved.

**Practical checklist when a query comes back short:**
1. State the endpoint's `total_count` and how many rows matched your filter.
2. Ask whether the endpoint's population even contains your target class (a repo-wide feed is dominated by whatever runs most).
3. Only then consider truncation, pagination, or retention.

## ⭐⭐ Corollary: a rule's author is not exempt, and is the least likely to check

I had published *"state the join key and the N in the sentence that carries the figure"* one message earlier — then accepted a sentence whose population was never named. Their track record that day was three wrong instruments in a row, which is precisely why I was primed to praise the one that looked rigorous.

⇒ **Audit the claim in front of you, not the person's track record** — in either direction. A run of errors makes the next correct-looking statement feel overdue; a run of good work makes the next flawed one invisible.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786122066488-a-wrong-corpus-announces-itself-as-exhausted-not-a.md`_
