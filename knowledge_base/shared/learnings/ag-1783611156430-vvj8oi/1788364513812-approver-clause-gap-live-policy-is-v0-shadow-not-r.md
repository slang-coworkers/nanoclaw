---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788364061356-ozxar5
written_at: 2026-09-02T15:55:13.812Z
---

# [approver/clause-gap] Live policy is v0-shadow (NOT relaxed) — dependabot/bot PRs ABSTAIN on author_trust, do not round up

**Symptom.** Step-0 recall for a dependabot Go-module bump (slang#12878, grpc 1.82.1→1.83.1 in extras/scaler) surfaced wiki learnings stating this class "WOULD_APPROVE" and that "CONTRIBUTOR author [is] trusted under **v0-shadow-relaxed**". The live `eval-clauses.py` instead FAILED `author_trust` → ABSTAIN_POLICY:CLAUSE_FAIL:author_trust.

**Root cause.** The wiki's "v0-shadow-relaxed" describes a policy that is NOT what is currently mounted. The approver `policy/` mount is empty, so `eval-clauses.py` falls back to the bundled **`v0-shadow`** (confirmed in clauses.json: `policy_version: "v0-shadow"`), whose trusted set is `['COLLABORATOR','MEMBER','OWNER']`. dependabot[bot] / nv-slang-bot[bot] carry `author_association=CONTRIBUTOR`, which is NOT in that set → author_trust FAIL for every bot-authored PR. A MEMBER reviewer's APPROVAL pinned to head does NOT flip it (the clause reads the PR *author's* association, never a reviewer's).

**How to catch it.** Trust the deterministic script output (`policy_version` + the author_trust evidence line), not the recalled "WOULD_APPROVE precedent" bullets. The precedented WOULD_APPROVE outcomes for dependabot bumps assumed a relaxed policy; under the mounted `v0-shadow` the calibrated decision for a bot-authored PR is ABSTAIN_POLICY regardless of how clean the bump is (Devin clean, go.sum hash-pair integrity PASS, decoupled-from-compiler all still hold — they just don't matter once author_trust fails and short-circuits Step 1).

**Fix.** For any bot-authored PR under v0-shadow: expect and record ABSTAIN_POLICY:CLAUSE_FAIL:author_trust honestly; note the clean-bump provenance in the challenger field for the human, but never round up to WOULD_APPROVE. This is a **policy** reason_code (system working as intended), NOT an infra reason_code — it does not burn down the infra gate and is excluded from agreement scoring. Do NOT re-escalate the empty mount per-PR; it is one standing operator escalation (OPEN as of 2026-09-01).
