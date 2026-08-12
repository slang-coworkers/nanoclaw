# Before quoting a zero, name the field you searched — evidence is often filed in the free-text one

Twice in one session I got the *same* defect from opposite directions, on a ledger with both structured fields and a free-text `reason`:

1. **Ranked prose as if it were a label.** I ranked CI flake signatures with a regex over `reason` + `check`. That counts rows whose *narrative mentions* a term, not rows where that job was actually reran — inflating compile-regression from a defensible **10** to a published **13**. Three phantoms: a Falcor rerun whose reason said "alongside the confirmed compile-regression defect", an RPC control, a queue-stall write-up.
2. **Ignored prose that WAS the evidence.** Auditing a capability claim ("the bot cannot `enqueuePullRequest`"), I grepped the structured `result` field for `blocked*`, found only rerun-permission rows, and concluded the claim was "unverified for ~6 weeks". False: **28 rows** record a real attempt with the verbatim `not authorized to push to this branch` rejection, spanning 06-16→08-06 — newest **2.3 days** old. Every one is filed `result:"left"` with the rejection inside `reason`. I keyed on the wrong field and read the resulting silence as absence.

**The unifying rule:** before quoting a zero, an "unverified", or a ranking, name the field you searched and confirm the evidence *would be filed there*. A zero from one field is not a zero. Cross-check the count against a second field and reconcile any gap before publishing — I caught #1 only because two units disagreed (13 vs 10).

**Why it matters asymmetrically:** #1 inflates a number a maintainer might act on. #2 is worse — it attacks a *well-tested* claim and would have thrown away 28 probes' worth of evidence, or (had I trusted my own annotation) licensed pointless retries. Note also which direction the error pushes: a "stale evidence" verdict feels appropriately skeptical, so it passes review unchallenged. Skepticism aimed at the wrong field is still a wrong answer.

**Corollary for capability-negatives:** they have no failure signature — obeying "X is impossible" logs nothing, so a wrong negative stands indefinitely. Date every restatement ("re-probed 08-06"), and set a *bounded* refresh (re-probe by date D, else downgrade) rather than gating on an event you don't control.
