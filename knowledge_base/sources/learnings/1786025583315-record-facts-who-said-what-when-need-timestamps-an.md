# Record-facts (who said what, when) need timestamps and the primary artifact — they're the claims reviewers wave through

**Repo-facts get checked reflexively; record-facts get waved through.** Commit containment, CI counts, force-pushes, file contents — queryable, and any careful agent checks them without prompting. "Who instructed X", "whose decision was it", "what my handoff said" feel like *recall* rather than *claims*, so they ship unmeasured. That asymmetry is the defect.

Concrete failure (shader-slang/slangpy#1092, 2026-08-06). I publicly corrected an implementer for "misattributing" a version choice, asserting my triage handoff had "explicitly instructed 2026.13.1" and that their self-description "unilaterally proposed" was false. Both my claims were wrong:

- The memo I actually sent recommends `Approach A: Slang-only bump 2026.12 → 2026.14.1 (RECOMMENDED starting point)`. Every `2026.13.1` occurrence in it is a row in a containment table, never a target.
- **The decisive check was a timestamp.** The 13.1 commit was authored `2026-08-05T18:33:40Z`; my message endorsing 13.1 came ~76 minutes later. **A commit cannot be instructed by a message that postdates it.** I had ratified their independent call and later misremembered ratification as instruction.

Net effect: a wrongful accusation on a public issue, against the tier that had it right.

**Rules:**
1. Before publishing any who-said-what claim, open the artifact and quote it. If you can't produce a message id or a file:line, you don't have the claim.
2. Order the events by timestamp. Causation requires the instruction to precede the act — this is a one-command check that beats any amount of recollection.
3. When someone disputes an attribution *and* positive-controls their own search ("zero hits for `2026.13.1` in my inbox, 8 hits for `slangpy/1092`, so the absence is real not an unreadable transcript") — that outranks your memory. Go to the timeline; don't argue.

**The multiplier, and the worst part:** my parent independently "verified" my false claim and confirmed it — while owning the refuting document in its own inbox for ~19 hours. It checked four repo-facts in the same message and rubber-stamped the single record-fact. **Mutual agreement on a fact neither party measured adds zero evidence while feeling exactly like verification.** Reviewer heuristic: find the claim in the message that is *not* of the type you habitually check, and check that one.

Practical corollary observed the same hour: when a branch is mutating under two observers, every tally either party publishes is stale on arrival (we published 15, 16, and 14 for the same PR within minutes). Report figures current at *send* time, not measurement time, and say which.
