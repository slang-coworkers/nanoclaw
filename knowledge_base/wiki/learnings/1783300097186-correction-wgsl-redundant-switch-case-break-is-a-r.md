---
title: "CORRECTION: WGSL redundant switch-case break IS a real bug (older naga rejects) — verify across toolchain VERSIONS, not just current source"
type: learning
topic: verification
source: learnings/1783300097186-correction-wgsl-redundant-switch-case-break-is-a-r.md
---

# CORRECTION: WGSL redundant switch-case break IS a real bug (older naga rejects) — verify across toolchain VERSIONS, not just current source

## Corrects an earlier learning (slang #11946)
My earlier note said the trailing `break;` Slang emits in WGSL switch cases is "valid (redundant), not invalid" and downgraded #11946 to P3-cosmetic/needs-info. **The reporter then supplied a concrete error and it flipped to a confirmed P2 target-emit bug.** Both conclusions were partially right — here's the reconciliation and the lesson.

## What actually happens
- **Current naga (v0.19 → trunk) and Tint ACCEPT** a trailing `break` in a switch case — verified by reading naga's real validator source (`naga/src/valid/function.rs`: the switch block grants `ControlFlowAbility::BREAK` to case bodies and preserves it through nested `Statement::Block`s; error Display says "outside of a `loop` or `switch` context").
- **Older naga REJECTS it** with `break outside of loop` (no "or switch"). The reporter hit this via **gogpu → wgpu-native**, which pins an older naga (pre-v0.19, the standalone `gfx-rs/naga` era). Deployed WGSL runtimes lag the naga trunk by a lot.
- The `break` is genuinely **redundant** (WGSL cases don't fall through), so emitting the idiomatic **break-free** form is a semantic no-op that works on old naga + current naga + Tint. That's the fix (WGSL-gated suppression of the terminal switch-exiting break; keep meaningful early breaks).

## Lessons (the important part)
1. **"Valid per current source" ≠ "not a bug."** A real user error report from a deployed toolchain outranks source-level "the spec/current-validator allows it" reasoning. If a real consumer rejects our output and a trivial idiomatic change makes it accepted everywhere, it's a codegen bug worth fixing — don't over-conclude "works as intended" from trunk source alone.
2. **Verify across toolchain VERSIONS.** DeepWiki (and reading trunk) gave the *current-naga* answer; the reporter runs an *older* naga. When a report contradicts your "it's valid" finding, suspect a version gap and check older tags before doubling down.
3. **When WebSearch/Explore are down, `gh api repos/OWNER/REPO/contents/PATH?ref=TAG --jq .content | base64 -d` fetches exact source at any tag** — I diffed naga's break/switch validator across wgpu-v0.19/0.20/22/trunk this way to pin the behavior. (naga moved into the wgpu monorepo ~v0.19; pre-v0.19 lives in gfx-rs/naga.)
4. Don't let a persuasive negative finding make you dismiss a reporter — ASK for their exact tool + error (I did, on GitHub), which is what surfaced the truth.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783300097186-correction-wgsl-redundant-switch-case-break-is-a-r.md`_
