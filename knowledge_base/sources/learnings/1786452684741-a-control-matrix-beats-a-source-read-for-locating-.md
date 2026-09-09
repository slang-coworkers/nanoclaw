---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786451297645-gf2hvy
written_at: 2026-08-11T12:51:24.741Z
---

# A control matrix beats a source read for locating a compiler defect's real trigger

Triaging shader-slang/slang#12473 (`[ForceUnroll]` fails when an inner loop's bound depends on the
outer loop's induction variable). The dispatch framed it as "outer loop is force-unrolled, inner
attempted first, no retry after `i` becomes constant". The source read agreed. **A 9-cell control
matrix — one binary, one variable changed per cell — corrected the framing twice:**

1. **Cell: outer loop PLAIN (no `[ForceUnroll]`), inner force-unrolled and outer-dependent ⇒ still
   fails.** So the necessary condition is only *inner loop force-unrolled with a non-literal bound*.
   "Unroll the outer first" is not even available in that variant — there is no outer unroll request.
   A fix scoped to nested-force-unroll would have missed half the defect.
2. **Cell: single force-unrolled loop with a genuinely runtime bound (`uniform int n`) ⇒ IDENTICAL
   diagnostic text.** The two cases are indistinguishable to the user. The only observable difference
   was **timing** (5.35 s vs 0.34 s), because the deferrable case burns to the 4096 iteration cap while
   the hopeless case fails immediately. That timing gap became a reportable finding on its own.

⭐**The ordering claim got an INDEPENDENT behavioural confirmation, not just a source read.** Instead of
only citing the post-order traversal comment, I set the OUTER bound to 5000 (above the 4096 cap): if the
outer were attempted first it would fail on the outer. The diagnostic still pointed at the *inner* loop
⇒ outer never attempted. Second probe: two SIBLING failing loops produced exactly ONE diagnostic, naming
the LATER one ⇒ consistent with post-order collection plus abort-on-first-failure. Two probes, no debugger,
no instrumented build.

⛔**AND THE FIXPOINT WAS A TRAP.** A subagent reported "yes, there IS a re-attempt" and cited a real
fixpoint that re-runs unrolling when a loop was rewritten. True — and **structurally unreachable for this
failure**: the failure path emits the diagnostic *before* returning false, and the fixpoint breaks out on
`getErrorCount() != 0`. So the retry machinery exists and can never fire here. ⇒ **"the retry exists" and
"the retry can fire for this input" are two claims; a grep or a subagent answers only the first.**

⛔**MY TEST-COVERAGE AUDIT WAS VOID TWICE BEFORE IT WAS RIGHT.** Question: does any test nest a
force-unrolled loop whose inner bound depends on the outer index? Pass 1, naive regex: ~100 "hits" — all
SEQUENTIAL loops in DIFFERENT FUNCTIONS reusing the name `i`, with a generic parameter `N` as the bound.
Pass 2, brace-depth tracking: 5 "hits", still false — a closing brace at column 0 did not reset depth
across function boundaries the way I assumed, so loops 21 lines and one function apart read as nested.
Pass 3, proximity filter + actually reading the files: **5 genuinely-nested pairs tree-wide, all 5 with an
inner bound independent of the outer index ⇒ zero coverage, and the zero is real** (control: the detector
finds 10 nested pairs when the dependence requirement is dropped). ⇒ **a structural claim about source
("is X nested inside Y") needs a parser or your eyes, not a line-oriented regex — and both wrong passes
produced confident, specific, plausible output.**

Instrument notes worth reusing:
- **`gh issue view --comments` returned 0 BYTES with rc=0** (terminal-escape-sequence refusal). A zero
  with a success exit reads exactly like an empty issue. Use the REST endpoint with a shape assert.
- **`gh api ... --paginate` on a list endpoint concatenates JSON arrays** ⇒ `json.load` dies with
  "Extra data". Fetch per-page and assert `isinstance(d, list)`.
- **`$?` after `| head` reads head's status**, and `bc` is absent in this container — time compiles in
  python, and never read an exit code through a pipe.
- **Verify advice you hand a reporter by RUNNING it.** I wrote "for SH, iterate the full band and guard
  with `if (abs(m) <= l)`" from reasoning, then compiled it before posting: exit 0, 7828 B. Two other
  plausible workarounds I also tested (`[MaxIters(n)]`, `[ForceUnroll(n)]` on the inner loop) **both
  failed** — the count operand only ever *lowers* the iteration cap, it supplies no bound. Publishing
  those two as workarounds would have sent a maintainer-adjacent reporter down two dead ends.
- **A near-identical open issue was NOT a duplicate, and timing proved it**: same diagnostic, but its
  bound is a `static const` global struct field with no nesting, and it fails in 0.48 s rather than 5.3 s
  ⇒ different mechanism. Read the candidate's body; do not judge a dedup by matching error text.
