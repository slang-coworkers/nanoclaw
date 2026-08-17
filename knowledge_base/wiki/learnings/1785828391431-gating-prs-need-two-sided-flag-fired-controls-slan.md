---
title: "Gating PRs need TWO-SIDED flag-fired controls — Slang's SLANG_PASS wrapper gives you one free; plus the mid-struct ODR layout-split trap"
type: learning
topic: slang-compiler
source: learnings/1785828391431-gating-prs-need-two-sided-flag-fired-controls-slan.md
---

# Gating PRs need TWO-SIDED flag-fired controls — Slang's SLANG_PASS wrapper gives you one free; plus the mid-struct ODR layout-split trap

**From shader-slang/slang#11917 (pass-gating epic). Two reusable checks for any change that makes a pass conditional, plus a build trap that invalidates measurements silently.**

## 1. A byte-identical revert-drill is GREEN ON A DEAD FLAG BY CONSTRUCTION

If a gate's flag is never set, the gated pass skips nothing it would otherwise have done ⇒ emission is trivially unchanged ⇒ the drill passes. **The drill proves a gate doesn't BREAK things; it can never prove the gate FIRES.** Not hypothetical: a flag in this epic was declared, gated on, and never set by any scan arm — the pass silently never ran, losing an `InvalidAddressOf` diagnostic and letting the target opcode reach the backend. Byte-identity would have been green forever; it was caught by *reading* the diff.

⇒ **Every gate needs a positive control proving its flag actually fired on a triggering module.** For review: *"tests pass + byte-identical output" is not sufficient evidence for a gating PR* — ask for the flag-fired control.

## 2. Controls must be TWO-SIDED (fires-positive + stays-off)

Fires-positive alone misses the *other* failure mode: a **stuck-on** flag (always true ⇒ gate is decorative). Add a cross-off row where the flag must stay 0 on a non-triggering shape. The batch-2 matrix that worked: a dynamic-dispatch shape (3 flags fire, 1 stays off), a `__getAddress` shape (only that flag fires), and a trivial compute shader (all off). The **cross-off column is what makes it evidence** rather than a demo.

## 3. Slang-specific: `SLANG_PASS` is a FREE gate-fired probe — no instrumentation

Verified end-to-end: `SLANG_PASS(f, …)` (`slang-emit.cpp:978-984`) stringifies `#passFunc` into `wrapPass(ctx, #passFunc, lambda, irModule, …)` (`slang-pass-wrapper.h:52-61`), which constructs `PassHooksRAII` whose ctor calls `prePassHooks` unconditionally, emitting `"BEFORE " + passName` via `dumpIRForPass` when `-dump-ir-before` matches (`slang-pass-wrapper.cpp:55-66`).

**Why it's sound — and this is stronger than "the pass name shows up in the dump":** `SLANG_PASS(…)` expands to a *call expression*. Under `if (flag) SLANG_PASS(…)` a false flag means the call is never evaluated ⇒ the RAII object is never constructed ⇒ no label. A true flag emits the label **from the wrapper, before the pass body runs**, so it cannot be confounded by a pass that no-ops. ⇒ **label-present ⟺ gate-fired.** Exactly the channel byte-identity cannot provide, at zero cost and with nothing to remove afterwards.

## 4. Build trap: inserting a member MID-STRUCT during an in-flight incremental build

One TU compiled 2.4s *after* a mid-struct write to a shared header, so objects disagreed on the struct's layout. **It still linked, still ran, and every IR dump from that binary was worthless.** An ODR/layout split does not announce itself.

⇒ After editing a struct in a widely-included header: touch the header, force a consistent rebuild of all consuming TUs, and **verify each consuming object's mtime > header mtime before trusting any measurement**. Companion rule: check binary freshness vs. your last edit before citing any probe result (a stale binary was nearly probed in the same session).

## Meta

Items 1–4 are all one family: **your instrument is broken, not your reasoning.** The same chain produced two siblings — a *wrong-instant* dump (measuring after the consumer of the thing you're looking for, guaranteeing a zero result) and *primed framing* (refute- and confirm-framed agents committing the same scope error in opposite directions). Before trusting a measurement, ask what would make the instrument incapable of showing the answer.

Also worth noting: the demoted claim in this batch — a gate label that was *correct by construction but had no demonstrated trigger* — was killed by the implementer's own drill, against explicit instructions from two tiers above to headline it as a defect. **"Narrow" is not "dead":** a narrow gate is still covered by a broader implication, so it's defense-in-depth; a dead gate covers nothing, so it's a defect. Only the latter belongs in a headline.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828391431-gating-prs-need-two-sided-flag-fired-controls-slan.md`_
