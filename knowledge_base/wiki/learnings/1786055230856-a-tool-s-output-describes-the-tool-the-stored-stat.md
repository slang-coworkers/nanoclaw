---
title: "A tool's output describes the tool; the stored state describes the world"
type: learning
topic: misc
source: learnings/1786055230856-a-tool-s-output-describes-the-tool-the-stored-stat.md
---

# A tool's output describes the tool; the stored state describes the world

# Verify the stored state, never the command's report of itself

**Four distinct failures in one session** (shader-slang/slang#12401 chain, 2026-08-06) collapse into
one rule. Each time a command reported something true *about itself* that was read as a fact about the
world:

| what was read | what it actually meant | what to read instead |
|---|---|---|
| `gh run cancel` → `✓ Request to cancel workflow submitted` | the *request* was accepted | `gh api repos/o/r/actions/runs/<id> --jq .status` — it stayed `queued` indefinitely |
| `ncl tasks update --series-id …` → printed help | **wrong flag, silent no-op** | `ncl tasks get --id <id>` and grep the stored prompt |
| a local copy of a PR body | what you *meant* to publish | `gh pr view --json body` (or `gh api …/pulls/N --jq .body`) |
| `append_learning` exposes no edit path | *your interface* has none | the files are plain markdown, `rw` to another actor — **ask who can** |

**Why this class is dangerous:** every one of these fails toward *"verified."* The command exits 0 (or
prints something reassuring), so the check appears to have passed. Nothing logs the gap.

## Corollaries with teeth

- ⭐⭐⭐ **A dead fallback is worse than no fallback, because you stop watching.** The `ncl` no-op would
  have left a scheduled horizon un-updated while it was *reported as armed* — the wait would have
  expired asking a question already answered.
- ⭐⭐⭐ **A parse failure is not a negative result.** A verifier died and printed `(unparsed)`, which
  reads almost exactly like *"old wording absent ⇒ update succeeded."* So the silent no-op **and** the
  broken checker both failed toward "verified" and would have confirmed each other. Same shape:
  `grep -n ']\(...'` dying with `Unmatched ( or \(` produces no output and a non-zero exit —
  indistinguishable at a glance from a clean sweep. **Every check needs its FAILURE distinguishable
  from its NEGATIVE RESULT.**
- ⭐⭐ **Discriminator vs symptom.** A *count* is a symptom; a *class filter* is a discriminator. 30
  skipped CI jobs can come from a docs-path filter, matrix exclusion, or a priority yield — the count
  cannot tell you which. Filtering by job **name** (`build|test-|rhi|sanitiz|…`) and finding *all* of
  them skipped is a discriminator: any single success or failure in that set would prove compilation
  happened. Ask what else could produce this number before treating it as evidence.
- **Round-trip through the published artifact.** To verify something you emitted, extract it back from
  where the consumer will read it (published body, remote branch, stored task record) and re-run the
  consumer's operation on it — not on your local source.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786055230856-a-tool-s-output-describes-the-tool-the-stored-stat.md`_
