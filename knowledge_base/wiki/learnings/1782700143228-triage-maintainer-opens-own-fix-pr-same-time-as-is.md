---
title: "Triage: maintainer opens own fix PR ~same time as issue → verify + post + PARK, don't dispatch fixer"
type: learning
topic: agent-ops
source: learnings/1782700143228-triage-maintainer-opens-own-fix-pr-same-time-as-is.md
---

# Triage: maintainer opens own fix PR ~same time as issue → verify + post + PARK, don't dispatch fixer

When triaging a shader-slang/slang issue, ALWAYS run the duplicate/PR pillar (`gh pr list -R shader-slang/slang --search "11806"` and a title search) BEFORE forwarding to slang-fixer. Maintainers frequently open their own fix PR within ~1 minute of (sometimes before) filing the tracking issue.

**Concrete (2026-06-29, #11806):** jkwak-work filed #11806 ("CMake Options workflow fails across VS2022, aarch64, and ASAN sweeps") at 02:21:21Z but had already opened draft PR #11807 (`Fixes #11806`, branch fix-cmake-options-failed-tests) at 02:20:43Z. The PR's 7 changed files covered all 5 failure classes.

**Why:** dispatching slang-fixer to produce a fix here would create a competing/duplicate PR for work the maintainer is actively doing — wasted compute + reviewer confusion. Same park pattern as #11776/#11774/#11717/#11781.

**How to apply:** if a maintainer-authored PR with `Fixes/Closes #<num>` already exists, do NOT forward the fixer. Instead: (1) verify each root cause at HEAD, (2) set Issue Type if blank, (3) post the verified 5-bullet verdict on the issue pointing at the existing PR (a DRAFT PR does NOT suppress the issue post — still post per workflow step 9), (4) report up to parent recommending PARK with the PR link, (5) hold the fixer-forward pending parent confirmation. Re-engage only on a substantive human comment or a webhook on the maintainer's PR.

**Bonus (CMake Options workflow permission split, confirmed at HEAD 777a78adb):** all three `cmake-options*.yml` live under `.github/workflows/` (bot CANNOT push — missing `workflows` App permission), but `.github/cmake-options-matrix.json` is OUTSIDE `workflows/` so the bot CAN push it. So for a hypothetical bot fix: item1 + the probe-shell halves of the CUDA-guard/TINT-probe items are workflows-gated; the matrix.json data + the pure C++/CMake fixes (union payload, /bigobj, BVH link helper) are bot-pushable. Moot when a maintainer authors the PR.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782700143228-triage-maintainer-opens-own-fix-pr-same-time-as-is.md`_
