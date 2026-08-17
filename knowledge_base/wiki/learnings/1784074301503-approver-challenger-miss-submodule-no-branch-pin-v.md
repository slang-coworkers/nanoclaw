---
title: "[approver/challenger-miss] submodule no-branch pin verifies against DEFAULT BRANCH not the same-name tag"
type: learning
topic: review-approval
source: learnings/1784074301503-approver-challenger-miss-submodule-no-branch-pin-v.md
---

# [approver/challenger-miss] submodule no-branch pin verifies against DEFAULT BRANCH not the same-name tag

**Symptom:** On a `.gitmodules` submodule entry with no `branch =` line pinned to a release-tag commit (mimalloc `8c532c32` = v2.1.7, PR #12107), I initially cleared the "no branch pin" gap by reasoning the pin is "reachable from `refs/tags/v2.1.7`". The codex DECISION_REVIEW gate flagged this as the wrong mechanism.

**Root cause:** `extras/check-submodule-commits.sh` (shader-slang/slang) checks the pinned commit's reachability from the `branch =` value if present, ELSE the **remote's default branch** (`git ls-remote --symref <url> HEAD`). Its tag-fallback tries `refs/tags/<ref_name>` where `ref_name` is the *default-branch name* (or the `branch=` value) — NOT an arbitrary version tag. So for mimalloc-with-no-branch it verifies against `refs/heads/main` (tip `fef6b0dd`, the v2.3.2 line), and the tag path (`refs/tags/main`) doesn't exist. The check passes only because `8c532c32` (v2.1.7) is an ANCESTOR of `main`.

**How to catch it:** When a submodule pins an older release commit with no `branch =`, don't assume "tag-reachable" clears the CI submodule check. Verify the real predicate: `git merge-base --is-ancestor <pin> origin/<default-branch>`. If the pin is NOT an ancestor of the default branch AND there's no `branch =` naming a ref it's reachable from, `check-submodule-commits.sh` FAILS — that's a real gap (the pin would need a `branch =` override or a slang-skip-pin-check opt-out). Also confirm empirically with the `check-submodules` CI conclusion at the pinned head.

**Fix:** State the mechanism precisely: "pin X is an ancestor of the submodule's default branch (verified `merge-base --is-ancestor`); `check-submodules` CI = success." The contrast to `external/fast_float` (which DOES use `branch = v8.2.7`, a tag with no same-name branch — so the tag-fallback fires there) is the tell that the script keys on the *tracked ref name*, not any version tag.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784074301503-approver-challenger-miss-submodule-no-branch-pin-v.md`_
