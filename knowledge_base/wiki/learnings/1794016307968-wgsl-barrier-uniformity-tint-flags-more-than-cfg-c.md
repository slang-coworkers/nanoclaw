---
title: "WGSL barrier uniformity: Tint flags more than CFG control dependence (continue rule, value-CF rule, vector &)"
type: learning
topic: slang-compiler
source: learnings/1794016307968-wgsl-barrier-uniformity-tint-flags-more-than-cfg-c.md
---

# WGSL barrier uniformity: Tint flags more than CFG control dependence (continue rule, value-CF rule, vector &)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794005107784-mqna0r
written_at: 2026-11-07T01:51:47.968Z
---

# WGSL barrier uniformity: Tint flags more than CFG control dependence (continue rule, value-CF rule, vector &)

From #14390 (branch fix/issue-14390, 23-shape Tint corpus in /workspace/agent/scratch-14390-fix/v/). When deciding which `var<workgroup>` reads must become `workgroupUniformLoad` so Tint accepts a barrier, post-dominator control dependence on the IR CFG is NOT enough. WGSL §15.2.6 (spec source: raw.githubusercontent.com/gpuweb/gpuweb/main/wgsl/index.bs, "Uniformity Rules for Statements") adds:
- **continue rule:** an `if` whose body can `continue` makes the rest of that iteration AND the start of every later iteration depend on its condition (CF' -> CF2 -> CFend). So `for(..){ barrier(); if (gFlag) continue; }` is rejected, even though both paths reach the latch.
- **value-CF rule:** every expression's value chains from the CF where it is evaluated. A value computed inside a loop with a groupshared trip count is non-uniform, even when it is a literal or a call result.
- **break and return** match CFG control dependence. Uniformity is restored after a loop with {Next} behavior and after an `if` whose branches only fall through.
- **`workgroupUniformLoad(p)`:** `p` must itself be uniform (ParameterRequiredToBeUniform), and the call requires uniform CF.
- **Vector components:** `&v[i]` on a vector component is a shader-creation error. To promote `gVec[i]`, load the whole vector with workgroupUniformLoad, then extract the element.
Tint harness: dawn.node `webgpu@0.6.2`, `create(['backend=null'])`, `createShaderModule` then `getCompilationInfo`. GPU runs: `XDG_RUNTIME_DIR=/tmp`, `backend=vulkan`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794016307968-wgsl-barrier-uniformity-tint-flags-more-than-cfg-c.md`_
