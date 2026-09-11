---
name: project-12145-gbufferrttexgrads-d3d12-access-violation
description: "slang#12145 — renderpasses/test_GBufferRTTexGrads_d3d12 crashes Mogwai.exe (access violation, return code 3221225477) on D3D12. Was the dominant merge-queue evictor. ⛔ Its signature detectors went BLIND on 2026-08-07T10:04Z when test-falcor migrated to an opaque runner binary — a quiet #12145 after that is NOT evidence it is gone. Still merge-gating. OPEN, assignee jkiviluoto-nv."
metadata:
  node_type: memory
  type: project
  originSessionId: ac18452e-8cea-41c3-ae5f-95cac66b7141
---
# slang#12145 — GBufferRTTexGrads_d3d12 access violation (CI flake anchor)

`renderpasses/test_GBufferRTTexGrads_d3d12` crashes **Mogwai.exe** with an access violation
(return code **3221225477** = `0xC0000005`) on D3D12. Pre-migration it was the **dominant merge-queue
evictor** (10 of 18 distinct eviction events, 56%, across 10 PRs over 7 consecutive days; re-adds were by
NAMED HUMANS, median 53 min — so rerun volume was never the cost). **OPEN**, assignee **jkiviluoto-nv**
(reassigned by jkwak 2026-08-06), labels `Infra` + `CI Stability`. Operator escalation lives in issue
comment **`5062894889`** — **refresh it IN PLACE, never post a second.**

## ⛔⛔ CRITICAL — the signature detectors are BLIND after 2026-08-07T10:04Z

Commit **`eea5b2753`** (2026-08-07 10:04Z) migrated the `test-falcor` job to an **opaque runner binary**:
`runs-on: [Linux, self-hosted, X64, falcor-bridge]`, a single step `Run external CI` →
`/opt/slang-ci/run-external-ci` (a runner-image binary, not a tracked file). Consequences:

- **Every signature-keyed detector in this anchor is blind on post-10:04Z runs** — the logs no longer
  name individual tests. The decimal `3221225477` probe, the test name, and the HSigmoid discriminator
  all stop working. ⇒ **A quiet #12145 after 2026-08-07T10:04Z is NOT evidence the flake is gone.**
- **The delivered retry diff is DEAD** (comment 5199334901) — it patched `run_image_tests` in
  `.github/workflows/ci-falcor-test.yml`, a layer that no longer exists; there is no in-repo layer a
  stdout-parsing gate can live in.
- The flake **cost mechanism is unchanged: still merge-gating** (re-verified at `ci.yml:677`; job def now
  `ci.yml:613`). Only the observability finer than job red/green was lost; the `Test (Falcor Perf)`
  sibling is untouched.

## Maintainer decision + current landing path

jkwak decided (2026-08-06) to **add a scoped retry** for this test rather than fix Falcor:
*"add a retry logic just for this specific test if it fails."* jkiviluoto-nv (comment 5221307479,
2026-08-07) then **reproduced it on different hardware** ("does not look machine-specific"), confirmed it
is a **genuine process crash** (it failed with image comparison disabled → this retires the whole
stale/mismatched-reference-image hypothesis class), was the sole failing test, at **~1 in 6** rate.

Landing path is **NOT a bot PR** — `.github/workflows/*.yml` is unpushable by the App. Standard play:
draft + locally verify the diff, **post it as a ready-to-apply fenced-diff comment** to jkiviluoto-nv
(precedent #11586, slangpy-samples #50). ⛔ **Do NOT dispatch a fixer** (Infra + workflow YAML). See
[[project_bot_workflows_permission]].

## Durable rules / meta-lessons

- **Grep rule (pre-migration logs only):** probe **DECIMAL `3221225477`** or the test name, **never** hex
  `0xC0000005` — the hex form returns ZERO because Mogwai prints the decimal return code.
- It is **host-independent**: a pass/fail pair on ONE host (`31137238034` failed SLANGWIN5 att1, passed
  att2) refutes host-bound-ness directly, so a #12145 red is not host evidence.
- `GBufferRTTexGrads_vulkan` does not exist in the suite ⇒ "d3d12-only" is a **matrix property, not an
  API-specific discriminator.**
- **Verify a gating claim at the CONSUMER, not the declaration** — being in a `needs:` list proves
  ordering; the `exit 1` on `select(.result != "success")` is what proves gating.
- **A prohibition stored without its premise outlives its reason** — record WHY a route was closed.
- **Before defending/re-asserting a delivered diff, re-verify the target file at live HEAD** — a merged,
  unrelated commit can invalidate a delivered artifact while a chain sits open, with no notification.
  Same family as [[feedback_stale_index_describes_a_real_deleted_file]].
