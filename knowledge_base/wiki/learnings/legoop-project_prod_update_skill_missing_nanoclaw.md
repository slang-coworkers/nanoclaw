---
title: "update-slang-coworkers-prod skill omits nv-nanoclaw merge; base-nanoclaw is a base-common dependency so validate fails without it"
type: learning
topic: agent-ops
source: learnings/legoop-project_prod_update_skill_missing_nanoclaw.md
---

# update-slang-coworkers-prod skill omits nv-nanoclaw merge; base-nanoclaw is a base-common dependency so validate fails without it

The `/update-slang-coworkers-prod` skill (Steps 3 + 7) only checks/merges **nv-main, nv-dashboard, nv-slang, nv-slangpy** — it **omits `nv-nanoclaw`** (the 5th branch). `/update-nanoclaw-instance` (lego) merges all 5.

**Why it breaks:** `base-common` (`container/spines/base/coworker-types.yaml:35`) lists `base-nanoclaw` in its `skills:`. The `base-nanoclaw` skill body lives **only on origin/nv-nanoclaw** (tracked there, e.g. commit 645f6d88 / #529) — it is NOT in the `shader-slang/slang-skills` external manifest, so `fetch-skills.sh` can't supply it. Without merging nv-nanoclaw, `npm run validate:templates` fails for **every** coworker type (`default`, `slang-fixer`, …) with `references unknown skill/workflow/overlay: base-nanoclaw`.

**Symptom during update:** after the 4-branch merge, validate shows e.g. `Validated 10 type(s) against 38 catalog entries` + 8-9 FAILs, and `container/skills/base-nanoclaw` + `nanoclaw-*` dirs are absent on disk and not in prod git HEAD.

**Fix applied mid-update (2026-06-03):** manually `git merge origin/nv-nanoclaw` (conflicts on package.json + .github/workflows/ci.yml → take `--ours`, HEAD has nv-main's canonical infra). Then validate passes 12/12 against 48 entries.

**Note:** the `nanoclaw-*` PROJECT skills nv-nanoclaw also brings are **inert** on prod (prod runs only `main` + `slang-*` coworkers, no nanoclaw-* coworkers — user confirmed "prod not needed nanoclaw"). But `base-nanoclaw` (despite the name) is a **base-platform** skill required by base-common, not a project skill — it's a hard dependency. Keep the merge.

**TODO (task #16):** patch the skill at `~/.claude/skills/update-slang-coworkers-prod` — add `origin/nv-nanoclaw` to Step 3's branch loop and a Step 7f merge. Related: [[project_fanmerge_is_local_only]], [[project_update_nanoclaw_merge_drift]].

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/legoop-project_prod_update_skill_missing_nanoclaw.md`_
