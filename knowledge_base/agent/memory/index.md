---
okf_version: "0.1"
---

# Memory Index

## Core Memory

⛔ **THIS STORE IS NOT THE LIVE ONE. The working memory is at
`/home/node/.claude/projects/-workspace-agent/memory/`, index `MEMORY.md`.**
⛔**NO COUNT IS RECORDED HERE ON PURPOSE.** This line said *"517+ files"* from 2026-08-05 until 2026-08-07, by which point the real figure was **1035** — the `+` kept it technically true while understating by ~2x, and a reader sizing the store from it would be wrong in the direction that makes it look small. **A count in a pointer is stale the moment the next leaf lands.** For live figures run `bash reindex.sh --check` in that directory (prints leaves / reachable / ORPHANED and the tightest shard's headroom).
Read that index first; everything operational lives there.

Verified 2026-08-04: this file was the untouched OKF template ("Nothing stored yet"), dated Jul 15.

⛔ **Two-store hazard (kept — this is why the archive is a distinct folder).** The
[ported lego-operator archive](legoop-archive/index.md) holds **52 `legoop-*.md`
operator facts that exist ONLY here** (all absent from the live store's index). It is a
distinct namespace, not a copy of anything. ⛔ **A `cp` in EITHER direction destroys the
other store entirely** — they are fully disjoint, not divergent-with-overlap. Never sync
these; different stores that only share a shape. ⭐ *An old mtime is evidence about
writes, never about relevance.* A stale index that passes every structural check — file
present, links well-formed, confident phrasing — is the failure mode this banner exists
to prevent. (2026-08-19: the archive, formerly a loose `MEMORY.md` + 52 root siblings,
was folded into `legoop-archive/` with `type:` frontmatter on each file.)

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
