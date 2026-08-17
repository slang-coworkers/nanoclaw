---
title: "slang#12258 MetalLib-3.2 — the -std derivation machinery already exists; only the producer + capdef atom are the gap"
type: learning
topic: slang-compiler
source: learnings/1785287353987-slang-12258-metallib-3-2-the-std-derivation-machin.md
---

# slang#12258 MetalLib-3.2 — the -std derivation machinery already exists; only the producer + capdef atom are the gap

**Issue #12258 (jkwak-work, maintainer): "Upgrade Metal compiler support on Windows to MetalLib 3.2."** The issue body reads as a big five-part feature (toolchain upgrade + capability plumbing + `-std` flag + Windows CI + docs). Triage-critical finding: the hardest-sounding compiler piece is **already done**, and the real work splits cleanly into a tiny code change vs. a large infra task the bot can't touch.

**What already exists (verified @ HEAD ea711ddcb):** PR #12009 (for issue #12096, "metal4.0 -std regression") landed a general `-std=metalX.Y` derivation:
- `source/compiler-core/slang-gcc-compiler-util.cpp:978-988` builds `-std=metal<maj>.<min>` from `options.metalLanguageVersion` when set; literal `-std=metal3.1` only as the unset fallback.
- Producer `source/slang/slang-code-gen.cpp:782-786` sets `metalLanguageVersion = (4,0)` — but ONLY special-cases `metallib_4_0`. Everything else falls through to the literal 3.1 default *by coincidence*, not derivation.
- capdef `source/slang/slang-capabilities.capdef:186-208` is a linear inherit chain 2_3→2_4→3_0→3_1→4_0, no `metallib_3_2`.

**So the code gap for a new metallib_X_Y is only:** (1) add the capdef atom (retarget the next atom to inherit it) + regenerate the auto-doc; (2) GENERALIZE the producer to set the version from the *highest implied* metallib atom (not a growing if/else ladder — matches the "one source of truth" convention). The emitter/`-std` assembler need NO change. Adding the atom alone does nothing (target would still emit `-std=metal3.1`) — sub-tasks "add capability" and "pass -std" are coupled at the producer. A source/emit-level FileCheck (extend `tests/metal/threadgroup-size.slang`, which already contrasts `-capability metallib_4_0` vs `metallib_3_1`) verifies this in CI *without* an Apple toolchain.

**What the bot CANNOT do (the headline acceptance criteria):** upgrade the Windows Apple-Metal toolchain dependency, add a Windows CI job producing/verifying a real `.metallib`, own the toolchain docs. No toolchain-release decision, no `.github/workflows/*` write (App lacks `workflows`), no Windows+Metal runner to verify. A code-only PR is a partial contribution behind an infra dependency, not a close.

**Triage disposition:** maintainer-authored + assigned to a *named human* (jkiviluoto-nv) + no bot @-mention + infra-gated headline ⇒ PARK-at-triaged (post verdict, set Type=Feature, hand fixer the briefing but HOLD — no unprompted PR). This is the "different-human-assignee" flavor of park; NOT the "self-filed+self-assigned→no fixer at all" rule.

**Lesson:** on a Metal `-std`/metallib-version feature request, check `slang-code-gen.cpp` + `slang-gcc-compiler-util.cpp` FIRST — since #12009 the version machinery is generic and most of the perceived work is already shipped. Separate the small verifiable compiler slice from the infra slice before estimating scope or dispatching a fixer.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785287353987-slang-12258-metallib-3-2-the-std-derivation-machin.md`_
