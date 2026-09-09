---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788503476880-yv8daz
written_at: 2026-09-04T06:43:49.444Z
---

# [approver/process] slangpy external/slang-rhi bump or oversize PR = deterministic Step-1 ABSTAIN — run eval-clauses first, and it is a POLICY reason not NO_REVIEW_SIGNAL

**Context:** shader-slang/slangpy#1140 "Add opacity micromap support" (skallweitNV, MEMBER), a +1326/-18 native+bindings PR that bumps the `external/slang-rhi` gitlink (22239042→e17f6d75, carrying the actual OMM implementation). Decision: ABSTAIN_POLICY, reason CLAUSE_FAIL:no_protected_paths.

**Symptom:** I ran the workflow in order — harvested bot reviews (exit 22: CodeRabbit pending), polled CodeRabbit ~5.5 min, dispatched a Devin subagent (~7 min, returned 0/18 files loaded, partial) — then ran eval-clauses.py and it FAILED immediately on two Step-1 clauses: `no_protected_paths` (the `external/**` glob matches `external/slang-rhi`) and `tier_eligible` (1344 lines > 400 cap under v0-shadow). The whole review-signal-gathering effort was moot: Step-1 clause FAIL short-circuits before Step-2 verdict parse, so the review verdict is never the operative input.

**Root cause:** The workflow sequences review-input build (slow: harvest + poll + Devin) BEFORE the skill's Step-1 clauses (cheap: pure metadata predicates over `gh` PR metadata + changed paths + policy). For any PR that obviously trips a Step-1 clause, the slow work is wasted.

**How to catch it:** Two cheap, deterministic pre-checks off the changed-file list you already fetch when staging:
1. Any changed path under `external/**` (a submodule/gitlink bump) → `no_protected_paths` will FAIL. On slangpy the headline case is the `external/slang-rhi` gitlink — recall already flags "diff size ≠ change size; external/** is the sole guard for that gitlink."
2. Sum of additions+deletions in the `base...head` compare > `max_total_lines` (v0-shadow: 400) or files > `max_files` (30) → `tier_eligible` FAILs. Note `external/slang-rhi` shows as only +1/-1 in the compare, so the size cap is driven by the visible slangpy churn, not the submodule.

**Fix / procedure tweak:** Run `eval-clauses.py <ws>` as a FAST PRE-GATE right after staging `tmp/context.json`, before waiting on CodeRabbit or launching Devin. It only needs `tmp/context.json` + policy (commit_match is `unevaluable` without the review doc, which is itself just another abstain trigger and never blocks a hard FAIL). If Step 1 already yields a hard FAIL, synthesize a short honest review-doc.md noting the review signal was moot, record ABSTAIN_POLICY, and skip the ~6-min poll + Devin run entirely. (Still fine to run the challenger-facts read for the record/learning, as I did — that's cheap and reinforces the abstain.)

**Classification pitfall (important for the infra quality-gate metric):** When the bot review never settles AND you abstain, do NOT reach for `NO_REVIEW_SIGNAL`. If a Step-1 clause FAILs, the operative reason is the POLICY reason `CLAUSE_FAIL:<name>` — the pipeline reached a correct "a human must look" outcome from clause data alone. `NO_REVIEW_SIGNAL` is an INFRA reason (excluded from agreement scoring, drives the infra gate toward zero) reserved for when Steps 1–2 would otherwise pass but there is genuinely no bot review AND no Devin signal. Step-1 FAIL takes precedence in the procedure ordering, so it is a policy abstain even if the review signal happened to be absent. Misfiling this as NO_REVIEW_SIGNAL would wrongly ding the infra gate for a PR the policy correctly routed to a human.

**Also confirmed (not a gap):** `Feature::opacity_micromap` is a live flag — populated by the generic `hasFeature` query loop in the Device ctor and gated in the test via `has_feature` + `pytest.skip`; the single present-path test builds a real OMM and asserts observable output `[1,2,1,2,1,2]`. So the "flag with no setter is dead" and "no trigger-present control" probes both clear here. This did not affect the decision (Step-1 abstain) but is the kind of thing to verify if a similar PR ever passed the clauses.
