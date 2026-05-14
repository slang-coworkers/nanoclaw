# NanoClaw Daily Changelog (nv-* branches)

Auto-generated daily rollup of merged PRs across the five upstream branches that feed `nv-coworkers` via the merge train. For semver release notes, see [CHANGELOG.md](CHANGELOG.md).

For architectural context — spines, workflows, overlays, traits, bindings (the lego coworker composition system most of these PRs touch) — see [docs/lego-coworker-workflows.md](https://github.com/slang-coworkers/nanoclaw/blob/nv-main/docs/lego-coworker-workflows.md).

| Branch | Scope |
|---|---|
| `nv-main` | Host process, composer, base spines/workflows, CI |
| `nv-dashboard` | Pixel Office dashboard (standalone) |
| `nv-slang` | slang project spine, skills, workflows |
| `nv-slangpy` | slangpy project spine, skills, workflows |
| `nv-nanoclaw` | nanoclaw self-hosted project spine, skills, workflows |

Cap: ≤10 bullets per branch per day. Entry shape: `**#NNN** title — one-line why`. Dates are in Asia/Kolkata (IST).

<!-- BEGIN AUTO -->

## 📅 2026-05-14

### nv-main (4 PRs)
- **#345** `fix: fetch-skills compares tree-sha, not just branch name` — comparing branch names skipped re-fetch when upstream advanced; now compares cached `github-tree-sha` against upstream sha per skill, with API-failure fallback to "skip"
- **#341** `feat: chain-reporting protocol hoisted to base spine` — every coworker now inherits the 5-bullet `send_message(to="parent")` + `send_file` narrative-attachment shape (was slang-only); coordinated with #342 land sequence
- **#338** `fix(host-sweep): stale CLAUDE.md detect survives host restarts` — empty in-memory `spawnedClaudeMdHash` after restart silently bypassed every active session; falls back to disk-hash and reseeds the map
- **#336** `ci: catch silent empty-workflow-body` — `validate-templates` now fails on zero-step non-extends workflows; new R13 vitest asserts ≥1 step + 100-char `stepBodies` floor; CONTRIBUTING.md documents the required `N. **Title** {#id}` step format

### nv-dashboard (3 PRs)
- **#344** `fix: hidden-session count + Create Modal type-cache regression` — Pixel Office badge now filters `hidden_at`; transient `/api/types` failure no longer poisons the cache (empty `{}` was truthy → never retried)
- **#343** `fix: unread badges propagate + don't auto-mark on view` — outbound poll 30s→3s for agent-originated activity; right-panel render no longer auto-marks the "target" session; coworker click no longer bumps the folder cursor; "mark all read" now also bumps folder cursor
- **#337** `fix: always bind new coworkers to admin's messaging group` — `routing: direct` previously got own dashboard tab but no admin binding (multi-agent handoff broken); both wirings now apply unconditionally for non-admin coworkers

### nv-slang (5 PRs)
- **#342** `feat: draft-PR mode + 5-bullet chain reporting` — `slang-fix-issue` can push fork branch + open cross-fork draft PR (unlocks Devin reviewer); chain-reporting moved to base spine via #341
- **#339** `fix: peer-review quietness rule + active-work sentinel` — kills polite-ack loops between fixer/reviewer (substantive vs no-op classification); `/workspace/agent/active-work/<target>/` claim sentinel deduplicates handoffs arriving via multiple a2a sources, with 30-min TTL
- **#335** `fix: reformat slang-* workflow steps to numbered-list` — four workflows (`slang-discord-answer`, `slang-fix-issue`, `slang-pr-review`, `slang-triage-issue`) were silently composing as description-only because the parser regex requires `N. **Title** {#id}`; rewrote all four with anchor IDs preserved
- **#334** `feat: add slang-reviewer coworker + slang-pr-review workflow` — coworker type + workflow; the skill files live upstream at `shader-slang/slang-skills@coworkers` and are fetched at build time via skill-source inheritance
- **#333** `feat: optional peer-review step in slang-fix-issue` — Step 4.5 sends diff to `slang-reviewer` when present in destinations; silent skip when absent; two-round cap

### nv-slangpy
_No PRs merged today._

### nv-nanoclaw
_No PRs merged today._

<!-- END AUTO -->
