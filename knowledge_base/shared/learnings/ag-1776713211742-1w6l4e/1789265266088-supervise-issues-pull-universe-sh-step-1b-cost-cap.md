---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-13T02:07:46.088Z
---

# supervise-issues pull-universe.sh step 1b cost-cap stamping does not scale (3291 sessions ≈ 55 min)

## Symptom
On Tick 221 (2026-09-13), `scripts/pull-universe.sh` sat in **step 1b (cost-cap stamping)** for **70+ minutes without finishing** — the whole chain scan stalled before step 2 even started. `scan.py` buffers all stdin before emitting, so `scan-out.json` stays 0 bytes the entire time, which looks like a hang but isn't.

## Root cause
Step 1b calls `ncl cost-cap status --session <id> --json` **once per gh-issue session, sequentially**. The universe now has **3291 gh-issue sessions** (many historical sessions per thread — NOT the ~574 thread keys). Each call is a `bun /app/src/cli/ncl.ts` cold-start (~1s) + a per-session `outbound.db` read, and the loop has a 15s per-call timeout. 3291 × ~1s ≈ **55 min just for step 1b**, before the (fast, batched) gh phase.

## Fix applied this tick (workaround)
Killed the run and replaced step 1b with a **single** `ncl cost-cap stopped --json` call: sessions in the returned `stopped` set → `cost_status="stopped"`, all others → `"unknown"` (scan.py treats `"unknown"` identically to any non-stopped session for the cost short-circuit, so **zero fidelity loss when the stopped set is what you key on**). Patched a COPY at `/workspace/agent/tmp/pull-universe-fast.sh` (never edit the shared skill file in place). With the empty stopped set this tick, the full scan then finished in ~22 min (per-chain enrichment of 1413 threads at ~24-56 chains/min is the remaining, unavoidable cost).

Gotcha when patching: the injected block contains its own `<<'PY'` heredoc, so the OUTER `python3 - <<'PY'` patcher must use a DIFFERENT delimiter (e.g. `<<'ENDPATCH'`) or bash closes the heredoc early at the inner `PY`.

## Permanent fix (for the skill maintainer)
`pull-universe.sh` step 1b should use `ncl cost-cap stopped` ONCE (returns `{count, stopped:[...]}`) instead of N per-session `cost-cap status` calls. cost_stopped detection only needs the live stopped set; stamping 3291 historical sessions is pure waste. `ncl cost-cap stopped --json` returns `{"count":N,"stopped":[...]}` — note `count` counts stopped sessions, and the top-level dict has 4 keys (count/group/costUnavailable/stopped), so `len(parsed)`==4 is a KEYS count, not a stopped count — read `.stopped`.

## Also
The scan's projected fields drop `thread_id`/`coworker` to null; resolve each nudge row's owning tier + byte-exact thread from `ncl sessions list` (thread_id → agent_group_id → folder). Rows owned by `main` (orchestrator-owned chains: slang-torch, slang-vscode-extension, slang-coworkers/nanoclaw) or a phantom key cannot be coworker-nudged — surface them to the operator; that IS their nudge (their nudge_reason says "escalate to operator").
