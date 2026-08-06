---
name: project_nanoclaw_1051_agent_image_guard_selfblock
description: "slang-coworkers/nanoclaw#1051 sync PR — verify-agent-image.yml guard self-blocks on the commit that first adds the agent-image key; pin is VALID; routing = inline, not routed"
metadata:
  node_type: memory
  type: project
  originSessionId: pr1051-sync-nv-nanoclaw
---

**slang-coworkers/nanoclaw#1051** — `Sync nv-nanoclaw with upstream/main`, bot-authored (`nv-slang-bot[bot]`), branch `sync/upstream-nv-nanoclaw` → `nv-nanoclaw`. `pr_ready_for_review` fired twice: `opened` 2026-07-29 (28 files, +4951/−68) and `synchronize` 2026-08-05 (84 files, +8788/−563, head `516b501c`).

**ROUTING: handled inline by Main, NOT routed.** Same repo-class as [[project_nanoclaw_pr874_webhook_route_approver]] / #873 / #864 / #868 / #871: NanoClaw platform-infra fork, not in the product-coworker routing map, no `nanoclaw-*-pr-approver` wired. The webhook task string says "route to the project's *-pr-approver" — that string targets PRODUCT (slang/slangpy) PRs; do NOT dispatch a NanoClaw-platform PR to `slang-pr-approver`/`slangpy-pr-approver`. No auto-merge (config says never auto-merge this gate; `nv-nanoclaw` is maintainer-namespaced, outside the `nv-coworkers` grant per [[feedback_nv_coworkers_automerge]]).

**THE VERIFY FAILURE IS A GUARD BUG, NOT A BAD PIN.** New `.github/workflows/verify-agent-image.yml` arrives in this sync; its `verify` job fails at step **"Resolve the pin change"** on both heads. Mechanism, verified from the raw job log (`gh api repos/<r>/actions/jobs/<id>/logs`) — **ZERO output between the script `##[group]` and `##[error] exit code 1`**, so none of the guard's three `::error::` branches ran:

- `read_pin()` ends in `grep -o '"agent-image"...'`; the base commit `259803b`'s `versions.json` exists but holds only `onecli-gateway`/`onecli-cli` — **no `agent-image` key** ⇒ `grep` matches nothing and **exits 1**.
- Script header is `set -euo pipefail`, so that non-zero exit propagates out of the `$( )` and kills the script at the `OLD="$(read_pin ...)"` line, **before the first `echo`**.
- Empty was clearly *meant* to be legal: `${OLD:-<none>}` and the `if [ -z "$NEW" ]` branch both handle it. Only the `pipefail`+`grep` interaction makes it fatal.
- **Head's pin is VALID and would pass every check**: `797273591697.dkr.ecr.us-east-1.amazonaws.com/nanoclaw/agent@sha256:af60e54fc0c8139157244c2b2f23d3d365fd2446210f816ce013e5282d64fd60` — single-reference, digest-pinned.
- **Self-blocking by construction:** this sync is the very commit introducing `agent-image`, so `OLD` is necessarily empty. Re-pushing can NEVER turn it green; it would only self-resolve once the key is already on the base branch.
- **Fix is one line:** let `read_pin` tolerate a missing key (`|| true` / `|| echo ""` on the pipeline). Maintainer's call.

**⚠️ MY OWN ERROR, worth the row:** on the first webhook I reported the cause as "the agent-image pin was removed or is not a single digest-pinned reference" — I read that off the script's **error branches** instead of the **runtime values**, and shipped it as the finding. No `::error::` was ever emitted; the pin was fine all along. ⭐⭐⭐**A guard's error text enumerates what it CAN say, never what it DID say — an exit code plus a matching-looking branch is not evidence that branch ran. Read the emitted output; NO output is itself the discriminator** (it localizes the death to before the first `echo`, which is what ruled out all three branches here). See [[feedback_a_guard_can_be_inert_and_read_as_passing]] for the sibling failure — a guard that cannot say "I couldn't evaluate."

**✅ RESOLVED at head `c1ccd04c` (3rd webhook, `synchronize`, 08-05 08:03Z) — the "can NEVER go green" clause above is SUPERSEDED.** Push touched exactly one file, `.github/workflows/verify-agent-image.yml` (+14/−1), and did **both**:
1. **`|| true` on the grep** — `{ grep -o ... || true; }`. Its committed comment states the same mechanism I derived independently: "no agent-image key at this ref" is a legitimate answer, and without this "grep's exit 1 trips `pipefail` and kills the step before it can classify the change." ⇒ **root cause CONFIRMED by the fix**, and my first-turn attribution (pin removed / not digest-pinned) confirmed WRONG.
2. **`if: github.base_ref == 'main'`** — why `verify` now reads **`skipping`**, not passing. **This is a REASONED skip, not a red-check bypass:** a fork `nv-*` branch has no OIDC role for the publisher's ECR and no signer identity, so pull/cosign/lock-label steps would fail on a MISSING CREDENTIAL, not on the image. Trust is **inherited** from the verified `main` merge. Pin at this head is byte-identical to the previous head (`...@sha256:af60e54f...`) — a reference to an already-verified digest, not a new image. The `|| true` fix stays load-bearing for when the gate DOES run on `main`.

⚠️**`skipping` is the "inert guard reads as passing" shape** ([[feedback_a_guard_can_be_inert_and_read_as_passing]]) — here it is legitimate, but only because the skip CONDITION and the credential rationale were read. **Never accept a gate that stopped failing without reading WHY it stopped.**

**State at `c1ccd04c`: `mergeStateStatus: CLEAN`, `ci` pass, `verify` skipping, 0 reviews, 84 files +8801/−563.** Maintainer owns merge; still NO auto-merge (gate config says never; `nv-nanoclaw` outside the `nv-coworkers` grant).

**On redelivery:** routing unchanged (inline, no dispatch). Do NOT re-diagnose from the script source; do NOT re-review; do NOT auto-merge. Nothing posted to GitHub (comment hygiene — clean bot sync, maintainer-owned branch).
