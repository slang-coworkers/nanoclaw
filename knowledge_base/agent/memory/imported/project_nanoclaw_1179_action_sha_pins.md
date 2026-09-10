---
name: project_nanoclaw_1179_action_sha_pins
description: "nanoclaw#1179 (szihs, nv-main, OPEN) pins 15 action refs to SHAs across 6 workflows. Reviewed INLINE, comment 5240826225. All 7 SHAs verified correct; 1 orange (leaf branches still floating incl. pull_request_target label-pr), 2 yellow. TWO of my instruments fabricated results: ls-remote --refs hid annotated-tag peels (2 false MISMATCHes), gh code search returned a false 0."
metadata:
  node_type: memory
  type: project
  originSessionId: b0435a3e-b3a9-4fa9-9472-b6d46515461a
---

# nanoclaw#1179 — "pin every third-party action to a SHA"

PR https://github.com/slang-coworkers/nanoclaw/pull/1179, author **szihs**, base **`nv-main`**,
head **`0456192e0`**, merge-base `0d31622ee`, **6 files +15/−15** (every changed line a `uses:`).
All 4 checks green (`ci` 3m5s, `guard`, `label`, `check`). 0 reviews / 0 comments at my post.
My comment **`5240826225`**, posted via `gh api -X POST .../issues/N/comments` (the REST path —
`gh pr comment` fails with `Resource not accessible by integration (addComment)`, see
[[project_nanoclaw_1169_fixture_not_verbatim]]).

**Routing: INLINE by Main.** The `pr_ready_for_review` webhook carried the generic *"route to the
project's `*-pr-approver`"* string, and was **redelivered once** mid-review with identical payload.
No nanoclaw approver is wired; only `slang-pr-approver` / `slangpy-pr-approver` exist and both are
COMPILER-product approvers. Standing rule: [[project_nanoclaw_pr874_webhook_route_approver]].

## The body's core claim HOLDS

Resolved all 7 actions via `git ls-remote --tags`: every pinned SHA is the commit its tag points at
today, and the 4 already in `release.yml` are byte-identical. No pinned action reads
`github.action_ref`/`GITHUB_ACTION_REF` — the one mechanism by which tag→identical-commit could
change behavior. Base had a genuine dual state (5 floating + 2 pinned `checkout`, etc.).

## ⛔⛔ TWO of my instruments FABRICATED results in one review — opposite directions

1. ⭐⭐⭐**`git ls-remote --tags --refs` STRIPS the `^{}` peel line**, so for an ANNOTATED tag it
   returns the **tag object**, not the commit. `pnpm/action-setup@v4` and
   `configure-aws-credentials@v4` are annotated ⇒ I generated **2 confident MISMATCH verdicts
   against a correct PR**. Drop `--refs` and read `refs/tags/vN^{}` when present. **A mismatch is
   the finding that gets published — this instrument fails toward manufacturing work.**
   (Preceded by a 3rd instrument failure: 7/7 "MISMATCH" from `gh api` on **`api.github.com` =
   `401 Bad credentials`** — the token is scoped to `slang-coworkers` only, so cross-org tag reads
   must go through `git ls-remote`. The error body parsed as a SHA field and printed as MISMATCH.)
2. ⭐⭐**`gh api search/code` returned `total_count: 0`** for `.github/workflows` in `.ts` files. I
   published *"no `.ts` file references `.github/workflows`"* — **false**:
   `scripts/release.test.ts:13` does exactly that. The adversary caught it; I corrected it inside
   the posted comment rather than leaving it. ⇒ **never source a NEGATIVE from search/code**;
   enumerate contents instead.
   ⛔**CORRECTION 2026-08-10 (from #1181): my stated cause — "under-reports (indexing lag, fork/branch
   scope)" — was too weak and named the wrong failure mode.** `search/code` returns **0 for EVERY
   query against `slang-coworkers/nanoclaw`**, including a term guaranteed present in
   `package.json` on the default branch. The repo is a **fork** (`fork: true`, parent
   `nanocoai/nanoclaw`), and forks are not in the code index at all. Positive controls the same
   minute: `repo:nanocoai/nanoclaw+nanoclaw` → 293, `repo:shader-slang/slang+kIROp_DebugScope` → 10.
   ⇒ ⭐⭐⭐**On this repo the instrument is DEAD, not weak — a `0` here carries zero information, so
   "it under-reports" understates it into something a reader might still sample.** Full table +
   scope caveat: [[project_nanoclaw_1181_lazy_db_unit_cost]].

⇒ Both are ANCHOR-C shaped: a control validating the instrument would not have caught either,
because the instrument ran fine and returned a **true statement about the wrong object**.

## 🟠 Leaf branches still float — and the worst one is `pull_request_target` with write scope

"Zero floating refs remain" is true for `nv-main` **only**. `nv-coworkers`/`nv-slang`/`nv-slangpy`/
`nv-nanoclaw`/`nv-dashboard` all still carry `checkout@v4`, `action-setup@v4`, `setup-node@v4`,
`setup-bun@v2`, `github-script@v7`, `configure-aws-credentials@v4` (+`setup-python@v5`,
`astral-sh/setup-uv@v5` on nv-slang). `ci.yml` triggers on PRs to all 6 branches ⇒ a leaf PR runs
the leaf's own floating file. **`label-pr.yml` on every leaf is `pull_request_target` +
`pull-requests: write` + `issues: write` + floating `github-script@v7`** — its own header comment
documents the danger. Rated orange not blocking: nv-main owns `.github/**` and merge-train/ci.yml
canonicalize owned files to nv-main, but that lands in a **composed checkout**, not the leaf refs
(`ci.yml:175` admits a running workflow cannot rewrite itself).

⭐The adversary cited this via **`/workspace/agent/nanoclaw-kb/.github/workflows/label-pr.yml`** — a
**separate clone in my workspace on branch `kb-sync-20260810`**, NOT a leaf branch of the PR's repo.
Wrong path, right fact: it reproduced on all 5 real leaves via `gh api ...?ref=<branch>`.
**ANCHOR-A again — check which tree a path names before accepting OR rejecting the claim on it.**

## 🟡 Two durability findings

- **`# vN` buys nothing here.** `.github/renovate.json` sets `enabledManagers: ["custom.regex"]`,
  one manager scoped to `/^versions\.json$/`. Renovate's own
  `lib/config/options/index.ts:1292`: *"Only managers on the list are enabled."* ⇒ `github-actions`
  manager OFF. No dependabot config (3 paths 404), 0 bot-authored PRs ever. **`WebFetch` on
  docs.renovatebot.com twice returned "section truncated, but I infer…" — an INFERENCE dressed as
  doc lookup; both WebSearch calls 400'd.** Only reading renovate's SOURCE settled it.
- **No guard.** Nothing rejects a floating `uses:`. Normally scope creep on +15/−15, except
  `check-release-age-policy.sh` exists *because* a supply-chain policy was "documented, committed,
  and inert" — same decay class.

## Out of scope, flagged anyway
`verify-agent-image.yml:208` curls cosign from **`releases/latest`, unpinned, no checksum**, and
`steps.sig.outcome == 'success'` is what enables `gh pr merge --auto` (line ~215). A swapped binary
exiting 0 authorizes auto-merge of an unverified image — **the verifier floats while everything it
verifies is pinned.** Also `github/gh-skill` installed unversioned at `ci.yml:239`, then used with
`GITHUB_TOKEN`. Neither introduced by this PR.

## Adversary changed my calibration
Downgraded finding 1 ORANGE→YELLOW ("frozen permanently" overstated — humans bump, enabling the
manager later fixes it; the FORMAT is valid, the CONFIG is not). Upgraded finding 3 to ORANGE on the
`pull_request_target` exposure I had under-weighted. Folded `setup-uv` non-disclosure into finding 3
instead of listing it separately. ⭐**The adversarial pass moved 2 of 3 severities and caught 1 false
supporting claim — and its own strongest citation was to the wrong filesystem.**
