---
title: "Locationless IR-pass diagnostics on imported-module structs: fix at emission, not key creation"
type: learning
topic: slang-compiler
source: learnings/1780418999087-locationless-ir-pass-diagnostics-on-imported-modul.md
---

# Locationless IR-pass diagnostics on imported-module structs: fix at emission, not key creation

**Symptom:** Warnings raised from IR passes (e.g. E31106/E31107 parameter-group leak during `ConstantBuffer` legalization; E41021 synthesized-ctor uninitialized-field) emit with **no `file:line`** when the struct involved is imported from a precompiled `.slang-module`. Single-file uses show a location fine. (shader-slang/slang#11395, PR #11424.)

**Root cause:** These diagnostics derive their location from an IR instruction's `sourceLoc` — typically the leaked/uninitialized member's `IRStructKey`. When the struct is deserialized from a precompiled binary module, its field keys carry no source location that resolves in the *consuming* compile. The rich-diagnostics (span) renderer **drops `file:line` entirely when the resolved SourceLoc has `line == 0`** — so you get a message with no location, not a wrong location.

**Dead-end (verified empirically — don't repeat it):** Stamping the key's loc at creation (`irFieldKey->sourceLoc = fieldDecl->loc` in `lowerMemberVarDecl`, slang-lower-to-ir.cpp) does **NOT** fix the imported case — the loc-less key lives in the *consumer* after deserialization, untouched by consumer-side lowering. AND it's redundant for in-source keys: the IRBuilder already stamps them via `IRBuilderSourceLocRAII` (lowerDecl → createStructKey → _maybeSetSourceLoc). Removing the explicit stamp left 4/4 guard tests green.

**Correct fix — at the diagnostic emission site:**
1. Give the diagnostic an explicit `.location` field (in slang-diagnostics.lua, `span { loc = "location" }` instead of `loc = "member:IRInst"`).
2. At emission, fall back to a *use-site* location when the originating inst's loc is invalid: `loc.isValid() ? loc : findFirstUseLoc(type_or_func)`. For E31107 the fallback is the parameter group's use site (the `ConstantBuffer<>` decl in the consumer); for E41021 it's the constructor's use site.

**Gotchas:** `findFirstUseLoc` returns the first use whose user has a *valid* sourceLoc, else the inst's own (possibly invalid) loc — so the fallback isn't a hard guarantee, just recovers the common consumer-side case. `SourceLoc::isValid()` = raw offset ≠ 0, which doesn't guarantee renderability. A regression test must precompile a module (`//TEST:COMPILE: mod.slang -o stem.slang-module`) and import it (`-I dir` + `import` with hyphens→underscores) — a single-file test cannot reproduce the loss.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780418999087-locationless-ir-pass-diagnostics-on-imported-modul.md`_
