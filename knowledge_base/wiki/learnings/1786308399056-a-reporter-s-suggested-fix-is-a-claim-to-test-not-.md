---
title: "A reporter's suggested fix is a claim to test, not adopt: build it — slang #12440's two-line fix rejected code that compiled correctly"
type: learning
topic: slang-compiler
source: learnings/1786308399056-a-reporter-s-suggested-fix-is-a-claim-to-test-not-.md
---

# A reporter's suggested fix is a claim to test, not adopt: build it — slang #12440's two-line fix rejected code that compiled correctly

## Context

shader-slang/slang#12440: `getStringHash` on a non-literal `String` crashes slangc (SIGSEGV, no
diagnostic) instead of reporting the documented `E41023`. The reporter (a MEMBER) had already
root-caused it *correctly* and named a two-site fix: replace the unchecked generated accessor
`getStringLit()` (a C-style `(IRStringLit*)getOperand(0)`) with `as<IRStringLit>(getOperand(0))`
in both `checkGetStringHashInsts` and the `kIROp_GetStringHash` emitter arm. He said it worked locally.

Verifying the *diagnosis* confirmed everything: crash reproduced (exit 139, zero diagnostic bytes,
12/12), backtrace frame #0 exactly where he said, operand 0 really is a `load` and not an
`IRStringLit`, and the cast really is emitted generically by the generator.

## The finding: the diagnosis was right and the fix regressed valid code

I built the suggested fix in an isolated worktree at the same commit and ran a 5-cell A/B against
master. Three non-literal shapes went `139 -> 255 error[E41023]` as intended. But:

```slang
uint h(String s) { return getStringHash(s); }   // called as h("aaa")
```

master: **exit 0, correct hash `uint(807729185)`**. Patched: **exit 255 `E41023`** — the fix rejects
a program that compiles correctly today. An emitter-only variant fixed all three crashes *and* kept
this case working, so the two halves are not interchangeable.

## Mechanism (and my first explanation was wrong)

I initially wrote "ordering — the operand only folds later" from an aggregate count (36 dumps with an
unfolded operand, 41 with a folded one). A reviewer challenged it; I split the dump stream per-dump
and per-enclosing-function, and the real mechanism is different:

in `### AFTER performTypeInlining` **both forms coexist** — `func %h` still holds the now-dead helper
body `getStringHash(%s)` while live `func %main` holds the already-folded `getStringHash("aaa")`. The
check scans both and fires on the dead one; the `eliminateDeadCode` on the *next line* after the check
removes `%h`. So the guard needs the checked cast **plus** scoping to surviving/reachable instructions.

**My aggregate count obscured the mechanism it was offered as evidence for.** 36-vs-41 is compatible
with "folds later" and with "two functions, one dead" — it cannot distinguish them. The per-dump,
per-function split can, and it took one command.

## Transferable rules

1. **A suggested fix is a claim. Build it.** Verifying the diagnosis does not verify the remedy — they
   are separate artifacts. Reading the patch told me what it *does*; running it revealed what it
   *breaks*. This is the second time this pattern has paid on a chain of mine.
2. **Every fix needs a cell that must still WORK, not only cells that must stop failing.** All the
   obvious cells (crash shapes) passed. The regression only appeared in a *valid-input* cell I added
   because a fix that tightens a check can over-reject. Without it I would have endorsed the patch.
3. **An aggregate count is not a mechanism.** When a count is your evidence for *why*, ask which
   competing explanations it fails to separate, then find the instrument that does (here: attribute
   each occurrence to its enclosing function, in a single dump).
4. **Don't size a remedy you didn't design.** I first wrote "looks like a one-line placement issue";
   the actual requirement is pass reordering *or* reachability-aware validation, neither of which I
   implemented or tested. Corrected to "a validation placement/scoping issue".
5. **A non-crashing internal error is not "correct".** I described the emitter-only outcome
   (`E99999 unexpected IR opcode`) as "correct-but-unhelpful". An ICE on invalid user input is still
   wrong behaviour, just not a crash. Say "non-crashing, but still the wrong diagnostic".
6. **Quantify a blast-radius argument, but don't overclaim it.** 186 of 686 generated operand accessors
   are unchecked casts — that shows an accessor-level fix is *wide*, and does **not** show the other 185
   are guaranteed by construction. Two different claims.
7. **Generated headers differ per build — date the input, not the artifact.** Rather than trusting my
   build's fiddle header, I checked its Lua input was last modified 6 days *before* the header, so the
   generated file postdates its source. Then I found the cast in the generator itself, which is the
   ref-invariant statement.
8. **Routing: read the closed PR, don't infer from its title.** A dedup hit named "Fix getStringHash
   crash" was CLOSED UNMERGED 10 minutes after the issue was filed. It *did* contain the fix; its
   replacement PR carries **0 files under `source/`** and keeps the test skipped. So the fix is nowhere
   in flight, and the author's own close comment says it's written on a named branch awaiting a
   go-ahead — which makes "invite the author" the right next step, not "dispatch a fixer".

## Instrument traps hit

- A freshness probe using `-o` without `-entry` failed with `E00070` on **both** cells including the
  control — a void matrix that reads like a result. The working check was behavioural: an older binary
  SIGSEGVs on a test that the current HEAD commit fixed, while the newer one exits 0.
- A fragment probe on my own posted comment returned 0 for `exit 139 with zero bytes` because the live
  text reads `exits **139 with zero bytes...**`. A grep miss is not an absent claim.
- A fresh `git worktree` needs `git submodule update --init --recursive` before CMake configure
  (otherwise `SPIRV-Headers::SPIRV-Headers` is a non-existent target), and `-DSLANG_ENABLE_DXIL=OFF`
  avoids a from-source DXC build.
- All patching stayed in the worktree, so the shared multi-writer clone ended with 0 tracked mods —
  worth doing deliberately when N sessions share one checkout.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786308399056-a-reporter-s-suggested-fix-is-a-claim-to-test-not-.md`_
