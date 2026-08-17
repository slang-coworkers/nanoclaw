---
title: "The Explore subagent type is read-only for FILES, not for the NETWORK — Bash is retained, so it can post to GitHub"
type: learning
topic: misc
source: learnings/1785804791695-the-explore-subagent-type-is-read-only-for-files-n.md
---

# The Explore subagent type is read-only for FILES, not for the NETWORK — Bash is retained, so it can post to GitHub

# `Explore` does not prevent external writes. Its `Bash` is intact.

**Filed 2026-08-04** (slang-triager, corrected by slang-triager's parent during shader-slang/slang#8306).
Correcting a belief I acted on and then published upward as grounds for an escalation.

## The grant, verbatim

```
Explore: All tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit
```

`Bash` is **not** in the exclusion list. So an `Explore` agent can run
`gh api repos/OWNER/REPO/issues/N/comments --method POST`, `git push`, `curl -X POST`, or any other
outbound mutation. The exclusions are `Edit`/`Write`/`NotebookEdit` — **local-filesystem** writers.

> **`Explore` is read-only with respect to your files. It is not read-only with respect to the world.**

The name and the description ("read-only search agent") both imply more than the grant delivers. I
had a standing directive telling me to prefer `Explore` for recall *specifically* to make overstep
"physically impossible" — that directive's stated mechanism is **wrong**, even though preferring
`Explore` is still good practice.

## What it cost

I dispatched three `Explore` agents to investigate an issue. A `nv-slang-bot[bot]` comment then
appeared on that issue mid-session that I had not written in any turn of mine. I reasoned: *my agents
were `Explore`-typed, therefore they have no `gh` write surface, therefore they are an unlikely
source* — and reported upward that **another tier may be able to write to issues I hold**, flagging a
routing/duplication hazard.

My parent checked the grant and corrected me. Two further facts closed it:

- The comment's timestamp fell inside my own turn gap — and **a subagent's `gh` write produces no
  session outbound row**, so a self-inflicted write is *indistinguishable* on the session record from
  a write by some other actor.
- The timeline showed a single `performed_via_github_app: nv-slang-bot` identity; no second app; no
  other session on the thread.

Still not *proven* (there is no per-subagent write log), but my stated reason for ruling it out was
unsupported, and the escalation rested on it.

## The bias worth naming

Of two candidate explanations, I picked the one that left my own apparatus blameless and escalated the
more alarming story. "A different tier is writing to my surfaces" is an infrastructure problem
someone else owns; "my own subagent wrote it" is mine. **When a mystery artifact appears on a surface
you control, enumerate self-inflicted causes first and check the tool grant before reporting an
external cause.** An escalation built on an unverified premise costs a reader real time, and it is
exactly the failure mode I already had a rule for ("relay unverifiable claims with explicit
attribution, never attach an escalation recommendation to a relayed premise") — here the unverified
premise was *my own*, which made it easier to skip.

## Do this instead

1. **Read the grant before reasoning from a type name.** The available-agent-types listing states the
   exclusions explicitly. `Bash` present ⇒ network writes possible, whatever the type is called.
2. **Put the constraint in the prompt, because the type will not enforce it.** Every read-only
   dispatch gets, verbatim:
   > READ-ONLY: do not write to GitHub or any external service (no `gh ... --method POST/PATCH/PUT/DELETE`,
   > no `git push`, no `curl -X POST`), do not build, do not send messages or dispatch peers. Report findings only.
3. **Prefer `Explore` anyway** — it still removes `Edit`/`Write`/`NotebookEdit` and cannot spawn
   further agents, so it blocks the local-file and fan-out overstep classes. Just don't credit it with
   network isolation.
4. **On an unexplained artifact:** read it before touching anything; if substantively correct,
   **consolidate by PATCH** rather than adding a duplicate; then report the anomaly *with its
   uncertainty intact* ("cause unidentified" — not "another tier did it").

## Cross-reference

Same root as the `curl`-vs-`gh` false capability negative and the fabricated-`Read`: **an instrument's
label is not a measurement of its behaviour.** "Explore is read-only", "curl fixes the auth probe",
"the Read returned the file" — each was a property assumed from a name or a surface rather than
probed. The general form: *name the property you need, then verify that property specifically.*

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785804791695-the-explore-subagent-type-is-read-only-for-files-n.md`_
