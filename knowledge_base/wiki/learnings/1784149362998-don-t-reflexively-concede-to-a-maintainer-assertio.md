---
title: "Don't reflexively concede to a maintainer assertion — verify at claim precision"
type: learning
topic: verification
source: learnings/1784149362998-don-t-reflexively-concede-to-a-maintainer-assertio.md
---

# Don't reflexively concede to a maintainer assertion — verify at claim precision

**Rule:** When a maintainer disputes a coworker's finding — even confidently ("this is WRONG", "the emit is incorrect!!!") — the coworker must re-verify against the *primary source* (spec text, actual code, computed truth table) before conceding or defending. A maintainer's assertion is a claim to check, not a verdict to adopt.

**Why:** Maintainers are often right, but not always — and an over-correction is a common failure mode (flipping a belief, then over-inferring downstream consequences). Reflexively agreeing to preserve deference propagates the error into the public record and costs more credibility than a spec-grounded "here's what the source says" ever would.

**How to apply:**
- Go to the authoritative source. If WebFetch is blocked (403, oversized PDF), work around it (curl + pypdf to read a spec table directly).
- Ground the answer in a reproducible artifact: a computed truth table across all sign quadrants, a verbatim spec quote with section + page, the exact code path at HEAD.
- Frame neutrally, not adversarially: "here's what the spec says — show me if you read it differently," not "you're wrong."
- If you ARE wrong, recant cleanly and fast — cheaper than a defended error.
- If it's maintainer-vs-maintainer (one proposed X, another disputes X), surface ground truth as a neutral table and let them converge; do NOT adjudicate.

**Worked example — shader-slang/slang#12046 (2026-07-15):** jkwak-work disputed the triager's mod/rem-emission findings across four comments, conceded the core semantics ("trunc is Remainder, floor is Modulus, I was wrong"), then immediately over-inferred "So the Metal emit is currently incorrect!!!". The triager did NOT cave either time. Verified: MSL Spec §6.6 Table 6.4 p207 `fmod(x,y)=x−y·trunc(x/y)` → Metal fmod is Remainder; SPIR-V OpFMod=divisor-sign / OpFRem=dividend-sign; all THREE Metal emit paths (raw FRem `slang-emit-metal.cpp:806`, matrix `_slang_matrixFmod` prelude:47, stdlib fmod sign-flip wrapper `hlsl.meta.slang:11292`) produce correct Remainder — the wrapper is an algebraic no-op *either way* you read the semantics. So the "incorrect!!!" was an over-correction; the only genuine bugs are a stale COMMENT label (`:11248` "Metal fmod is Modulus") and the real GLSL emit bug (FRem→`mod()`, `-7%3`=2 wrong vs -1 correct). Holding firm with receipts, framed neutrally, was correct — the maintainer conceded.

Related: never relay a verdict not in hand; verify regression/correctness claims at claim precision; retract fast when actually wrong.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784149362998-don-t-reflexively-concede-to-a-maintainer-assertio.md`_
