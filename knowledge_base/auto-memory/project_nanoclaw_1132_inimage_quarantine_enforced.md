---
name: project_nanoclaw_1132_inimage_quarantine_enforced
description: "nanoclaw#1132 (MERGED by szihs 08-06 14:19Z, 75s after CI green, no reviews) closes F01: writes minimum-release-age=4320 into /root/.npmrc + a build-time refusal probe, pins codex 0.146.1->0.146.0. Reviewed INLINE by Main (~30th instance, no nanoclaw-pr-approver). Verdict SOUND. Live follow-up: the probe's pnpm is pinned ONLY in container/Dockerfile; Dockerfile.derived + build.sh overlay run it on an uncontrolled base pnpm, and pnpm 11 dropped .npmrc for this setting -> those rebuilds HARD-FAIL (fail-closed, not a silent hole)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2c8dd905-7119-413e-a073-b91387b0aaf1
---

# nanoclaw#1132 — in-image release-age quarantine, enforced + proven

**State:** MERGED to `nv-main` by **szihs** 2026-08-06T14:19:08Z, **75 s** after CI went green
(14:17:53Z). `auto_merge: null`, zero reviews, zero comments. Head SHA
`246cbd730385bb7d8e9ca41f86b7826fa95dc26f`; branch `fix/f01-codex-mature-pin` **already deleted**
(⇒ read contents at the **SHA**, not the ref — the ref 404s). Reviewed **inline by Main** per the
standing nanoclaw rule ([[project_nanoclaw_pr874_webhook_route_approver]]); ~30th instance
(#1118 was ~29th). **No GitHub comment posted** — comment hygiene for maintainer changes.

Closes **F01**, my own finding ([[project_nanoclaw_1097_codex_one_copy]]): `pnpm install -g`
resolves config from `/root/.npmrc` and **never reads `pnpm-workspace.yaml`**, so the repo's
three-day quarantine never applied to the packages that actually execute in the agent container.
#1118 fixed only the workspace half ([[project_nanoclaw_1118_release_age_back_in_force]]).

## Verified sound (independently, not from the PR body)

- **codex `0.146.0`** published `2026-07-29T01:45:57Z` = **12,275 min (205 h)** ≥ 4320 ⇒ mature.
  Published `scripts` **empty** ⇒ `onlyBuilt` correctly stays absent. `0.146.1` published
  `2026-08-05T16:00:31Z` = 22 h ⇒ genuinely would fail the new gate. All from
  `registry.npmjs.org/@openai/codex` directly.
- **All four pinned CLIs mature** ⇒ turning the gate on does not break the build:
  agent-browser 0.27.1 (1578 h), claude-code 2.1.197 (889 h), claude-trace 1.0.9 (8590 h),
  codex 0.146.0 (205 h).
- **No `minimumReleaseAgeExclude`** added anywhere (diff-verified). Test
  `container/cli-tools.test.ts` asserts none can be added quietly.
- **The gate is proven, not read.** CI job 92644544738 log, verbatim:
  `structural: minimumReleaseAge=4320 at top level — OK` /
  `in-image: install-cli-tools.sh declares 4320 and probes enforcement — OK` /
  `positive probe: top-level minimumReleaseAge refused typescript@5.9.3 — OK` /
  `negative control: nested minimumReleaseAge was ignored, as expected — OK` /
  `verified against pnpm 10.33.0`. A real paired refuse/allow control —
  satisfies [[feedback_a_declared_supply_chain_gate_needs_a_refusal_control]].
- **Fail-closed on both legs**: probe install *succeeds* ⇒ `exit 1`; probe fails *without*
  `ERR_PNPM_NO_MATURE_MATCHING_VERSION` ⇒ `exit 1`. "Cannot confirm" is not "fine".

## ⭐ Follow-up A (live, timely) — the probe's pnpm is pinned in ONE of THREE call sites

`install-cli-tools.sh` is invoked from three places; only the first controls its pnpm:

| call site | pnpm pinned? |
|---|---|
| `container/Dockerfile:171-173` | ✅ `ARG PNPM_VERSION=10.33.0` + `corepack prepare … --activate` at :158-159 |
| `container/Dockerfile.derived:63-65` | ❌ **zero** pnpm/corepack lines in the whole 104-line file (grepped myself) — runs on `FROM ${BASE_IMAGE}`, the **hardened upstream base**, whose pnpm this fork does not control |
| `container/build.sh:~218` (`--pull` overlay) | ❌ synthesizes `FROM ${IMAGE_NAME}:${TAG}` + `USER root` + `RUN sh /tmp/install-cli-tools.sh` — same exposure, on the **published** image |

**pnpm 11 removed `.npmrc` as a source for this setting** — corroborated from pnpm's own
settings page (v11/12): *"Only auth and registry settings are read from `.npmrc` files. All other
settings … must be configured in `pnpm-workspace.yaml` or the global `~/.config/pnpm/config.yaml`."*
That independently predicts the PR's measured `11.20.0 → ignored`. **`11.20.0` is `latest`,
published 2026-08-03**, and CI's own log advertises it (`+ pnpm 10.33.0 (11.20.0 is available)`).

⇒ **Consequence is a HARD BUILD FAILURE, not a silent hole** — the probe's FATAL branch fires.
Correct design, but: the PR forces an image rebuild on both boxes, so **if either uses the
derived/hardened path and its base ships pnpm 11.x, that rebuild fails** with a message whose
suggested fix ("find where this pnpm reads the setting") is non-trivial. **Named forward fix:
write the floor to `~/.config/pnpm/config.yaml` as well as `.npmrc`.** Could not determine the
base's pnpm version from here (`BASE_IMAGE` is a registry ARG) ⇒ *check before rebuilding*.

⭐⭐ **My subagent reported this as "the probe silently passes" — WRONG, and I nearly published it.**
It read the script's own table (`pnpm 11.20.0 → probe passes`) where "passes" means *the pnpm
install succeeded*, which the script treats as FATAL. **"Probe passes" and "build succeeds" are
opposite here.** ⇒ *When a relayed finding claims a silent failure, trace the exit path yourself
before calling it silent* — cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]].

## Follow-up B (minor)

- **`$NPMRC` is clobbered with `>`, unconditionally, and left poisoned on the failure path.**
  The probe writes `minimum-release-age=99999999` to `$NPMRC_DIR/.npmrc` and only overwrites it
  with real config on the success path. Harmless in a Docker layer (discarded), but the PR
  advertises `NPMRC_DIR` as the way to exercise this outside a container — where it silently
  destroys a real `~/.npmrc` and, on the FATAL path, leaves a ~190-year floor behind. No backup,
  no `trap`.
- **The `packageManager` probe defect from #1118 is STILL present** at this ref, in a file this PR
  edits. `check-release-age-policy.sh` prints `pnpm --version` from the repo root (where
  `packageManager: pnpm@10.33.0` is visible) but runs the probe from a `mktemp -d` fixture that
  writes **no** `packageManager` key, and nothing compares the two. So *"verified against pnpm
  10.33.0"* is not guaranteed to name the binary that did the verifying — same class as the finding
  itself. Latent only: CI uses `pnpm/action-setup@v4` (pnpm straight on PATH), and the log shows
  10.33.0 in both roles.

## Honest scope of my verification

I did **not** run the in-image `-g` probe. The central empirical claim (10.33.0 refuses /
11.20.0 ignores) is corroborated two independent ways — the CI log's *repo-level* probe refusing
under 10.33.0 with the exact error code, and pnpm's official v11/12 settings docs — but not
reproduced. ⭐ *Official upstream docs are a cheap second witness for a measured behaviour claim:
they cost one fetch and can confirm the mechanism a local measurement only observed.*
