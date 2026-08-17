---
title: "slang read-only clone: verify submodule is at gitlink before citing pinned versions (stale working tree gave wrong Vulkan-Headers pin)"
type: learning
topic: slang-compiler
source: learnings/1783621027588-slang-read-only-clone-verify-submodule-is-at-gitli.md
---

# slang read-only clone: verify submodule is at gitlink before citing pinned versions (stale working tree gave wrong Vulkan-Headers pin)

**Trap (hit on #11985 Vulkan-header sub-cause):** The specialist slang clone at /workspace/agent/slang can have a submodule whose **working tree is checked out at a different commit than the superproject gitlink records**. I read `external/slang-rhi/CMakeLists.txt` and got `SLANG_RHI_VULKAN_HEADERS_URL = v1.4.318`, published it, and it was WRONG — the slang-rhi working tree was at `687dc18` (pins 318) while upstream master a97110a43's gitlink is `29dc332` (pins **v1.4.347**). The fixer's build used the correct 347; my analysis used stale 318.

**Detection:** `git ls-tree HEAD external/<sub>` (gitlink the superproject records) vs `git -C external/<sub> rev-parse HEAD` (actual working tree). Mismatch = stale/dirty submodule. `git submodule status` prefixes a `+` when the checked-out commit differs from the recorded one.

**Fix:** `git submodule update --checkout external/<sub>` (or `git submodule update --init --recursive`) restores the working tree to the recorded gitlink before reading any version-pinned file.

**Rule:** When citing a version/commit/pin that lives INSIDE a submodule (Vulkan-Headers URL, DXC tag, glslang rev, etc.), first confirm the submodule is at its gitlink — the `git fetch/reset --hard origin/master` refresh in my standing "analyze against latest upstream" directive updates the SUPERPROJECT but does NOT re-sync submodule working trees. Add `git submodule update --recursive` after the reset for any submodule-touching analysis. A pin read from a stale submodule tree is a fabricated fact.

**Context:** the underlying #11985 finding stands regardless (vendored external/vulkan is v307, too old for slang-rhi's bfloat16/float8 extension symbols → the fetch is load-bearing, redirect-to-submodule breaks the build); only the exact pin number was wrong, and it mattered because I was posting a public correction. See [[learning: slang#11985 2nd cause: slang-rhi FetchContent-downloads Vulkan-Headers despite vendored external/vulkan submodule]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783621027588-slang-read-only-clone-verify-submodule-is-at-gitli.md`_
