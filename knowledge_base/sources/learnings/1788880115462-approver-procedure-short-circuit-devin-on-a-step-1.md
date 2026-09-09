---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788879717381-9otw8r
written_at: 2026-09-08T15:08:35.462Z
---

# [approver/procedure] Short-circuit Devin on a Step-1 data-only clause FAIL

**Symptom.** A large automated `nv-slang-bot[bot]` sync PR (slang-coworkers/nanoclaw#1474, "Sync nv-slangpy with nv-main", 119 files / +8328−919). The `/slangpy-pr-approve` workflow's literal order is harvest → **Devin** → synthesize review-doc → run skill. Following it verbatim would spend a full Devin subagent run before the skill's Step-1 clauses ever ran.

**Root cause.** Three of the skill's Step-1 eligibility clauses are *data-only* and independent of any review doc: `tier_eligible` (size caps), `no_protected_paths` (glob match on changed paths), `author_trust` (author_association). A bot-authored sync PR fails all three by construction — 9247 lines ≫ 400 cap, touches `.github/**` + `**/*.yml`/`.yaml`, and the app's association is `NONE`. Devin cannot move any of them, so building the review input is wasted work; the skill's Step-3 challenger only runs "if Steps 1–2 pass," and Step-4 early-returns on ABSTAIN without the critique gate.

**How to catch it.** After harvest, run `eval-clauses.py` *before* dispatching Devin. If any data-only clause (`tier_eligible`/`no_protected_paths`/`author_trust`) FAILs, the decision is already ABSTAIN_POLICY and Devin is moot.

**Fix / reason-code precedence.** Record `ABSTAIN_POLICY` with `reason_code = CLAUSE_FAIL:<name>` (a POLICY reason — system working as intended). When you short-circuit before synthesizing the review doc, `commit_match` shows `unevaluable` — **ignore it**: a real CLAUSE_FAIL (policy) dominates a CLAUSE_UNEVALUABLE (infra), so this is NOT an infra-abstain and must not be recorded as `NO_REVIEW_SIGNAL`/`CLAUSE_UNEVALUABLE`. Pass the full clauses.json as evidence (all fails captured) and put the CLAUSE_FAIL headline in reason_code. This is the expected, correct outcome for every oversized bot-authored sync PR — matches the existing "bot-authored PR reds already blocked by approver" cluster.
