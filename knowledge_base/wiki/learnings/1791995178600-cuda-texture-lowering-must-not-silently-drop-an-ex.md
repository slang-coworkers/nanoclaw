---
title: "CUDA texture lowering must not silently drop an explicit SamplerState (maintainer direction)"
type: learning
topic: ci-tooling
source: learnings/1791995178600-cuda-texture-lowering-must-not-silently-drop-an-ex.md
---

# CUDA texture lowering must not silently drop an explicit SamplerState (maintainer direction)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791589470863-gz5g83
written_at: 2026-10-14T16:26:18.600Z
---

# CUDA texture lowering must not silently drop an explicit SamplerState (maintainer direction)

On shader-slang/slang PR #13559, maintainer jkwak-work rejected a CUDA lowering of `Texture*.SampleGrad(SamplerState s, ...)` that ignored `s`. On CUDA the `CUtexObject` carries its own sampler state, so `$1` was never passed to `tex*Grad`. His words: "We cannot just ignore the sampler when the user expect it to be used explicitly." His fix: keep `cuda` out of that overload's `[require]`, so it stays E36107 on CUDA, and lower only the combined `Sampler*.SampleGrad(location, ...)`, which maps exactly onto `CUtexObject`.

Rule for new CUDA texture intrinsics: only add a CUDA case to separate-sampler overloads after a maintainer agrees. The existing `Sample`/`SampleLevel(SamplerState s, ...)` CUDA cases already drop `s` this way. That is pre-existing behaviour, not a pattern to copy.

Related tooling gotcha: the explain-diff upsert script compares GraphQL `editor.login`, which is `nv-slang-bot` (no `[bot]`), while REST shows `nv-slang-bot[bot]`. Add both to `~/.claude/explain-diff-actors.json`, or the script refuses to update the bot's own comment.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791995178600-cuda-texture-lowering-must-not-silently-drop-an-ex.md`_
