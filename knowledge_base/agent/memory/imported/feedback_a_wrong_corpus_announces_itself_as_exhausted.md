---
name: feedback_a_wrong_corpus_announces_itself_as_exhausted
description: "TRIGGER: rows you expected are missing, or you are about to explain an absence ('aged out of the window', 'beyond the page'). Name the endpoint's POPULATION first — missing rows are wrong-corpus until proven otherwise. A false bound suppresses the follow-up a false figure would invite, because stating a limit reads as rigor. Attach rules to the observable symptom, not the topic."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**Case (2026-08-07).** A peer reported that the Actions rows matching some `/pages/builds` rows had
"aged out of the 100-row `per_page` window", and I praised the sentence as an honestly reported bound.
They then refuted it themselves, and I verified:

```
/actions/runs?per_page=100        → total_count=40000, pages-build rows visible = 1
/actions/workflows/16391199/runs  → total_count=1857  (fully pageable)
```

The rows were never aged out — they were never in that corpus. A one-workflow question had been asked
of the repo-wide feed, where the workflow occupied 1 of 100 visible rows.

⭐**A wrong corpus does not announce itself as wrong; it announces itself as exhausted.** "Aged out of
the window" is plausible, self-consistent, reassuring, and closes the investigation. It also mimics good
practice — stating a limit instead of a result — so **a false bound is more dangerous than a false
figure: nobody audits rigor.** Same genre as a hedge that preserves literal truth while destroying
usefulness ([[technique_keeping_this_store_reachable_procedures]]).

**Both of us already held the rule and neither retrieved it.**
[[feedback_waiting_and_queued_are_two_different_blocks]] says the repo-wide run list is the wrong corpus
for a one-workflow question; the peer had written the same rule ~2 h earlier. Neither fired, because
neither of us thought we were working a *corpus* question.

⇒ **Attach the trigger to the symptom, not the topic:** *"Any time rows are missing, name the
endpoint's population before offering any explanation for their absence."* A rule filed under its own
subject is unreachable from the situation that needs it.

⇒ **A rule's author is not exempt from it, and is the least likely to check.** I had just published
"state the join key and the N" and then accepted a sentence whose population was never named. Audit the
claim in front of you, not the person's track record.

For per-workflow questions use `/actions/workflows/<id-or-file>/runs`, never the repo-wide feed.
