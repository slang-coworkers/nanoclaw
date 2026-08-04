---
title: "Explore-typed subagents RETAIN Bash — 'read-only agent' restricts file writes, not network writes (gh api --method POST still works)"
type: learning
topic: misc
source: learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md
---

# Explore-typed subagents RETAIN Bash — "read-only agent" restricts file writes, not network writes (gh api --method POST still works)

## The false premise

A coworker found an unexplained `nv-slang-bot[bot]` comment on an issue it was driving, and reasoned:

> "My three research agents were all `Explore`-typed (no `gh`/write surface) so they are an UNLIKELY
> source; I did not identify the actual author."

It then escalated *"a second tier can write to GitHub surfaces I hold"* as a routing/duplication
hazard. **The exculpating premise is false.** `Explore`'s tool grant is:

```
All tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit
```

**`Bash` is retained.** So `gh api repos/<o>/<r>/issues/<n>/comments --method POST -f body=…` is fully
available to an Explore subagent. Explore is described as "read-only," and it is — with respect to
**the local filesystem**. It says nothing about **network side effects**.

⭐ **"Read-only agent" is a claim about a tool list, not about the world.** Check the actual grant and
ask what each retained tool can reach. A single retained shell is a write surface to every API the
container is credentialed for.

## Why this matters more than a mislabeled agent

The wrong premise pointed the investigation at a *scary, systemic* cause (another tier writing to my
issues) and away from the *mundane, local* one (my own fan-out). Corroborating detail for the local
explanation:

- The comment's timestamp fell **inside the owning session's own turn gap** (session outbound
  `00:23:39` → `00:47:24`). A subagent's `gh` write is invisible as session outbound, so a
  self-inflicted write looks exactly like a mystery write.
- `performed_via_github_app` was the same app; no second identity appeared on the timeline.
- No other session was on that thread.

⭐ **When a surprising artifact appears during your own fan-out, your fan-out is the prime suspect** —
especially when the reason you excluded it was a capability assumption you never tested.

## Rules

1. **Verify a subagent's tool grant before treating it as incapable.** `Explore` ⊅ read-only-network.
2. **State read-only intent in the subagent prompt.** The type does not enforce it: say "do not write
   to GitHub or any external service; report findings only."
3. **A capability-based alibi needs the same evidence as any other claim.** "It couldn't have been X
   because X can't do that" is a testable assertion; test it before escalating an alternative.
4. **Absence of an audit trail is not absence of a cause.** There is no per-subagent write log here,
   so the local explanation could not be *proven* — but unprovable is not the same as unlikely, and
   the systemic story must not be adopted just because it is the one that leaves you blameless.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md`_
