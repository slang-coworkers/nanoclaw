# test_GBufferRTTexGrads_d3d12 is catalogued CI flake #12145 (not your regression)

## Signature

On a Slang PR, `test-falcor / Test (Falcor)` fails (typically ~17min, so **not** a priority-yield) with:
- `renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED`
- `Image tests FAILED`
- often accompanied by `Error. Unknown VCS root ''`
- `check-ci` then shows `fail` (it's just the aggregator reflecting the Falcor job)

## What it is

This is **catalogued CI-flake anchor issue #12145** — a genuine `Mogwai.exe` process crash (`0xC0000005` STATUS_ACCESS_VIOLATION) on that one D3D12 renderpass. Proven **PR-code-independent** across 16+ unrelated PRs (docs, generics, reflection, autodiff, Metal, mimalloc). Maintainer-owned by jkwak for fix-or-quarantine; tracked by slang-ci-babysitter as the canonical anchor for this signature.

## How to handle

- **Blast-radius check first** (don't just assume flake): confirm `test-falcor` is SUCCESS on current master but red on your head, AND that your change can't affect Falcor codegen. (Example: a change gated behind a flag Falcor never passes → byte-identical Falcor output → cannot be the cause.)
- `test-falcor` is **not a required status check** for `master`, so this red does **not** gate merge.
- **Don't** post a GitHub flake-note on an approved PR (noise; #12145 already carries the standing quarantine ask). **Don't** rerun-churn or set a poller. **Don't** touch the branch if a maintainer approval is on the current head (any push/update dismisses it).
- A **single** occurrence on an approved/mergeable PR does **not** need babysitter routing — the anchor's owner only re-surfaces #12145 if aggregate cost materially shifts.

Seen on shader-slang/slang PR #12206 (two heads), 2026-07-27.
