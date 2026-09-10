---
name: project_12402_slang_attr_namespace_unowned
description: "#12402 `_slang_attr` unreserved → duplicate Metal/WGSL output location. Own-bot echo, ZERO dispatch, but I posted one additive finding: the resolver ALREADY handles this prefix (control C) — the real gap is ORDERING, census runs before synthesis."
metadata:
  node_type: memory
  type: project
  originSessionId: c0b27b29-8538-4c9a-8d53-946f50d35e96
---

**shader-slang/slang#12402** — "`_slang_attr` is reserved only by convention: user-written `: _slang_attr1` silently duplicates an output location (Metal + WGSL)". Filed **2026-08-06T16:58:45Z by `nv-slang-bot[bot]`**, no labels, no assignee, 0 comments. Canonical thread `gh-issue-shader-slang/slang-12402`.

## Routing: own-bot echo ⇒ ZERO dispatch (no triager, no fixer)

Same class as [[project_12320_coverage_macos_segfault_base_rate]] / [[project_12337_backend_codegen_compile_time_pattern]]. Provenance is our own **#8183 chain**: the body says so explicitly ("while prototyping a fix for #8183 — in an **abandoned, unlanded** patch"). The #8183 chain is live and correctly parked: draft PR **#12155** (`fix/issue-8183`, assignee `jkwak-work`, still `draft=true`, last commit 16:59:15Z — the fixer was actively polishing comments in the same minute this issue was filed).

⛔ **Checked the [[project_12333_dev_null_output_path_tests]] escape hatch and it does NOT apply**: no maintainer commissioned this filing. Zero issue comments, zero review comments, zero reviews on #12155 — so no `pdeayton-nv`-style "please file an issue" request exists. Body itself says *"Filing for visibility rather than proposing a patch."* ⇒ echo rule holds, no dispatch. The body already IS the triage writeup.

## But I posted ONE additive finding — comment [5207773300](https://github.com/shader-slang/slang/issues/12402#issuecomment-5207773300)

Per [[project_12337_backend_codegen_compile_time_pattern]]: **own-bot echo is a reason not to RE-DO the work, never a reason to withhold NEW verified content.**

**Reproduced at `master` d7d59f374** with `build/Release/bin/slangc`. ⚠️Binary mtime 08-04 07:50 predates clone HEAD (08-06) — checked currency the right way: last commit touching `slang-ir-legalize-varying-params.cpp` is **`0864e60e6` (08-04 04:18)**, i.e. *before* the binary was built ⇒ binary is current **for this file**. (Generalizing "binary older than HEAD ⇒ stale" would have wrongly blocked the repro; the per-file question is the answerable one.)

Confirmed exactly as filed: `[[user(_SLANG_ATTR_1)]]` ×2 on Metal, `@location(1)` ×2 on WGSL, `EXIT=0`, no diagnostic. Also confirmed the negative claim: `grep -rn '_slang_attr' source/ include/` = **exactly 2 hits** (`:3218` `packStageInParameters`, `:3307` `ensureStructHasUserSemantic`), no reservation check anywhere.

### The four controls — C is load-bearing and MOVES the root cause

| # | source | Metal |
|---|---|---|
| A | `a : COLOR1; b : COLOR1` | `COLOR_1`/`COLOR_2` — resolved |
| B | `a; b` both bare | `_SLANG_ATTR`/`_SLANG_ATTR_1` |
| **C** | **both `: _slang_attr1`** | **`_SLANG_ATTR_1`/`_SLANG_ATTR_2` — RESOLVED** |
| D | `a : _slang_attr7; b` | `_SLANG_ATTR_7`/`_SLANG_ATTR_1` — no collision |
| E | `a : _slang_attr2; b; c` | `_2`/`_1`/**`_2`** — collides |

⭐⭐ **Control C falsifies the filing's stated mechanism.** Body says the resolvers "do not synthesize one for a bare field, so they do not catch either case." But when BOTH fields carry user-written `_slang_attr1`, `fixFieldSemanticsOfFlatStruct` fixes it — so the prefix is **already bucketed and already renumbered** by `usedSemanticIndexSemanticDecor` (`:3858-3864`). The limitation is not inability to synthesize; **it is ORDERING**: both call sites run census-then-synthesis (output `:3993-3994`, input `:3106-3107`), so the `_slang_attr` added at `:3307` post-dates the census that would have caught it.

⇒ **Opens a THIRD option the filing does not list**, smaller than both of its two (reserve the prefix / build a single allocator): make the synthesized indices visible to the census that already exists. The synthesized inst is an `IRSemanticDecoration(name=_slang_attr, index)` — exactly the shape the census already handles.

⚠️**Limit I stated in the comment and must keep stating: I did NOT test a reordering.** Swapping the two calls changes what the census sees on every varying path (in AND out); the census also rewrites layouts via `_replaceAttributeOfLayout`, and `ensureStructHasUserSemantic` consumes layout offsets itself. Reported where the gap is, explicitly did not propose the patch.

### Severity refined in both directions (D and E)

- **Narrower** (D): needs user index `N` == the layout offset a bare field lands on. `_slang_attr7` with 2 outputs does not collide.
- **Wider** (E): not specific to `_slang_attr1` — bare fields take consecutive offsets, so any `N` within the output count hits. Colliding set **grows with varying count**, not one unlucky value.

Agreed with the filing's low-severity call and maintainer-decision framing.

## RESUME

Only on a substantive **human** (non-bot) comment on #12402, or if a maintainer picks up either suggested direction. **Do NOT dispatch a fixer** — this is a maintainer design call, and item 2 is a live hazard for whoever finishes #8183, so it belongs to that chain's reviewer. Related: [[project_8183_wgsl_metal_displacement_segfault]] (provenance, draft PR #12155 held), [[project_bot_comment_webhook_echo]] (echo rule), [[project_12333_dev_null_output_path_tests]] (the commissioned-filing exception, checked and absent here).
