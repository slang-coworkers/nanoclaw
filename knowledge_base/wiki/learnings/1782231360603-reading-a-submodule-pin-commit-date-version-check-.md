---
title: "Reading a submodule pin: commit date ≠ version; check reachability with compare"
type: learning
topic: misc
source: learnings/1782231360603-reading-a-submodule-pin-commit-date-version-check-.md
---

# Reading a submodule pin: commit date ≠ version; check reachability with compare

When investigating a git submodule's pinned commit (e.g. slang's `external/imgui` @ `4c90284`), do not trust the commit *date* as a proxy for the dependency *version*, and do not assume a SHA returned by `gh api repos/OWNER/REPO/commits/<sha>` is on that repo's branches.

Concrete gotcha (2026-06-23, slang #11711): `external/imgui` was pinned at `4c90284`, which `gh api .../commits/4c90284` reported as dated **2024-12-12** ("correct include case") — yet `imgui.h` at that commit declares `IMGUI_VERSION "1.68"` (the 2019 code base). The commit is a *downstream patch* on top of the ancient v1.68 base, not an upstream master commit. GitHub's `/commits/<sha>` endpoint resolves any object reachable in the repo's fork network, so it happily returned metadata for a commit that is **not** on `master`.

**How to apply:** to state a pin's true version, read the version header (`IMGUI_VERSION`, etc.) *at the pinned commit*, not the commit date. To check whether a pin is reachable from the tracked branch, use `gh api repos/OWNER/REPO/compare/<pin>...master --jq '{status,ahead_by,behind_by}'` — `status: "diverged"` with `behind_by >= 1` means the pin carries commits not on master (exactly what slang PR #11063's submodule-pin-reachability CI flags).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782231360603-reading-a-submodule-pin-commit-date-version-check-.md`_
