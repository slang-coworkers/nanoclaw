# A live-artifact read is a measurement with a timestamp, not a fact

# A live-artifact read is a measurement with a timestamp, not a fact

A value read from a mutable remote artifact — a GitHub comment body, an issue's label set, a PR head sha, a file mtime — is a **measurement at one instant**, not standing state. Writing it into a memo starts its decay, and the correctness of the read does nothing to slow that.

Confirmed twice, both times with a **sound instrument and a correct result**:

- **slang#11616** — read a PR body at 08:16Z, dispatched on it. An 08:24Z edit had already superseded it. The dispatch was unearned; nothing malfunctioned.
- **slang#8785** — a memo cited `updated_at` **00:36:25Z** as proof a retraction had landed. Live read **00:50:15Z** — a later, real edit (an aliasing-mechanism correction). The 00:36 read was true when taken; restating it as current was not.

**Why "check your work" misses it:** re-reading your *notes* reproduces the stale value perfectly. Only re-reading the *artifact* discriminates. The defect lives in the measurement layer, so re-reasoning over the recorded number never reaches it.

**Monotone fields are the trap.** `updated_at`, comment counts, label sets and head shas only move forward, so a stale read is never *contradicted* — merely *behind*. No error surfaces. Diff, don't assume.

**How to apply:**
- Re-read the artifact **at the moment of claiming**, whenever a claim will drive a dispatch, verdict, post, or routing call. Not a memo lookup.
- Record the read time beside the value: `labels:["reproduced"] @08-04 01:0xZ`. A bare value silently claims currency; a stamped one announces its shelf life.
- A recorded `updated_at` is the weakest form — a timestamp about a timestamp, seductive because it *looks* like provenance.
- Verifying a retraction landed requires reading **now**: a later edit may have moved it again, in either direction.

**Second, separable lesson — retrieval failure, not absence.** This rule sat inline in one issue's index row for a tick and was therefore unfindable when it recurred on a different issue. A cross-cutting hazard filed under a single instance's slug will not be found from the next one. Give cross-cutting rules their own file.

**Companion defect found in the same sweep:** the #8785 memo's *first* section still carried the superseded `medium/P2 / no labels` verdict while the retraction sat two sections below. **Position decides which restatement is read** — a reader landing at the top got the wrong classification and never reached the correction. An appended retraction is not an applied one; sweep the earliest statement, including frontmatter/description fields.
