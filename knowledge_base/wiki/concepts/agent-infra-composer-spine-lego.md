---
title: "Composer, Spine, and Lego Coworker System"
type: concept
group: agent-infra
tags: [composer, spine, lego, coworker, claude-md, workflows, codex, skills, ab-test, buddy, overlay]
source_count: 23
---

# Composer, Spine, and Lego Coworker System

This page covers the NanoClaw lego coworker architecture: how CLAUDE.md spines are composed, workflow step format requirements, codex/buddy integration, A/B test infra, skill discovery for Codex agents, pre-commit hook gotchas, and operational feedback from production coworker deployments.

## TL;DR

- Write workflow steps as a numbered list (`1. **Title** {#id}`) only. The composer's parser matches nothing else, so `## Step N:` headers silently compose empty step bodies — a whole workflow can run on description-only text with no error. Run `npm run validate:templates` to catch it.
- Refreshing a skill updates its mtime even when content is unchanged, which recomposes the spine, changes the CLAUDE.md hash, and makes the sweep kill running containers. Avoid host/service restarts during active sessions.
- For Codex-provider groups, symlink `AGENTS.md → CLAUDE.md` and `.agents/ → /home/node/.claude` using the ABSOLUTE container path. The group folder has no `.claude/` subdirectory. With the symlinks the harness discovers skills natively and skips `baseInstructions` injection; without them the agent reports no skills.
- Block a read-only/eval coworker from external writes at BOTH layers: the MCP allowlist AND the prompt. The allowlist does not stop a bash `gh pr comment`, and prose does not stop a tool call.
- Judge coworker output on would-you-ship-this engineering quality — correctness, adaptation to the real problem, no hacks or test-gaming. Never reward proxy metrics (lines changed, speed, comment count). A green CI on a fix that games the test is a failure.
- The nv-* `.husky/pre-commit` hook runs `format:fix` then re-stages only `src/**/*.ts`, silently dropping every other staged path from the commit. For multi-path commits, format and test yourself, use `--no-verify`, and ALWAYS confirm with `git show --stat HEAD`. The pre-push hook has the same shape.
- Encode a must-happen behavior as a numbered workflow step with a MUST gate, not a paragraph in CLAUDE.md. Prose instructions reliably fail to elicit tool usage that a structured step enforces.
- `base-nanoclaw` is a base-platform dependency of `base-common`, not a project skill — any prod-update path that omits the `nv-nanoclaw` merge fails `validate:templates` for every coworker type.
- rtk token-compression was evaluated and rejected: it rewrites none of the commands that dominate the Slang token bill while applying lossy compression to credential-adjacent and exact-output reads. Do not re-propose unless the cost driver changes.
- The triage workflow's read-only-on-GitHub posture is the default research stance, not an absolute bar. It yields when the spine's GitHub-observability MUST applies AND the parent authorizes the post for that issue. Stay read-only through research; post at resolution. Reconcile a buddy flag by citing the authorization, not by reverting.
- When threading a new IR opcode as a sibling of an existing one, grep for the existing opcode's symbol across `source/` for the inventory. Curated touchpoint lists routinely miss name-lookup tables, IR-pass pattern matchers, override-synthesis sites, and stable-name tables.
- Before flagging normalize-before-match as a new risk in a review, check whether a shipped sibling already normalizes the same kind of string. If the normalizer is not in the PR diff it is base behavior — downgrade to at most "pre-existing, out of scope."
- Trace a tool's top-level `main.cpp` flow, not the library entry point whose name matches the flag. `slangi -disasm` disassembles and then still executes, so it shares the run-path crash rather than being a separate site — one fix covers both.
- Verify parity claims by reading the shared code path: slang-test's `-exclude-prefix`, `-skip-list`, and positional `-test-prefix` are all `Path::simplify`'d identically and compared by exact string, so a new matcher must reuse the same normalization or it breaks parity.
- Scope target-specific IR passes explicitly — e.g. empty-struct field removal is valid only for C-like source targets and must be gated off the direct-LLVM CPU path.
- Adding a method to a public COM interface needs coordinated ABI touchpoints beyond header and impl; the record/replay registration is the one that fails silently.

## Workflow Step Format: Numbered List Only

The composer's step parser only matches `^\s*\d+\.\s+\*\*[^*]+\*\*` (numbered-list format). `## Step N: TITLE` H2 headers silently produce empty step bodies. All four broken Slang workflows (`slang-pr-review`, `slang-fix-issue`, `slang-triage-issue`, `slang-discord-answer`) were running with description-only CLAUDE.mds since this mistake. The fix was PR #335 (May 14 session) and `validate-templates.ts` CI gate (PR #336) ([May 14 session — landed PRs](wiki/learnings/legoop-project_session_may14.md)).

When creating new workflows, use numbered-list step format only: `1. **Title** {#id}` — never H2/H4 headers. `npm run validate:templates` (runs in CI before tests) catches the silent-empty-body failure systematically.

## Spine Composition and CLAUDE.md Staleness Detection

The host sweep detects stale containers by comparing the container's `spawnedClaudeMdHash` (in-memory Map) against the current CLAUDE.md hash. The Map empties on host restart: any container outliving a restart became permanently invisible to stale detection. The fix (PR #338) falls back to hashing the on-disk CLAUDE.md as baseline ([May 14 session — landed PRs](wiki/learnings/legoop-project_session_may14.md)).

When a skill is refreshed (even if content is unchanged, mtime updates), the spine recomposes and the hash changes → the sweep kills running containers. This is why service restarts during active sessions are disruptive ([Restarting nanoclaw main service triggers initGroupFilesystem → skill refresh → CLAUDE.md recompose → claude-md-stale kills all running containers. Avoid restarts during active sessions.](wiki/learnings/legoop-feedback_service_restart_kills_containers.md)).

## Codex Agent Skill Discovery: Symlinks

For Codex provider agents, create symlinks in the group folder so Codex CLI natively discovers NanoClaw content ([Create symlinks (AGENTS.md→CLAUDE.md, .agents→.claude) in group folders for Codex agents so the Codex CLI natively discovers our skills. Prefer letting the harness pick them up over overriding developer instructions.](wiki/learnings/legoop-feedback_codex_symlinks_for_skills.md)):
- `AGENTS.md → CLAUDE.md`
- `.agents/ → /home/node/.claude` (ABSOLUTE container path — not relative `.claude`)

The `.agents` symlink MUST use the absolute container path `/home/node/.claude`, NOT relative `.claude`. The group folder (`/workspace/agent/`) has no `.claude/` subdirectory — skills are mounted at `/home/node/.claude/skills/` which is a separate mount point.

With the symlinks, the harness picks up skills naturally alongside Codex's own native plugins; without them, `baseInstructions` injection produces no skill listing when the agent is asked what skills are available. When AGENTS.md symlink exists, the harness skips `baseInstructions` injection (no duplication). `promptAddendum` (routing/session context) is still injected.

## Read-Only / Eval Coworkers: Block Writes at Both Layers

When a coworker is meant to be non-posting (read-only review, eval, A/B), block external writes at BOTH the MCP allowlist (no write tools granted) AND the prompt level (instructions forbid `gh`/`git push`/post). One layer alone leaks: the allowlist doesn't stop a bash `gh pr comment`, and prose alone doesn't stop a tool call ([Read-only/eval coworkers must be blocked from external posting at BOTH layers](wiki/learnings/legoop-feedback_no_external_post_ab_tests.md)).

## A/B Test Infrastructure: Evaluation Criteria

Judge coworker output on real engineering quality — would-you-ship-this: correctness, adaptation to the actual problem, creativity, no hacks/workarounds/test-gaming. Don't reward proxy metrics (lines changed, speed, number of comments). A fix that games the test or papers over the root cause is a failure even if CI goes green ([Judge coworker output by real engineering quality, not proxy metrics](wiki/learnings/legoop-feedback_ab_evaluation_criteria.md)).

## Pre-commit Hook Drops Files on nv-* Branches

The `.husky/pre-commit` hook on nv-* branches runs `pnpm run format:fix` then re-stages only `src/**/*.ts`. If your commit mixes `src/**/*.ts` edits with other paths (container/, .github/, *.md, *.yaml) and prettier touches anything, the hook's selective re-add silently drops the non-src and prettier-reset files from the commit — no error ([nv-* pre-commit hook runs format:fix then re-adds only src/**/*.ts — silently drops other staged files from the commit](wiki/learnings/legoop-feedback_precommit_hook_drops_files.md)).

Symptom (PR #554): committed an 11-file feature; the resulting commit contained only 4 brand-new files, all 6 tracked `M` edits fell out. For multi-path commits: use `git commit --no-verify` (after running `pnpm run format:fix` + tests yourself), then ALWAYS verify with `git show --stat HEAD`. Same applies to `git push` which has a pre-push hook.

## Buddy Skill: Codex Review Not Actually Running

The `/buddy` skill spawns a background Agent that correctly finds the session JSONL and creates a codex thread, but never calls `mcp__codex__codex-reply` to send monitoring updates. The guidance written is based on Claude's OWN analysis of the JSONL, not codex's analysis — the buddy overlay currently adds no independent verification ([Legoop project buddy not using codex](wiki/learnings/legoop-project_buddy_not_using_codex.md)).

Fix needed in `container/skills/buddy/SKILL.md`: after reading JSONL lines, buddy MUST call `mcp__codex__codex-reply(threadId=<saved>, prompt=<transcript summary>)` and should only write to `.buddy-guidance` based on CODEX's response, not its own judgment.

## Workflows Enforce Tool Usage That Prose Instructions Don't

A structured WORKFLOW.md (explicit numbered steps with MUST gates) enforces tool usage — DeepWiki research, send_message handoffs, critique stages — that a long prose instruction block fails to elicit. When a behavior must reliably happen, encode it as a workflow step, not a paragraph in CLAUDE.md ([Workflows enforce tool usage that prose instructions don't](wiki/learnings/legoop-project_ab_test_discord_workflow.md)).

## update-slang-coworkers-prod Skill Missing nv-nanoclaw Branch

The `/update-slang-coworkers-prod` skill only checks/merges nv-main, nv-dashboard, nv-slang, nv-slangpy — it omits `nv-nanoclaw`. `base-common` (`container/spines/base/coworker-types.yaml`) lists `base-nanoclaw` in its `skills:`, and `base-nanoclaw` lives only on `origin/nv-nanoclaw`. Without merging nv-nanoclaw, `npm run validate:templates` fails for every coworker type ([update-slang-coworkers-prod skill omits nv-nanoclaw merge; base-nanoclaw is a base-common dependency so validate fails without it](wiki/learnings/legoop-project_prod_update_skill_missing_nanoclaw.md)).

Note that `base-nanoclaw` (despite the name) is a base-platform skill required by base-common, not a project skill — it's a hard dependency even on prod instances that don't run nanoclaw-* coworkers.

## rtk Token-Compression Proxy: Evaluated and Rejected

rtk v0.42.1 dry-run shows it rewrites only `git gh cat ls grep cargo pytest make docker kubectl` — NOT `cmake`, `ninja`, `slang-test`, `slangc`, or `./extras/formatting.sh` (the exact commands that dominate the Slang coworkers' token bill). Net negative: lossy compression lands on credential-adjacent and exact-output reads while saving nothing useful ([rtk token-compression proxy evaluated 2026-06-03 and rejected for all groups; not enabled anywhere](wiki/learnings/legoop-project_rtk_evaluated_rejected.md)). Do not propose rtk again unless the cost driver changes.

## Inter-Coworker Routing: Triage Posture and Handoff Rules

The triage workflow's "read-only on GitHub" posture is the DEFAULT research-phase stance, not an absolute bar. It is overridden when: (1) the spine CLAUDE.md "GitHub as primary observability" [MUST] applies, AND (2) the parent explicitly authorizes the post for that specific issue ([Triage workflow read-only-GitHub yields to spine observability MUST + explicit parent authorization](wiki/learnings/1780414455913-triage-workflow-read-only-github-yields-to-spine-o.md)).

Staying read-only during research steps (1–6) and posting only at the resolution phase (with explicit parent auth) is the correct pattern. A buddy-monitor flagging the write as a spec violation should be reconciled by citing parent instruction + spine MUST, not by reverting.

## Sibling-Opcode Threading: Grep Not Curated Lists

When threading a new IR opcode as a sibling of an existing one, the only reliable inventory is `grep` for the existing opcode's symbol across the codebase. Curated touchpoint lists routinely miss the name-lookup tables, IR-pass-level pattern matchers, override-synthesis sites, and stable-name tables. Specifically: `grep -rn "kIROp_<existing-opcode>" source/slang/ source/compiler-core/ source/core/` ([slang sibling-opcode threading — grep-not-list rule for fan-out inventory](wiki/learnings/1780292674603-slang-sibling-opcode-threading-grep-not-list-rule-.md)).

## Code Review: Normalize-Before-Match Parity Check

Before flagging normalize-before-match as a NEW risk in a PR review, check whether a shipped sibling feature already applies the same normalization to the same kind of string. If the normalizer is NOT in the `gh pr diff`, it's base behavior — downgrade from "bug this PR adds" to at most "pre-existing, out of scope" ([Before flagging normalize-before-match as a NEW risk, check shipped-sibling parity](wiki/learnings/1780324464202-before-flagging-normalize-before-match-as-a-new-ri.md)). Verify with `gh pr diff | grep <normalizer>` before escalating.

## slang-test Exclude-Prefix and Skip-List Path Normalization

`-exclude-prefix` entries, `-skip-list` entries, and positional `-test-prefix` args are ALL run through `Slang::Path::simplify(..., SimplifyStyle::NoRoot)` before storage and are compared by exact string. A new matcher reusing the same comparisons inherits whatever separator behavior the shipped positive-selector already relies on — skipping `Path::simplify` would break parity ([slang-test: -exclude-prefix / -skip-list / -test-prefix are all Path::simplify'd identically](wiki/learnings/1780324292016-slang-test-exclude-prefix-skip-list-test-prefix-ar.md)).

## slangi Printf and Disasm Crash Analysis

`slangi -disasm` shares the same runtime crash path as `slangi` — the tool disassembles AND then always falls through to execute. One `printHandler` fix (`source/slang/slang-vm-inst-impl.cpp`) fixes both invocations. Trace the TOOL's top-level flow (`tools/.../main.cpp`), not just the library entry point whose name matches the flag ([slangi `-disasm` shares the run-path crash — NOT a separate site (corrects a prior #11399 learning)](wiki/learnings/1780385340573-slangi-disasm-crash-is-not-a-separate-site-it-exec.md), [slangi printf %s with string literal crashes (run vs -disasm are distinct paths)](wiki/learnings/1780332260528-slangi-printf-s-with-string-literal-crashes-run-vs.md)).

## Slang Compiler Bug Analysis Reference Learnings

Several learnings document Slang-compiler-specific behaviors useful for future debugging:
- The `[require]` capability atoms never reach codegen cap set ([Slang [require] capabilities never reach codegen cap set; version path has a partial compensation, bindless has none](wiki/learnings/1781638061693-slang-require-capabilities-never-reach-codegen-cap.md))
- Float bitwise operator fast-path regression (#11493→#11648): binary `& | ^ << >>` and unary `~` are separate branches ([Slang #11493 fast-path silently declines float-bitwise → E39999 ambiguous (regression vector)](wiki/learnings/1781703451468-slang-11493-fast-path-silently-declines-float-bitw.md), [slang #11648 float-bitwise diagnostic: binary and unary ~ are separate fast-path branches](wiki/learnings/1781724869679-slang-11648-float-bitwise-diagnostic-binary-and-un.md))
- Empty-struct field removal pass must be scoped to C-like source targets only (gate: `!isCPUTargetViaLLVM`) ([Empty-struct field removal is C-source-only — never run it on the direct-LLVM CPU path](wiki/learnings/1781735606781-empty-struct-field-removal-is-c-source-only-never-.md))
- Adding a method to `IGlobalSession` requires 4 coordinated ABI touchpoints beyond header+impl, with the REPLAY_REGISTER being the silent one ([Adding a method to Slang IGlobalSession — the 4 ABI touchpoints beyond header+impl (replay-handlers is the silent one)](wiki/learnings/1781177934466-adding-a-method-to-slang-iglobalsession-the-4-abi-.md))
- coerce-bypass on bound-receiver injection: let the receiver flow raw for known structural injections ([slang-coerce-bypass-on-bound-receiver-injection-empirical](wiki/learnings/1780073270938-slang-coerce-bypass-on-bound-receiver-injection-em.md))
- bundle-level `watched_paths_digest` in diagnostics-catalog already covers catalog source — per-entry `doc_section_digest` is localization only ([slang #11410: bundle-level watched_paths_digest already covers catalog source — per-entry doc_section_digest is only localization](wiki/learnings/1780354591272-slang-11410-bundle-level-watched-paths-digest-alre.md))
- using-namespace import leak has a twin on the legacy/API lookup path ([Slang: using-namespace import leak had a TWIN on the legacy/API lookup path](wiki/learnings/1780493606237-slang-using-namespace-import-leak-had-a-twin-on-th.md))

---
**Source learnings (23):**
- [May 14 session (workflow step format fix, validate-templates, stale detection fix)](wiki/learnings/legoop-project_session_may14.md)
- [Create symlinks (AGENTS.md, .agents) in group folders for Codex agents](wiki/learnings/legoop-feedback_codex_symlinks_for_skills.md)
- [Read-only/eval coworkers must be blocked from external posting at BOTH layers](wiki/learnings/legoop-feedback_no_external_post_ab_tests.md)
- [Judge coworker output by real engineering quality, not proxy metrics](wiki/learnings/legoop-feedback_ab_evaluation_criteria.md)
- [nv-* pre-commit hook runs format:fix then re-adds only src/**/*.ts — silently drops other staged files](wiki/learnings/legoop-feedback_precommit_hook_drops_files.md)
- [Bug: Buddy is Claude reviewing itself, not codex reviewing Claude](wiki/learnings/legoop-project_buddy_not_using_codex.md)
- [Workflows enforce tool usage that prose instructions don't](wiki/learnings/legoop-project_ab_test_discord_workflow.md)
- [update-slang-coworkers-prod skill omits nv-nanoclaw merge](wiki/learnings/legoop-project_prod_update_skill_missing_nanoclaw.md)
- [rtk token-compression proxy evaluated 2026-06-03 and rejected](wiki/learnings/legoop-project_rtk_evaluated_rejected.md)
- [Triage workflow read-only-GitHub yields to spine observability MUST](wiki/learnings/1780414455913-triage-workflow-read-only-github-yields-to-spine-o.md)
- [slang sibling-opcode threading — grep-not-list rule for fan-out inventory](wiki/learnings/1780292674603-slang-sibling-opcode-threading-grep-not-list-rule-.md)
- [Before flagging normalize-before-match as a NEW risk, check shipped-sibling parity](wiki/learnings/1780324464202-before-flagging-normalize-before-match-as-a-new-ri.md)
- [slang-test: -exclude-prefix / -skip-list / -test-prefix are all Path::simplify'd identically](wiki/learnings/1780324292016-slang-test-exclude-prefix-skip-list-test-prefix-ar.md)
- [slangi printf %s with string literal crashes (run vs -disasm are distinct paths)](wiki/learnings/1780332260528-slangi-printf-s-with-string-literal-crashes-run-vs.md)
- [slangi -disasm shares the run-path crash — NOT a separate site (corrects prior learning)](wiki/learnings/1780385340573-slangi-disasm-crash-is-not-a-separate-site-it-exec.md)
- [Slang [require] capabilities never reach codegen cap set](wiki/learnings/1781638061693-slang-require-capabilities-never-reach-codegen-cap.md)
- [Slang #11493 fast-path silently declines float-bitwise → E39999 ambiguous](wiki/learnings/1781703451468-slang-11493-fast-path-silently-declines-float-bitw.md)
- [slang #11648 float-bitwise diagnostic: binary and unary ~ are separate fast-path branches](wiki/learnings/1781724869679-slang-11648-float-bitwise-diagnostic-binary-and-un.md)
- [Empty-struct field removal is C-source-only — never run it on the direct-LLVM CPU path](wiki/learnings/1781735606781-empty-struct-field-removal-is-c-source-only-never-.md)
- [Adding a method to Slang IGlobalSession — the 4 ABI touchpoints](wiki/learnings/1781177934466-adding-a-method-to-slang-iglobalsession-the-4-abi-.md)
- [slang-coerce-bypass-on-bound-receiver-injection-empirical](wiki/learnings/1780073270938-slang-coerce-bypass-on-bound-receiver-injection-em.md)
- [slang #11410: bundle-level watched_paths_digest already covers catalog source](wiki/learnings/1780354591272-slang-11410-bundle-level-watched-paths-digest-alre.md)
- [Slang: using-namespace import leak had a TWIN on the legacy/API lookup path](wiki/learnings/1780493606237-slang-using-namespace-import-leak-had-a-twin-on-th.md)

_Catalog: [[wiki/index.md]]_
