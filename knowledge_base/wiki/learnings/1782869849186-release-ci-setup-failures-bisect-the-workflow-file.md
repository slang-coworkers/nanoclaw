---
title: "Release-CI Setup failures: bisect the workflow file's own history, not just the source-commit range"
type: learning
topic: ci-tooling
source: learnings/1782869849186-release-ci-setup-failures-bisect-the-workflow-file.md
---

# Release-CI Setup failures: bisect the workflow file's own history, not just the source-commit range

When a Slang **release CI** run fails at an environment/Setup step (not a compile step), the culprit is almost always a **CI-config change**, and the standard "commits since last successful run" heuristic can mis-blame the wrong PR.

**Concrete case (2026-07-01, run 28483807363):** linux x86_64 release job died at Setup with `sudo: command not found` (exit 127). Initial triage blamed #11828 ("Rename CI/nightly workflow files") because it was a CI-infra commit in the range. But #11828 never touched `release.yml`. The real culprit was **#11793 "Add GitHub Actions workflow lint"** (commit `bb3fae60f`) — despite its title, it added `image: ghcr.io/shader-slang/slang-linux-gpu-ci:v1.6.1` to the linux x86_64 release matrix entry. `release.yml` already had `container: ${{ matrix.image || '' }}`, so supplying an image moved the job into a container that runs as root with no `sudo`, while `.github/actions/common-setup/action.yml` still calls `sudo apt-get install -y libx11-dev`.

**Rules of thumb:**
1. For a Setup/environment failure, run `gh api "repos/shader-slang/slang/commits?path=.github/workflows/<wf>.yml&per_page=8"` AND the same for `.github/actions/common-setup/action.yml` — bisect the *workflow file's own history*, not the whole source range. Compare the file at the last-success SHA vs. the failing SHA.
2. A PR's title lies about scope. A "workflow lint" PR silently containerized a job. Diff the actual patch (`gh api .../commits/<sha> --jq '.files[]|select(.filename=="...")|.patch'`).
3. `container: ${{ matrix.image || '' }}` is inert until an `image:` value is supplied — adding `image:` to one matrix leg is what flips a job into a container. Containers run as root and typically lack `sudo`; any `sudo apt-get` in the shared setup action then fails with exit 127.
4. Principled fix lives in the shared setup action (make it root/container-aware: drop `sudo` when `id -u == 0`, or guard with `dpkg -s libx11-dev` like `.github/actions/claude-code-runner/action.yml` already does), not in the per-workflow file.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782869849186-release-ci-setup-failures-bisect-the-workflow-file.md`_
