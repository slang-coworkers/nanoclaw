---
title: "[approver/challenger-miss] aarch64 build red on a slang PR is usually Setup-stage infra-flake, not a compile error — classify by cross-platform + cross-PR"
type: learning
topic: ci-tooling
source: learnings/1784138142765-approver-challenger-miss-aarch64-build-red-on-a-sl.md
---

# [approver/challenger-miss] aarch64 build red on a slang PR is usually Setup-stage infra-flake, not a compile error — classify by cross-platform + cross-PR

**Symptom:** shader-slang/slang#12123 (test-only, single .cpp) tasked with a CI-failed event. `build-linux-debug-gcc-aarch64` and `build-linux-release-gcc-aarch64` both RED at the head. Tempting to read a red build on a C++-touching PR as PR-caused (→ BLOCK).

**Root cause of the red:** NOT a compiler error. Both jobs failed in the GitHub Actions **"Setup" step** — `sudo apt-get install -y libx11-dev` could not reach `ports.ubuntu.com` (`E: Failed to fetch ...libx11-dev_..._arm64.deb ... connect (101: Network is unreachable)` → `exit code 100`). The `Build Slang` step never ran (skipped). No .cpp compiled.

**How to catch it (the decisive classification method, in order of strength):**
1. **Cross-platform:** a genuine compile error in a single changed .cpp fails on ALL platforms. Here `build-macos-*-clang-aarch64` SUCCEEDED and x86_64 builds progressed — so it is not the code.
2. **Cross-commit:** the SAME two aarch64 jobs failed at the prior head too (before the author's follow-up commits) — points away from any diff delta.
3. **Cross-PR (definitive):** the same `build-linux-*-gcc-aarch64` jobs SUCCEEDED on an unrelated concurrent PR (`ser-abi-single-source`) — same toolchain, no code overlap ⇒ transient ARM64 apt-mirror flake, not a systemic outage, not PR-caused.
4. **Read the log tail** for the failing job (`gh run view --repo <r> --job <id> --log-failed | tail`) and identify the FAILING STAGE: pre-compilation setup/provisioning (apt/network/toolchain/checkout/disk/qemu) = infra; compilation of a specific .cpp = possibly real.

**Fix / rule:** The Slang aarch64 Linux builds cross-install X11/dev deps from `ports.ubuntu.com` during Setup and flake on transient network. A red aarch64 build whose log shows an apt/network failure in Setup is INFRA-FLAKE — it does not make the decision BLOCK (no verified 🔴) and does not by itself make it ABSTAIN_INFRA (that is for a failure of the APPROVER pipeline, not the PR's own CI). Delegate the log fetch to a subagent to keep logs out of context. Note: a red aarch64 build is still an UNSETTLED/red required check on the head, so it removes a "clean CI" corroboration point — see [approver/challenger-miss] ci-green-snapshot-is-not-settled-CI.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784138142765-approver-challenger-miss-aarch64-build-red-on-a-sl.md`_
