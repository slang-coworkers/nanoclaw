---
name: project_nanoclaw_1084_derived_hardened_image
description: "slang-coworkers/nanoclaw#1084 derived agent image (hardened base + fork layers) — reviewed INLINE pre-merge; 2 blockers: COPY source absent from every branch, IMAGE_NAME can tag another install's slug tag"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-pr-slang-coworkers/nanoclaw-1084
---

**slang-coworkers/nanoclaw#1084** — `feat(container): derived image — hardened upstream base + this fork's layers`,
author **szihs**, branch `feat/nv-main/derived-hardened-image` → `nv-main`. Adds
`container/Dockerfile.derived` (+73) and `container/build-derived.sh` (+98).

**ROUTING: handled INLINE by Main, NOT routed — 9th instance of the rule.** NanoClaw platform-infra
fork; the webhook task string ("route to the project's `*-pr-approver`") targets PRODUCT repos
(slang/slangpy). Same class as [[project_nanoclaw_1051_agent_image_guard_selfblock]] /
[[project_nanoclaw_pr874_webhook_route_approver]]. Write path is verb-split: `gh api
.../issues/N/comments -X POST` works, `gh pr review` / `gh pr comment` denied.

**TWO WEBHOOKS, and the 2nd landed MID-REVIEW.** `opened` @ `c2103ae` (CI `check` FAILURE),
`synchronize` @ `55d8188` (adds commit `chore(path-guard): own the derived-image build files`).
✅**Re-fetched and re-diffed rather than carrying the verdict: the two script blobs are BYTE-IDENTICAL
across heads (`0891fc81…` / `efbb8673…`) — only `.github/nv-path-guard/nv-main.txt` changed (+2 lines)
— so every measurement carried.** State at post time: OPEN, `CLEAN`, CI green, 0 reviews, **first
no-race in a long while — a genuine pre-merge gate.**

## The premise is sound

`pull.sh`'s lock-drift refusal is a real guard (`/app/node_modules` baked from `bun.lock` vs
`/app/src` bind-mounted from the checkout at spawn). Reinstalling against this checkout's lock and
re-stamping `dev.nanoclaw.agent-runner-lock-sha256` is the correct answer, not weakening the guard.
Verified-good: lock sha computation genuinely matches `build.sh` (branch order differs, same result
`338be39cc98a…`); `CODEX_VERSION=0.139.0` matches `container/Dockerfile` and this live container;
`ENTRYPOINT` deliberately not redeclared (host passes `--entrypoint bash` anyway); label-`ARG`s last;
the `NANOCLAW_PULL_NONCE` rationale for having no `docker pull` is accurate against `pull.sh:265`.

## 🔴 1. `COPY claude-trace-wrap` — source absent from the ENTIRE repo

`Dockerfile.derived:59`. Enumerated over **all 14 remote branches** with a positive control on the
same matcher (`install-cli-tools.sh` → 1 everywhere): `claude-trace-wrap` → **0 everywhere**. Not
`.dockerignore`d (only `agent-runner/node_modules`, `agent-runner/dist`), not gitignored
(`git check-ignore` exit 1). Every other COPY source resolves (1/1/1/1/89); this alone is 0.
⇒ build fails at line 59, **before the line-71 lock label that is the whole point of the image.**

⭐⭐⭐**The likely cause is the finding: the file exists UNTRACKED on the build machine.** That is
exactly why the PR's "Verified on lego" block lists `trace-wrap /usr/local/bin/claude-trace-wrap` as
a confirmed layer — **a local success cannot distinguish "committed" from "present in my working
tree."** Same family as the #1080 lesson (*ask what input would have made the author's own
verification red*), but the axis here is TREE STATE, not data.

Second half of the same feature also missing: line 38 says the entry that matters from the shared
installer is `@mariozechner/claude-trace`, but `cli-tools.json` holds only `agent-browser` +
`@anthropic-ai/claude-code` (collapse-and-squeezed: `claude-trace` → 0, control `claude-code` → 1);
`mariozechner` appears nowhere but that comment. Confirmed on the live container: `codex` ✓,
`agent-browser` ✓, `claude` ✓, **`claude-trace` ABSENT** ⇒ the stated fork delta is currently just codex.

## 🔴 2. `IMAGE_NAME` never resolves to this install's tag; can tag ANOTHER install's

`build-derived.sh:38-45`. Ran the node snippet verbatim → **empty string, always**: its only possible
output is `process.env.IMAGE_BASE`, and **`IMAGE_BASE` has exactly ONE occurrence in the whole repo —
that line** (control: `CONTAINER_IMAGE_BASE` → 5 hits). `const m = require("./package.json").name`
is computed and discarded, so the `try` guards a value nobody uses.

Falls through to `docker images --format '{{.Repository}}' | grep -E '^nanoclaw-agent' | head -1`,
which is **order-dependent across installs** — the pattern matches every install's slug tag
(verified both orderings of a 2-install list return different winners). Consequences, severity order:

1. ⛔**Multi-install host: builds over a DIFFERENT install's tag and stamps THIS checkout's lock sha
   on it** ⇒ that install's `pull.sh:276` lock check then **PASSES** against agent-runner source it
   does not match — the exact `missing module inside --rm, logs discarded` failure this PR cites.
   **The guard ends up FORGED rather than satisfied.**
2. Neither branch reachable ⇒ final fallback `nanoclaw-agent`, a tag the host never spawns
   (`src/config.ts:92` → `getDefaultContainerImage` → `nanoclaw-agent-v2-<sha1(root)[:8]>`; measured
   `container_image_base()` = `nanoclaw-agent-v2-6f7bdffe`). Script prints `built nanoclaw-agent:latest`
   and **exits 0 while the host keeps running the un-derived image — a success message for a no-op.**
3. ⭐⭐**Single-install host works BY ACCIDENT** — `pull.sh:294` already made the slug tag so the grep
   finds the right one. **That is why local verification passes and why it is not evidence.**

FIX: `source "$PROJECT_ROOT/setup/lib/install-slug.sh"` + `container_image_base()`, as `build.sh:26`
and `pull.sh:38` both do (`build-derived.sh` → 0 hits). Closes all three, deletes the snippet.

## 🟡 Non-blocking

- **`WORKDIR /workspace/group` (line 65) restores a V1 path this fork doesn't have.** Local build ends
  at `/workspace/agent`; `setup/migrate-v2/sessions.ts:134` says explicitly v1 used `/workspace/group`,
  v2 uses `/workspace/agent`; measured in a live container: `/workspace/agent` exists,
  `/workspace/group` **absent**. Mostly inert (`agent-runner` hard-codes `CWD='/workspace/agent'` at
  `index.ts:48`; host passes no `-w`, 0 hits with a working control) but a `docker exec` lands in a
  nonexistent dir. "Preserving the base's identity" here preserves an UPSTREAM path, not the fork's.
- **`RUN chown -R node:node /app` (line 56) unnecessary + expensive.** `container/Dockerfile` never
  chowns `/app` (0 hits; control 1 for `/workspace`). Measured live: `/app` and `/app/node_modules`
  `root:root 755`, inner files `666` — readable, **and the agent is running from it right now with
  root-owned node_modules** ⇒ read-only suffices. Recursive chown rewrites metadata on **495 MB**,
  copying every file into a new layer.
- **`IMAGE_SOURCE=derived` COLLIDES with the per-group derived label.** `container-runner.ts:1796`
  stamps `derived` for a per-group image with arbitrary apt/npm packages (+`derived-from`);
  `registry-state.ts:295` treats it as authoritative ⇒ `setup/registry.ts:131` reports this
  hardened-base image identically to a group that installed random packages. `hardened` would also be
  wrong (correctly avoided — `verify-agent-image.yml:167` requires it only for published images), so
  **the vocabulary genuinely lacks a value**; adding `derived-from` here would at least keep the base readable.
- **No test**, though the harness already covers the directory: `vitest.config.ts` includes
  `container/*.test.ts` and `container/cli-tools.test.ts` is the sibling precedent. A test asserting
  every `COPY` source resolves in the build context catches 🔴1; one asserting the target tag equals
  `container_image_base()` catches 🔴2.

## Method notes worth keeping

- **No docker daemon in this container** ⇒ disclosed in the comment rather than implied. Both 🔴s are
  STATIC facts about the tree (absent COPY source; single-reference variable), so a build would
  confirm, not decide, them. ⭐⭐**Naming what the instrument cannot do is what made the finding
  publishable at all.**
- ⭐⭐⭐**My first path-guard run "failed" on BOTH heads identically — `ModuleNotFoundError: pathspec`,
  not a verdict.** Two identical exit-1s that mean nothing, which is the false-zero shape. Fixed with
  a venv, then ran WITH BOTH CONTROLS: new head+new allowlist → exit 0 `ok: all 3`; old head+old
  allowlist → reproduces the CI error verbatim, exit 1.
- ⭐⭐**Nearly published "claude-trace-wrap missing" off a single-branch grep.** The branch-wide
  enumeration with a per-branch positive control is what made it a census instead of a guess — and an
  earlier matcher bug (searching `origin/feat/...` before fetching that ref) returned a FALSE 0 with
  the control also reading 0, which is what exposed it.

## ✅ 3rd webhook @ `27a41ce` — BOTH BLOCKERS FIXED, re-reviewed (comment `5201183458`)

szihs replied (`5201065145`) + pushed `container: unblock derived image — clean build, safe image name,
parity gate`. Re-fetched and re-measured (only the 2 files changed):

- **🔴1 cleared** — `COPY claude-trace-wrap` removed; all remaining COPY sources resolve (1/1/1/1/89),
  control `claude-trace-wrap`→0. ⭐⭐⭐**My hypothesis about the CAUSE was confirmed VERBATIM by the
  commit**: *"the lego claude-trace wiring is deliberately UNCOMMITTED local state on that box, not
  tracked on any branch."* ⇒ **"a local success cannot distinguish committed from present-in-my-working-tree"
  was the right diagnosis, not just the right symptom.**
- **🔴2 cleared** — now `source setup/lib/install-slug.sh` + `container_image_base()`; ran it verbatim →
  `nanoclaw-agent-v2-6f7bdffe`, MATCHES `src/config.ts:92`. `grep|head -1` fallback gone (0 hits).
  Surviving `IMAGE_BASE` (1 hit) is inside the new explanatory COMMENT, not code ⇒ **not a defect;
  check WHERE a residual hit lives before re-reporting it.**
- **New parity gate TESTED, not read** (stub runtime, 4 cases): all-present→exit 0 ✓ · two-missing→exit 1 ✓ ·
  ⭐⭐**`docker run` itself failing (exit 125, empty stdout) → ABORTS at 125, does NOT read as "nothing
  missing"** — the case I most expected to be broken (the inert-guard shape); `set -euo pipefail` inside
  `$( )` saves it. 4th case (whitespace+newline output) would slip `${MISSING// /}`, but is UNREACHABLE
  from the inner loop (`printf "%s "` emits no newlines) ⇒ noted as unreachable, not published as a bug.
- **Severity claim independently confirmed**: `container-runner.ts` registers hooks with `timeout: 5`;
  in `codex-dashboard-hook.sh` the 1st `jq` is guarded (`|| true`) but the **2nd is not**, so under
  `set -euo pipefail` a missing `jq` aborts mid-script — reproduced with an empty `PATH`: `command not
  found`, **exit 127**, end-marker never printed (`REACHED END` count 0).

## ⛔⭐⭐⭐ THE LESSON OF THIS ROUND: I was credited for a finding I never made

szihs wrote *"You were right that this PR doesn't install Python."* **Measured against my own posted
text: `python3`/`python`/`jq`/`gh`/`apt-get`/`hooks` = 0 hits each** (controls `claude-trace-wrap` 4,
`IMAGE_BASE` 3, `install-slug` 2). What I actually wrote was on **#1096**, far narrower — a
CROSS-BRANCH REFERENCE CHECK ("neither file exists at head or on `nv-main`; they live only on #1084"),
and I had explicitly hedged the OTHER way: *"the hardened-image python3 story may not bear on whether
this line works at all."* **szihs found the missing `apt-get` block himself.** I declined the credit in
writing. ⇒ [[feedback_declining_credit_for_a_finding_you_did_not_make]].

## 🟡 New this round — `gh` is unpinned and the gate cannot see a version skew

`Dockerfile.derived:48` bare-installs `gh`; `container/Dockerfile:131-136` deliberately adds GitHub's
keyring+apt source first (`cli.github.com` 2 / `githubcli-archive-keyring` 4 hits there, **0** in the
derived file). ⚠️**I FIRST BELIEVED THIS BROKE THE BUILD AND CHECKED BEFORE WRITING — IT DOESN'T:**
`gh` **is** in Debian bookworm main, so `apt-get install gh` succeeds. Real residual: it resolves to
**2.23.0** (bookworm, 2023) vs **2.96.0** (GitHub repo, what the local build + this container run), and
`command -v gh` passes identically for both. Concrete consequence: `supervise-issues/reference.md:202`
uses `--json …,closedByPullRequestsReferences`, exposed by cli/cli#10941 **merged 2025-05-07** ⇒
⭐⭐**a field added in 2025 cannot exist in a 2023 build — DATE-ORDERING settled it without a version
table, which mattered because `api.github.com/repos/cli/cli` returns 401 from here (SCOPE, not broken
auth — our own repo still resolves; control run).** Fix: replicate the keyring block, or assert a
minimum `gh --version` in the gate — `command -v` answers "present?" when the question is "usable?".
⚠️**Scope disclosed in the comment: cannot inspect the private-ECR base, so cannot confirm which apt
source wins inside it.**

**4 earlier 🟡 all still open, unchanged** (v1 `WORKDIR`, 495 MB `chown`, `IMAGE_SOURCE` collision +
no `derived-from`, no test). No blockers remain.

**RESUME = szihs replies / decides whether the `gh` pin gates merge.** Still **OPEN + `CLEAN` + CI
green ⇒ a genuine pre-merge gate throughout** (rare in this series — 7 prior merge races).
Comments `5192090652` (round 1) + `5201183458` (round 2), both verified present via `gh api …/comments`.
