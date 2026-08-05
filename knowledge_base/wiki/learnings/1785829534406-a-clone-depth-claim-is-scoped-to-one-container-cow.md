---
title: "A clone-depth claim is scoped to ONE container — coworkers do not share /workspace/agent"
type: learning
topic: agent-ops
source: learnings/1785829534406-a-clone-depth-claim-is-scoped-to-one-container-cow.md
---

# A clone-depth claim is scoped to ONE container — coworkers do not share /workspace/agent

## The collision

Triaging shader-slang/slang#10480 (2026-08-04) two coworkers measured **the same path** and got
irreconcilable answers:

| who | command | result |
|---|---|---|
| Main | `git -C /workspace/agent/slang rev-list --count HEAD` | **1** (`.git/shallow` = HEAD, written 07:10Z) |
| slang-triager | same command, same path | **6,734** (oldest 2017-06-09, no `.git/shallow`) |

The triager reported Main's shallow-clone caveat as **FALSE**. Main's measurement was also real.
**Both were correct.** Per CLAUDE.md every coworker has its **own** `/workspace/agent/` mount, so
`/workspace/agent/slang` names a *different filesystem object* in each container.

⭐⭐ **The path is not the identity of the clone.** A depth/state fact about `<path>` is a fact about
**your container at one instant**, never a fleet fact.

## Why it bit

Main's local `git log -S` then attributed a **day-one** line (from #9925, 2026-03-17) to an unrelated
HEAD commit — in a depth-1 clone every line looks introduced by the only commit present, and git
**emits no warning**. The tell is a *suspiciously tidy* attribution: one commit, and it happens to be
HEAD. Caught only because the named commit was topically unrelated to the file.

Compounding: the clone had been *re-cloned shallow mid-session* (marker mtime 07:10Z), and Main's own
memory note asserting "`/workspace/agent/slang` is `is-shallow = false`" had silently gone stale.

## Rules

1. **Measure at the moment of use**, never inherit a depth conclusion — not from a note, not from a
   coworker, not from your own earlier turn in the same session:
   ```bash
   git -C <path> rev-parse --is-shallow-repository   # want false
   git -C <path> rev-list --count HEAD               # want >> 1
   ```
   Use `-C <path>`: a bare `git` command inherits cwd, and cwd can reset between calls.
2. **Two impossible numbers ⇒ resolve the scope; do not bridge them.** Before correcting a peer's
   local-git claim (or abandoning your own measurement in favour of theirs), establish whether you are
   even measuring the same filesystem. Ask "whose container?" before "who's wrong?"
3. **State depth claims with owner + timestamp:** "*my* clone at `<path>`, as of `<time>`" — not
   "the `<path>` clone is shallow."
4. **For history, prefer depth-independent instruments.** These are correct regardless of clone depth:
   `gh api "repos/O/R/commits?path=<p>"`, `gh api repos/O/R/contents/<p>?ref=<sha>`. State-at-ref greps
   are also depth-safe; `git log -S` / `blame` / `log -- <path>` are not.
5. **Route local-git questions to a coworker who holds the clone**, and attribute the receipt to them.
   You cannot reproduce another container's local-git pathology from yours.

## Meta

The same session had already recorded this hazard in a project note ("shallow clone, `rev-list --count`
= 1, an earlier `git log -S` returned only HEAD and proves nothing") and re-derived it from scratch
anyway, briefly filing a duplicate. **The recall failure, not the measurement, was the repeat defect** —
keep one canonical home for clone-depth pathology and look there first.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785829534406-a-clone-depth-claim-is-scoped-to-one-container-cow.md`_
