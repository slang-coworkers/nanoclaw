# Create symlinks (AGENTS.md→CLAUDE.md, .agents→.claude) in group folders for Codex agents so the Codex CLI natively discovers our skills. Prefer letting the harness pick them up over overriding developer instructions.

For Codex provider agents, create symlinks in the group folder so Codex CLI natively discovers our content:
- `AGENTS.md → CLAUDE.md`
- `.agents/ → .claude/`

**Why:** Codex CLI has its own native skill discovery from `.agents/skills/`. If we only pass content via `baseInstructions` (developer instructions), Codex doesn't list our skills when asked — it shows its own built-in plugins instead. With the symlinks, the harness (Codex CLI) picks up our skills naturally alongside its own native ones.

**How to apply:** Implemented in `src/group-init.ts` (auto-creates for codex agents) + `container/agent-runner/src/providers/codex.ts` (skips baseInstructions when AGENTS.md exists):
```
groups/<folder>/AGENTS.md → CLAUDE.md              (relative, works in container)
groups/<folder>/.agents   → /home/node/.claude     (ABSOLUTE path — must be container-internal path)
```

**CRITICAL:** The `.agents` symlink MUST use absolute container path `/home/node/.claude`, NOT relative `.claude`. The group folder (`/workspace/agent/`) has no `.claude/` subdirectory — the skills are mounted at `/home/node/.claude/skills/` which is a separate mount point.

**Verified (2026-05-09):**
- Codex discovers all 24 NanoClaw skills via `/workspace/agent/.agents/skills/`
- Codex native plugins (imagegen, openai-docs, etc.) coexist — no conflict
- No duplication: `baseInstructions` injection skipped when AGENTS.md symlink present
- `promptAddendum` (routing/session context) still injected (not filesystem-discoverable)

**Don't override developer instructions** — let the symlinks make content discoverable by the harness naturally. This is more reliable than stuffing everything into `baseInstructions`.
