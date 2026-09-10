---
name: project_nanoclaw_1382_cost_scenarios_tests
description: "nanoclaw#1382 (szihs, test-only, nv-main) 9 behavioral cost-accounting scenarios + 1 codex per-model case. Reviewed INLINE by Main (~33rd no-nanoclaw-approver instance), comment 5468441048. LGTM; all 4 source claims verified at head-ref. gh GH_TOKEN was STALE — posted via gateway curl (HTTP 201)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 25abb26c-ca32-4483-861f-e2cf3dfaf8ff
---

# nanoclaw#1382 — behavioral cost-accounting scenario tests

PR `slang-coworkers/nanoclaw#1382` by szihs (Harsh Aggarwal), base `nv-main`, head `test/cost-scenarios`. **Test-only**: 462 additions, 0 deletions, 2 files (`container/agent-runner/src/poll-loop.cost-scenarios.test.ts` new 440-line file + 1 case appended to `codex-cost.test.ts`). `bun.lock` unchanged. MERGEABLE / UNSTABLE (CI test jobs 22,24 pending at review; check/guard/label green, verify skipped). No prior reviews.

Adds 9 scenarios pinning cost-cap invariants from #63/#65/#1327/#1333: provider gating, per-model pricing, restart resume/no-double-count, `/clear` vs `/compact` epoch behavior. No module mocks (bun `mock.module` is process-global, leaks) — drives the REAL in-memory session DB + REAL pricing through the additive `__costCapTestHooks`/`__setConfigForTest` seams. Per-test `CODEX_HOME` temp dir. `afterEach` resets poll-loop cost singletons; sorts `'-' < '.'` before `poll-loop.cost.test.ts` whose `seed()` doesn't clear turn flags.

## Review = verify test claims against head-ref source (not the body)

All four load-bearing claims confirmed by fetching head-ref files via `gh api .../contents/...?ref=test/cost-scenarios` (avoids wrong-tree read per ANCHOR A/C):
- **Provider gate** `poll-loop.ts:373`: `costEnabled = costAllotmentUsd > 0 && (provider === 'claude' || 'codex')`. opencode/pi → disabled. ✅ scenario 1.
- **Codex baseline** `poll-loop.ts:433`: no persisted row ⇒ `codexLedgerBaselinePending` defaults to `provider === 'codex'`. ✅ codex case.
- **resetCostForNewSession** `poll-loop.ts:558-604`: rotates BOTH `costBudgetGen++` (581) and `ledgerGen++` (590), zeroes `costSpentUsd`, guards `costWindow !== 'lifetime'` (559, test uses lifetime), never touches session id, folds codex baseline synchronously. ✅ 4a.
- **isClearCommand/categorizeMessage** `formatter.ts:27,48,78`: `/compact` ∈ ADMIN_COMMANDS → 'admin'; `isClearCommand` matches only `/clear`. ✅ 4b.
- **Pricing** `pricing.ts:45,49`: opus-4-8=$5, sonnet-4-6=$3/Mtok; `codex-cost.ts:96,112`: gpt-5.6-sol=$5, gpt-5.2-codex=$1.75/Mtok. So hardcoded `toBeCloseTo(5/10/15)` and differ-checks hold.

## Verdict: LGTM (inline comment 5468441048)

1 🟡 non-blocking: restart + codex scenarios HARDCODE `toBeCloseTo(5/10/15)` while model-switch/codex-per-model DERIVE from `oneMsgUsd`/`priceCodexEvent` — a rate change breaks the hardcoded 3 even though the behavior is unchanged; deriving them too would be price-robust + self-consistent. Body's "796 pass/1 fail" = pre-existing `Bun.YAML.parse` gap in untouched `scaffold.test.ts` (local bun 1.2.19 vs 1.2.21+), local-only. Did NOT assert suite passes — CI pending.

## Infra note
`gh` CLI write FAILED (`Resource not accessible by integration`; `gh auth status` = `GH_TOKEN` invalid for nv-slang-bot[bot]) but READS worked. Posted via direct `curl` POST to api.github.com (gateway injects credential) → HTTP 201. Flagged stale GH_TOKEN to operator. Learning: `gh GH_TOKEN can be stale while gateway curl still posts to GitHub`.

~33rd instance of the no-nanoclaw-approver rule (routing table covers only shader-slang/slang, slang-rhi, slangpy; no `nanoclaw-pr-approver` coworker → Main reviews inline).
