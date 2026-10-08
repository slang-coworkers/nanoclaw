---
okf_version: "0.1"
---

# Memory Index

## Core Memory

- **Memory lives in this OKF store.** The old native store (`~/.claude/projects/-workspace-agent/memory/`) was migrated into [imported/](imported/index.md) on 2026-08-30 and retired; the router is [imported/MEMORY.md](imported/MEMORY.md).
- **Never record counts in pointers** — they go stale with the next leaf. Live figures: `bash imported/reindex.sh --check`.
- **Dashboard session `sess-1776713576150-9fon2n`: read it only as `ncl sessions messages <sid> --reverse --json --limit ≤400`** (rows under `.data`); to reach further back, `--since-seq <seq> --limit ≤400` is also bounded (used 2026-10-07 to cover a 4-day gap). The host bounded this read on 2026-09-27 (two-phase keys-then-content, nanoclaw `e24a7ec64`/`9b0003065`); before that it was unbounded and wedged every later `ncl` call. Never page it with a large `--offset`. `conversations/*.md` does **not** contain dashboard-session rows.
- **[legoop-archive/](legoop-archive/index.md) and imported/ are disjoint stores** — never `cp` between them.
- **Before forwarding ANY `pr_ready_for_review` webhook to a `*-pr-approver`, run `ncl groups list` and check `paused` — on the first event, not the repeat.** Both approvers are paused; detail in [pr-approvers-paused.md](pr-approvers-paused.md).
- Full context, evidence and history for these: [system/hazards.md](system/hazards.md).

## Map

- [Memory system definition](system/definition.md) - how this memory works, and yours to improve
  ([folder index](system/index.md))
- [Slang / slang-rhi chain records](slang/index.md) - per-chain state for shader-slang issue/PR work
  (written here because it's this session's own chain detail; operational routing rules still live in
  the live store above)
- [Ported lego-operator archive](legoop-archive/index.md) - **52 `legoop-*.md` operator facts that
  exist ONLY in this store**, now in their own folder with a proper folder index and `type:`
  frontmatter on each. ⭐ **A backtick is not a link — a filename in prose is invisible to every
  reachability check**; link the folder, not the filenames in prose.
- [#11135 IRTypeAlignmentAttr chain](project_11135_ir_type_alignment_attr_12306.md) - maintainer-requested
  impl; peer review found a triple-verified 🔴 `addAttrs` interleaving bug. **Reachable from no index in
  either store and absent from the live one** — relinked here 2026-08-05.
- [#12307 reflection-json scope representation](project_12307_reflection_json_scope_representation.md) -
  MERGED 2026-08-15/19 (PR #12310). Terminal record + durable CI/reachability lessons.
- [Orchestrator operational reference](orchestrator/index.md) - on-demand Main
  reference (mounts incl. `/workspace/project`, create_agent vs SDK Agent,
  interactive prompts, self-modification). Distilled 2026-08-18 from the legacy
  always-injected `CLAUDE.local.md`; the composed spine (`CLAUDE.md`) stays
  canonical for role/tools/routing/Projects.
- [Harness / provider findings](harness/index.md) - durable structural facts about
  running a group on the Codex provider vs Claude (headline: settings.json hooks are
  inert for Codex). Distilled 2026-08-20 from the May-2026 A/B and parity R&D notes.
- [PR approvers paused](pr-approvers-paused.md) - **check `paused` before routing any
  approver webhook**; both approvers are operator-paused and the decision is still pending.
- [Supervise-tick delivery guardrail](project_supervise_tick_no_cc_discord.md) - each
  `/supervise-issues` tick delivers to `orchestrator-dashboard` and nowhere else; never
  CC a coworker.

### Superseded / pruned working notes

Provider / harness experiments (May 2026): the durable findings are folded into
[harness/](harness/index.md); the raw R&D files were pruned once distilled — retiring a
distilled note is a success, not a loss.

- Pruned 2026-08-23 (durable findings live in
  [harness/codex-provider-parity.md](harness/codex-provider-parity.md)): `a2a-handoff-test.md`
  (task #13 — free-form triage→fixer handoff is sufficient) and `claude-vs-codex-triage-943.md`
  (Codex follows overlay/critique text voluntarily despite inert hooks; observability blind spot).
- Pruned 2026-08-21 (distilled into
  [harness/overlay-modes-comparison.md](harness/overlay-modes-comparison.md)): the A/B/C/D root
  files `full-abcd-comparison.md`, `full-abcd-comparison-v2.md`, `fixer-ab-test-943.md`.
- Pruned 2026-08-21 (shipped): `plan-webhook-session-routing-test.md` — its `pr_session_mappings`
  table + `report_pr_created` MCP tool both shipped and are documented in CLAUDE.md; a superseded
  implementation plan carries no audit value.
- Pruned 2026-08-20 (distilled into `harness/codex-provider-parity.md`): the 210-line
  `codex-parity-test-results.md` and the `plan-triage-fixer-ab-test.md` plan.

Dated snapshots — point-in-time, superseded by design (kept as audit stubs, not for reading):

- [Superseded supervisor snapshots](superseded-supervisor-snapshots.md) - June-2026 `/supervise-issues` cron reports, **pruned to one consolidated audit stub 2026-08-22** (dead renderings; live successor is `supervisor-state.json`)
- [Tracker tick 66](tracker-tick.md) - 176-chain board, 2026-07-01; **pruned to a stub** (dead snapshot, live successor is `supervisor-state.json`)
- Dashboard board renderings (`chat-board` pruned 2026-08-23; `final-board` pruned 2026-08-22; `board-inline` + `inline-board` pruned 2026-08-20) — all dead point-in-time renders, recorded in the two stubs above.

- [Imported native memory](imported/index.md) — migrated concepts, distilled incrementally by the daily OKF cron. Router at [imported/MEMORY.md](imported/MEMORY.md). Synthesis started 2026-08-30: the two flat monolith family indexes (byte-identical to the linked `index-{feedback,project}-N` shards) were pruned and the router trimmed to triggers. 2026-08-31: the monoliths had regrown on disk (still generated by `reindex.sh`); root-caused by making `reindex.sh` delete each source monolith after it shards it (past the row-conservation assert; small unsharded families keep their sole monolith), then deleted the two files — 386 KB, byte-conserved with the shards, all leaves still reachable. Remaining backlog is un-synthesized per-issue/lesson OVERSIZE leaves, distilled ≤4/run by the daily OKF-synth cron and shrinking steadily; the store currently reports **0 structural defects** (bare `[[stem]]` control examples aren't path-form links, so they are correctly never flagged). Live figures: `python3 /workspace/agent/tools/okf_synth.py scan` and `bash imported/reindex.sh --check`.
