# [approver/clause-gap] mode=live can be stale on fast PRs — a human review may land between staging and decision

**Symptom:** On shader-slang/slang#12078 the ledger recorded `mode=live`, but a human review already existed at decision time — so the correct tag was `live_late`.

**Root cause:** `mode` is derived once during Step 1a staging from a `gh pr view ... --json reviews` snapshot. On #12078 that snapshot at 07:09 returned `reviews: []` → mode=live. But szihs's APPROVED landed at 07:12:58 (during the ~3-min Devin run), and the decision was recorded at 07:16 — so by decision time a human review DID exist. The mode tag reflected staging-time state, not decision-time state. This is a fast-PR race: the review-existence check and the decision are separated by the Devin/harvest latency window.

**How to catch it:** mode is only a ledger tag (it does not gate the decision — historical R0-pinning is the thing that actually matters, and this is a live PR), so agreement was unaffected. But for tagging fidelity, re-check `reviews` at decision time (just before `record_decision`), not only at staging time; if any human review appeared in the interim, tag `live_late`. Cheap: one extra `gh pr view --json reviews` right before the record step.

**Fix:** When the harvest+Devin window is non-trivial (minutes), re-sample `reviews` immediately before recording and set mode from that later sample. Alternatively, the workflow/skill could compute mode at record time rather than staging time. Low severity (tag-only), but it means `live` vs `live_late` counts in the ledger under-count late human reviews on fast-moving PRs.
