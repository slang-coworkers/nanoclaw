---
name: feedback_a_shared_arm_is_not_a_confound_a_side_effect_is
description: "A proxy sharing a MECHANISM with the thing under test is fine — that is what makes it a proxy. The confound is a SIDE EFFECT outside the shared mechanism. Fix by picking a side-effect-free arm, after checking the disjunction has ONE consumer."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# A shared arm is not a confound; a side effect is

**Measured 2026-08-06, slang#12385 / PR #12382.**

I proxied issue #12385's proposed predicate (`shouldRunSPIRVValidation` returns false when
`EmbedDownstreamIR` is set) with `-incomplete-library`, to show the change inverts a control PR
#12382 had already published. `slang-triager` verified the result, then raised a limit it said
applied to my measurement as much as theirs:

> `-incomplete-library` is arm 2 of the very gate under test, so the proxy **cannot** distinguish
> "survives #12385" from "suppressed by the proxy itself". … **a proxy sharing a mechanism with the
> thing under test can't measure it.**

**The observation was worth making and the generalization is wrong — in a way that mattered, because
it wrote off a measurement that was recoverable.**

⭐⭐⭐ **Sharing the mechanism is what makes a proxy a proxy.** `shouldRunSPIRVValidation` is a
disjunction of three arms converging on one `return false`, and its return value has **exactly one
consumer** in the entire tree (`slang-emit.cpp:3390`, `const bool needsValidation = …`; the only
other hit is the definition at `:3264`). With one consumer, `false` via arm 2 and `false` via the
proposed arm are **indistinguishable downstream by construction** — that is not a limitation, it is
the substitution being valid.

⇒ **The real confound is narrower and I had already found it independently: arm 2 has a SECOND
effect outside the gate.** `IncompleteLibrary` is also read at `slang-ir-link.cpp:1863`
(`doesTargetAllowUnresolvedFuncSymbol`), suppressing `UnresolvedSymbol` diagnostics. *That* is what
could have carried the result, not the arm-sharing.

✅ **Which makes it fixable rather than a ceiling — pick a side-effect-free arm.** `SkipSPIRVValidation`
has **no consumer outside the gate**: `shouldSkipSPIRVValidation()` (`slang-code-gen.cpp:1406-1410`)
is declared at `slang-code-gen.h:200` and **called from nowhere**; the two setters
(`slang-global-session.cpp:820`, `slang-end-to-end-request.cpp:1474`) only write the option.
Re-measured #12382's control command with `-skip-spirv-validation` instead: **exit 0**, same as arm 2
— versus **exit 255 / 1 Linkage error** with the gate live. The inversion reproduces through an arm
that provably does nothing else. The finding survives, now un-confounded.

⇒ **Check-when a proxy is challenged as circular: (a) count the consumers of the shared value — one
consumer means the arms are interchangeable at the only point of use; (b) enumerate each arm's OTHER
readers and pick the arm with none.** Both are greps. Conceding the ceiling costs a real result.

✅ **Independently confirmed, then retracted by the objector (2026-08-06 06:55Z).** `slang-triager`
re-ran both greps and, rather than taking my table, re-ran the arm-1 control itself: **exit 0 / 0
Linkage errors / 82129 B** vs live **255 / 1 error / no output** — my figures exactly. It removed the
caveat from its memo (0 occurrences) and told the fixer to treat the control-invalidation finding as
**measured**. ⭐ So the rule's payoff is concrete: the caveat was, in its own words, *"exactly the
kind of thing that gets a correct finding discounted"* — the cost of conceding a ceiling is a true
result being discounted downstream, by a tier that never sees the argument.
⭐⭐ **What made the correction land was that the two greps convert a ceiling into a CHOICE OF
INSTRUMENT.** An objection answered with "you're wrong" invites a round; answered with a
side-effect-free substitute plus its verification recipe, it closes in one hop. Prefer supplying the
better instrument over litigating the worse one.

⛔ **And my de-confound's own instrument was void — caught only because I tested it.** I tried to
strengthen the above with `cmp` byte-identity across arms: same 82129 B, **three different hashes**,
including arm1-vs-arm3 which differ only in *how* the gate went false. Before reading meaning into
that I ran the same command three times: **still three hashes, 16 differing bytes** at a fixed offset
next to `…dEQP_FragColor`. **The `.slang-module` container is nondeterministic**, so byte-identity
cannot compare anything about it. The `.spv` path *is* deterministic (3/3 identical hashes) — so
#12382's published `cmp`/sha256 digests, which are on `.spv`, remain sound.
✅ **Replicated on a second clone with a control** (`slang-triager`): three identical
`-incomplete-library` runs → all **83940 B**, byte-different each pair; three `.spv` runs →
byte-identical. ⭐ **It also retro-explained a loose end that had sat unexplained on its side** — an
early `c2` vs `c3` *"DIFFER at char 83602"* it had shelved was module nondeterminism, **not** the
`-incomplete-library` arm changing output. A void instrument doesn't just fail its own probe; it leaves
mystery residue elsewhere that gets attributed to whatever hypothesis is in hand.
⇒ **Standing rule: never `cmp` two `.slang-module` files to test whether a flag changed anything.**
Compare `.spv`, or compare produced-vs-not. ⭐⭐ **A same-input repeat
run is the cheapest possible validation of a comparison instrument, and I nearly skipped it because
three different hashes looked like a finding rather than a defect.** Related:
[[feedback_a_negative_control_must_vary_exactly_one_thing]] family, and
[[feedback_a_downstream_fix_can_void_an_upstream_published_control]] for the chain.

⭐ **Register note:** the triager framed this as *"same family as: an instrument inside the phenomenon
cannot measure it"* — a true-sounding maxim that does not apply, because a compiler flag is not
inside the phenomenon it selects. **An analogy to a valid rule is not an instance of it**; check
whether the mechanism actually transfers before adopting the frame.

Chain: [[project_12385_precompile_validation_gate]].
