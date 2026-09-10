---
name: feedback_read_every_write_site_before_asserting_an_invariant
description: "RUN `grep -n '<member>'` OVER EVERY FILE THAT TOUCHES IT BEFORE ASSERTING AN INVARIANT — one call returns the complete write set. FOUR corrections on one mechanism (slang m_typeCheckingCache) in 20 min, each narrower, none caught by mutual review until the mechanical enumeration ran in round 3 and found a 4th write site both tiers had missed. Cross-reading each other's prose is a WEAKER instrument than one grep: it finds errors serially, one per round, while enumeration returns all of them at once. Also: an intent-describing comment supplies semantics you skip verifying; being RIGHT about an adjacent fact licenses stopping early; only a BOUNDED search licenses stopping at all."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# Reading one write site correctly licenses NOTHING about the invariant

## ⛔⭐⭐⭐ THE COMMAND, ADDED AFTER A 4TH NARROWING — run this BEFORE reasoning

```bash
grep -n '<member>' <the files that touch it>      # ONE call = the complete write set
```
**This is the rule.** Everything below is why. slang-discord-support's pushback, which outranks my
original framing: *"two agents reading each other's prose is a weaker instrument than one `grep` over
write sites."* Neither of us ran it until **round three**, while both confidently correcting the
other. Mutual review found errors 1–3 **serially, one per round**; the enumeration returns all of
them **at once, before any ship.** ⇒ ⭐⭐⭐ **I was crediting the expensive instrument that happened
to be running.** A rule naming a COMMAND gets executed; a rule naming a DISCIPLINE ("read producer
and consumer") gets recalled.

⚠️**A 4th site existed that both of us missed through three rounds:** `slang-session.cpp:147-149`
lazily constructs an **empty** cache, and `:825`'s null-guard means the **first** Linkage of a
process is never seeded. So supersetness is conditional on the global being non-empty at creation —
not structural as claimed.

✅**What the 4th round ESTABLISHED (the positive finding, easy to lose):** because the gate is on
**size**, the larger cache wins **regardless of teardown interleaving** — both destruction orders in
the cold-start trace land on the same result. The mechanism tolerates arbitrary ordering.

⛔⭐⭐⭐**THE ASYMMETRY THAT SETTLES IT (discord-support's, and it outranks everything above): MUTUAL REFUSAL HAS NO TERMINATION CONDITION.**
It stops when both parties run out of things to look at — which is **indistinguishable from correctness**, and gets credited as convergence. A write-site
`grep` terminates because **the set is finite and knowable**. ⇒ The two instruments do different jobs and are NOT substitutes: **mutual refusal guards
against INHERITING an unverified claim** (it is what stopped either of us adopting the other's figures all evening); **enumeration BOUNDS THE SEARCH.**
Tonight I had the expensive one running and credited it with the cheap one's coverage.

⭐⭐⭐**"Converged" vs "no one has found the next one yet."** Four narrowings is a warning about
confidence at each step. What made round 4 different is not that it was fourth — it is the first
produced by an **exhaustive** method rather than by someone happening to look somewhere new.
**Only a bounded search licenses stopping.**

**2026-08-05, Main + slang-discord-support, slang `m_typeCheckingCache`.** **Four** corrections on one
mechanism in twenty minutes. Every step was **narrower** than the last. Rounds 1-3 were each found by
someone reading a *different half of the object*; **round 4 came from the mechanical enumeration above**
— which is the point: cross-reading found them one per round, the grep would have found all at once.

| # | Claim | Who caught it | What was unread |
|---|---|---|---|
| 1 | `~Linkage` **merges** the cache back | discord-support | the operation itself (`:127` is a bare `RefPtr` assign — a **replace**) |
| 2 | ⇒ content is **not** accumulated; "largest single Linkage's cache, not the union of all work" | discord-support (self) | the **producer** side — `createSession` seeds each Linkage *from the current global* |
| 3 | ⇒ (mine, sharpened) "you pay a growing price for a cache **periodically thrown away**" | discord-support | same — overshot in the opposite direction |

**The verified mechanism** (both halves, `slang-global-session.cpp:823-828` + `slang-session.cpp:119-130`):
seeding makes a departing cache normally a **superset** of what it replaces, so

```
Sequential:  G=400 → A copies 400, adds 50 → G=450 → B copies 450, adds 30 → G=480
             ⇒ accumulates losslessly. REPLACE ≡ MERGE here.
Concurrent:  A and B both snapshot G=400 ; A→450 lands ; B→550 replaces it
             ⇒ A's 50 entries LOST while the count ROSE 450→550.
```
Size is monotonically non-decreasing **always**; content is lossless **sequentially**, lossy **only
under overlapping snapshots**. Entry loss is **invisible in the size**.

## Rules

- ⛔⭐⭐⭐ **An invariant over a data structure is a claim about EVERY site that writes it.** Read the
  producer *and* the consumer before asserting what is preserved. Correction #2 read the destructor
  perfectly and inferred the wrong invariant because the constructor determines it.
- ⛔⭐⭐⭐ **"I checked the operation and inferred the invariant"** is the compact form of the defect.
  Verifying an *operation* is local and cheap; an *invariant* is global and needs the whole write set.
- ⭐⭐⭐ **Being RIGHT about an adjacent fact is what licensed stopping.** discord-support had just
  correctly corrected my verb, and that fresh accuracy felt like solid ground for the next inference.
  ⇒ **a fresh correct finding is the least-audited moment in an exchange** — it arrives with visible
  rigor attached. Cf. [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]].
- ⭐⭐ **An intent-describing comment supplies semantics you then skip verifying.** My error: the block
  is headed `// Upstream type checking cache.` — "upstream" invites *contribute-into*, so I read a
  size-guarded **merge** two lines above a bare pointer assignment. **The unopened state was inside a
  block I had opened**; the comment filled in what I didn't read.
- ⭐⭐ **Convergence looks like each claim getting NARROWER.** merge → replace →
  replace-that-is-usually-a-merge-except-under-overlap. If corrections keep getting *broader*, someone
  is generalizing rather than measuring.
- ⭐⭐ **A narrower claim is often the MORE useful one to ship.** "Lossy under concurrency" names the
  condition; "periodically thrown away" asserts general unreliability and would misdirect a maintainer
  away from the documented one-session-per-thread pattern where the cache is perfect. And the narrow
  condition *was* the reported scenario (the user described multiple threads).
- ⭐⭐ **Correlated derivations are not corroboration.** discord-support declined credit for ~12
  subagents independently finding one fact: they got near-identical prompts, so agreement measures
  **prompt similarity**, and they would have reproduced its framing error in unison. Honest reading:
  weak evidence about *discoverability*, none about correctness. Same defect as two instruments that
  degenerate to the same wrong answer.
- ⭐ **Correct in the open, not quietly.** Its `latest-report.md:90` carries both corrections *inline*
  rather than a silently-fixed version, and the log notes the draft is with the operator so the
  correction travels with the artifact.

Related: [[feedback_control_the_instrument_not_the_reasoning]] (open the artifact),
[[feedback_correction_unapplied_until_every_restatement_fixed]] (sweep the restatements — here the
restatement was already routed upstream), [[feedback_a_correct_rule_with_an_unvisited_boundary]].
