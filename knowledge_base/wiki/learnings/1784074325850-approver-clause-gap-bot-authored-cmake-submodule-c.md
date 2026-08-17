---
title: "[approver/clause-gap] bot-authored CMake/submodule change is Devin-only tier; relaxed policy does NOT protect external/CMakeLists.txt"
type: learning
topic: review-approval
source: learnings/1784074325850-approver-clause-gap-bot-authored-cmake-submodule-c.md
---

# [approver/clause-gap] bot-authored CMake/submodule change is Devin-only tier; relaxed policy does NOT protect external/CMakeLists.txt

**Symptom:** Step-0 recall for PR #12107 (bot-authored: mimalloc→submodule + FATAL_ERROR in `external/CMakeLists.txt`) surfaced a strong prior warning that touching `**/CMakeLists.txt` fails `CLAUSE_FAIL:no_protected_paths` → ABSTAIN_POLICY. That prior was for the BUNDLED conservative default policy and would have mis-steered this decision.

**Root cause:** The mounted group policy `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (`v0-shadow-relaxed`, human sign-off haaggarwal 2026-07-10) narrows `protected_paths` to ONLY `[".github/**", "**/slang-tag-version.h"]`. `**/CMakeLists.txt`, `cmake/**`, `external/**`, `**/*.yml` are protected in the *bundled* default but NOT under the mount. `eval-clauses.py` precedence: `--policy` > per-PR `<ws>/policy/` > mounted `/workspace/extra/approver-policy/` > bundled default. No per-PR policy is staged for live webhook runs, so the mounted relaxed policy governs — CMake/external edits pass `no_protected_paths`.

**How to catch it:** Never hand-judge protected paths from a recalled learning — run `eval-clauses.py` and read the emitted `policy_version` (`v0-shadow-relaxed`) + `no_protected_paths` evidence. A recall bullet citing `.github/**`/CMakeLists protection is only valid under the policy it was written against.

**Fix / confirmed-safe shape:** Bot-authored PRs (`nv-slang-bot[bot]`) get harvest exit 20 (production claude-code-action review skips bot branches) ⇒ **Devin-only tier is correct, not an infra abstain**. For a small build-config change: (1) verify the submodule pin dereferences to the intended tag (`gh api .../git/refs/tags/<v>` → deref annotated tag), (2) confirm default-platform builds are unaffected by checking the CMake option gates (here `SLANG_BUILD_MIMALLOC` OFF on default Linux/macOS ⇒ new FATAL_ERROR unreachable), (3) confirm CI checks out `submodules: recursive` (`ci-slang-build.yml`) so a "removed auto-download" can't break the build matrix, (4) cross-check the issue thread for maintainer-blessed approach + version. #12107 cleared to WOULD_APPROVE/CLEAN with jkwak-work APPROVED at the exact head = clean agreement. This shape (bot build-config PR, options-gated, CI-recursive-checkout, issue-blessed) is safe to approve when all four hold.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784074325850-approver-clause-gap-bot-authored-cmake-submodule-c.md`_
