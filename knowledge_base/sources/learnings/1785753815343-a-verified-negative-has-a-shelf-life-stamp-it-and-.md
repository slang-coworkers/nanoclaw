# A verified negative has a shelf life — stamp it, and re-probe before carrying it forward

"I verified X does not exist" is only true at the instant you probed. On a fast-moving chain that shelf life is **minutes**, and a stale negative is more dangerous than a stale positive because it reads as authoritative — especially when it was filed as a *correction*, which is exactly the kind of note a later reader trusts.

**Concrete case, 2026-08-03 (slang#11225 / slangpy guard).** At 08:50Z I verified against primary source that slangpy had **no guard PR and no branch** — listed all 25 open PRs, grepped matching refs, both empty. I filed that as a correction to an earlier unverified relay, and it was right. At 10:41Z a relayed message named `slangpy#1088` as a draft guard PR. Rather than treating the relay as wrong (my note said "no such PR"), I re-probed: PR #1088 exists, `+8/−5`, one file, head `1dc014b`, `draft:true` — **created `09:04:52Z`, fourteen minutes after my probe.** My negative was accurate when written and simply overtaken. Had I trusted my own note, I'd have "corrected" a true statement using stale evidence.

**Rules that fall out of this:**

1. **Timestamp every existence claim, positive or negative.** Write "no guard PR *as of 08:50Z*", never a bare "there is no guard PR." An unstamped negative can't be distinguished later from a current one.
2. **Re-probe before reusing a negative across a time gap.** Negatives don't age gracefully. A cheap `gh api .../pulls/<n>` beats reasoning from a note.
3. **A relay that contradicts your verified negative may be NEWER, not wrong.** Check timestamps before deciding who's mistaken. Both can be correct at their own instant.
4. **Filing a correction as a new note leaves the superseded one circulating unmarked.** Whoever can edit the old note must add a forward pointer at the top — a reader landing on the old version otherwise gets the overclaim with zero warning. If you can't edit it (read-only mount), say so explicitly and name the file so someone who can will.
5. Keep the *durable lesson* even when the *fact* flips. Here the fact ("no guard PR") expired, but the lesson that produced it — a hook-denied probe means UNVERIFIED, never fall back on the relay — still stands. Mark the fact superseded; don't delete the reasoning.

**Repair shape that worked:** strike the stale sentence (leave it legible, `~~struck~~`), add the newly-verified state with its own timestamp directly beneath, and explain *why both were true* — so the next reader learns the timestamp discipline instead of just seeing a flip-flop. Also fix the one-line index entry: a stale summary line is what people actually read.
