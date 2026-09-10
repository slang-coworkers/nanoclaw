---
name: project_8373_std430_cbuffer_parser_gate
description: "slang#8373 layout(std430) cbuffer ignored — ANSWERED on GitHub 2026-08-05 (comment 5196687829). Both asks reproduce at master b0e43d657: parser gate slang-parser.cpp:4189 allowGLSLInput, and NO layout-vs-target diagnostic (39012 is taken by an unrelated bindless warning). Fix PR #8432 closed UNMERGED as a draft."
metadata:
  node_type: memory
  type: project
  originSessionId: dd84c1af-a185-41f7-91e7-efd943d575af
---

# slang#8373 — `layout(std430) cbuffer` silently gets std140

**State: ANSWERED, no longer mine.** Maintainer `jkwak-work` asked `@nv-slang-bot` "is the issue
still reproducible?" (comment `5195777322`, 2026-08-05T18:36Z). Verdict posted as
[comment 5196687829](https://github.com/shader-slang/slang/issues/8373#issuecomment-5196687829)
2026-08-05T19:58Z. Issue reassigned attention to `zangold-nv`. **No RESUME trigger** — if a human
replies substantively, that's a fresh chain input.

## The finding (both asks reproduce)

1. **Wrong ArrayStride.** `layout(std430) cbuffer` → `ArrayStride 16` (std140).
2. **Missing diagnostic.** Same source to `-target hlsl` → **exit 0, silent**, plain
   `cbuffer CBlock_0 : register(b0)`.

**Cause is purely the PARSER GATE, not type-layout** — `source/slang/slang-parser.cpp:4189`:
`if (parser->options.allowGLSLInput && parser->pendingModifiers)`. False ⇒ falls through to
`ParseBufferBlockDecl(parser, "ConstantBuffer")` with **no layout arg** ⇒
`GLSLLayoutRulesFamilyImpl::getConstantBufferRules` (`slang-type-layout.cpp:2020-2058`) defaults to
`kStd140LayoutRulesImpl_`. The type-layout side **already dispatches correctly** on an explicit
layout type; the modifier never arrives.

⛔⭐⭐⭐ **REFINED by the triager's GUILTY CONTROL, and it beats my silence-only read.** I inferred
"the modifier never reaches" type-layout — correct, but **silence cannot distinguish *unparsed* from
*parsed-and-discarded*, and the two imply different fixes.** Their control: same file, same
invocation, `std430` → `zzznotalayout` ⇒ **exit 255, `error[E31217]`** (reproduced on my edge). So the
diagnostic channel is **live without `-allow-glsl`**, and `parseLayoutModifier` runs
`CASE(std430, GLSLStd430Modifier)` **ungated** — verified at master: `slang-parser.cpp:10478`, with
**zero** `allowGLSLInput` references between the function start (`:10385`) and that case. Only the
**consumer** at `:4189` is gated. ⇒ **The parse side needs no work; the fix is the gate + a new
warning.** Appended to the public comment (2026-08-05T20:15Z).

⭐⭐ **A guilty control is the natural partner of an innocent one:** I ran the *innocent* control (a
flag that makes it work) and stopped; they ran the *guilty* one (an input that must fail) and learned
what the silence meant. **When a channel is silent, prove the channel works before concluding the
feature is absent.**

⭐⭐ **The one-flag differential is what made this airtight and cheap** — same file, same binary,
only `-allow-glsl` added:

| | ArrayStride | struct name |
|---|---|---|
| without `-allow-glsl` | **16** | `..._std140` |
| with `-allow-glsl` | **8** | `..._std430` |

⇒ It **isolates the gate as the sole cause** and simultaneously proves the std430 path itself is
healthy. Reach for a toggle differential before reading any source: it converts "I believe the gate
is why" into a measurement, and it told me the fix is small (remove a gate) rather than large.

## Fix status — the trap worth remembering

Referenced fix **PR #8432** ("Fix std430 layout support for cbuffers in .slang files", author
`Copilot`, branch `copilot/fix-8373`) is **`draft: true`, `merged_at: null`, closed 2025-10-28** —
i.e. *closed unmerged*. It carried both halves plus `tests/spirv/cbuffer-std430-layout.slang`.
⚠️ **That is a fact about the PR, never about master.** I dispatched it to the triager with exactly
that caveat and then verified by compiling, not by inferring.

⛔⭐⭐ **`39012` IS TAKEN — and this is the failure a "confirm the PR's claim" reading would have
produced.** The PR proposed diagnostic id `39012` for the layout-qualifier warning. At master
`39012` exists but is **"bindless space index unavailable"**, unrelated. So "39012 is present"
is TRUE and means the OPPOSITE of "the fix landed". The only GLSL layout diagnostics at master are
`31216`/`31217`, both for an *unrecognized* qualifier — neither covers *recognized but
unsupported-on-this-target*. ⇒ **A reviver needs a NEW id.** Searching for the artifact a PR
promised and finding the number is not finding the feature — read what the number *is*.

## ⛔ I posted a bot comment with NO 🤖 disclaimer — and did not notice across two edits

The triager caught it (overriding my "no reply needed" — **correctly: a defect in a public artifact
outranks a sign-off**) and patched it in place: len 4176→4286, `updated 20:20:01Z`, comments still 4.
Verified on my edge: disclaimer count **exactly 1** at line 34, non-zero control (`ArrayStride` → 3)
proves the grep works, refinement paragraph + all 6 bullets intact, 0 HTML-escaping.

⭐⭐⭐ **The transferable failure: I reviewed the comment's CONTENT twice — drafted it, then appended a
refinement — and never once checked its ENVELOPE.** Structural requirements (provenance footer,
label, format) are invisible to a correctness review, because nothing in the content looks wrong.
⇒ **Check the envelope on the same pass as the content, or it never gets checked at all.**

⚠️ **Scope this honestly — I could not find a documented mandate.** Not in `CLAUDE.md`,
`CLAUDE.local.md`, or [[feedback_github_comment_hygiene]]; it appears as *verified practice* in
several chain memos ([[project_11969_metal_out_param_addrspace]],
[[project_11981_metal_export_out_param_addrspace]] flags a *missing* one as a defect). Enumerated 6
recent `nv-slang-bot[bot]` comments: **3 carry it, 3 don't** (`5179233988`, `5195640966`,
`5196649835` — all on #12338, all authored by another chain). So it is **real convention, unevenly
applied**, and the triager's "every comment must carry it" is the right norm even though I couldn't
source it. ⇒ **Do it by default.** The three gaps belong to #12338's owning chain, not to me — noted,
not reached into ([[feedback_group_clone_is_shared_by_all_sibling_sessions]]: direct edges only).

## Instrument notes

- **Prebuilt `slangc` at `/workspace/agent/slang/build/Release/bin/slangc`** (mtime 2026-08-04
  07:50, built at `0864e60e6`) — no build needed for a repro check. `slangc -v` prints only a
  build stamp (`1785829848`), not a commit, so **attribute the binary via mtime → `git log --until`**.
- ⭐⭐ **Staleness closed by DIFFING THE FUNCTION, not by trusting the commit distance.**
  `git show <build-commit>:file` vs `git show master:file` vs the **GitHub blob** — all three
  byte-identical for `parseHLSLCBufferDecl`. That licenses "measured with an older binary, but the
  responsible code is unchanged at master", which a bare commit-count could not.
- ⛔ **MY clone is SHALLOW (`is-shallow-repository` → true, 11 commits, `.git/shallow` present).** So
  `git log -S` over it is near-worthless — the subagent's "only one commit touches `allowGLSLInput`"
  was an artifact of depth 11, not history. It reported the search honestly; the depth is what made
  it uninformative. Use the GitHub blob as the independent instrument.
  ⛔⭐⭐⭐ **BUT I PUBLISHED THIS AS "the group clone is shallow" — TWICE (memory row + the message to
  the triager) — FROM ONE CONTAINER'S MEASUREMENT. The triager's clone at the SAME ABSOLUTE PATH is
  NOT shallow: 6744 commits, oldest `52e8d4b9a 2017-06-09 Initial commit`, no `.git/shallow`.**
  Depth is **per-container**, exactly like the memory store
  ([[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]] settled the same shape
  for `/home/node/.claude`). ⇒ **Say "shallow on my edge", never "the clone is shallow"** — the
  over-wide version tells a peer to distrust a `git log -S` that is actually sound, and the triager
  said it nearly skipped one it didn't need to. Same lesson as
  [[feedback_publish_a_claim_as_wide_as_your_evidence]]: the evidence was one checkout; the claim
  named the fleet. See [[feedback_group_clone_is_shared_by_all_sibling_sessions]] — shared *within*
  a group, so read-only regardless.
- `/workspace/extra/ephemeral` is **read-only**; scratch goes in `mktemp -d /tmp/...`.
- ⚠️ **`slangc … | head -3` reports exit 141 (SIGPIPE), masking a real 255** (triager's disclosure).
  **Never read an exit code through a pipe** — redirect to a file, then `head` it.
- ⚠️ **The Release tree lacks `libslang-glslang`** (it lives under `build/Debug/lib/`), so anything
  needing `spirv-opt` fails there with `E00100 failed to load downstream compiler`. `-target
  spirv-asm` does not need it; a full `-target spirv` may. The triager's first whole matrix was void
  this way — **including its control**, which is what made it detectable.
- ⚠️ **A repro must contain the construct being measured:** their first attempt had no array member,
  so std430-vs-std140 stride was *structurally unobservable* and read as "doesn't reproduce". Same
  class as a grep over a projection lacking the column.
- ⛔⭐⭐⭐ **`&&` BETWEEN CONTROL PROBES SILENTLY SKIPS THE CONTROLS** (triager's disclosure, the
  sharpest thing on this chain). `grep -c` **exits 1 on zero matches**, so `grep -c X && grep -c Y`
  aborts right after printing the `0` — their non-zero and must-hit controls **never ran**, and the
  output looked like a clean confirmation of my zero claim. **Nastier than the void matrix: there the
  control visibly failed; here it silently didn't execute.** ⇒ **Use `;` not `&&` between control
  probes — a control's exit status is not a reason to stop asking.** ⚠️ Their re-run agreed with the
  first output, which they correctly called **over-determination, not adequacy** — *the right answer
  from a broken instrument is still a broken instrument.*
- `mcp__slang-mcp__github_get_file_contents` returns a bare `404` for a path that doesn't exist at
  master — usable as an absence probe, but `gh api contents` + `base64 -d` gives more.

Related: [[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] (how this chain was
recovered), [[project_fixer_restart_tripwire]].
