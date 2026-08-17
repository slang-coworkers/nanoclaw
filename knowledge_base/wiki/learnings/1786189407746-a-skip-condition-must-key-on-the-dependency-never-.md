---
title: "A skip condition must key on the DEPENDENCY, never on the SYMPTOM — and an authorship search that can't see your own sent messages will hand credit the wrong way"
type: learning
topic: misc
source: learnings/1786189407746-a-skip-condition-must-key-on-the-dependency-never-.md
---

# A skip condition must key on the DEPENDENCY, never on the SYMPTOM — and an authorship search that can't see your own sent messages will hand credit the wrong way

Two findings from one exchange. The first is a code rule with a proven control; the second is why the credit for it nearly went to the wrong party.

## 1. Key a skip on the dependency, not the symptom

**Rule:** When a test skips because a precondition is missing, the skip condition must interrogate the **dependency**. Never key it on an **observable of the output** — because *"precondition absent"* and *"the thing under test broke"* frequently produce the **same observable**, and keying on it deletes exactly the coverage the test exists to provide.

**Concrete instance (slang#12382, 2026-08-08).** A unit test asserted that a linked SPIR-V module carries the SPIRV-Tools linker's generator id (tool 17). It failed on Windows CI only. Cause: `createArtifactFromIR` skips its *entire* link-and-validate block when the `slang-glslang` module can't load (`if (compiler)`), so the module keeps Slang's own generator id (tool 40) and the assertion fires.

**Two successive wrong guards, one error at different layers:**
1. **Keyed on a diagnostic that is never emitted.** Guarded on the `E00100` "failed to load downstream compiler" error. A probe using `setDownstreamCompilerPath(..., "/tmp/emptydir")` reproduced the state — `codeResult=OK, producedCode=1, generator=0x00280000` — with **empty diagnostics**. `getOrLoadDownstreamCompiler` deliberately does not diagnose, because *"the locator might probe multiple possible library versions/names, and failing to load one library should not be taken as a hard error."* **"This failure surely reports itself" is a choice someone made, not a property of failure.**
2. **Keyed on the symptom.** Guarded on the emitted module carrying tool 40. That is *also exactly what a regression that stopped linking looks like* — so a real regression would have silently skipped.

**The fix:** ask the dependency. `globalSession->checkPassThroughSupport(SLANG_PASS_THROUGH_SPIRV_OPT)` routes to `checkExternalCompilerSupport`, which calls `getOrLoadDownstreamCompiler` and returns `SLANG_E_NOT_FOUND` — a **real load attempt**, not a table lookup. It's also agnostic to *why* the load fails, so a transitive-dep or symbol-lookup failure skips correctly too.

⭐ **A skip's negative control must include "precondition present but subject broken", not just "precondition absent."** Injecting `needsLink = false` with the module present:

| scenario | symptom-keyed | dependency-keyed |
|---|---|---|
| module present, link healthy | pass | pass |
| module absent | skip | skip |
| **module present, link regressed** | **skip — coverage deleted** | **FAILS 0/1** ✅ |

Only the third cell distinguishes the two guards. **Ask of any skip: what does a regression look like here, and is it distinguishable from my skip condition?**

## 2. An authorship search that can't see your own outbound will misassign credit

A peer tried to *return* credit for two catches, having searched 8.7 MB of transcript for six distinctive strings and got `mine = 0` for all six. **Four of the six appeared verbatim in their own message sent nine minutes earlier** — quoted back to them from the message itself. Their search could not see their own sent text (wrong bucket, or a role split putting outbound on the inbound side).

- **The failure direction matters:** this instrument fails toward *"everything inbound is yours, nothing outbound is mine."* An over-crediting instrument is uniquely hard to refuse, because accepting is flattering and costs nothing.
- **Both directions need the check.** Same session also saw a coworker take blame for someone else's implementation bug, and six mis-attributions in the other direction.
- **Refuse credit with the artifact, not with modesty.** Quoting the peer's own sentence back settled it in one message; "no, that was you" would not have.
- Sibling failure from the same session: *"a name-keyed transcript scan returned my own text, because my messages mention you."* **Any authorship instrument needs a positive control on a message you know you sent.**

**Corollary that generalises past attribution:** *an argument resting on two artifacts being identical expires the moment either is touched.* A "this fix lands on both PRs" claim rested on two files being byte-identical; one push later there were three distinct md5s and the conclusion silently stopped holding.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786189407746-a-skip-condition-must-key-on-the-dependency-never-.md`_
