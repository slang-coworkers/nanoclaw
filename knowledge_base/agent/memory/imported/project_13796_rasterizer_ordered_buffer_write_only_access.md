---
type: project
name: project_13796_rasterizer_ordered_buffer_write_only_access
description: "slang#13796 (bot-filed 10-20 23:51Z by slang-triager as a side finding of #13771 / PR #13792, on the #13771 Main's order): RasterizerOrderedBuffer<T> gets the write-only access on every target (HLSL RWBuffer, Metal access::write, GLSL writeonly, SPIR-V NonReadable + spirv-val fail). Regression from #5454 (v2024.14.5): hlsl.meta.slang buffer typealias passes loop index aa as the _Texture access arg; #5454 inserted WriteOnly=2. Owned by the issue's own webhook Main (sess-1792540289870-fun2vl); NO fixer yet, operator decision asked 10-21 00:07Z; one-shot recheck-13796-rovbuffer-f0fa 10-23 09:00Z."
metadata:
  node_type: memory
  type: project
---

# slang#13796: RasterizerOrderedBuffer emitted as a write-only buffer

**Filed** 10-20 23:51Z by slang-triager (`sess-1792502067447-0onhoa`) as a side finding of the #13771 chain. The #13792 R1
reviewer spotted Metal `texture_buffer<float, access::write>` followed by `read()`. The #13771 Main (`sess-1792502009853-1i67fs`) ordered
"check for duplicates, confirm on master, file it as a separate issue". The triager's `[Report]` (#13771 Main seq 52) offered a
`[Triage handoff]`. The #13771 Main declined at seq 65 (00:00:53Z) and gave routing to this issue's own webhook Main
(`sess-1792540289870-fun2vl`, thread `gh-issue-shader-slang/slang-13796`). Labels `regression` and `reproduced`, Type Bug, no assignee.

**I verified at origin/master a760da2fb0 (Release build, 10-21 00:05Z):** `hlsl.meta.slang` `kBaseBufferAccessLevels` loop emits `aa`
as the access argument, and `slang-type-system-shared.h` has `kCoreModule_ResourceAccessWriteOnly = 2` /
`RasterizerOrdered = 3`. The repro gives HLSL `RWBuffer<float >`, Metal `access::write` then `.write`/load, GLSL `writeonly ... imageBuffer`
then `imageLoad`, SPIR-V `OpDecorate %rb NonReadable` then `OpImageRead`. `SLANG_RUN_SPIRV_VALIDATION=1` fails with
`Capability StorageImageReadWithoutFormat is required`. No open PR edits `kBaseBufferAccessLevels`. #13792 only touches
`hlsl.meta.slang` near line 20669 (the RWBuffer Metal setter), which is a different hunk.

**Interaction with #13792:** after #13796 is fixed, `RasterizerOrderedBuffer` stops being write-only and #13792's `ImageStore` fence covers it.
The #13771 Main told the triager that one Risk-line sentence covers this. The two changes are independent.

**Disposition:** follows the side-finding precedent (#13603, #13620, #13729): no fixer without an operator or maintainer decision. The
fix is small (add a `kCoreModule_ResourceAccess*` field to the table and emit it in the typealias and extension, plus a target-code and
reflection CHECK test). The open question went to orchestrator-dashboard on thread `gh-issue-shader-slang/slang-13796` (10-21 00:07Z).
To dispatch: send slang-triager a `[Triage handoff]` request on the canonical thread, because it filed the issue and the issue body is the triage.
Timer: one-shot `recheck-13796-rovbuffer-f0fa` (10-23 09:00Z).

**Compliance note:** like the other bot-filed issues (#13603, #13620, #13695, #13729), #13796 has no `bot` label (Contributor AI
Standard R9). That is a fleet-wide gap in the filing path, not specific to this issue.
