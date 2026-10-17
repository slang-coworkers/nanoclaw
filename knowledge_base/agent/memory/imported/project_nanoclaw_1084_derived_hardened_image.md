---
type: project
name: project_nanoclaw_1084_derived_hardened_image
description: "slang-coworkers/nanoclaw#1084 derived agent image (hardened base + fork layers) — MERGED 08-06 06:42Z @27a41cea3 after 2 inline reviews. Both blockers (untracked COPY source; IMAGE_NAME could tag another install's slug) fixed; 5 🟡 left open (unpinned gh 2.23, v1 WORKDIR, 495 MB chown, IMAGE_SOURCE=derived collision, no test), still present on nv-main 10-16."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-pr-slang-coworkers/nanoclaw-1084
---

# slang-coworkers/nanoclaw#1084 — derived hardened image (MERGED)

`feat(container): derived image — hardened upstream base + this fork's layers`, author **szihs**,
`feat/nv-main/derived-hardened-image` → `nv-main`. Adds `container/Dockerfile.derived` and
`container/build-derived.sh`. **Merged 2026-08-06 06:42Z at `27a41cea3`.** Reviewed inline by Main
(comments `5192090652` round 1, `5201183458` round 2). Condensed 2026-10-16 by okf-synthesis.

**Routing:** handled INLINE by Main, not sent to a `*-pr-approver` — NanoClaw platform-infra PRs are not
product repos (same class as [[project_nanoclaw_1051_agent_image_guard_selfblock]],
[[project_nanoclaw_pr874_webhook_route_approver]]). Write path is verb-split: `gh api …/issues/N/comments -X POST`
works, `gh pr review` / `gh pr comment` are denied. A `synchronize` webhook landed mid-review; the script blobs
were byte-identical across heads, so measurements carried — re-diff rather than carry a verdict.

## Premise (sound)

`pull.sh` refuses lock drift (`/app/node_modules` baked from `bun.lock` vs `/app/src` bind-mounted at spawn).
Reinstalling against this checkout's lock and re-stamping `dev.nanoclaw.agent-runner-lock-sha256` is the right
answer, not weakening the guard. The lock-sha computation matched `build.sh`; `CODEX_VERSION` matched.

## Blockers (both fixed in `27a41ce`)

1. **`COPY claude-trace-wrap` — source absent from all 14 remote branches** (with a per-branch positive
   control). The build would fail before the lock label that is the image's point. My hypothesis — the file
   exists *untracked* on the author's box, so his local "verified" build could not tell committed from
   present-in-working-tree — was confirmed verbatim by the fix commit. `@mariozechner/claude-trace` was also
   absent from `cli-tools.json`.
2. **`IMAGE_NAME` never resolved to this install's tag.** The node snippet's only output was `process.env.IMAGE_BASE`,
   referenced nowhere else, so it fell through to `docker images | grep ^nanoclaw-agent | head -1` —
   order-dependent across installs. On a multi-install host it would tag **another install's** image and stamp
   this checkout's lock sha on it, **forging** that install's `pull.sh` lock check. With no match it built
   `nanoclaw-agent:latest`, a tag the host never spawns, and exited 0. Single-install hosts worked by accident.
   Fixed by sourcing `setup/lib/install-slug.sh` + `container_image_base()` like `build.sh` / `pull.sh`
   (re-run → `nanoclaw-agent-v2-6f7bdffe`, matching `src/config.ts`).

Round 2 also tested the new parity gate with a stub runtime: a failing `docker run` (exit 125) aborts rather
than reading as "nothing missing" (`set -euo pipefail` inside `$( )`).

## Open 🟡 (non-blocking; all still present on `nv-main` at 2026-10-16)

- **`gh` unpinned:** bare `apt-get install gh` resolves to bookworm's **2.23.0** (2023), not GitHub's apt repo
  (2.96.0) that `container/Dockerfile` adds a keyring for. `command -v gh` passes for both, but e.g.
  `supervise-issues` uses `closedByPullRequestsReferences` (cli/cli#10941, 2025) — date-ordering settles it.
  Fix: replicate the keyring block or assert a minimum `gh --version`. (I first thought it broke the build; it doesn't.)
- `WORKDIR /workspace/group` restores a v1 path; v2 uses `/workspace/agent` (mostly inert; `docker exec` lands nowhere).
- `RUN chown -R node:node /app` is unnecessary (agent runs fine from root-owned `/app`) and rewrites ~495 MB into a layer.
- `IMAGE_SOURCE=derived` collides with the per-group derived-image label (`container-runner.ts`, `registry-state.ts`);
  the label vocabulary lacks a value for "hardened base + fork layers"; adding `derived-from` would help.
- No test, though `vitest.config.ts` covers `container/*.test.ts`: assert every `COPY` source resolves, and the
  target tag equals `container_image_base()`.

## Lessons

- **A local success cannot distinguish "committed" from "present in my working tree."** Ask what tree state
  would have made the author's own verification red (cf. the #1080 data-axis version).
- **A census needs a per-branch positive control.** A single-branch grep nearly published the COPY finding as a
  guess; a fetch-order bug once gave a false 0 that only the control (also 0) exposed.
- **Two identical failures can both be the instrument.** My first path-guard run failed on both heads with
  `ModuleNotFoundError` — not a verdict. Fixed the venv, then ran with both controls.
- **Name what the instrument cannot do.** No docker daemon here; both blockers were static tree facts, so a build
  would confirm, not decide them — disclosed in the comment.
- **Check where a residual hit lives before re-reporting it** (the surviving `IMAGE_BASE` was in a comment).
- **Decline credit you did not earn:** szihs credited me with "this PR doesn't install Python"; my posted text had
  0 hits for it (my note was on #1096, hedged the other way). Declined in writing →
  [[feedback_declining_credit_for_a_finding_you_did_not_make]].
