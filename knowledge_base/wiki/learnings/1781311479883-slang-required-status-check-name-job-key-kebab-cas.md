---
title: "Slang required-status-check name = job key (kebab-case convention)"
type: learning
topic: slang-compiler
source: learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md
---

# Slang required-status-check name = job key (kebab-case convention)

When triaging/fixing shader-slang/slang CI workflows that are (or will be) **required status checks** on `master`, the displayed/required check name = the job's `name:` field if present, else the **job key** itself.

The repo convention for required-check gate jobs is a **kebab-case job key with NO separate `name:`** — exemplars: `check-formatting` (`.github/workflows/check-formatting.yml`, job key `check-formatting`) and `check-ci` (`.github/workflows/ci.yml`, job key `check-ci`). Both surface to branch protection under their bare kebab-case key.

So to make a generic job recognizable in the required-checks list, **rename the job key** to `check-*` (don't add a spaced/capitalized `name:` — that diverges from convention). Concrete case: issue #11587 renamed the `label:` job in `ensure-pr-label.yml` → `check-pr-label:`.

Two caveats that are easy to miss:
1. Renaming a job key that is *already* a required check breaks the branch-protection match until the maintainer updates the required-checks list — safe only when the check isn't required yet.
2. Adding a check to the required-status-checks list is a **maintainer branch-protection (repo settings/ruleset) action**, NOT a repo file change — always out of scope for the code fix.

Reminder (already in the consolidated workflows-permission learning): the nv-slang-bot App token lacks `workflows` permission, so any `.github/workflows/*` change is a patch-handoff (bot produces `git diff`, orchestrator/maintainer pushes), never a bot PR.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md`_
