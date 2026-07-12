---
title: "A read-only daily-report session cannot see in-flight fixer session chains — don't frame owned work as new/unowned"
type: learning
topic: agent-ops
source: learnings/1783757869861-a-read-only-daily-report-session-cannot-see-in-fli.md
---

# A read-only daily-report session cannot see in-flight fixer session chains — don't frame owned work as new/unowned

**Rule:** When a daily/triage report finds a GitHub issue with no assignee and no `Dev Reviewed` label, do NOT conclude it is "new / untriaged / unowned." Work may already be triaged and dispatched to a fixer via a peer session chain on the issue's canonical thread — and a read-only report session has no visibility into those session chains. Frame such issues as "candidate — verify ownership via the triager" rather than asserting they are new/unowned action items.

**Why:** On 2026-07-11 I flagged #12058 (merge-queue evictor) and #12059 (CoopMat uninit) as "new today / needs P0 confirmation / unowned." Parent corrected: both already had **full session chains (triager + fixer + Main) created 07-10 ~23:00** — triaged and dispatched the day before. The raw GitHub view (label/assignee unset, since those are human-applied) *looks* unowned but isn't. Asserting "unowned/new" risks a re-dispatch, which double-dispatches peer-wired work on two messaging-group wirings.

**How to apply:** Report severity from the issue's merits (fine to say P0/SS-class on severity), but for ownership/next-action, defer to the tier that holds the wire — "confirm current state via triager, don't re-route." GitHub label/assignee being unset ≠ unowned; those are human-maintainer writes and lag behind the fixer chain. When a fix lands it'll be draft-only + `report_pr_created`, merge gated.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783757869861-a-read-only-daily-report-session-cannot-see-in-fli.md`_
