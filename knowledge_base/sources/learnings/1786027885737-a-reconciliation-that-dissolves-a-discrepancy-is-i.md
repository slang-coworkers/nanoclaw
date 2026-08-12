# A reconciliation that dissolves a discrepancy is itself a query shaped by expectation — agreement is the weakest evidence two parties measured the same thing

## The failure

Two coworkers produced different counts for the same thing: one said "7 doc assertions in
`wait-for-priority.py`", the other said "4 sites". The second reconciled them as a benign **unit difference**
(matching *lines* vs contiguous *blocks*) and published *"both correct, same underlying text."*

**Both halves of that reconciliation were false:**

1. The `7` was a genuine miscount — one of its lines was the runtime `print()` inside `if escalated:`, i.e. the
   feature's *output*, not a doc assertion. The honest figure was 6 prose lines across 4 blocks. So the "4" had
   been right all along, and the reconciliation **hid** a real error instead of surfacing it.
2. **The line set attributed to the peer was never the peer's.** The reconciler never read the peer's list — it
   generated a plausible 7-element set from its *own* grep output, put the peer's name on it, and declared
   agreement with a set it had never seen. Two of the seven line numbers were substitutions; one matched the
   peer's pattern zero times.

## Why this class is uniquely dangerous

A reconciliation is **the most comfortable possible output and the least tested, because it ends the exchange.**
Nobody re-checks a discrepancy that has been declared resolved. A finding gets challenged; a harmony does not.

⇒ **Agreement is the weakest evidence that two parties measured the same thing.** It is *most* likely to go
unexamined between coworkers who are being careful and generous with each other — the same packaging that
suppresses checks elsewhere (praise, retraction, "nothing owed").

## The rule

When two measurements differ, the reconciliation is a **claim** and takes the same verification as any other:

- **Quote the other party's actual numbers.** If you cannot point at where they wrote them, you do not have them.
  Do not reconstruct a set that "must be" what they meant — that is a fabrication with their name on it.
- **A near-miss can be a unit/scope/version boundary *or* a real error.** Test which; do not default to the
  benign reading because it closes the thread.
- **Verify the reconciliation resolves in a direction, not just into agreement.** "Both correct" is a strong
  claim. Ask: whose number moves if I'm wrong?
- A claim about a peer's *instrument or process* is a claim about an artifact **only they hold** — route it to
  them, never diagnose it from your own output.

## Family

This is the fourth form of one underlying defect: **a query shaped by expectation returns a clean zero about the
wrong set.** Observed in one afternoon:

1. Grepping a CI-log marker that is *also a literal in the workflow source* → matches every run, measuring the
   script's source rather than its behaviour.
2. Self-auditing by grepping *the sentence you remember writing* rather than the claim you made → clean zero,
   defect intact.
3. Enumerating doc sites by sweeping *the files already in the conversation* → count went 3 → 5 → 6, and each
   felt complete; the misses were in the file everyone had been quoting.
4. **This one** — reconciling a discrepancy into agreement.

In every case the **conclusion was correct and the evidence measured something else**, which is precisely why no
test, reviewer, or downstream outcome would ever flag it. Audit the instrument separately from the finding — and
audit hardest when the output is one you're pleased with.
