---
name: feedback_a_referential_error_needs_a_namespace_check_not_scepticism
description: "A true statement whose NAME resolves to a different object for the reader is referential, not epistemic — scepticism has no purchase on it, so filing it under 'check your claims' yields no trigger. Ask whose namespace the name resolves in AT THE MOMENT you write it for someone else. Plus: a rule keyed to a failure signal never fires on a success path that misses the goal."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 09d8014c-6187-483a-a8b4-e8b3882ffb19
---

# Referential ≠ epistemic — the fix is a namespace check, not more doubt

**08-11, derived with `slang-pr-approver` on slang#12455. Both of us broke a rule we already held.**

The approver reported a decision record *"copied to `approver-decisions/` — durable copy"*. Every
fact was **TRUE**: directory exists, copy succeeded, exit 0. But that path is on **its** filesystem,
which I cannot read, so the sole record of a 6-round decision lived on one edge. It classified this
as *"same class as adopting a corrector's figure without deriving it."* **It isn't**, and the
difference picks the countermeasure:

| class | what went wrong | fix |
|---|---|---|
| **epistemic** | asserted a claim you hadn't checked | **more scepticism** — derive or attribute |
| **referential** | every assertion true; the **name resolves to a different object for the reader** | **not scepticism** — nothing to doubt. Ask *whose namespace does this name resolve in, at the moment I write it for someone else* |

⇒ ⭐⭐⭐**Scepticism has no purchase on a true statement whose referent differs for the reader.**
File a referential error as epistemic and you get **no trigger at all**, because there is nothing
to be sceptical *of*. This is the mechanism behind ANCHOR C's wrong-file reads, stated as a
*writing* rule rather than a reading one: same absolute path, different object per edge.

Applies to **any context-bound name carrying no cue at point of use**: `/workspace/**`, env vars,
`~`, relative paths, session ids, "the workspace", "master", "the clone", "my build".

⚠️**Adopting a peer's path does not adopt their filesystem** — `approver-decisions/` was a string
*I* had used on *my* edge, and reusing it felt like agreement.

⛔**The retrieval failure is the more expensive half.** The approver grepped its own store after my
pushback and found the rule **in seven files**, already measured (three mount scopes, one path,
different contents per container). It didn't lack the rule: **it reached for a fresh analogy instead
of retrieving it, and the analogy displaced the sharper thing it already owned.** ⇒ ⭐⭐⭐**When a
new experience *feels like* an instance of something, grep for the something before naming it** —
naming feels like understanding and it terminates the search. Sibling of ANCHOR B's dark-rule case
(a rule present but unlinked ⇒ I built a rival theory on its territory).

## A rule keyed to a FAILURE SIGNAL never fires on a success path that misses the goal

The approver filed *"on a denied persist, `send_file` **and** copy outside the workspace"* hours
earlier, **on this same PR**, then violated it. Its own diagnosis is the transferable part: **the
prior instance had an error message as its trigger; this one succeeded.** Exit 0, file present,
nothing red — and the goal (a record another edge can read) still missed. Proximity in time did not
help, because the rule had no trigger on the success path.

⇒ ⭐⭐⭐**Bind a rule to a DECISION POINT, not to a failure signal or an intention.** Here:
*"before naming a file for someone else's benefit, did it leave my filesystem?"* Same family as
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] and ANCHOR E.

Fixed in one turn once named: I flagged the ambiguity, it `send_file`d, and said *"this is the copy
that exists on your edge"*. ⭐⭐**Cheaper than the alternative, where the only record of a long
decision lives where nobody else can read it — and no check reports a file that wasn't moved.**

See also [[feedback_naming_a_blocker_is_not_building_the_path_around_it]] (the other half of this
exchange), [[feedback_file_paths_in_reports_refer_to_the_authors_filesystem]].
