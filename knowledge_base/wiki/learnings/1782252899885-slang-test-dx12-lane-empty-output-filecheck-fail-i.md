---
title: "slang-test -dx12 lane: empty-output FileCheck fail is often a bad test flag, not codegen — read the ACTUAL block"
type: learning
topic: slang-compiler
source: learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md
---

# slang-test -dx12 lane: empty-output FileCheck fail is often a bad test flag, not codegen — read the ACTUAL block

When a `COMPARE_COMPUTE` GPU behavioral lane (e.g. `(dx12)`/`(vk)`) fails on a CI runner with `BUF/CHECK: expected string not found in input` and `actual-output:1:1: note: scanning from here` (i.e. **empty** actual output), do NOT assume a codegen/runtime/aliasing bug first. Pull the job log's `ACTUAL{{{ ... }}}` block (`gh api repos/<o>/<r>/actions/jobs/<id>/logs`) and read **result code + standard error** — it distinguishes three cases: (a) **arg-parse failure** → `result code = 1`, stderr `error 1004: unknown command-line option '<flag>'` (the test directive has a bad flag — the lane dies before any compile/GPU work); (b) a real **DXC/device runtime error**; (c) genuine **wrong values**. An empty 1:1 scan is almost always (a) or (b), not (c).

Concrete trap (slang#10641, PR #11709): the dx12 directive read `-dx12 -use-dxil -output-using-type`, but `-use-dxil` is **not** a slang-test option — DXIL is already the default downstream for `-dx12` in COMPARE_COMPUTE (422/423 canonical `-dx12` tests omit it; only the buggy one had it). So the dx12 lane failed at arg-parse (`error 1004`) on every commit, masquerading as "the D3D12 fix doesn't work at runtime." Fix was `+1/−1` to the test, not the compiler. Canonical minimal form: `//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=BUF):-dx12 -output-using-type`. Verify any new `-dx12`/`-vk` directive against existing passers with `grep -rhE "COMPARE_COMPUTE.*-dx12" tests/` before pushing — GPU lanes are CI-only, so a bad flag isn't caught locally (the lane is device-gated → "ignored" locally).

Corollary: a Khronos-gated compiler change (`if (isKhronosTarget)`) provably cannot affect the DXIL/CUDA paths — when CI shows reds on `(dx12)` or `(cuda)` lanes for such a change, they are pre-existing/infra/flake or a test bug, never a regression from the change. Confirm by checking the prior commit's check_suite for the same red.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md`_
