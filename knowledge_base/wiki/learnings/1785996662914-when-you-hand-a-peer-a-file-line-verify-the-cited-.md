---
title: "When you hand a peer a file:line, verify the CITED function contains the mechanism — not just that the mechanism exists somewhere"
type: learning
topic: ci-tooling
source: learnings/1785996662914-when-you-hand-a-peer-a-file-line-verify-the-cited-.md
---

# When you hand a peer a file:line, verify the CITED function contains the mechanism — not just that the mechanism exists somewhere

**Rule:** A correct conclusion delivered with the wrong file:line costs the reader a wrong-function read, and it invites them to conclude you were wrong about the conclusion too. Before citing a location to a peer, confirm the mechanism you're describing lives *in that function*, not merely somewhere in the call chain.

**How it happened (slang#12371, 2026-08-06):** A reviewer asked whether my unit test's `setenv` could race concurrent tests. I traced it, found real threading, and told them *"`runUnitTestModule` (`slang-test-main.cpp:5612`) `dlopen`s the module in-process and dispatches its test functions on `std::thread`s."*

The conclusion was right — tests do run concurrently. The citation was wrong: the loop **inside** `runUnitTestModule` is a plain sequential `for (SlangInt i = 0; i < testCount; i++)` (that's test *discovery*). The concurrency is one level up:
- `useMultiThread` set at `:5793-5799` — requires spawn type `UseTestServer`/`UseFullyIsolatedTestServer` **and** `serverCount > 1`
- `runTestsInParallel` at `:5802-5804` → real `std::thread`s at `:5452-5455`, joined `:5457`
- fan-out is across test **entries**, not within the module

A reviewer who opened the function I named would have found a plain `for` loop and reasonably concluded the race wasn't real. **A misdirected cite can refute a true claim.**

**Why the error was easy:** I grepped for `std::thread` / `parallel`, got hits in the same file, saw `runUnitTestModule` was the in-process entry point, and fused two true facts ("this function loads the module in-process" + "this file fans out threads") into one false sentence ("this function fans out threads"). Both halves were verified; the *join* was not.

**How to apply:**
- After drafting a cite, re-open the named function and confirm the mechanism is inside its body. `sed -n '<start>,<end>p'` on the function, not a whole-file grep.
- When the mechanism spans layers, cite the layers separately: "*X* loads it in-process (`:5612`); the concurrency is at *Y* (`:5793-5799` → `:5802`)". Naming the seam is more useful than naming one end.
- Beware fusing two verified facts about the same file into one sentence about one function — that's the specific move that produced this.
- Correct it unprompted the moment you notice. The peer is auditing against what you told them.

**Same family, worth grepping together:** a `grep`/`sed` line cite doesn't establish the enclosing *scope* either (`precompileForTarget` is on `IModulePrecompileService_Experimental`, not `IModule` — cost a build cycle), and absence in a filtered view isn't absence (`opt/module.h` "exposes only a getter" — `SetHeader` is right there at `:59`; I'd grepped for the field, never for a setter). All three are the same generator: **a claim true of the thing checked, asserted about a scope that wasn't.**

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785996662914-when-you-hand-a-peer-a-file-line-verify-the-cited-.md`_
