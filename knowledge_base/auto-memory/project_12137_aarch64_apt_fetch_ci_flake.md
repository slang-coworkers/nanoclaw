---
name: 12137-aarch64-apt-fetch-ci-flake
description: "aarch64 runner apt-fetch flake (ports.ubuntu.com unreachable, exit 100) — CI-babysitter tracking anchor, observe-mode"
metadata: 
  node_type: memory
  type: project
  originSessionId: 069bca5b-badc-4247-aeb7-329e73eddd54
---

**#12137** (shader-slang/slang, Infra / CI Stability) — CI-babysitter tracking anchor filed by nv-slang-bot 07-16.

**Signature:** aarch64 (`ubuntu-24.04-arm`) runners fail at the **`Setup`** step (build jobs) / **`Common Test Setup`** step (test jobs) with `apt-get install` **exit 100** — cannot reach `ports.ubuntu.com:80` (both IPv6 `2620:2d:4002:1::10a/b/c` and IPv4 `91.189.91.102/103/104` time out). Fails to fetch X11 dev pkgs (`libx11-dev`, `libxcb1-dev`, `x11proto-dev`, `libxau-dev`, `libxdmcp-dev`, `xtrans-dev`, `libpthread-stubs0-dev`). **Pre-compile** — no source change fixes it; `check-ci` roll-up then goes red.

**Attribution rule:** a red aarch64 `Setup`/`Common Test Setup` step on ANY PR = THIS infra flake, NOT a code regression. Affected PRs named: #11979, #12055, #12080, #12089, #12105, #12114, #12115, #12118, #12119, #12123 (several I track). Flapping, not continuous — same-hour runs pass/fail (07-16: 07:31Z/07:43Z passed, 06:58Z/07:55Z/09:22Z failed).

**Ownership:** slang-ci-babysitter OWNS this — logs new hits here, does NOT re-file. Observe-mode: **evicts-and-self-recovers** (auto-requeue works; #12055 bounced from merge queue twice 07-16 and self-requeued each time). Escalates further ONLY if it strands an approved PR (eviction with no auto-requeue) or clusters into a sustained stall.

**Fix path:** lives in `.github/workflows/` (apt retry+backoff / fallback mirror / pre-provisioned arm64 deps / force IPv4) — bot [[project_bot_workflows_permission]] CANNOT push workflow YAML, needs a maintainer. A non-workflow retry-wrapper on a setup *script* is the only triager-scopeable slice; babysitter has NOT requested it.

**Main's decision 07-16:** bot-authored tracking anchor, self-triaged, observe-mode → NO triage/fix chain routed; no redundant GitHub comment. Ties [[project_bot_pr_priority_yield_red_run]] (cosmetic-red discipline).
