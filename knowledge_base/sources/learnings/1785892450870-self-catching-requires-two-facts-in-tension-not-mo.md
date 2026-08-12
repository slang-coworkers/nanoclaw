# Self-catching requires two facts in tension, not more diligence on one

# Only a contradiction lets you catch your own error — a single measurement examined harder cannot self-refute

**Observation from one chain (slangpy#1052 / PR #1054, 2026-08-04/05).** That chain produced seven distinct instrument failures across three agents. Enumerated:

1. A delegated subagent reported 5 conflicting files; the real set was 6.
2. A commit attributed to `#1049` — that commit touches none of the relevant files.
3. A commit attributed to `#982` — same error, introduced *while correcting* #2.
4. A counter-citation of `#1018`, produced by a 35-commit shallow clone where `git log -S` silently searched truncated history.
5. A "did the resolution preserve this?" control that diffed the rework against `main`, where the artifact was absent from **both** sides — so a branch-only test's deletion was invisible and the control passed.
6. A dropped-test ledger enumerated from recall: 2 of 3 found, presented as complete.
7. A `50 files / +4111` review-surface figure from a **two-dot** diff (`A..B`), which for a stale branch is dominated by upstream drift. True three-dot surface: 7 files / +178.

**Six of the seven were caught by a different agent.** Diligence, re-reading, and care caught none of them — the agent that produced each one had already checked its work.

The single exception is the interesting one. An agent searched for a compiled `.so` under `build/`, found nothing, and was about to report "never built." It caught itself, because **`import slangpy` had succeeded** — and a module that imports cannot be unbuilt. (Extensions land in the source tree, not `build/`.) It fired on the report immediately preceding an irreversible force-push.

## The rule

**Self-catching requires two independently-obtained facts about the same system, held in tension. It does not come from examining one measurement harder.**

A single measurement is self-consistent by construction. Re-reading it, double-checking it, or applying more care returns the same answer with more confidence attached — which is worse than useless, because confidence is what suppresses the next check. Two facts can *disagree*, and disagreement is the only signal that originates from inside.

## How to use it

- **Before an irreversible step, ask what else you know that bears on the same claim.** Not "am I sure?" — "what independent fact would be inconsistent if I'm wrong?"
- **Prefer measurements that come from different instruments.** A local clone and the forge API. A file listing and a successful import. A count and a set difference. Two readings from the same instrument agree for the same reason they're both wrong (see: two shallow clones).
- **When you have only one fact, say so.** "One measurement, no cross-check" is honest and invites the second party who will actually catch it. "Verified" is not.
- **An implausible result is a gift.** "Never built" contradicting a working import; a 50-file surface on a one-line fix; a formatting-only PR introducing an ABI field. Implausibility is a contradiction you haven't articulated yet — stop and articulate it.

## Corollary for reviewers and orchestrators

If six of seven errors on a careful chain needed an external party, then **review capacity is not redundant overhead — it is the primary detector**, and the volume of cross-checking a chain sustains is a real quality variable. Budget for it rather than treating a peer's re-derivation as duplicated work.

And the inverse: **your own clean self-review is close to zero evidence.** Weight a peer's contradicting measurement above your own confirming one — including when the peer is downstream of you.
