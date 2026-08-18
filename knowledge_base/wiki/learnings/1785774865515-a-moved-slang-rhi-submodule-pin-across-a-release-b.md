---
title: "A moved slang-rhi submodule pin across a release boundary is not evidence the regression is in rhi"
type: learning
topic: slang-compiler
source: learnings/1785774865515-a-moved-slang-rhi-submodule-pin-across-a-release-b.md
---

# A moved slang-rhi submodule pin across a release boundary is not evidence the regression is in rhi

Converting a PyPI-release bisect into a slang-rhi commit range is the right first move on any slangpy issue whose backtrace has rhi frames, but the *pin moved* answer is weaker than it looks — and can point the wrong way.

**Technique (works without a slang-rhi clone, and avoids the shallow-tag trap):**
```bash
gh api "repos/shader-slang/slangpy/contents/external/slang-rhi?ref=v0.36.0" --jq '.sha'
gh api "repos/shader-slang/slangpy/contents/external/slang-rhi?ref=v0.37.0" --jq '.sha'
gh api "repos/shader-slang/slang-rhi/compare/<sha1>...<sha2>" --jq '.commits[] | "\(.sha[0:9]) \(.commit.message|split("\n")[0])"'
```
REST beats `git ls-tree <tag>` here: slangpy clones in coworker containers often have **no tags at all** (`git describe` → "No names found"), so the local command yields nothing and an empty result is easy to misreport as "the pin didn't change".

**The trap (observed on slangpy#1089):** the pin DID move across 0.36.0→0.37.0 (96fef6f9→af6a1168, 15 commits/78 files) — but all 15 commits were adapter/CUDA/WebGPU/test work, and the suspect functions (`getPipelineCacheKey`, `createPipelineWithCache`) were byte-identical at both pins. The rhi pipeline-cache code had landed months earlier (slang-rhi#379, 2025-06-02), well before the *older* pin. The actual regression was slangpy newly **entering** a latent rhi path: v0.37.0 added `src/sgl/device/persistent_cache.{h,cpp}` (didn't exist at v0.36.0 — REST 404) and began setting `.persistentPipelineCache` in the rhi DeviceDesc for the first time (slangpy#561).

So: **always intersect the commit range with the specific functions in the backtrace** before concluding ownership. A non-empty range only bounds the window. Grep the suspect symbols at *both* pins (`gh api .../contents/<path>?ref=<sha> --jq .content | base64 -d | grep -n ...`) — if they're identical, the regression is a caller-side activation, and the fix may still land in rhi while the *cause* is in slangpy. Checking whether a file existed at the older tag (404 vs 200) is a cheap, decisive boundary probe.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785774865515-a-moved-slang-rhi-submodule-pin-across-a-release-b.md`_
