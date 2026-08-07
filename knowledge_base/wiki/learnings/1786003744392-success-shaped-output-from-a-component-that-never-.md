---
title: "Success-shaped output from a component that never did its job — five instances in one session, and the discriminator was cheap every time"
type: learning
topic: agent-ops
source: learnings/1786003744392-success-shaped-output-from-a-component-that-never-.md
---

# Success-shaped output from a component that never did its job — five instances in one session, and the discriminator was cheap every time

**The question is not "did this pass?" but: *what does this check's output look like when the check itself is broken?* If that is indistinguishable from PASS, it is not a check.**

Five instances in one session (2026-08-06, shader-slang/slang#12382 review + the follow-on pipeline fix). Each was **success-shaped output from a component that never did its job**, and in each the discriminating observation was cheap and adjacent.

| # | component | success-shaped output | what it actually meant | cheap discriminator |
|---|---|---|---|---|
| 1 | review merge step | `_skipped_` in the combined report | reviewer was dispatched, ran, and produced nothing — identical to "deliberately not dispatched" | did we dispatch it? then a missing artifact is an error, not a skip |
| 2 | extraction guard | `zero Task/Agent subagent dispatches — no reviewers ran` | 7 subagents ran, 4 returned; `tool-uses.jsonl` was never written because `set -euo pipefail` killed the script at the `\| tee` pipeline | is the guard's *input* present? |
| 3 | criterion's marker check | `all blocks marker-bearing` | tautology — it filtered by the same `MARKERS` tuple the extractor selected with | does the check import the thing it checks? |
| 4 | a CI retry mechanism I published | confident source-derived causal claim | the code branch never executed — 0 of 100 fires | the tool logs its verdict every fire; read the log |
| 5 | a fixture I called a truncation incident | shipped artifact ≫ take-last output | artifact was hand-assembled: both stream blocks **plus** a 68-byte human-written header the stream never contained | diff the artifact against the blocks; inspect provenance |

**The family test:** for any check, guard, control, or metric — *enumerate the wrong outcomes it still calls PASS*. Not "can it fail?" (a voided-input control proves only that one path fails) but "which specific broken states does it green-light?"

**Corollaries earned the hard way:**

- **A prose warning is not an enforcement.** I documented "keep both discriminating fixtures or the suite can't detect drift" — and the script permitted exactly that, silently, exit 0. If a precondition is load-bearing, the tool must exit non-zero without it.
- **A negative control tests the failure shape you imagined.** Voiding a marker set empties the keep-list and forces a fallback; real *drift* widens the set. Different code paths. The mitigation's target mode was untested.
- **A badly chosen negative control teaches nothing and looks like success.** To test an over-fire gate I anchored a regex on `^##` — it didn't fire, because **zero** real reviews start with `##`; they all open with prose. Re-anchoring on `All ` fired at 18/34.
- ⭐ **That well-chosen control then exposed a defect in the thing under test.** 18 of 34 real reviews open with `"All "`, and my rejecter carried `All my independent verification` as an alternative. It scored 0/34 only because no review happened to open with those exact four words — one beginning *"All my independent verification is complete…"* would have been falsely rejected, failing closed on a legitimate run. Removed.
- **A rejecting heuristic needs its false-positive rate measured against the whole corpus, not its target class** — and **specificity does not generalize the way sensitivity does.** "0/34" is a fact about *this* corpus and *this* prompt template. So don't record it: make the tool re-measure it every invocation and gate the verdict on it. Unmeasurable corpus ⇒ INCONCLUSIVE, never PASS.
- **A tighter assertion is a search for provenance errors you don't know you have.** Adding a strictly-longer assertion made a *real* fixture fail; inspecting provenance rather than loosening the assertion withdrew a claim I'd repeated three times and a reviewer had endorsed. When a tightened check fails on data you trust, **inspect the data before relaxing the check.**
- **If a fixture needs unusual tolerance, that's evidence the artifact was hand-edited** — record the provenance, don't widen the slack.
- Piping a checker through `tail` masks its exit code; read `$?` directly.

**Why this family is worth naming:** a verifier that green-lights a broken component is the *same defect class* as the merge step substituting a placeholder for a missing file — the bug the whole effort existed to kill, recurring inside its own fix. Silence, absence, and unexecuted code all render as success unless something is built to tell them apart.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786003744392-success-shaped-output-from-a-component-that-never-.md`_
