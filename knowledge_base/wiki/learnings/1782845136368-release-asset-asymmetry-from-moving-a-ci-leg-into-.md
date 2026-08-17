---
title: "Release-asset asymmetry from moving a CI leg into a no-sudo container (verify exact failing command, not disk/transient)"
type: learning
topic: agent-ops
source: learnings/1782845136368-release-asset-asymmetry-from-moving-a-ci-leg-into-.md
---

# Release-asset asymmetry from moving a CI leg into a no-sudo container (verify exact failing command, not disk/transient)

When a GitHub release is missing artifacts for ONE arch/platform but not others, don't assume "transient — just re-run." Trace the exact failing command in the release CI run.

Case: shader-slang/slang#11845 (v2026.12.1) — linux x86_64 general + debug-info tarballs missing; aarch64 complete; glibc-specific x86_64 tarballs present.

How it decomposed:
- Slang's `release.yml` builds general tarball + debug-info per matrix leg; the glibc-specific x86_64 tarballs come from SEPARATE workflows (`release-linux-glibc-2-27.yml` / `-2-28.yml`). So "glibc variants present but general/debug-info absent" = the main `release.yml` x86_64 leg failed while the glibc workflows ran fine.
- `release.yml` has `fail-fast: false`, so a failed leg leaves the others to upload — producing arch asymmetry.
- The failed run's job log showed the disk-space precheck PASSED (79.2 GB) — a RED HERRING (the two `echo ::warning/::error` lines were cyan = GitHub echoing the script SOURCE, not runtime output). The actual failure was the NEXT step: `sudo: command not found` → exit 127.
- Root cause: PR #11793 added `image: ghcr.io/shader-slang/slang-linux-gpu-ci:vX` to ONLY the x86_64 leg (others `image:""` = native runner). That container runs as root with no `sudo`, but `.github/actions/common-setup/action.yml`'s "Install dependencies (Linux only)" runs unconditional `sudo apt-get` → exit 127 before build. Native-runner legs (incl. linux aarch64) have sudo → fine. DETERMINISTIC, not transient — a plain re-run of the tag fails again.

Two reusable takeaways:
1. **Bot-pushability:** the GitHub App `workflows` permission gates ONLY `.github/workflows/*`. Fixes under `.github/actions/` (composite actions) are bot-pushable. So "it's a CI fix → not bot-pushable" is wrong when the fix is in actions/. (Confirmed: bot pushed `.github/actions/common-setup/action.yml` as draft PR #11849.)
2. **sudo idiom for steps that run on both native runners and root containers:** `SUDO=""; if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi; $SUDO apt-get ...` (mirrors the repo's existing claude-code-runner idiom).

Also: a draft PR with `Closes #N` does NOT auto-close the issue or surface the trail prominently — still post/refresh the issue's 5-bullet naming the held draft PR. And a code fix prevents recurrence but does NOT restore the already-missing release artifacts (maintainer re-run from a fixed ref, or manual re-upload).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782845136368-release-asset-asymmetry-from-moving-a-ci-leg-into-.md`_
