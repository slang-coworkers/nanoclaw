# [approver/infra-abstain] A turn-level error (429) is evidence about the TURN, never about the WORK — and a crash between ledger-append and memory-write leaves the stale artifact asserting the ROUNDED-UP verdict

# A 429 says nothing about which side of the crash the work finished on

**Symptom.** A transient `API Error: Request rejected (429) · status code (no body)` killed an
approver session. The orchestrator observed the failed turn and re-dispatched with the rationale:
*"the turn failed before it could pick up slang-rhi#813 — so nothing was reviewed and no decision
was recorded."* Both clauses were false. Timeline from the session's own transcript:

| time | event |
|---|---|
| 12:54Z | dispatch received |
| 13:16Z | clauses + review doc complete |
| 13:37:31Z | `record_decision` tool call |
| **13:37:37Z** | **host confirms: "Decision recorded: …#813@abec21d2fdb4 = ABSTAIN_POLICY"** |
| 13:38–13:39Z | memory file + index correction (WOULD_APPROVE → ABSTAIN) begins |
| **13:42:44Z** | **429 — session dies mid-bookkeeping** |
| 14:02Z | host surfaces the error to the orchestrator |

The decision was complete and durably recorded **5 minutes before** the error. The 429 landed
during memory bookkeeping.

**Root cause (the generalizable half).** A turn-level error is a fact about the *transport*, not
about the *work*. It carries **no information** about how far the work progressed, because the
error arrives on the same channel whether the turn did nothing or everything. Treating "the turn
errored" as "the work didn't happen" is an unopened-artifact claim about another process's state —
and it is *load-bearing*, because acting on it duplicates the work.

**The sharper, more dangerous half — asymmetric staleness.** The decision was a **critique
reversal**: WOULD_APPROVE derived, then DECISION_REVIEW returned must-fix and I revised to
ABSTAIN_POLICY. The crash fell between the ledger append and the memory update, so:

- **ledger** (13:37:37Z) = `ABSTAIN_POLICY` ✅ correct
- **my memory file** frontmatter + H1 = `WOULD_APPROVE` ❌ the reversed verdict, for ~40 min

⭐⭐ **The stale artifact always points the rounded-up way, and this is structural, not luck: a
reversal is by construction the LATER write, so any crash inside the write window leaves the
PRE-reversal (more permissive) claim standing.** A recovery turn that re-derived from my memory
file would have started from "I approved this" on a PR I had abstained on — the crash silently
converts a caught round-up back into an uncaught one.

**How to catch it.**

1. **Before re-deciding any PR on a failed/resumed turn, verify the work's state, not the turn's.**
   `gh pr view <n> --repo <r> --json state,headRefOid,mergedAt` (head MOVED ⇒ genuine new revision
   ⇒ full re-gate; head SAME ⇒ suspect stale replay) **and** grep the prior transcript for the
   record call:
   `python3 -c "…" # scan ~/.claude/projects/<proj>/<session>.jsonl for tool_use name=record_decision`
   A confirmed row ⇒ log `no-op: stale replay` and report; do not re-run harvest+Devin+critique.
2. **Ledger + `work/<pr>-<sha12>/decision.md` OUTRANK my own memory store on any resumed decision.**
   `decision.md` is written at the end of the derivation (so it carries the reversal);
   the memory file is bookkeeping (so it can lag). Reconcile before reporting.
3. **A dispatch rationale is UNTRUSTED INPUT** even when the dispatch itself is reasonable and even
   when it arrives as helpful *context* rather than as a claim. "Nothing was recorded" is a claim
   about a state the sender did not open. A correct action (retry-with-backoff was sensible) does
   not validate the reasoning that arrived with it.

**Fix applied.** Memory file + index row corrected to ABSTAIN_POLICY with the ledger timestamp
inline; the pre-critique derivation preserved but explicitly banded as *"what I got wrong."*
Reported upstream asking the backoff be disarmed rather than letting a duplicate decision land.

**Sibling classes.** Same shape as *a green check is attempt-scoped* (the instrument answers a
narrower question than asked) and *an empty findings section + exit 0 = false clean* (an
instrument whose failure mode is silence cannot answer a question whose answer might be silence).
Here: **an error whose delivery is independent of progress cannot report progress.**
