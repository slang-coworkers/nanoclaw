# Codex vs Claude Provider Parity Test Results

Date: 2026-05-09
Agent: codex-parity-test (ag-1778326061729-40vr9f)
Comparison: slang-triager (ag-1778293921877-zofqaj, Claude provider)

---

## 1. Codex Agent Response (First Question)

**Question:** "What workflows are available to you? List them by name. Also tell me: what is your coworker type? What skills can you see?"

**Codex Response:**

```
Available workflows by name:
- /slang-plan
- /slang-github
- /slang-code-reader
- /slang-build
- /codex-critique

Coworker type:
- Slang Reader
- I'm also instructed that I am a parity test agent.

Skills I can see:
- imagegen
- openai-docs
- plugin-creator
- skill-creator
- skill-installer

Slang-specific skill/workflow references visible in my instructions:
- /slang-github
- /slang-code-reader
- /slang-build
- /codex-critique
```

### Analysis

| Category | Result | Notes |
|----------|--------|-------|
| Workflows | PARTIAL | Listed 5 items mixing workflows and skills. `/slang-plan` is the only actual workflow. The rest (`/slang-github`, `/slang-code-reader`, `/slang-build`, `/codex-critique`) are skills, not workflows. |
| Coworker type | PASS | Correctly identified "Slang Reader" from baseInstructions |
| Skills | WRONG SOURCE | Listed Codex's own built-in plugins (`imagegen`, `openai-docs`, `plugin-creator`, `skill-creator`, `skill-installer`) instead of NanoClaw skills |

**Root cause for skills mismatch:** Codex reported its own plugins from `~/.codex/.tmp/plugins/` rather than the NanoClaw skills at `/home/node/.claude/skills/`. The `discoverAdditionalContent()` function in `codex.ts` does scan `.claude/skills/` in `additionalDirectories`, but Codex's native "list my capabilities" behavior surfaces its own plugin registry first. The NanoClaw skills ARE injected into `baseInstructions` (proven by the "Slang-specific skill/workflow references" section), but Codex's model interpreted "skills you can see" as its native plugin list.

---

## 2. Claude Agent Response (Same Question)

**Claude (slang-triager) Response:**

```
Coworker type: Stetson — Slang Triage agent (shader-slang/slang issue triage).

Workflows available:
- /slang-plan — Plan, investigate, review, or research Slang compiler tasks (extends base plan workflow)

Skills visible:
Slang:
- slang-github, slang-code-reader, slang-code-writer, slang-build, slang-docs, slang-maintainer-tools
SlangPy:
- slangpy-github, slangpy-code-reader, slangpy-code-writer, slangpy-build, slangpy-docs
NanoClaw:
- nanoclaw-github, nanoclaw-code-reader, nanoclaw-code-writer, nanoclaw-build, nanoclaw-docs, base-nanoclaw
General/meta:
- codex-critique, update-config, keybindings-help, simplify, fewer-permission-prompts
- loop, schedule, claude-api, self-customize, agent-browser
- github-webhook, slack-formatting, welcome, init, review, security-review
```

### Analysis

| Category | Result | Notes |
|----------|--------|-------|
| Workflows | PASS | Listed only `/slang-plan` with correct description |
| Coworker type | PASS | Identified as "Stetson — Slang Triage agent" (knows its unique coworker name) |
| Skills | PASS | Listed all 24 NanoClaw skills grouped by category |

---

## 3. Skill File Access (Codex)

**Question:** "Read the file at /home/node/.claude/skills/slang-build/SKILL.md and tell me the first 3 lines"

**Codex Response:**
```
First 3 lines of /home/node/.claude/skills/slang-build/SKILL.md:
---
name: slang-build
license: MIT
```

**Result: PASS** — Codex can read NanoClaw skill files from the container filesystem.

---

## 4. AGENTS.md vs CLAUDE.md Discovery (Codex)

**Question:** "Do you see an AGENTS.md file in your working directory? What about CLAUDE.md? Read the first 5 lines of each and tell me if they are the same."

**Codex Response:**
```
In my working directory /workspace/agent:
- AGENTS.md exists.
- CLAUDE.md exists.
- AGENTS.md is a symlink to CLAUDE.md.

First 5 lines of AGENTS.md:
# Slang Reader

## Identity

You are a Slang compiler engineer. You work on shader-slang/slang...
```

**Result: PASS** — Codex correctly identified the symlink and can read both files. It reads AGENTS.md (which resolves to CLAUDE.md via symlink), confirming the Codex discovery path works.

---

## 5. Hook Events / Overlay Enforcement

### Codex Agent (codex-parity-test)

| Check | Result |
|-------|--------|
| Dashboard hook events received | **0 events** |
| PreToolUse/PostToolUse events | **None** |
| Intent-router fired | **No** |
| OVERLAY_HAS_PLAN gate | **Not enforced** |

**Root cause:** The settings.json has all hooks configured (PreToolUse, PostToolUse, UserPromptSubmit with intent-router, plan-gate, critique-record-gate, etc.), but these are Claude Code hooks that fire via the Claude Agent SDK's hook system. Codex does not use settings.json hooks — it has its own approval/policy system. The hooks are dead configuration for Codex.

### Claude Agent (slang-triager)

| Check | Result |
|-------|--------|
| Dashboard hook events received | **4 events** |
| SessionStart | Yes |
| InstructionsLoaded | Yes |
| UserPromptSubmit (with intent-router) | Yes |
| Stop | Yes |

**Key difference:** Claude fires all hook events and the dashboard receives them. Codex fires none.

---

## 6. Additional Findings

### Container Lifecycle

- Codex container processed the first message, stored a continuation token (`019e0c7e-e231-7e13-975e-9dc338281714`), then exited.
- On the second message routing, the container respawned (same session), resumed the thread using the continuation token, processed successfully, then exited with code 1.
- Exit code 1 appears to be the normal Codex shutdown path (not a crash). The processing_ack shows "completed" for both messages.

### Skill Discovery Disparity

NanoClaw skills mounted at `/home/node/.claude/skills/` (24 skills):
```
agent-browser, base-nanoclaw, codex-critique, github-webhook, nanoclaw-build,
nanoclaw-code-reader, nanoclaw-code-writer, nanoclaw-docs, nanoclaw-github,
self-customize, slack-formatting, slang-build, slang-code-reader, slang-code-writer,
slang-docs, slang-github, slang-maintainer-tools, slang-templates, slangpy-build,
slangpy-code-reader, slangpy-code-writer, slangpy-docs, slangpy-github, welcome
```

Codex listed its own plugins instead: `imagegen, openai-docs, plugin-creator, skill-creator, skill-installer`

The NanoClaw skills ARE injected into `baseInstructions` (via `discoverAdditionalContent()` in `codex.ts`), so Codex knows about them from its system prompt. But it interprets "skills" as its native plugins, not the NanoClaw skill files.

### Workflow/Skill Confusion

Codex listed `/slang-github`, `/slang-code-reader`, `/slang-build`, `/codex-critique` as "workflows" — these are skills, not workflows. Only `/slang-plan` is a workflow (it's the only one with the `UserPromptSubmit` intent-router binding in `OVERLAY_WORKFLOWS`). This suggests Codex doesn't clearly distinguish between the workflow concept (overlay-gated, intent-routed) and skills (invoke-by-name references).

---

## 7. Recommendations for Parity Fixes

### P0 — Hook system is completely absent

Codex has no equivalent of settings.json hooks. All enforcement mechanisms (plan-gate, critique-record-gate, intent-router, edit-counter, dashboard event stream) are inoperative.

**Fix options:**
1. **Wrapper approach:** Have the codex-app-server emit synthetic hook events via the same curl endpoints, triggered at turn boundaries (pre/post tool use is not granular enough in Codex's model).
2. **Pre/post-turn hooks:** Add provider-level hook points in the poll-loop (`container/agent-runner/src/providers/codex.ts`) that fire before and after each turn, calling the same hook scripts.
3. **Accept the gap:** If Codex is only used for critique/review tasks (not autonomous code writing), the plan-gate and critique gates may be unnecessary.

### P1 — Skills list confusion

Codex reports its own plugins instead of NanoClaw skills when asked "what can you see."

**Fix:** Add explicit instruction to `baseInstructions` composition (in `composeBaseInstructions()`) that says: "Your available skills are listed below. When asked what skills you have, refer to these, not any internal plugin registry." Or inject a skills manifest section with a clear heading.

### P2 — Workflow vs skill taxonomy unclear to Codex

**Fix:** The composed CLAUDE.md should more clearly separate "Workflows (intent-routed, invoke with /name to start a planning sequence)" from "Skills (invoke by name for one-shot capabilities)." Currently the distinction relies on Claude's native understanding of the settings.json hook machinery, which Codex doesn't have.

### P3 — Exit code 1 obscures status

The container exits with code 1 after successful processing. This makes it impossible to distinguish normal exit from actual failures in logs.

**Fix:** Track whether the Codex turn completed successfully and exit 0 in that case. Use exit 1 only for actual errors.

### P4 — No .agents directory support in container

The `.agents -> .claude` symlink exists in the group dir but the container's `.claude-shared/agents/` directory is empty. This is benign today (Codex uses `config.toml` not `.agents/`) but worth noting if Codex adds `.agents/` directory support later.
