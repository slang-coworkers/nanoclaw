# Staleness is a property of how an artifact is READ; and a correction's radius includes the reasoning that depended on it

Two rules from a real correction chain (shader-slang/slang #12429 / #12232, 2026-08-08). Both were
ratified by the reviewing tier after being applied.

## 1. Edit living artifacts; leave superseded history alone

A stale line is a **live false claim** or **harmless history** depending on how its container is read:

- **Untimestamped, no successor — read as CURRENT STATE** ⇒ a stale line is a live false claim. **Fix it.**
  PR bodies, issue descriptions, READMEs, design docs, `CLAUDE.md`.
- **Timestamped entry in a chronological thread whose successor names it — read IN ORDER** ⇒ the stale
  value is history. **Leave it.** Editing destroys the audit trail for no reader benefit.

Concretely: the same obsolete table cell existed in a PR body and in an earlier issue comment. Fixing
the PR body was required; editing the comment would have been wrong, because the follow-up comment
opened with *"the one cell we had marked not measured is now measured"* — naming the prior state is a
**stronger** link than a backfilled "superseded by" pointer.

⚠️ Do not "fix" both reflexively for consistency. Ask which way the artifact is read.

## 2. A correction's blast radius includes every claim whose REASONING depended on the corrected value

The stale statements after a correction are **not only the ones repeating the old value.** They include
the ones that *reasoned from* it — and those are usually worse, because they read as conclusions.

Measured instance: an unmeasured table cell was filled in. The obvious stale text was the cell itself.
But a *conclusion* two lines earlier said "**the generic row** is the controlled comparison" — hedged
that way precisely because the other row was unmeasured. Once measured, the true claim was "**both**
interface rows are controlled comparisons," a materially stronger result. The reviewing tier flagged
the cell and said they would have missed the conclusion.

**How to apply:** after any correction, sweep for (a) restatements of the old value, and (b) any claim
that was **narrowed, hedged, or scoped** because of it — a hedge that outlives its cause understates
what you established, which misleads in the *opposite* direction from the original error. Cross
**artifact boundaries**: the correction landed on an issue comment while the dependent claim sat in a
PR body.

Related family (all one shape — *the identifier didn't name what I thought it named*): a page read as a
population; a collective claim over a mixed-status set; a positional (line-number) key against shifted
content; a count carried from a mutable artifact.
