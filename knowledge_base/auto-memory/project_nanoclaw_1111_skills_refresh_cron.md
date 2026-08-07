---
name: project_nanoclaw_1111_skills_refresh_cron
description: "nanoclaw#1111 hourly skills-refresh cron — MERGED +17min (8th+ race); reviewed INLINE post-merge, 6/6 blobs == nv-main BY HASH; 2🔴 (dry-run preflight can't see the failure it exists to catch; permission-403 classified RATE LIMITED) 4🟡; comment 5206280223"
metadata: 
  node_type: memory
  type: project
  originSessionId: da63cac8-7d46-472b-8253-8de1932c5110
---

# nanoclaw#1111 — `skills: hourly refresh cron that reaches live containers without a restart`

Author `szihs` (human), base `nv-main`, head `ad705d48`, 6 files +566/−20, single commit.
**MERGED 2026-08-06T13:35:51Z, +17 min after opening** — post-merge review, all 6 blobs verified
identical to `nv-main` **BY HASH** (`0115c424d9` `2d2b48225d` `3103d88416` `291fb7feab`
`33e376a7cc` `b81b7e2ac5`). All 3 checks (`check`/`ci`/`label`) green. Comment `5206280223`,
posted via the verb-split REST path (`gh api …/issues/1111/comments -X POST`).

**Routing:** nanoclaw platform PR ⇒ handled **INLINE by Main**, webhook's generic
"route to `*-pr-approver`" task string overridden per [[project_nanoclaw_pr874_webhook_route_approver]].

## Findings

- 🔴**(1) `--dry-run`, the documented pre-install check, cannot see the failure the PR fixes.**
  `refresh-skills-cron.sh:83-85` skips step 1 entirely and hard-codes `fetch_rc=0`; token
  resolution + `gh_probe_repo_readable` both live *inside* `fetch-skills.sh`, so dry-run reaches
  neither. On a token-less logged-out box (today's exact failure) it logs `fetch-skills ok (rc=0)`
  and exits 0; the byte-identical env without `--dry-run` exits 1 with the real diagnosis.
  ⭐⭐**Proved the step never executes by POISONING `fetch-skills.sh` with a sentinel — it never
  fired under `--dry-run`, did fire without it.** *A green line about a command that did not run.*
- 🔴**(2) A permission 403 is classified `RATE LIMITED`** — `gh-token.sh:56` matches a bare
  `HTTP 403`. ⭐⭐⭐**Elicited a REAL non-throttle 403 from live GitHub** (`gh api -X PUT
  repos/shader-slang/slang-skills/contents/…` → `Resource not accessible by integration (HTTP 403)`)
  **and fed that exact string through the PR's own helper ⇒ `RATE LIMITED`.** That is precisely the
  App-installation-reach question the body spends a paragraph on, so the operator is told to wait
  for a reset that never comes; also drives the new 10s/20s backoff. Narrowing to
  `rate limit|secondary rate|abuse detection|HTTP 429` verified **both directions** (4 real
  throttles still match; permission + SAML 403s fall to `other`).
- 🟡**(3) `refreshMirror` stops refreshing once dst mtime > src mtime, and prints that as clean.**
  Pre-existing (`group-init.ts:203` same helper) but the cron promotes it from "stale until next
  wake" to "stale indefinitely". Measured with an untouched control group: touched group misses the
  new upstream file, prints `0 change(s)` — byte-identical to a genuinely-current run, **no third
  state for blocked/unmeasured**. ⭐⭐**Also falsifies the body's own known-limit**: I reproduced the
  interrupted `rm -rf`+partial-copy state ⇒ next tick returned `false`, partial tree persisted; it
  repaired only after an *unrelated* upstream change bumped src mtime (that control DID fire) ⇒
  "self-heals next tick" is really "repairs on the next upstream change".
- 🟡**(4) fail-loud into a file with no reader** — `logs/refresh-skills-cron.log` census: writer
  only, zero consumers (`funnel-cron.log` likewise). Non-zero exit into cron mails nowhere ⇒ a
  broken hour looks like a quiet hour.
- 🟡`python3` absent from the cron preflight (`for tool in node gh jq`) though it is the token
  minter's runtime (`gh-token.sh:106`) — measured `rc=127 python3: command not found`; the
  App-minter path IS the cron path, which is why that preflight exists.
- 🟡jq preflight dies on the `repo: null` shape the loop explicitly handles (line 122 keeps
  `[ "$repo" = "null" ] && continue`, but lines 96/108 `map(sub(...))` first ⇒ `jq` rc=5, aborts
  under `set -e`; control without null → `shader-slang` rc=0). Latent — no writer emits it today.
- 🟡**Zero tests** in a repo that tests `scripts/` (`vitest.config.ts` includes
  `scripts/**/*.test.ts`, 10 exist); findings 1/2/3/6 are each one test. `prettier`/`eslint` are
  scoped to `src/**` so the new `.mjs` is unformatted+unlinted; no shellcheck in CI despite the
  `# shellcheck source=` directive.

## Verified sound (not just read)

`gh skill install` DOES stamp `github-tree-sha` and it equals the contents-API dir sha — installed
`slang-build` for real, both `761ed798…` ⇒ tree-sha cache is correct. New `not present upstream`
path fires (forged skill → exit 1). The quoted downstream failure is real: removing a declared
skill dir makes `resolveCoworkerManifest` throw the exact `references unknown
skill/workflow/overlay` error (control: present → resolves). `gh auth token` exits 0 printing
nothing when logged out — reproduces; gating on `gh auth status` is right. The
`$(date)`-clobbers-`$?` claim about funnel-cron is **true by execution** (`rc=7` without,
`rc=0` with). flock serializes (3 ticks skipped under a holder, then resumed). Mount/copy premise
re-derived independently AND confirmed from inside a live container (`/proc/mounts`:
`/home/node/.claude` its own mount, 79 skills). `providesAgentSurfaces`: interface + accessor +
1 synthetic test provider, **0 real** ⇒ no second path. Cadence reproduced exactly (65 commits
since 05-06, max 7/day). Path-guard confirmed with **git's own gitwildmatch engine**: all 6 files
owned by `nv-main`, control overlay path not owned. CI log is end-to-end proof: `Found 18` →
`Authenticated via env:GH_TOKEN` → `Done: 12 fetched, 6 cached, 0 failed`.

## ⛔ My own instrument failures (all disclosed in the posted comment)

- ⭐⭐⭐**My first `resolve_gh_token` test PASSED FOR THE WRONG REASON: `GH_TOKEN` was set in MY
  environment**, so it returned through the env branch and I nearly recorded "logged-out resolution
  succeeds" — the exact opposite of the truth. Only `env -u GH_TOKEN -u GITHUB_TOKEN` produced a
  real result. *A resolution-order function tested inside a pre-resolved env measures nothing.*
- ⛔**FALSE EXIT STATUS again: `gh api … | tail` reported rc=0 while the call failed** (`$?` read
  `tail`) — re-ran capturing rc directly. Same shape as #1102's `| head` instance.
- ⚠️Mixed-case owners return `401 Bad credentials` through my gateway for **both** repos while
  lowercase controls succeed ⇒ that is MY proxy; **published no claim** about the probe's case
  handling.
- ⚠️First `fetch-skills.sh` run printed `No external skills declared` — that is `nv-main`'s real
  tracked state (only the `nv-slang`/`nv-slangpy` spines declare `skill-source`; branch census
  confirms), **not a defect**. Built a real declaration to get a non-empty manifest.
- ⚠️`dist/` is gitignored and my borrowed `node_modules` lacked a hoisted `js-yaml` ⇒
  `ERR_MODULE_NOT_FOUND`; symlinking from `.pnpm` and copying `dist` into the worktree fixed it.
  **The "N files / 0 tests" import-error signature again — my env, not the branch.**

**RESUME** = szihs replies; findings 1 + 2 are **LIVE on `nv-main`** ⇒ one follow-up PR closes both
with tests (offered in the comment). The crontab is **NOT installed** on either box yet, so
finding 1 is still genuinely pre-install.
