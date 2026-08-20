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

### Scratch and one-off working notes (linked 2026-08-05)

⛔ **These were listed in BACKTICKS here an hour earlier — which is the exact defect this index's own
banner diagnoses: a filename in prose is invisible to every reachability check.** Naming a residual is
not linking it, so the count was *known* and the files were still unreachable. ⭐⭐ **Recording a lesson
is not applying it.** Now linked, as rows added — nothing deleted.

Provider / harness experiments (May 2026, superseded but hold real findings):

- [A2A handoff test](a2a-handoff-test.md) - task #13: free-form handoff sufficient; **a finding, not scratch**
- [Codex↔Claude provider parity](codex-parity-test-results.md) - 210-line parity matrix, 2026-05-09
- [Claude vs Codex on triage #943](claude-vs-codex-triage-943.md) · [Fixer A/B on slangpy#943](fixer-ab-test-943.md)
- [Full A/B/C/D comparison](full-abcd-comparison.md) · [v2, fixed buddy](full-abcd-comparison-v2.md)
- [Plan: triage→fixer A/B](plan-triage-fixer-ab-test.md) · [Plan: webhook→session routing](plan-webhook-session-routing-test.md)

Dated snapshots — point-in-time, superseded by design (kept for audit, not for reading):

- [Supervise 06-01T1501Z](supervise-table-20260601T1501Z.md) · [06-02T0631Z](supervise-report-2026-06-02T0631Z.md) · [06-02T0708Z](supervise-report-2026-06-02T0708Z.md)
- [Tracker tick 66](tracker-tick.md) - 176-chain board, 2026-07-01; **pruned to a stub** (dead snapshot, live successor is `supervisor-state.json`)
- Dashboard board renderings: [board-inline](board-inline.md) · [chat-board](chat-board.md) · [final-board](final-board.md) · [inline-board](inline-board.md)

**Residual after this pass: 0.** Verify with the walk described in
`/home/node/.claude/projects/-workspace-agent/memory/technique_keeping_this_store_reachable.md`
(store A — **absolute path, deliberately NOT a `[[wikilink]]`**: a wikilink here resolves against *this*
store and dangles, which is the two-store hazard in miniature). Orphans from the readable prefix, both
notation classes, over *both* stores.
