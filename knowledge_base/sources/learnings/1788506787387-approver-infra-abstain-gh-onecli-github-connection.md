---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788137600490-lkljc6
written_at: 2026-09-04T07:26:27.387Z
---

# [approver/infra-abstain] gh/OneCLI GitHub connection dropping mid-session → HARNESS_FAIL (exit-21 reviews-fetch-fail + unevaluable clauses)

**Symptom.** On the rev3 re-run of shader-slang/slang#12836, `collect-reviews.sh` returned **exit 21 ("reviews fetch failed")** and `harvest.json` was `{"found": false, "fetch_error": "reviews fetch failed"}`. Diagnosis showed the true cause: `gh` was returning **HTTP 401 `app_not_connected`** — "GitHub is not connected in OneCLI. Ask the user to open this URL to connect it: http://0.0.0.0:10254/p/.../connections?connect=github". Even `gh api rate_limit` 401'd. Critically, `gh pr view 12836` had **succeeded at the very start of the same turn** (head c3c6b9988bd7 was captured), so the connection dropped MID-TURN.

**Root cause.** The OneCLI GitHub app connection is not a static token — it can expire/disconnect within a single session. When it does, ALL `gh` calls fail with 401 `app_not_connected`, which surfaces to the approver as harvest exit 21 (reviews-fetch-fail) AND makes every `eval-clauses.py` clause unevaluable (all clauses need read-only `gh`). This is distinct from rate-limiting — two identical 401s in a row, no reset window; it will NOT self-heal on retry. A human must reopen the connect URL.

**How to catch it.** On harvest exit 21, don't assume a transient reviews-only blip — probe `gh api rate_limit` (or any tiny gh call): if it returns 401 `app_not_connected` / "not connected in OneCLI", the whole harness auth is down, not just reviews. Distinguish from rate-limiting (rate limits give 403 + a reset timestamp and remaining=0, not 401 app_not_connected). Retrying is futile; escalate.

**Fix / handling.** Record **ABSTAIN_POLICY reason_code=HARNESS_FAIL** (more accurate than the workflow's default exit-21 → NO_REVIEW_SIGNAL, because a review very likely EXISTS behind the auth wall — prior revisions all harvested clean reviews fine — and clauses are unevaluable too; the failure is the harness, not "no signal"). Name the artifact (401 app_not_connected + the connect URL). `record_decision` is host-side and works even with gh down, so the row still lands and alerts. Then report the blocker UP with the reconnect URL so a human restores the OneCLI GitHub connection; a re-push (new head) or re-dispatch after reconnect gets a real decision. Caveat: the ledger is append-only per (repo,pr,commit) — recording HARNESS_FAIL locks THIS head, so if auth is restored and the head is unchanged, a real WOULD_APPROVE/BLOCK on the same commit will be refused; the operator should push a new head for a clean decision. Reason_code is infra (burns the infra gate to zero) — the metric correctly flags OneCLI connection instability as something to fix at the platform level.
