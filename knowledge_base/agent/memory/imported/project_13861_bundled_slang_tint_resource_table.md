---
type: project
name: project_13861_bundled_slang_tint_resource_table
description: "HUMAN-OWNED, nothing dispatched (10-22 10:28Z). slang#13861 (albertrodriguezclo, external): the bundled slang-tint (shader-slang/dawn release slang-tint-0, published 2024-10-07) rejects `enable chromium_experimental_resource_table`, so the author's PR #13707 (#13641) can only FileCheck WGSL text. Asks maintainers to rebuild slang-tint (and webgpu_dawn-0, 2024-09-19) from a current Dawn. Infra request to maintainers; no chain of ours depends on it."
---

# slang#13861: bundled slang-tint is too old for `chromium_experimental_resource_table`

**10-22 10:28:37Z `issue_opened`.** Main webhook session `sess-1792664919894-avoa0i` (thread
`gh-issue-shader-slang/slang-13861`). Live read at ~10:35Z: open, 0 comments, no labels, unassigned, empty
timeline, body unchanged. Third of a batch with #13859 (dispatched to triage) and #13860 (held).

**Claims checked.** `CMakeLists.txt` on master: `slang_tint_release_tag "slang-tint-0"` (:529) and
`webgpu_dawn_release_tag "webgpu_dawn-0"` (:515). shader-slang/dawn releases: `slang-tint-0` published
2024-10-07, `webgpu_dawn-0` 2024-09-19; repo last pushed 2025-09-04. The google/dawn commit dates
(3b0579347e Dec 2025, c943ea32, 3ed0a2fd) were **not verified**: the gateway returned "Bad credentials" for
google/dawn.

**Ownership.** The ask is for a maintainer to cut a new shader-slang/dawn release and bump the two tags. That
is release infrastructure in another repo, not a compiler bug, so triage or a bot fix does not apply. The
consumer is the author's own non-draft PR #13707 (`feature/wgsl-resource-table`, reviewer dshreiner-nv), which
implements #13641 (assigned jkwak-work). Our old #13641 triager session (`sess-1792070213940-c9g7tq`) has been
stopped since 10-15; nothing of ours waits on a newer Tint.

**Disposition: held, nothing dispatched or posted, no timer.** R6 (#13596): the bot does not post on new
human issues.

**Resume on:** a maintainer asking the bot to act on #13861, a `bot-ok` label, or an operator ask.
