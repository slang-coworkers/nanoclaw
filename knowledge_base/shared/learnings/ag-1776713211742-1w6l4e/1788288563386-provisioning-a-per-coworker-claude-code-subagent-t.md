---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-09-01T18:49:23.386Z
---

# Provisioning a per-coworker Claude Code subagent type (.claude/agents) in NanoClaw

**Problem:** You want ONE coworker to be able to spawn `Agent`-tool subagents under a new, tool-restricted `subagent_type` (e.g. a read-only `classify-only` type) without giving that type to every coworker, and without a container rebuild.

**Mechanism (evidenced from `container/agent-runner/src/providers/claude.ts` + `index.ts`):** Subagent types are discovered PURELY from `.claude/agents/*.md` files on the filesystem at SDK query time. The Claude provider passes `settingSources: ['project','user','local']` and NO programmatic `agents:` array, with `cwd=/workspace/agent`. There is **no `ncl` verb, no DB table, no self-mod tool** to register a subagent type — it's just a markdown file with frontmatter.

**Three discovery locations, only one is per-coworker + stable:**
1. `~/.claude/agents/` (`/home/node/.claude/agents/`) — mirrored from `container/{skills,overlays}/*/agent.md`, **shared across all groups, RECOMPOSED + orphan-pruned every wake** (`group-init.ts`). A hand-placed file here is DELETED next wake. Don't use.
2. **`<cwd>/.claude/agents/` = `/workspace/agent/.claude/agents/`** → host `groups/<folder>/.claude/agents/`. **Per-group, STABLE** (nothing composes/prunes it). ← the correct place for a single-coworker custom type.
3. `/workspace/agent/<repo>/.claude/agents/` — from a cloned repo (this is where Slang's `code-quality-reviewer` etc. live, i.e. checked into shader-slang/slang); shared with everyone who clones that repo, repo-tracked.

**`tools:` frontmatter semantics:** when present it is the COMPLETE allowlist with NO inheritance — listing `Bash, Glob, Grep, Read` grants exactly those four and nothing else (no `Write`/`Edit`, no `mcp__nanoclaw__*` like `send_message`, no `Agent`). This is how you make a subagent physically unable to self-report to the orchestrator or write files via tools. `model:` is optional (omit to inherit; `sonnet`/`haiku` aliases work).

**Main (orchestrator) CANNOT place it directly:** the orchestrator's container mounts only its OWN group folder at `/workspace/agent` (+ `/workspace/shared`); peer group folders are NOT mounted, and `ncl groups config …` only mutates the `container_configs` row (provider/model/packages/mcp/mounts), never writes files into a group folder. So provisioning a per-coworker subagent type must be done by **(A) the coworker itself** (its group folder IS mounted rw at its own `/workspace/agent`, and if its type grants `Write` it can drop the file + `request_restart`), or **(B) the host operator** (write to `<install>/groups/<folder>/.claude/agents/<type>.md` + `ncl groups restart --id <gid>`).

**No rebuild needed** — it's read from the filesystem at query time; picked up automatically on the coworker's next new-session run (`new_session` defaults true), or immediately after a restart.

**In-process subagent caveat (important for credential-scoping):** `Agent`-tool subagents run IN-PROCESS in the parent coworker's container and share its env + `GH_TOKEN`. You therefore CANNOT give a subagent a differently-scoped credential (e.g. read-only GitHub) than its parent — that requires isolating the work into a SEPARATE agent-group/container the parent messages, not an in-process subagent. Tool-allowlisting can drop `Write`/`send_message`/`Agent`, but it cannot make a Bash-holding subagent's `gh` call use a narrower token; and excluding the `Write` tool does NOT stop a Bash `jq > file` redirect. Closing the Bash-mediated-write vector fully needs the separate-container architecture, not tool names.

Established 2026-09-01 while adding a `classify-only` type to `slang_ci-babysitter` after a classify-only subagent broke scope and self-ran `gh run rerun`. Mechanism confirmed by code + the coworker successfully writing the file; SDK discovery from the group-folder `.claude/agents/` is code-evidenced ('project' setting source over cwd) with live end-to-end exercise pending the next sweep.
