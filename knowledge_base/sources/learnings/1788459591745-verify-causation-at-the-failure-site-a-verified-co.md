---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-09-03T18:19:51.745Z
---

# Verify causation at the failure site — a verified correlated fact is not a verified cause

**What happened (2026-08-31 → 09-03, Slang `test-falcor` CI cluster):** A coworker (CI babysitter) diagnosed a `test-falcor` failure cluster as "HTTP 403 bridge auth" (08-31), then "corrected" it to "~24h artifact-retention TTL expiry" (09-02). I (orchestrator) independently verified via `gh api .../actions/artifacts` that the `slang-tests-*-release` artifacts DO have a ~24h TTL (true fact), accepted the coworker's causal attribution, and escalated to the operator with high confidence — "I verified this myself... it's the artifact TTL; no bridge credential/ACL work is needed; disregard the 403." Two days later, reading the ACTUAL failing job log (`gh run view --log-failed --job <id>`) on two affected PRs showed the real line: `run-external-ci: trigger failed: HTTP Error 403: Forbidden` — a ~15s auth rejection at trigger submission, **before any artifact is fetched** (the artifact name is only passed as an input). The 403 was the true cause all along; the 24h TTL was real **but causally irrelevant** — a red herring.

**The lesson:** Verifying a *plausible, correlated* fact is NOT verifying *causation*. I confirmed the artifact TTL existed and let that stand in for confirming it caused the failure. It didn't. The only thing that settles a failure's cause is reading the actual failure text at the failure site (the job log line that precedes the `##[error]`), not a related config fact that "would explain it."

**Rules that follow:**
1. Before relaying a root-cause to a decision-maker, read the actual failing log line — especially before asserting causation with confidence words ("I verified"). A build/config fact you can confirm (retention window, missing `needs:`, expired token) is only a *candidate* until the log confirms it fired.
2. A coworker's root-cause label is a hypothesis, not evidence — doubly so when it has already flip-flopped once. "Recants are common; reflexive relay costs credibility upstream" (project rule). The babysitter flip-flopped 403→TTL→403; each relay of mine inherited its uncertainty.
3. When a coworker explicitly says "the earlier root-cause wording may be wrong — worth a human re-check," that is a request to go read the primary evidence, not to pick between its past labels.
4. Cheap disambiguator for GH Actions failures: `gh run view <run-id> --log-failed --job <job-id>` and grep the tail for the error line; if `gh api .../jobs/<id>/logs` returns a terminal-escape-sequence refusal, use `run view --log-failed` instead.

**Net cost:** a confidently-wrong correction sat on the operator's desk for ~a day (no harm only because they hadn't acted), and I had to correct my own correction. The `test-falcor` failures are an external-CI **trigger auth/403** problem (`/opt/slang-ci/run-external-ci`), fixable only on the bridge side — not an artifact-retention change, which would have done nothing.
