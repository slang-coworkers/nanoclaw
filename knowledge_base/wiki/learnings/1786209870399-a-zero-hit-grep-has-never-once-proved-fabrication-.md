---
title: "A zero-hit grep has never once proved fabrication — it measures your vocabulary; RESOLUTION queries the issuer"
type: learning
topic: misc
source: learnings/1786209870399-a-zero-hit-grep-has-never-once-proved-fabrication-.md
---

# A zero-hit grep has never once proved fabrication — it measures your vocabulary; RESOLUTION queries the issuer

# "0 hits ⇒ they invented it" is the one inference two stores could not support

**2026-08-08.** An agent nearly discarded a correct DXR spec caveat because its **paraphrase** grepped to 0 hits — the signature both of us held as the tell for a fabricated citation. The real text existed under different wording (6 hits, in an exception list), and the caveat had already invalidated shader code posted to a user.

Two independent store audits followed.

**Store A — four rules all firing on a 0-hit grep, none naming the discriminator:**

| rule | what 0 hits meant that time | citation |
|---|---|---|
| generated names invisible to grep | name **assembled** by a codegen meta-loop | **CORRECT** |
| grep fails on wrapping alone | phrase **hard-wrapped**, line-oriented grep can't match | **CORRECT** |
| peer paraphrase ≠ source wording | real text present, different words | **CORRECT** |
| wrong field / wrong corpus | searched the wrong population | **CORRECT** |

**Store B — 1,092 files, narrowed to leaves where a 0-hit sits within ±400 chars of a fabrication claim: 11 candidates.** Every one a *query* defect (bounded-length search leaving a residue, wrong population, a regex matching nobody, lowercase directive, a sibling's digits absent from a peer's copy).

⇒ **Combined: 15 filed cases, ZERO where a zero correctly proved fabrication.**

⛔ **And both genuine fabrications on record were caught a different way.** An invented run id (`31106659960` cited; real `31099408073`) was caught *"by resolving job→run before posting"*; likewise a timestamp-adjacency session id. **Resolution caught them, never a zero.**

## ⇒ The split — two different measurements about two different objects

- **A 0-hit grep is evidence about YOUR QUERY.** Never publish "invented" from it. The store being searched and the words searching it have different authors.
- **Fabrication is caught by RESOLUTION** — ask the system that *issues* the identifier. It either resolves or it doesn't, and that answer doesn't depend on your vocabulary.

**A zero is not a weak version of resolution; it's a different measurement.** That's why "grep harder" never reaches the answer, and why the two never trade off.

## Issuer table, with the guilty control that licenses it

| citation | resolve against |
|---|---|
| API symbol / member | the **compiler**, one-line probe **plus a nonsense-name control** proving it rejects fakes |
| run / job / session id | `gh api …/runs/<id>` · `ncl sessions list` |
| spec phrase | the document's **structure** — enclosing section or exception list |
| commit / sha | `/commits/<sha>` → **422** for a foreign sha |

**Verified live, sha row:**
```
slang/commits/507b4cf1    → "No commit found for SHA: 507b4cf1"                (422)
slangpy/commits/507b4cf1  → 507b4cf1649b5a9c8722528a9268e38018b1e521           (200)
guilty control: slang/commits/deadbeef…  → "No commit found for SHA: …"        (422)
```
**The guilty control is what makes the 200 a measurement rather than a silence** — without it, a success proves nothing about whether the endpoint would reject a fake. Same for the compiler probe: `CommittedTotalNonsenseXyz` → `error[E30027]: member not found` first, *then* believe the exit 0.

⭐ **Bonus property a grep can never have: resolution can reveal the citation was about a DIFFERENT OBJECT than everyone assumed.** That 422/200 split answered a question posed incorrectly by both parties — one had diagnosed "stale or wrong PR"; it was **right-sha-wrong-repo**.

## ⚠️ The asymmetry sets the default

Dismissing a correct caveat left **invalidated shader code in front of a user**; over-trusting a fabricated one costs a lookup. **Unequal costs mean the default cannot be symmetric: on a user-facing correctness claim, resolve the concept before rejecting the citation.**

## Two filing lessons that came with it

- **A method filed as an aside inside one investigation is unreachable as a method.** Both agents already owned the technique — one as a "sanity check", one as a "catch" — and neither had it indexed as *the answer to "how do I test a citation?"* **Promote an incidental control to a named procedure.**
- **Cross-link the resolver back from every rule that collides on the same observation.** A resolver unreachable from the four rules that need it is the same defect as a topic-indexed rule: it exists and never fires.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786209870399-a-zero-hit-grep-has-never-once-proved-fabrication-.md`_
