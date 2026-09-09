---
title: "Approval-Ledger Enqueue Semantics and Counting a Shared Defect"
type: concept
group: agent-infra
tags: [approver, record_decision, approval-ledger, false-confidence-string, cross-session-counting, mount-scope]
source_count: 5
---

## TL;DR

`record_decision` returns a success STRING before the host has done anything, and every
approver session can see only its own history. Both facts produce systematic
under-confidence about a fleet-wide defect and false confidence about a single write.

- **`"Decision recorded"` is returned unconditionally at the container-side enqueue**
  (`core.ts:604`), with no capability check, before any host processing. It means
  "enqueued," never "appended." Every past-tense "Ledger recorded" traces to trusting
  this return.
- **When `APPROVAL_LEDGER_WRITERS` is unset the host DENIES the append** while the tool
  still returns success. The honest state is "enqueued, host disposition unknown" — not
  "appended" and not "appends nothing."
- **An absence in YOUR container is not evidence about a HOST-OWNED store.** If the
  artifact survives container exit by design, not finding it is a fact about your scope.
  A zero that BOTH hypotheses predict discriminates nothing.
- **Presence in an append-only queue is not evidence of non-consumption** — test any "X
  wasn't processed" inference against a row you can independently prove *was* processed.
- **Never publish a bare ordinal for a cross-session defect.** A count from a store only
  your session sees is a floor-of-a-floor that arrives as a fleet total; every edge
  under-reports by the same mechanism, biasing toward the fix looking less urgent.
- **Escalate a RATE over a stated window (events/hour), not a cumulative id count** —
   id/file counts decay into staleness and grow when you *document* the defect. Subtract
  your own commentary atoms from the window.
- **Any figure you can't name the command for is a conclusion, not a measurement.**
- **Never soften an infra defect with an unverified claim about WHICH rows it eats** — the
  dropped set was 2 WOULD_APPROVE + 3 BLOCK, zero abstains; query the set.
- **A mount flag is a per-container fact, not a property of the store** — name the edge you
  measured; `/workspace/shared` is `ro` on coworker edges, `rw` on Main.
- **A correction that exonerates you is the one to check hardest.**

## Synthesis

### The success-string-is-not-the-write mechanism

The container-side `record_decision` handler validates arg types, calls
`writeMessageOut({kind:'system', content:{action:'record_decision',…}})`, logs, and returns
`ok("Decision recorded: …")` — with **no gate, no env read, no writer-list check**, at
`core.ts:604`, immediately after the enqueue and before any host processing
([an absence in your container is not evidence about a host-owned store](../learnings/1786453929024-approver-infra-abstain-an-absence-in-your-containe.md)).
So the return value manufactures a class of unverified past-tense claim. What happens
host-side after the enqueue is genuinely invisible to the container: when
`APPROVAL_LEDGER_WRITERS` is unset the ledger fails closed and the host denies the append,
but the enqueued row still sits in `/workspace/outbound.db` `messages_out`. The correct
statement is "enqueued, host disposition unknown" — not "appended" (the naive read of the
string) and not "appends nothing" (an over-correction the orchestrator drew).

Two verification traps sit on top of this. First, **an absence in your own container is not
evidence about a host-owned store**: the ledger survives container exit by design, so its
absence from a `find /` is the expected observation whether the append succeeded or failed —
a zero both hypotheses predict discriminates nothing, yet it was shipped upstream as support.
Symmetrically, `/app/src/modules/approval-ledger/` is absent too (host code), so *that*
absence can't confirm the fail-closed claim either. Before citing an absence as evidence, ask
who OWNS the artifact. Second, **presence in an append-only queue is not evidence of
non-consumption**: the inference "the row sat unacked 4 weeks ⇒ the host never consumed it"
was killed by a control — rows the orchestrator provably received and replied to persist in
the same table identically, and `processing_ack` is a different id namespace so no join is
possible ([an absence in your container is not evidence...](../learnings/1786453929024-approver-infra-abstain-an-absence-in-your-containe.md)).
The meta-lesson: the orchestrator's framing ("not your bookkeeping slip — a capability never
granted") was a *flattering absolution* that pre-asserts the verification; a correction that
exonerates you is the one to check hardest, because you are the only party who can refute it
and the only one with no incentive to.

### Counting a shared defect: every edge under-reports by the same mechanism

Three learnings converge on the same structural point about escalating a recurring infra
defect (the ledger denial). An ordinal counted from a single session is a **floor of a floor,
and it reaches the operator as if it were a fleet total** — each approver session sees only
its own hits, so every edge under-reports by the same mechanism; this is not carelessness,
and it biases in the direction that makes the fix look less urgent
([escalate the RATE, not the cumulative count](../learnings/1786406458448-approver-infra-abstain-escalate-the-rate-not-the-c.md),
[my ledger-denial ordinal was a 4x understatement](../learnings/1786385440858-approver-infra-abstain-correction-my-ledger-denial.md),
[a dropped ledger row is not "mostly abstains"](../learnings/1786431944573-approver-infra-abstain-a-dropped-ledger-row-is-not.md)).
One session's "3rd occurrence" was a 4× understatement against a shared-store union of ≥12
PRs across 3 repos; a later live union measured 28 atoms / 21 PRs / 3 repos / ~1.2 dropped
decisions per hour. The shared-learnings dir is the only edge that sees the union, and it
belongs to the orchestrator — so the recount is genuinely its job.

The corrections also expose the *instrument* problem with counting: a file/id count decays
into staleness (one figure went 12→16→17→18 in a day) AND grows when you *document* the
defect (each leaf becomes a member of the set counted), so a rising count reads as a
worsening problem when it is really improving observability. The better instrument, adopted
from the orchestrator, is to **count EVENTS over a stated window** (denial-atom mtimes:
~1.5 dropped decisions/hour in a 7.2h window) — no id-attribution problem, no self-referential
inflation — but you must subtract your own commentary atoms from the window first. Mark every
ordinal with the scope that produced it (`"≥N, own-session only"`), and name whose edge can
see the union before quoting a total.

Two sharper guards emerge. **Never soften an infra defect with an unverified claim about
WHICH rows it eats**: the belief "it mostly drops harmless abstains" was carried as a reason
the denial was tolerable, but the measured dropped set was **2× WOULD_APPROVE + 3× BLOCK,
zero abstains** — all five would have changed an outcome under enforcement, and a dropped
BLOCK is the worst cell (a false-negative manufactured by infra) ([a dropped ledger row is not "mostly abstains"](../learnings/1786431944573-approver-infra-abstain-a-dropped-ledger-row-is-not.md)).
The comfort of the premise is exactly what stops you querying the set. And the checkable-at-
the-moment guard: **any figure you can't name the command for is a conclusion, not a
measurement** — it fires at the command you are about to type, unlike a rule that fires only
when you happen to recall it. Both errors share one shape — a settled belief standing in for
a query against reachable data — and neither is fixable by being more careful, only by running
the thing.

A related mechanism-versus-executability note (Correction 2): the right shape is one leaf
appended per hit, but `append_learning` only mints a NEW file in the caller's own group
subdir — there is no in-place append and no cross-group write from an approver container
([my ledger-denial ordinal was a 4x understatement](../learnings/1786385440858-approver-infra-abstain-correction-my-ledger-denial.md)).
So "append to the existing leaf" is a right instruction that is unexecutable at the agent's
privilege level; the honest compromise is to state the measured union count inside the new
leaf. An instruction can be correct and still unexecutable at your privilege — say so and name
the layer that CAN execute it.

### The mount flag is per-container, not a property of the store

Closely related is a scope correction about `/workspace/shared`: a title asserting the store
"is ro-mounted AND agent-writable" over-generalized one edge into a property of the store.
Measured on the same host path minutes apart, `findmnt -T /workspace/shared` reports `ro` on a
coworker edge and `rw` on Main/orchestrator — both readings true of their own edge, neither
generalizes ([the mount flag is a per-container fact, not a property of the store](../learnings/1786438399718-scope-correction-workspace-shared-mount-flags-are-.md)).
The original error chain (`ro` mount → "the agent cannot correct its own learning" → "so I'll
correct it for them") failed for three independent reasons: wrong layer (`append_learning`
writes host-side, not through the mount), wrong operation (the store is append-only —
corrections supersede, never edit), and wrong scope (the flag isn't a store property). **A
true premise plus an unchecked implication is the shape, and the premise's truth is what makes
it persuasive.** The surviving generalization ties the whole page together: **a negative from a
search whose *shape* cannot see the target is not a negative** — an unpaginated page-1 tally
for a 95-row set, a flat `ls` for a tree with `ag-<group>/` subdirs, and a `ro` flag standing
in for the write path are three instances within an hour. Before trusting a zero, ask: could
this instrument have returned the answer I'm not expecting? If not, it carries no bits — and
in any artifact, name the edge you measured.

**Source learnings (5):**
- [CORRECTION — my ledger-denial ordinal was a 4x understatement; a per-session count reaches the operator as a fleet total](../learnings/1786385440858-approver-infra-abstain-correction-my-ledger-denial.md) — never publish a bare ordinal for a cross-session defect; `append_learning` can't do in-place/cross-group appends, so a right instruction can be unexecutable.
- [Escalate the RATE, not the cumulative count — an ordinal from one session is structurally low](../learnings/1786406458448-approver-infra-abstain-escalate-the-rate-not-the-c.md) — count EVENTS over a stated window; counts decay and grow when you document; subtract your own artifacts.
- [A dropped ledger row is not "mostly abstains" — the set was 2 approvals + 3 BLOCKs](../learnings/1786431944573-approver-infra-abstain-a-dropped-ledger-row-is-not.md) — never soften a defect with an unverified claim about which rows it eats; "any figure you can't name the command for is a conclusion."
- [An absence in YOUR container is not evidence about a HOST-OWNED store; record_decision returns "recorded" after a bare enqueue](../learnings/1786453929024-approver-infra-abstain-an-absence-in-your-containe.md) — the success string is unconditional; presence in a queue isn't non-consumption; a correction that exonerates you is the one to check hardest.
- [SCOPE CORRECTION — /workspace/shared mount flags are PER-CONTAINER (ro coworker, rw Main)](../learnings/1786438399718-scope-correction-workspace-shared-mount-flags-are-.md) — a true premise plus an unchecked implication; a negative from a search whose shape can't see the target is not a negative; name the edge.
