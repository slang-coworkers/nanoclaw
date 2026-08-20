---
type: project
title: "szihs PAT path-routed in dev:10254 (NOTE: dev vault was :10256; prod is :10254) for github.com/szihs/* push — orchestrator-only, restored "
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# szihs PAT path-routed in dev:10254 (NOTE: dev vault was :10256; prod is :10254) for github.com/szihs/* push — orchestrator-only, restored 2026-05-28 after the bot-token-overwrite regression

OneCLI dev vault (port 10256). Only **one** secret currently holds a real szihs human PAT: `292f0169-…` (host=`github.com`, path=`/szihs/*`, format=`Basic {value}` where `{value}` is `base64("x-access-token:<PAT>")`). All other "szihs"-named secrets in the vault hold bot App installation tokens despite the misleading names — they get refreshed every 30 min from one of the three nv-slang-bot install ids.

**Why this matters:** the `nv-slang-bot` GitHub App definition itself does NOT advertise `workflows` permission. Querying `/app` confirms its catalog is `actions/contents/issues/metadata/pull_requests/organization_projects` — no `workflows`. So no install token (122982130 / 123550981 / 122269597) can ever push `.github/workflows/*.yml` files; the server returns *"refusing to allow a GitHub App to create or update workflow … without `workflows` permission"*. Only a real szihs human PAT (with `workflow` scope) can land workflow-file pushes.

**The 2026-05-27 → 2026-05-28 regression:** PR #475 re-enabled the `update_secret "szihs-git-push" 122269597 "292f0169-…"` line in `/home/ubuntu/haaggarwal/refresh-gh-tokens-dev.sh`, overwriting the human PAT with a bot install token every 30 min for ~24 hours. Symptom: slang-fixer's fork-PR flow on issue #11333 (touched `.github/workflows/`) silently fell back to "send patch to parent instead of opening PR". Fix: re-comment the line on 2026-05-28; PATCH the secret with a fresh szihs PAT (`gho_…` OAuth token works too — also accepted by git Basic auth).

**Why orchestrator-only access is the right model:**

- The PAT carries `workflow` scope plus `repo` — pushing as user "szihs" identity. We don't want every coworker doing that; only the orchestrator (which fans out work and represents human-authorized intent) should land workflow-file changes.
- Concrete state on this host (**updated 2026-06-04**):
  - Orchestrator agent (`128bff23-…`, identifier `ag-1778288632732-akb54b`) is now `secretMode=**selective**` with an explicit 14-secret set. **It was flipped from `all`→`selective` on 2026-06-04.** This was REQUIRED, not cosmetic — see the shadowing gotcha below.
  - All 13 selective coworker agents had their explicit `agent_secrets` row for `292f0169` deleted. Same for the other two confusingly-named secrets `5b162e39` (slang push) and `e1d49377` (slangpy upstream push).

**⚠️ CRITICAL shadowing gotcha (the thing that bit me 2026-06-04 and cost a wrong "orchestrator-push is off the table" conclusion):** under `secretMode=all`, orchestrator's push to `github.com/szihs/slang.git` did NOT use `292f0169` (`/szihs/*` PAT) — it used the **bot App token** `a043b2b3` (`/szihs/slang.git/*`), because **more-specific path wins** and `a043b2b3` was added 2026-06-01 to the refresh loop. So the PAT existed and was assigned, but was silently shadowed for the one repo that matters (the fork). `git ls-remote` succeeding proved nothing — szihs/slang is a PUBLIC repo, so the read needed no auth. **Fix applied 2026-06-04:** flip orchestrator to `selective` and assign everything EXCEPT `a043b2b3`; with `a043b2b3` invisible, the more-general `/szihs/*` PAT wins for orchestrator's fork pushes. Other agents stay `all`/keep `a043b2b3`, so they still push the fork as the bot. **Verified end-to-end:** orchestrator pushed the PR #11265 rebase (incl. workflow files) to szihs/slang, head `296364b`, no Workflows-wall rejection → the szihs token (a `gho_` OAuth token from `.env_szihs` key `SZIHS_PAT`) genuinely carries `workflow` scope.

**szihs identity only has push on the FORK:** probed 2026-06-04 — the szihs token gives `push=True` on `szihs/slang` but `push=False` on `shader-slang/slang` and `slang-coworkers/nanoclaw` (org membership, not a token-scope issue). So "route all 3 prefixes to the szihs PAT" is impossible; orchestrator uses the **bot App token** for the two org prefixes (`b37ad8e6` /shader-slang/*, `81055907` /slang-coworkers/*) and the **szihs token** only for `/szihs/*`.

**The other "szihs PAT" labels in the vault:**

- `5b162e39 (szihs PAT - slang push)` — host=`github.com`, path=`/shader-slang/slang.git/*`. Refreshed by the script with shader-slang App token (install 122982130). NOT a real PAT despite the label. Push to shader-slang/slang directly — works for code, fails for workflows.
- `e1d49377 (szihs PAT - slangpy upstream push)` — host=`github.com`, path=`/shader-slang/slangpy.git/*`. Same shape.
- `434a0755 (graphql szihs PAT)` — host=`api.github.com`, path=`/graphql`. Refreshed with shader-slang App token. Original intent (per saved memory) was a real human PAT for ProjectsV2; the script overwrites that intent.

If you want any of these to actually hold human PAT values, you must `# update_secret …` comment out their refresh line first, then PATCH the secret.

**How to apply:**

- Coworker reports `refusing to allow a GitHub App to … workflows permission` → confirm the destination is `github.com/szihs/*` and that the coworker isn't supposed to be pushing workflow files. If push is legitimate, route it through orchestrator instead. If it's another path (`shader-slang/*`, `slang-coworkers/*`), no PAT exists for that — see [[feedback_no_workflows_perm_for_bot]] for the policy of routing through szihs PAT instead of granting workflow scope to the bot App.
- Adding a new install id with similar permission concerns: skip it if the install can't carry `workflows`. Just rely on the szihs PAT path.
- Refresh script edit on 2026-05-28: line ~53 commented out — `update_secret "szihs-git-push" …`. Don't re-enable. The PAT slot is now manually managed (docs block expanded 2026-06-04). Source token lives in `.env_szihs` (gitignored), key `SZIHS_PAT`.
- **Do NOT put orchestrator back on `secretMode=all`** — that re-exposes `a043b2b3` and silently shadows the PAT on the fork again (see CRITICAL gotcha above). Keep it `selective` with `a043b2b3` excluded.

**Related memories:** [[feedback_no_workflows_perm_for_bot]] (no workflow perm for nv-slang-bot App), [[reference_gh_app_token_mint]] (env -i for token mint), [[project_onecli_match_priority]] (host-pattern + path-pattern matching quirks).

