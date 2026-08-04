---
name: feedback_compaction_target_yields_to_load_bearing_content
description: "A size target is advisory; verbatim commands, IDs and resume triggers are not compressible. Stop at the floor and say so."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# A compaction target is advisory; load-bearing content is not compressible

**2026-08-03.** A `PostToolUse` hook told me to compact `MEMORY.md` from 19.9KB to
**under 17.1KB**. I got it from 21.0KB → 19.8KB and **stopped above the target
deliberately**. That was the right call, and the turn produced two proofs of why.

## What made stopping correct
Two Mode-4 near-misses inside one compaction pass:

1. **I ellipsized a lesson whose entire point was the command.** Line 8 says
   *"Record the CHECK TO RUN, not the conclusion"* — and I compacted it by replacing
   `gh api repos/O/R/compare/<tag>...<sha> --jq .status` + the `SGL_SLANG_VERSION`
   pin-file path with the phrase *"verbatim commands in the chain."* A linter restored
   them with the note **"don't ellipsize the command — a lesson saying 'record the
   check' must CONTAIN it."** Correct: a pointer to a command costs a file-open at the
   exact moment you need the command, which is precisely what the lesson exists to
   prevent.
2. **A 🔴 row was chasing a debt already paid.** `#12219`'s index line read *"float→int
   follow-up DUE and NOT FILED, gate fired, missed 2 days."* The child recorded it
   **FULLY DISCHARGED — empirically fixed**, with the real (narrower, width-mismatch)
   residual tracked on #12186 comment `5150492632`. The row's own warning —
   *"check the act path FIRST"* — fired on itself. Fixed the row.

⇒ ⭐⭐**Re-read the child before acting on a red index row. A stale alarm outlives
the thing it alarms about**, and it looks identical to a live one.

## The rule
**Compact prose; never compact these:**
- verbatim commands and flags (the reason the note exists)
- identifiers you'd otherwise have to re-derive: SHAs, PR/issue/comment IDs, `file:line`
- RESUME triggers on live chains, and the ⛔/⚠️ traps that prevent a wrong action

**Sequence that worked:** dead-link sweep first (0 dead / 38 entries intact) → for each
candidate line, `grep` the child for the specific fact → only then shorten → re-verify
links and spot-check that named commands/IDs survived (`grep -c 'check_suite.id'` etc.).

⭐**Trim your own newest entry first.** The longest line in the file was one I had
written minutes earlier; being freshly-authored is not a claim to space.

⇒ ⭐⭐**When the floor is above the target, stop and say so** rather than deleting
load-bearing content to satisfy a number. A hook optimizes bytes; it cannot see which
byte is the one that prevents a wrong merge. Report the floor and why — an index that
fits the limit but has lost its commands has failed at being an index.

## 2026-08-04 — second pass. The "is it in the child?" probe is ITSELF an instrument that lies.

Same hook, 23.8KB → **18.6KB**, target 17.1KB. Stopped above it again, deliberately. What's new is
**how the safety check failed**, in both directions, in one pass:

I probed 20+ fragments with `grep -ciF '<exact index phrasing>'` against each child. **Nine came
back 0.** Running the ladder (shorter stem → `-E` alternation → synonym) showed:

- **Six were PHRASING VARIANTS, not absences** — `doesn't` vs `does not`, `V1/V2` vs
  `Variants 1 & 2`, `ECHOED script text` vs `echo`, `2 gaps NEITHER FILED` vs `no issue filed`.
  Had I trusted the zeros, I'd have "rescued" content that was already safe — wasted bytes, and a
  false sense that the index was the only copy.
- **Three were REAL Mode 4** — the fragment existed *only* in the index line. The sharpest:
  **`cmt 5062894889 = bot's ⇒ EDIT-in-place` on #12145.** The child recorded the comment id and that
  it was ours, but never the *consequence* — that a refresh must `PATCH`, never `POST`. One
  "move detail to the child" edit would have deleted the only copy of an operational rule that
  prevents a bot-on-bot echo. I wrote it into the child first, then trimmed the row.

⇒ ⭐⭐**The check that authorizes a deletion needs the same rigor as the claim it's checking.** An
exact-string probe over a child is a *narrower* instrument than the prose it's testing; a 0 from it
means *"my probe missed"* at least as often as *"the content is gone."* **Ladder every zero before
you delete on the strength of it** — and note the asymmetry that decides the default:
a false 0 costs bytes, a false non-zero costs the content permanently. **When the ladder is
ambiguous, write it to the child anyway** — duplication is cheap, deletion isn't.

⭐ **Second structural win worth reusing: fold pointer-only rows before trimming substantive ones.**
Five rows whose entire content was a link went to [[slang-longtail-chains-index]] — costs one hop,
risks nothing, because there was no prose to lose. Trimming a row that carries a SHA or a RESUME
trigger risks everything. **Sort compaction candidates by how little they'd lose, not by length.**

⭐ Also re-confirmed live rather than assumed: #12219 and slangpy#1051 really are `closed`, #12116 is
non-draft @`5c0e69c0c059`, #12014 still draft @`2e8c12db841f` (~26d). **Verifying state before
compacting a row is what lets you shorten it honestly** — three rows got *more* accurate, not just
shorter.

Related: [[project_gate_audit_shared_jsonl_mtime_race]] (same turn: an advisory
mechanism whose warning I over-trusted), [[project_12219_sccp_module_scope_composite_const_fold]],
[[slang-longtail-chains-index]], [[project_12145_gbufferrttexgrads_d3d12_access_violation]]
(where the rescued `EDIT-in-place` rule now lives).
