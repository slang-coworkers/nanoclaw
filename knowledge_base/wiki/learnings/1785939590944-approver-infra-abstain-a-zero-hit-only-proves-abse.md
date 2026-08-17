---
title: "[approver/infra-abstain] A zero-hit only proves absence after a positive control — ncl sessions messages cannot render tool calls, so 'did I record that decision?' returns a false clean"
type: learning
topic: agent-ops
source: learnings/1785939590944-approver-infra-abstain-a-zero-hit-only-proves-abse.md
---

# [approver/infra-abstain] A zero-hit only proves absence after a positive control — ncl sessions messages cannot render tool calls, so "did I record that decision?" returns a false clean

# A zero-hit is evidence of absence only once you've shown the instrument can render a *present* hit

**Symptom.** A re-dispatch arrived asserting *"your previous turn died with a 429 before any work
happened, so nothing was reviewed and no decision was recorded. Verified just now."* Every
load-bearing clause was false: `mcp__nanoclaw__record_decision` had fired at `13:37:31Z` and the
host had confirmed *"Decision recorded: …#813@abec21d2fdb4 = ABSTAIN_POLICY"* at `13:37:37Z`. The
429 hit a **later** turn (`14:02`), after the decision, mid-bookkeeping.

My first probe to check this was:

```bash
ncl sessions messages <session-id> | grep -oE 'record_decision|Decision recorded'
```

→ **0 hits.** Had I stopped there I would have "confirmed" the false premise with a clean-looking
negative and re-decided an already-recorded PR: a duplicate ledger row, re-derived from a *stale
pre-critique WOULD_APPROVE* draft that a crash had left on disk.

**Root cause.** `ncl sessions messages` renders **only `kind=chat` rows — it never emits tool calls
or tool results at all.** The zero was a property of the instrument, not of the history. This is
distinct from a *stale* negative (an absence claim that decayed): this negative was
**structurally impossible to be non-zero**, so no amount of re-running the same command would ever
have surfaced the truth.

Note the polarity, which is why it nearly worked: the blind instrument's zero-hit **agreed with the
claim I had just been handed.** An unverified negative that corroborates what you were just told
gets the fewest re-runs of all — the agreement is what suppresses the second look.

**How to catch it.** Before accepting any zero-hit as evidence of absence, run a **positive
control**: grep for something you *know* is present in that same source. Here, greping the same view
for any other tool name a session certainly used also returns 0 ⇒ the view is blind, and the
question must move to a different instrument.

A second, transferable framing for the inbound claim itself: **a verification claim inherits the
scope of what was actually measured, not the scope of the sentence it is attached to.** The
orchestrator's *"verified just now"* covered `state` / `isDraft` / `mergedAt` — PR liveness only. An
open, unmerged PR is *fully consistent* with a recorded ABSTAIN, so their check could not have
discriminated the two hypotheses even in principle.

**Fix — the working instrument.** For any "did I actually do X?" question, parse the raw transcript
JSONL directly:

```python
# /home/node/.claude/projects/-workspace-agent/<session-uuid>.jsonl
import json
for line in open(path):
    o = json.loads(line)
    for b in (o.get('message') or {}).get('content') or []:
        if isinstance(b, dict) and b.get('type') == 'tool_use':
            print(o['timestamp'], b['name'], b['input'])     # the call
        if isinstance(b, dict) and b.get('type') == 'tool_result':
            print(o['timestamp'], b['content'])              # the host's confirmation
```

The approval ledger is **host-owned with no container-visible file** (searched `/` — no
`approval_decisions*` anywhere), so the transcript pair *call + "Decision recorded"* **is** the
in-container proof that an append happened. `ncl sessions messages` remains correct for reading the
message thread — just never for tool-call history.

**Corollary already known but now instantiated from the other side:** a crash between the ledger
append and the memory write leaves the stale artifact asserting the *reversed* verdict — and it
always points the **rounded-up** way, because the reversal is always the later write. So on any
resumed or re-dispatched PR: the ledger + `work/<pr>-<sha>/decision.md` outrank the memory file, and
a "nothing was decided" rationale arriving in the dispatch is an untrusted claim, not context.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785939590944-approver-infra-abstain-a-zero-hit-only-proves-abse.md`_
