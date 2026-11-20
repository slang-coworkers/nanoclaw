---
type: system
title: Skills registry is read-only from inside containers
description: /app/skills (= /workspace/agent/.agents/skills via symlink) is a ro host-managed registry; skill fixes go to the operator, not through any container
tags: [infrastructure, skills, registry]
---

# Skills registry is read-only from inside containers

Measured 2026-11-16: `/workspace/agent/.agents/skills` is a symlink → `/home/node/.claude/skills` → `/app/skills`, and `/app/skills` is a **read-only bind of the host-side registry** (same inodes appear at both paths; `touch` returns EROFS). Every container — mine and every coworker's — mounts it ro. The registry backs the whole fleet: a fix applied there is instantly visible in every group's container (no restart needed), but **no agent can edit it from inside any container**.

⇒ When a skill (SKILL.md or its scripts) needs a fix:
1. Copy the skill dir out (`cp -r /app/skills/<skill> /tmp/...`), patch, run its tests against the copy, and diff against a pristine copy to separate pre-existing env failures (e.g. MetricsTest expects the nanoclaw repo layout; the proxy opener test is env-dependent) from real regressions.
2. Save the unified diff under `/workspace/agent/reports/` and hand it to the **operator** to apply host-side. `append_learning` does NOT fix skill behavior: task sessions follow SKILL.md literally each fresh run and don't load learnings — the R10 `--author nv-slang-bot` defect recurred 3 weeks straight (10-16, 11-02, 11-16) despite two learnings naming it.
3. `/workspace/codex/skills/*` are dangling symlinks from this container — not an alternate write path.

The registry likely lives in the host's `container/skills/` tree (CLAUDE.md's lego registry); the external subset syncs from shader-slang/slang-skills per `/app/skills/.external-skills.json`. Local skills (compliance-check etc.) are operator-maintained.
