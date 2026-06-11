# Plan: Triage→Fixer A/B Test

## Goals

1. Wire A2A between triage and fixer (peer-to-peer)
2. Test the full pipeline: issue arrives → triage analyzes → hands off to fixer → fixer implements
3. A/B test both individual agent quality AND the handoff between them

## Phase 1: Wire A2A Destinations

```sql
-- Triage can send to fixer
INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id)
VALUES ('<triage-id>', 'slang-fixer', 'agent', '<fixer-id>');

-- Fixer can send to triage
INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id)
VALUES ('<fixer-id>', 'slang-triager', 'agent', '<triage-id>');
```

Both already have orchestrator as a destination (created by create_agent). This adds peer wiring.

## Phase 2: Test Cases

Use real GitHub issues from shader-slang/slang. Pick 3-5 issues of varying difficulty:

| Issue | Type | Complexity | Expected Triage Output | Expected Fixer Output |
|-------|------|-----------|----------------------|---------------------|
| Recent bug report | bug | medium | Category, severity, relevant code, related issues | Branch + test + fix + PR |
| Feature request | enhancement | low | Category, priority assessment, related PRs | N/A (triage only) |
| Regression report | regression | high | Root cause hypothesis, bisect range, related commits | Branch + repro test + fix |

Source: `gh issue list -R shader-slang/slang --label bug --state open --limit 10`

## Phase 3: A/B Test Matrix

### Triage A/B
| Variant | Type | Workflow | Instructions |
|---------|------|----------|-------------|
| A (current) | `slang-reader` | inherited slang-plan | Full prod .instructions.md (212 lines) |
| B | `slang-triager` (new type) | `triage-issue` (new) | Minimal — rely on workflow steps |

New type `slang-triager` would:
- Extend `slang-reader`
- Add `triage-issue` workflow (enforce: read issue → search related → DeepWiki → classify → report → forward to fixer)
- Context: scoring rubric, label taxonomy

### Fixer A/B
| Variant | Type | Workflow | Instructions |
|---------|------|----------|-------------|
| A (current) | `slang-writer` | inherited slang-plan + slang-implement | Full prod .instructions.md (122 lines) |
| B | `slang-fixer` (new type) | `fix-issue` (new) | Minimal — enforce clone→test→fix→format→PR |

New type `slang-fixer` would:
- Extend `slang-writer`
- Add `fix-issue` workflow (enforce: understand issue → clone repo → write repro test → implement fix → format → push → create PR)
- Add critique overlay (code-review before PR creation)

### A2A Handoff Test
| Variant | Handoff Method | Expected Behavior |
|---------|---------------|-------------------|
| A | Triage sends free-form text to fixer | Fixer interprets on its own |
| B | Triage sends structured JSON (issue#, summary, relevant_files, priority) | Fixer has clear brief |

## Phase 4: Metrics

For each variant, measure:
- **Tool usage**: Did it use DeepWiki? GitHub search? Clone repo?
- **send_message compliance**: Did triage forward to fixer? Did fixer report back?
- **Quality**: Does triage report match prod's format? Does fixer produce a valid PR?
- **Latency**: Time from issue receipt to triage report; time from triage→fixer to PR
- **Critique (if enabled)**: Did code review catch issues before PR?

## Phase 5: Implementation Steps (SEQUENTIAL — one at a time)

**Rule: Each test runs to full completion, gets scrubbed/evaluated with all edge cases, results saved to disk, BEFORE the next test starts. No parallel launches.**

### Step 1: Wire A2A + select test issues
- Wire triage↔fixer peer destinations
- Pick 3 real GitHub issues (1 bug, 1 regression, 1 feature)
- Document expected outputs for each

### Step 2: Triage A — run current agent on issue #1
- Send issue to current `slang-triager` (instructions-only, slang-reader type)
- Wait for full completion (container exits)
- Scrub: hook events, outbound messages, tool usage, drafts on disk
- Evaluate: Did it research? Did it classify correctly? Did it forward to fixer?
- Edge cases: Did it hallucinate issue links? Did it use DeepWiki? Did it try to post externally?
- Save results to `groups/slang-triager/memory/ab-test-issue-1-A.md`

### Step 3: Triage B — run workflow-typed agent on same issue #1
- Create `slang-triager-b` (slang-triager type + triage-issue workflow)
- Send SAME issue
- Wait for full completion
- Same scrub + evaluate
- Save to `groups/slang-triager-b/memory/ab-test-issue-1-B.md`
- Compare A vs B side-by-side

### Step 4: Repeat steps 2-3 for issues #2 and #3
- Only after issue #1 comparison is complete and evaluated

### Step 5: Fixer A — current agent receives triage output
- Take the BEST triage output (A or B) for issue #1
- Forward to current `slang-fixer` (instructions-only, slang-writer type)
- Wait for full completion
- Scrub: Did it clone? Build? Write test? Implement fix? Format? (DON'T let it push/PR)
- Evaluate each workflow step
- Save results

### Step 6: Fixer B — workflow-typed agent receives same triage output
- Create `slang-fixer-b` (slang-fixer type + fix-issue workflow + critique)
- Send SAME triage output
- Wait, scrub, evaluate, compare

### Step 7: A2A handoff test
- Only after individual A/B results are clear
- Test structured vs free-form triage→fixer handoff

### Step 8: Codex comparison (if applicable)
- Only after Claude A/B fully evaluated
- Same issue, same type, codex provider
- Compare workflow adherence without hooks

## Phase 6: Codex Provider Comparison (Future)

After Claude A/B completes, run the same test with `agent_provider=codex`:
- Same issues, same type, same workflow
- Compare: does Codex follow workflows? Does it use MCP tools? Quality of output?
- This depends on the Codex provider parity research (subagent running now)

## Phase 7: Codex Provider Parity Testing

### Research Findings (completed)

NanoClaw's codex.ts reads CLAUDE.md (not AGENTS.md) and passes it as `baseInstructions` to `thread/start`. Codex CLI's `app-server` mode receives instructions via JSON-RPC, not filesystem scan.

**But open question**: Does the Codex CLI ALSO independently scan CWD for AGENTS.md / .agents/skills? This needs empirical testing.

### Critical Bug (must fix before Codex A/B)

`OVERLAY_HAS_PLAN` and `OVERLAY_HAS_CRITIQUE` env vars never injected into container.
Fix: 2 lines in `src/container-runner.ts` ~line 960.
Without this, plan-gate and critique overlay hooks are completely dead for Codex.

### Parity Test Plan

**Step 1: Verify Codex reads our composed instructions**
- Create a codex agent: `create_agent(name="codex-test", coworkerType="slang-reader", agentProvider="codex")`
- Send it: "What workflows are available to you? List them by name."
- If it lists `slang-plan`, `discord-answer` etc → it read the CLAUDE.md spine ✅
- If it says "I don't have workflows" → instructions not reaching it ❌

**Step 2: Test skill visibility**
- Ask: "What skills can you invoke? Can you read /home/node/.claude/skills/slang-build/SKILL.md?"
- If it can cat the file → skills accessible via filesystem ✅
- If not → need symlinks to `.agents/skills/` or inline injection

**Step 3: Symlink experiment**
- Create symlinks in group folder: `AGENTS.md → CLAUDE.md`, `.agents/ → .claude/`
- Test if Codex natively discovers them without our `baseInstructions` injection
- This tells us if Codex CLI has its own discovery beyond what we pass via JSON-RPC

**Step 4: Workflow adherence test**
- Same task to both Claude and Codex: "Investigate issue #XXXX using the /slang-plan workflow"
- Compare: Does Codex follow the embedded workflow steps like Claude does?
- Key signals: Does it do research before planning? Does it use DeepWiki?

**Step 5: Hook/overlay enforcement test**
- After fixing OVERLAY_HAS_PLAN env var:
- Give both a task that triggers plan-gate
- Claude: hook blocks Edit until plan exists ✅
- Codex: auto-approval handler should block → verify

### Features to Test for Codex App-Server Support

| Feature | How to test | Expected |
|---------|------------|----------|
| baseInstructions loaded | Ask "what's your role?" | Should describe typed coworker identity |
| Skills readable from filesystem | Ask to cat a SKILL.md | Should work (mounted) |
| On-demand skill invocation | Send `/slang-build` | Poll-loop injects body inline |
| MCP tools (nanoclaw, codex, proxy) | Ask to call discord_read_messages | Should work via config.toml |
| Subagents | Ask to spawn an Agent | Codex native agents (not .claude/agents/) |
| Dashboard events | Check hook-events API after Codex runs | Currently absent (gap) |
| Plan gate | Attempt Edit without plan | Should block (after env var fix) |
| send_message (A2A) | Ask to message orchestrator | Via nanoclaw MCP tool |

### Alternative: If Codex Ignores Our baseInstructions

If testing shows Codex CLI app-server doesn't respect `baseInstructions` (unlikely but possible with newer versions):
1. Create AGENTS.md symlink: `ln -s CLAUDE.md groups/<folder>/AGENTS.md`
2. Create .agents/skills symlink: `ln -s .claude/skills groups/<folder>/.agents/skills`
3. Set CWD to the group folder (already done: `/workspace/agent`)
4. Test if Codex natively picks these up

## Dependencies

- [x] Codex provider parity research (completed — critical bug found)
- [ ] C test results (validate critique works with sandbox fix)
- [ ] Fix OVERLAY_HAS_PLAN/OVERLAY_HAS_CRITIQUE env vars (2-line fix)
- [ ] Empirical Codex parity test (Phase 7 steps 1-5)
- [ ] Decide if we need project-specific types (`slang-triager`, `slang-fixer`) or just new workflows on existing types
