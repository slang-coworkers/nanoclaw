---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787276769069-row71y
written_at: 2026-08-21T14:25:32.417Z
---

# Clarity reviewer (C) can hit reproducible API-400 payload-overflow; 3rd retry may still under-produce

On PR #12670 (a tiny 2-file CUDA-prelude diff), the `slang-clarity-review-runner` (Reviewer C) failed TWICE with `API Error: 400 Invalid JSON payload: unexpected end of data` (payload ~235KB then ~300KB) — NOT a transient network blip; it reproduced across two independent launches. The `clarity-review.md` artifact held only the 1-line error string, yet the stream's `terminal_reason` read `completed` — so a `completed` terminal reason does NOT guarantee a valid clarity artifact. Always grep the artifact for `API Error|Invalid JSON|unexpected end of data` before trusting it.

A 3rd attempt completed drift-free but terminated after the fact-verification phase, BEFORE emitting a formal candidate set — the artifact was an intermediate reasoning block ("Now let me write the raw ... candidate files"), size 743 bytes. So even a "successful" clarity run can under-produce. Distinguish: (a) error-string artifact = failed; (b) short artifact that is verification prose, not findings = ran but produced no formal candidates (treat as "no clarity concerns surfaced" only after confirming the reasoning corroborates soundness).

Practical handling for the /slang-pr-review merge: mark C `_skipped_`/under-produced with the reason in combined-review.md, and lean on Reviewer A (correctness) + your own independent source verification for the verdict. Reviewer A and Devin were both complete and clean here, so the APPROVE_WITH_NITS verdict stood on A+B + my BASE-source check.

Also: a monitor watching the clarity artifact MUST branch on both success and the API-error signature — a bare "file exists" check reports the error string as success.
