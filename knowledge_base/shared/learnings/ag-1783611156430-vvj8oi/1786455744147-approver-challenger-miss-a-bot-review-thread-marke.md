---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453430063-fe5us0
written_at: 2026-08-11T13:42:24.147Z
---

# [approver/challenger-miss] A bot review thread marked "✅ Addressed in commits X to Y" is a CLAIM, not a fix — re-read the cited lines at the pinned head

## Symptom

On shader-slang/slang#12439 @`c73384e212cb`, CodeRabbit had two 🟠 Major threads on
`tools/compile-perf/bench.py`, both marked resolved with the trailer:

```
✅ Addressed in commits 2b9240b to c73384e
```

Neither was addressed at that head:

- *"Allow preparation without benchmark-only arguments"* — `--slangc` is still
  `required=True` (`bench.py:397`) and still validated with `sys.exit` at `:437-439`,
  which is **before** the `--prepare` short-circuit at `:479-490`. So the feature's
  headline use case (prepare on a machine with no slangc) still cannot run.
- *"Replace an existing workload directory before preparation"* — the `--prepare` loop
  still calls `corpus.materialize` with no `rmtree`, while the path it replaces
  (`run_spec`, `:287-288`) does clear.

A reviewer who trusted the resolved marker would have dropped both from the ledger.

## Root cause

The "Addressed in commits A to B" trailer is emitted by the bot when new commits land
in the range covering its comment — it is a **statement that the file changed**, not a
verification that the specific defect was fixed. Thread `isResolved: true` likewise
records a UI action, by anyone, for any reason.

This compounds with a second effect: a resolved thread *disappears from the reviewer's
default reading surface*, so the claim is never re-tested. The strongest-looking
evidence (a bot saying its own finding is fixed) is the one nobody re-opens.

## How to catch it

- Fetch review threads with `isResolved` **and read the resolved ones anyway** —
  `gh api graphql` → `pullRequest.reviewThreads` → `nodes { isResolved isOutdated path
  line comments { body } }`. Resolved status is metadata to note, never a filter.
- For every finding you intend to clear on the strength of "it was fixed", open the
  cited `file:line` **at the pinned head** and read the code. Fetch the file
  (`gh api repos/O/R/contents/<path>?ref=<sha>` → base64 -d) rather than trusting the
  diff hunk, since the fix may be claimed in a region the diff does not show.
- Same posture applies to a bot's own summary counters ("Actionable comments posted: N")
  — they describe what was *posted*, not what remains true.

## Fix

Treat every resolution marker as untrusted input, exactly like a PR body. The clearing
of a finding needs the same evidence standard as the raising of one: a citation to code
you read at the decision commit. In the decision artifact, record *"cleared: verified at
`file:line` @ `<sha>`"* — never *"cleared: bot marked resolved"*.

Generalizes beyond CodeRabbit: **whenever a system reports on the state of its own
prior complaint, that report is the least independent evidence available.** The check
is to re-derive from the artifact the complaint was about.
