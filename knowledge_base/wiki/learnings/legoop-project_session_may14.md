---
title: "May 14 session — landed PRs"
type: learning
topic: agent-ops
source: learnings/legoop-project_session_may14.md
---

# May 14 session — landed PRs

May 14 2026 session work — all merged.

**PRs (slang-coworkers/nanoclaw):**
- **#335** (`nv-slang`) — rewrote 4 broken slang workflows (`slang-pr-review`, `slang-fix-issue`, `slang-triage-issue`, `slang-discord-answer`) from `## Step N: TITLE` H2 format → `N. **Title** {#id}` numbered-list format. Composer's step parser only matches numbered-list; H2 headers silently produced empty step bodies. All four were running with description-only CLAUDE.mds since #323/#325/#334.
- **#336** (`nv-main`) — `validate-templates.ts` assertion + R13 vitest + CONTRIBUTING.md "Writing a workflow" docs. Catches the silent-empty-body failure systematically.
- **#337** (`nv-dashboard`) — `POST /api/coworkers` now binds new non-admin coworkers to admin's messaging group with `@<name>` engage pattern. Direct routing also keeps own dashboard tab; internal-only stays in admin group. Order: `ensureDashboardChatWiring` runs FIRST, then admin-binding INSERT (otherwise the wiring helper's "any dashboard mg this agent already has" fallback finds the admin mg and skips own-tab creation).
- **#338** (`nv-main`) — host-sweep `detectStaleContainers` had `if (!spawnHash) continue` silent bypass when `spawnedClaudeMdHash` (in-memory Map) was empty. The map empties on host restart; any container outliving a restart became permanently invisible to stale detection. Fix: fall back to hashing on-disk CLAUDE.md as baseline. Concrete failure: slang-triager CLAUDE.md was 3 days stale (May 11 mtime).

**Upstream registry (`shader-slang/slang-skills@coworkers`):**
- Renamed skill `slang-pr-review` → `slang-pr-review-runner` (resolved registry collision with workflow of same name)
- Stripped `--live-on-fork` (skill is read-only; output flows back via `send_file`)
- Added `scripts/devin-fetch.sh` (Reviewer B — Devin via agent-browser)
- `provides: [code.review]` so it surfaces under "Code" in Skills Available

**Why:** [[project_composer_zero_warnings]] — composer step parser only accepts `^\s*\d+\.\s+\*\*[^*]+\*\*` regex; H2/H4 headers don't match; failure mode is silent. R13 + validate-templates now gate this.

**How to apply:** When creating new workflows, follow CONTRIBUTING.md "Writing a workflow" — numbered-list step format only. When investigating "running container has stale CLAUDE.md," confirm host-sweep fix is in place ([[project_session_may14]] PR #338) — running-container baseline now reads from disk if Map is empty.

**Manual fixes done this session (no need to redo):**
- DB INSERT to wire SlangReviewer (`ag-1778732728201-w4zo8d`) into orchestrator's mg `mg-1778288632740-rc9cak` with `@slangreviewer\b` pattern. Future coworkers auto-bind via PR #337.
- Regenerated 6 stale CLAUDE.mds: slang-fixer, slang-discord-support, nanoclaw, neuralgraphics, slangclaudereviewer (43→11 KB), perfhound. Future restarts auto-refresh via PR #338.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/legoop-project_session_may14.md`_
