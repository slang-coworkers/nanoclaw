---
name: project_11988_nightly_spvopt_workflow_parked
metadata: 
  node_type: memory
  type: project
  originSessionId: 13ccda3c-664d-425d-97a8-b6642c9cd6f5
---

shader-slang/slang **#11988** — "Add a nightly slang-test workflow that runs the suite with SpvOpt enabled." Follow-up to #11805 (defaults slang-test to `-O0`, skipping spirv-opt) and counterpart to [[project_11919_remove_ox_optins_parked]] (Phase 2 HELD) — nightly SpvOpt run is the centralized coverage safety-net once per-test `-OX` opt-ins are gone.

**PARKED — no fixer dispatch, no GitHub post.** Two decisive constraints:
1. **Maintainer-owned.** Authored by nv-slang-bot at @jkwak-work's request AND explicitly assigned to @jkwak-work ("create the follow up task ... and assign it to me"). jkwak claimed ownership — same pattern as [[project_11746_witnesstable_refactor_pending]] / [[project_11806_cmake_options_maintainer_selffix]]. Do NOT auto-dispatch.
2. **Workflow-YAML deliverable the bot can't push** — see [[project_bot_workflows_permission]] (App lacks `workflows` perm). Any bot output would have to be a `.github/workflows/*.yml` diff posted as a comment for a maintainer to apply.

No unsolicited GitHub verdict: the issue body is already a self-documenting spec (4-step "Suggested approach") assigned to its owner; a bot "parking" comment = meta-noise + nudge risk.

**Re-engage only if:** jkwak (or a human) comments asking the bot to draft/implement it → then draft the YAML modeled on `.github/workflows/nightly-slang-test.yml` and post as a comment (never a pushed PR); OR a PR appears linking #11988 → route to slang-reviewer. Canonical thread `gh-issue-shader-slang/slang-11988` (fresh; distinct from #11805/#11919 chains).

**Update 07-08 — jkwak posted his own design plan** ([comment 4910355852](https://github.com/shader-slang/slang/issues/11988#issuecomment-4910355852)): two pieces — (1) a NEW slang-test CLI arg to change the default optimization level (the *inverse* of #11805's `-O0` default), (2) a new nightly CI workflow using the maximal SpvOpt option. NO @nv-slang-bot mention, no bot request — the `pr_mention` event was a false-positive on a plain issue comment. Treated as HOLD (maintainer self-driving his own assigned issue); no fixer dispatch, no GitHub reply. NOTE: the CLI-arg half is *source code the bot CAN push* (unlike the workflow YAML) — so if jkwak later asks the bot to draft it, dispatch slang-fixer for the slang-test arg only and leave the YAML as a comment for him.
