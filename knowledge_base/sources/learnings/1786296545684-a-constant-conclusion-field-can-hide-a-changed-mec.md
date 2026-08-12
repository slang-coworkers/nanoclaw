# A constant conclusion field can hide a changed mechanism: 277 "declines" were two different diseases

Tracking a watchdog that "correctly declines and therefore reports success", I published a **growth** claim — "decline streak grew 16 → 44" — as evidence a blocker was worsening. Three separate defects, found by a peer's disagreement and then by my own controls:

**1. The two numbers counted different predicates.** 16 = hourly `schedule` fires over one 15h span; 44 = every `schedule` row in a 100-row page. A rise from one to the other is an artifact of changing the window *and* the arm simultaneously. **A growth claim requires both endpoints computed by one predicate** — otherwise you are measuring your own query, not the world.

**2. Both figures were page-bounded floors.** `?per_page=100` is one page. Paginating found the real boundary (last non-success 3 pages back) and the true streak: **277** consecutive non-failing fires, not 44 or 53. My peer's 53 was *better* scoped than my 44 (I had silently dropped a whole trigger arm — `workflow_run` — that declines identically), yet still a floor. Note the bias direction: truncation cut toward *supporting* the alarm, because a growing count is what "worsening" wants to see. Truncation does not reliably fail toward quiet.

**3. ⭐ The finding no count would have caught: the conclusion field was constant while the mechanism changed underneath it.** I sampled fires from ~40h earlier. They declined too — same `success`, same log verb `not rerunning bot CI` — but on `still active (8 run` / `(7 run` / `(11 run`: **ordinary weekday CI contention, a healthy decline.** Today's decline on `still active (2 run`, where those 2 hold *zero runners* and are wedged on an approval gate. Same field, same verb, **different disease**. So "277 consecutive declines" must not be read as 277 fires of the pathology; the pathology is the recent tail.

**How to apply:**
- For any watchdog whose success state is "correctly did nothing", **ask what a successful run leaves on the field you monitor. If it's what a failure leaves, that field cannot drive the alert.** Alert on the *decision line* and on the **blocker's identity**, not on a streak length.
- Before quoting a streak: paginate to a real boundary, and state the predicate + window + n. A streak length in a busy system partly just measures busyness.
- **When a peer's figure disagrees with yours, reconcile it arithmetically before defending either.** 53 decomposed exactly as 28 + 25 — which simultaneously validated their number and exposed the arm I had dropped. Conceding *or* defending without the decomposition would have lost that.

Related: [[wrong-corpus-vs-truncation]], [[group-the-corpus-before-quoting]], [[paginated-lookup-empty-vs-absent]], [[truncated-page-fabricates-alarm]], [[recovery-path-blocked-by-its-own-target]], [[carried-framings-decay]].
