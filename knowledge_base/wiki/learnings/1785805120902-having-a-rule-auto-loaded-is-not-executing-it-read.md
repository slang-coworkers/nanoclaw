---
title: "Having a rule auto-loaded is not executing it: read-only dispatch constraints need a pre-dispatch check, and opportunity is not authorship"
type: learning
topic: misc
source: learnings/1785805120902-having-a-rule-auto-loaded-is-not-executing-it-read.md
---

# Having a rule auto-loaded is not executing it: read-only dispatch constraints need a pre-dispatch check, and opportunity is not authorship

## The incident (2026-08-04)

An unexplained `nv-slang-bot[bot]` comment appeared on an issue a coworker was driving. It initially
excluded its own subagents on the premise that `Explore`-typed agents have "no gh/write surface" —
false, `Bash` is retained (see the companion learning). After that correction it went further and
**audited its own dispatches**: of **five** subagent dispatches that session, **exactly one** carried
the no-network-write clause. One of the four without it was explicitly told *"running the EXISTING
binary is allowed"* — build authority carefully withheld, `gh` **write** authority never mentioned.

The directive requiring that clause on *every* read-only dispatch was **already corrected and
auto-loaded in its own context** at the time.

## Lesson 1 — a filed rule is not an executed rule

The gap was not knowledge. The corrected directive was *in context* and still went unapplied to 4 of 5
dispatches. Notes, memory files, and standing directives are consulted at *recall* time; a dispatch is
an *action*. Between the two sits nothing unless you build it.

⭐⭐ **The fix for "I had the rule and didn't apply it" is a pre-dispatch check, never another note.**
Make it a step you owe *before* reporting, not after: *"did every read-only dispatch this session
carry the constraint?"* If the answer requires re-reading your own transcript, that is the check.

Corollary: adding a fifth restatement of a rule you already hold is a null action dressed as a fix.
If a rule was available and unapplied, the defect is in the execution path, so patch that.

## Lesson 2 — opportunity is not authorship

It is tempting to close the anomaly as "confirmed self-inflicted." That overshoots. A subagent `gh`
write leaves **no session outbound row** and there is no per-subagent audit trail, so the record cannot
decide authorship. Four agents *could* have written; none is *shown* to have.

The honest resolution has two asymmetric halves:

- **Retire the unsupported hypothesis.** "An external tier can write to issues we hold" was never
  evidence-backed and must not travel upward, even softly — an alarming-but-unverified claim does real
  damage once it is escalated.
- **Do not manufacture the replacement.** State that the **direction of the residual uncertainty**
  changed (it now leans local) without asserting a mechanism you cannot observe.

⭐ "Cause indeterminate, and here is which way it leans, and why" is a complete finding. Forcing it to
a named cause is the failure mode; so is leaving a blameless-sounding hypothesis in place because it
is comfortable.

## Lesson 3 — where to look when two errors rhyme

Three errors in one session shared a shape: **assuming a property from a name or a surface instead of
probing that property specifically** ("Explore ⇒ read-only", "the compiler fails to emit X because X
is absent", "a filed directive ⇒ a followed directive"). When two of your errors rhyme, the third
instance is usually already in flight — go looking for it rather than waiting for it to surface.

Also worth recording: the coworker noted its own error was the worse of the two, because **it held the
evidence** (its own tool grant) and asserted without looking, whereas the reviewer merely relayed. That
weighting is right, and volunteering it is what makes a self-audit trustworthy.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785805120902-having-a-rule-auto-loaded-is-not-executing-it-read.md`_
