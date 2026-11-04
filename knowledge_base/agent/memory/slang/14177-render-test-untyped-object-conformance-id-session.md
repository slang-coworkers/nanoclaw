---
type: chain
title: slang#14177 — render-test untyped `new{...}` input writes a conformance ID from slang-rhi's device session
description: Human-filed (albertrodriguezclo) test-harness bug 2026-11-02 12:06:54Z. An untyped `//TEST_INPUT:set g = new{ foo: new ImplA{...} }` goes through slang-rhi createShaderObjectFromTypeLayout (device session), so setExistentialHeader takes ImplA's sequential ID from the wrong Linkage and dispatch runs ImplB. Dispatched to slang-triager under the R6 hold (to 2026-11-06 12:06:54Z). Main one-shot r6-release-14177-c2f9 at 11-06 12:10Z.
resource: raw/slang-14177-triage-memo.md
tags: [render-test, slang-rhi, dynamic-dispatch, conformance-id, test-harness, r6]
---

# slang#14177 — render-test untyped object input uses the wrong session for conformance IDs

**Ask.** In `COMPARE_COMPUTE`, `new{ foo: new ImplA{ v: 5 } }` (no outer type name) makes
render-test call `device->createShaderObjectFromTypeLayout` (`render-test-main.cpp:824`), which builds
the layout with slang-rhi's `m_slangContext.session` (`device.cpp:813`). `ShaderObject::setExistentialHeader`
(`shader-object.cpp:778`) then asks that session's `Linkage` for `ImplA : IFoo`'s sequential ID; the
counter is fresh, so it returns 0, which the program's numbering assigns to `ImplB` (the shader constructs
`ImplB(7)`, so ImplB=0, ImplA=1). Result 10 instead of 5. The typed form `new Params{...}` takes
`createShaderObject(slangSession(), ...)` (line 795) and passes. Reporter's suggested fixes: render-test
uses the program session for the untyped path, or slang-rhi's `createShaderObjectFromTypeLayout` takes the
owning session. Not a compiler bug. Only `-cpu` was run by the reporter.

**Related.** #14152 (same reporter, same morning, dynamic-dispatch existential layouts); the reporter's
PR #14176 (`Fixes #14152`) opened 11:59Z, 7 min before this issue, so this was probably found while
writing #14176's tests. Prior, different: #6924, #10797, #11266, #10893 / slang-rhi #811 (layout lifetime
on the same path).

**Dispatch (11-02 ~12:15Z, Orchestrator).** Memory grep on 14177: no hits. Only session on
`gh-issue-shader-slang/slang-14177` was my webhook session `sess-1793621216843-kle6tv`. Live: OPEN,
0 comments, no labels/assignee. Dup search (createShaderObjectFromTypeLayout; slang-rhi conformance ID
session): only #10893. Fenced blocks but no crash word (wrong value), so the **R6 hold applies until
2026-11-06T12:06:54Z**: no bot comment, label, type, PR or commit naming the issue before then. Release
timer: Main's `r6-release-14177-c2f9` (11-06 12:10Z); the triager was told not to set its own. A slang-rhi
filing or PR needs the operator's go-ahead (external repo).

**Triager progress 11-02 12:13Z (msg 18; their finding).** Reproduced on master 6815ed82d on cpu, vk
and cuda: 10/14 (expected 5/14); both control variants pass. Still checking coincidental-pass tests,
PR #14176, and slang-rhi upstream.

**Triage 11-02 12:20Z (slang-triager, msg 22; memo [raw/slang-14177-triage-memo.md](raw/slang-14177-triage-memo.md)).**
Bug / medium / P2 / render-test + slang-rhi; not a dup, no regression signal. Reproduced 10/14 on cpu, vk, cuda;
controls pass. I spot-checked `render-test-main.cpp` (untyped branch -> `createShaderObjectFromTypeLayout`) and
`device.cpp:823` (`m_slangContext.session`) at 6815ed82d / rhi b856e635: matches. Root objects use the program
session (root interface globals fine); sub-objects inherit the device session; `specializeType` :714 also.
slang-rhi main 30250fa unchanged; #811 rejected passing `IComponentType*` as an ABI break.
- **Rec A (slang):** render-test's untyped branch calls `createShaderObject(<program session>, layout->getType(), None, ...)`;
  for DXC/FXC pass-through (`slangComponent` may be null) take the session from `desc.slangGlobalScope`.
- **Coincidental passes (verified by declaration-order swap, cpu):** `global-interface-param-compute`,
  `constantbuffer-struct-interface-array`, `constantbuffer-struct-interface-field`, `parameterblock-struct-interface-field`;
  latent `global-interface-param-compute-mono`. #14176's CPU test is coincidental too but not broken today.
- **Operator question (asked 11-02):** a slang-rhi follow-up adding a session-carrying `createShaderObjectFromTypeLayout`
  (API/ABI change, so not covered by the file-without-asking rule even though slang-rhi is a shader-slang repo). SlangPy's
  `sgl Device::create_shader_object(type_layout)` may share the hazard (triager hypothesis, not run).
- **Side finds:** (a) `tests/compute/array-existential-parameter.slang` + a second conformer breaks the CPU C++ build
  (`MyImpl_run_0` AnyValue4* vs MyImpl_0*) -> told the triager to dedupe + file (verified-bug rule, no #14177 reference);
  (b) vk read 0 in a #14176-style two-CB by-value reduction, not investigated, not filed.
- **At release:** reporter PR -> draft becomes "review the reporter's PR", no handoff; else post, Type=Bug + `reproduced`,
  hand Rec A to slang-fixer.

**Reporter follow-ups 11-02 ~12:20Z (Orchestrator, webhook session `sess-1793622050338-rmbwtc`).**
- **slang#14178** (albertrodriguezclo, non-draft, opened 12:19:47Z, branch `fix/render-test-untyped-object-session`,
  "Fixes #14177"): the reporter's own Rec A fix. So at release, this chain is "review/acknowledge the reporter's PR";
  no slang-fixer handoff.
- **slang-rhi#965** (same reporter, opened 2026-11-02T12:20:47Z, 0 comments, no labels): the slang-rhi follow-up
  (`createShaderObjectFromTypeLayout` uses the device session). The **filing half** of the operator question is moot,
  because the reporter filed it. The PR half (should slang-fixer write a session-carrying API, an ABI change?) still
  needs the operator; my default is no, because the reporter is an active slang-rhi contributor (#958, #942, #929 merged).
  Dedupe: only #811 is related (it is cited in the issue). rhi main 30250fa10 is unchanged.
- Dispatched slang-triager on `gh-issue-shader-slang/slang-rhi-965` for a light triage: no re-repro, reuse this
  chain's analysis, keep the draft local. **R6 hold until 2026-11-06T12:20:47Z** (no fenced block, so no exemption).
  Timer: Main's `r6-release-rhi-965-f9f6` (11-06 12:25Z). The triager was told not to set its own.
- I did not message the #14177 triager session from the #965 session (the edge belongs to the sibling Main session).

**slang-rhi#965 triage 11-02 12:28Z (slang-triager msg 22; memo [raw/slang-rhi-965-triage-memo.md](raw/slang-rhi-965-triage-memo.md)).**
Bug / medium / P2 / IDevice shader objects; not a dup (#811 related); no regression. Root cause re-checked at rhi
30250fa (`device.cpp:755`, `shader-object.cpp:806` setExistentialHeader, `:714` specializeType).
- **Rec (a):** a session-first virtual like `createShaderObject` (null means the device session), the 2-arg form kept
  as an inline wrapper for source compatibility, `:714` switched to `m_layout->m_slangSession`, plus (b)'s doc sentence.
  (b) alone is not enough: rebuilding through `createShaderObject(session, layout->getType())` loses specialized
  or element layouts.
- **ABI is not a blocker:** I checked the rhi README "Project status and compatibility" at 30250fa: it guarantees
  neither source nor ABI compatibility (#895, merged 10-08). skallweitNV's #940 (merged 10-26) added IDevice virtuals;
  I did not check where in the interface they went. The ABI note in #811 was the PR author's own reasoning.
- **SlangPy:** the triager's static read only, not run: sgl `device.cpp:929` → rhi with only the global session;
  5 functional-API builtins call it. Treat it as a hypothesis, not a bug to file.
- Held draft in the triager's group: `comment-slang-rhi-965.md` (asks skallweitNV to choose the API shape). At
  release: if the reporter has a PR, do not post the draft; otherwise post it and set Type=Bug.

**Side find (a) filed 11-02 12:28Z (slang-triager msg 32): [slang#14180](https://github.com/shader-slang/slang/issues/14180)**
(bot-filed, Type=Bug + `reproduced`; does not name #14177/#14152/#14176/#14178). Static `-specialize MyImpl` on an
interface-ARRAY field with a second conformer passes the AnyValue payload to `MyImpl::run`; spirv-val/dxc/nvrtc/gcc
reject, slangc exits 0. Filed-only; **its issue_opened needs no dispatch**; no fixer chain without the operator.
Side find (b) is reproduced on vk (CB existential with `anyValueSize` < 16: reflection gives the
`{rtti,witness,AnyValue8}` tuple size 24, emitted std140 puts the next field at 32 — slang side); triager is deduping
before it files. Release one-shot prompt updated 11-02 ~12:32Z for #14178 (no fixer; acknowledgment post with gaps).

**Side find (b) filed 11-02 12:34Z (slang-triager msg 44): [slang#14181](https://github.com/shader-slang/slang/issues/14181)**
(bot-filed, Type=Bug + `reproduced`; names none of #14177/#14152/#14176/#14178/#14180; cross-refs umbrella #12316 and
sibling #12092). Reflection reports the existential tuple as 16+N bytes, but emit pads it (SPIR-V/GLSL/WGSL std140 for
N < 16 → 32 bytes; CUDA for N = 4/12 via `uint2` alignment), so a following field's offset diverges. L40S: vk reads the
payload and next field as 0 for N < 16; cuda the next field for N = 4/12; cpu fine. Why the vk payload itself is 0 is
unconfirmed. Filed-only; **its issue_opened needs no dispatch**. The #14177 held draft now acknowledges #14178 (+2 gaps)
and points to slang-rhi#965 only. Chain parked until `r6-release-14177-c2f9`.
Triager correction 12:35Z (msg 46): #14176's by-value reductions use `[anyValueSize(8)]`, so their vk zeros are #14181's
pattern. Nothing more to file from this chain.
**#14181 issue_opened webhook 11-02 (Orchestrator).** Not dispatched, as recorded above. Live check: OPEN, 0 comments,
`reproduced`, no assignee. The triager already announced the filing on the operator DM (row 510076, 12:35Z), so no
Main post was made. A fixer chain for #14181 still needs the operator.
**#14178 ready_for_review webhook 11-02 (synchronize, head eb8906fb; Orchestrator).** Not forwarded: slang-pr-approver is
paused. Queued in `data/approver-pause-queue.md` with the triager's two gaps. jkwak-work APPROVED; CI 57 pass / 0 fail.
**#14181 maintainer direction 11-03 15:07Z** ([comment](https://github.com/shader-slang/slang/issues/14181#issuecomment-6607371225), tangent-vector):
*"I believe we never intended for existentials to be allowed to have an any-value size below 16. I would propose that we
diagnose a warning when a declared any-value size is <16 and tell the user it will always be rounded up to at least 16
bytes. Then in layout computation we should do just that."* The comment does not mention the bot. jkwak-work self-assigned
the issue and set milestone Q1 2027 (11-02 18:29Z), so it is **maintainer-driving**: no bot post, no fixer. Main withdrew
the #14181 fixer go/no-go from the operator list (supervisor-state updated). Re-engage only if jkwak-work, tangent-vector
or the operator asks the bot.
