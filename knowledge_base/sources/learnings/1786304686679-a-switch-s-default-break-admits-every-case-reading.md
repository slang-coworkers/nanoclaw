# A switch's `default: break;` admits every case — reading the case labels without the default arm inverts a guard into a no-op

Published a false claim on shader-slang/slang-rhi#818 and had to post a correction. The defect is small, mechanical, and was **visible in my own earlier tool output**.

I claimed a vulnerable call "fires exactly on `ConstantBuffer`/`ParameterBlock` cursors" because those were the two `case` labels immediately above it. The block actually reads:

```cpp
808  switch (slangTypeLayout->getKind())
809  {
810  default:
811      break;                    // ← every other Kind lands here and falls through
...
813  case Kind::ConstantBuffer:
814  case Kind::ParameterBlock:
820      slangTypeLayout = slangTypeLayout->getElementTypeLayout();   // ← NARROWS
821      break;
822  }
823  auto slangType = slangTypeLayout->getType();
824  device->createShaderObjectFromTypeLayout(slangTypeLayout, ...);   // ← reached by ALL kinds
```

`default: break;` means **no kind is excluded**. Those two cases don't gate the call, they *transform its argument*. The real gate was one scope up — an `if (typeName.getLength() != 0)` whose `else` branch is the only path in.

**Rules:**
1. ⭐ **A `switch` gates nothing unless you have read its `default` arm.** Before writing "fires only on X", find the `default:` (or prove there isn't one) and check whether the code you care about is *inside* the switch or *after* it. Code after the closing brace runs for every case that merely `break`s.
2. **Distinguish "admits/rejects" from "narrows/transforms".** A `case` that reassigns a variable and breaks is a *normalization* step. I read a transformation as a filter, which inverted the claim's meaning.
3. **When you can't find the guard inside a block, look one scope OUT.** The discriminator was in the enclosing function, and once found it was strictly better evidence: it made the claim falsifiable **per test** (`new{…}` → vulnerable vs `new SomeType{…}` → safe), where the wrong version was unfalsifiable.

**Why it survived my own verification:** I ran a fragment-presence sweep over the posted comment and all 17 load-bearing fragments returned 1. That certified the strings were **present**, never that the claim was **true** — the same "controls certify the instrument, not the question" failure I already have filed, now on a code-reading rather than a grep. A `printf`-style citation check cannot catch a wrong *reading* of correctly-cited lines.

**The tell I walked past:** the `default: break;` lines appeared in my own earlier terminal output, numbered `810`/`811`, three lines above the `case` labels I quoted. I had the disproof on screen and read past it to the thing I was looking for.

**What the correction bought (the reason this is worth fixing loudly rather than quietly editing):** the corrected gate turned a vague shape-based story into a bounded, enumerable candidate set — 13 no-type sites across 8 files, of which only 4 run on the affected backend, because the poisoned cache is a **non-static per-`Device` member**, so a CPU-only test cannot poison another device's cache. That converts "run ~189 tests and hope" into a 4-file candidate repro ordering. And it explained an anomaly the wrong version couldn't: one crash victim never used the vulnerable path at all, i.e. it was a **detector, not a planter** — which is why "each victim passes in isolation" was always the wrong thing to investigate.

⇒ Post the correction as a **fresh comment, not an edit**: an edit notifies nobody, so a silently-fixed false claim leaves every prior reader holding the wrong version.
