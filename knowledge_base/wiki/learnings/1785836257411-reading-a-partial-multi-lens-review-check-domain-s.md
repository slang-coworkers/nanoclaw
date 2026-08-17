---
title: "Reading a partial multi-lens review: check DOMAIN sections against the synthesis, not through it"
type: learning
topic: review-process
source: learnings/1785836257411-reading-a-partial-multi-lens-review-check-domain-s.md
---

# Reading a partial multi-lens review: check DOMAIN sections against the synthesis, not through it

# A review's synthesis can smooth over what its own domain reviewers found

From shader-slang/slang #11917 batch-2 (PR #12336). A combined multi-lens PR review came back
`APPROVE_WITH_NITS, 0 bugs, 4 gaps`. I read the 79KB report itself instead of the dispatcher's summary,
and found the domain-reviewer sections **contradicted the synthesis twice** — both times against the
code I had just written from the summary.

## Why it happened, and the tell

The correctness lens had **died at its $40 budget cap**, producing a 0-byte `final-review.md`. Two of
its four domain reviewers completed; their raw output survived, but the merged synthesis never ran. The
result JSON said `reviewers_complete: false`. **A partial run makes synthesis/domain divergence far more
likely** — nobody reconciled them.

The two divergences:
- Synthesis said a pass synthesized **five** opcode families; a domain reviewer said six. Six was right
  (the sixth was handled by a *different* mechanism — a pass return value rather than a scan flag — so
  the file had two idioms for the same problem and my comment described one as the whole story).
- Synthesis offered gating a pass as a live option ("either gate it, or extend the comment"); a domain
  reviewer said it isn't gateable. The domain reviewer was right: the pass unconditionally writes state
  that outlives the compile, so it isn't opcode-scoped. **The synthesis was reasoning about opcode
  timing; the domain reviewer had identified a persistence boundary. Different questions.**

**Practice:** when a review artifact is large, delegate reading it to a subagent, and ask specifically
for (a) anything the summary omitted or compressed, (b) claims to verify yourself, (c) stated coverage
boundaries, and (d) **places the review disagrees with itself**. That last one is the highest-value
request and nobody volunteers it.

## Instrument failures to check before trusting a review result

- **A corroborating lens whose output is your own input is not corroboration.** One reviewer's "AI
  Analysis" section was a verbatim echo of my own PR body, truncated mid-sentence, immediately followed
  by `## Bugs / (none reported)`. "Clean 0/0/0" from that is *no signal*, not weak signal. Check that a
  lens actually said something before counting it.
- **A review's own guard can be a known false negative.** The run's drift guard grepped for `Task`
  while the CLI emitted `Agent` — it certified nothing. Read the guard, not just its verdict.
- **`grep -c` counts matching LINES, not occurrences.** It produced a "16 sites" figure that was really
  ~42. Same instrument bug as a code-search API's `total_count` counting matches rather than files, and
  as reading "8 test directives" as "8 diagnostics" when each diagnostic had a summary *and* a detail
  line. **Count it yourself before quoting a number in anything durable.**
- **A re-run after fixes measures a different artifact.** A clean re-run on the corrected tree is weaker
  evidence than a clean run on the reviewed tree would have been. Say so explicitly, or downstream
  readers take "clean" as validating code that no longer exists in that form.

## And the mirror-image failure on my side

Told a justification was too weak, I four times replaced it with an **unverified absolute** ("every
witness table", "no flag can be made to work at all", "invalidates every line citation"), then bounded
the prominent statement and left an unbounded restatement elsewhere in the same document. One shipped in
a pushed source comment before an independent critique caught it.

**Rule: a correction isn't applied until every restatement is fixed — and restatements in headings,
tables and summary lines outrank body prose, because they are what gets read instead of it.** The remedy
that worked: `grep` the term across source *and* prose in one pass and check every hit, rather than
patching the instance the reviewer pointed at. On the round where I did that first, the sweep returned
exactly what the reviewer flagged and nothing more — which is the evidence it was complete.

Corollary for citations: **state which tree a line number belongs to.** A macro sat at `:978` on master
and `:1019` on my branch because my own diff added lines above it. PR bodies should cite the base branch,
since that is what a reader diffs against.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785836257411-reading-a-partial-multi-lens-review-check-domain-s.md`_
