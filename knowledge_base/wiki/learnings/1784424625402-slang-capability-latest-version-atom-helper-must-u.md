---
title: "Slang capability: latest-version-atom helper must use getElements()[count-2], never a range/contiguity scan"
type: learning
topic: slang-compiler
source: learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md
---

# Slang capability: latest-version-atom helper must use getElements()[count-2], never a range/contiguity scan

When deriving a target family's *latest version atom* from a `_*_latest` capdef alias (to avoid hard-coding e.g. `_sm_6_10`), you MUST mirror the existing `getLatestSpirvAtom()`/`getLatestMetalAtom()` pattern exactly:

```cpp
auto elements = CapabilitySet(CapabilityName::_sm_latest).getAtomSets()->getElements<CapabilityAtom>();
return asAtom(elements[elements.getCount() - 2]); // -1 is the shader-stage atom
```

**Why this is the only correct form (learned the hard way on PR #12122, ~6 build cycles):**

1. A materialized `CapabilitySet` for a version alias includes a trailing **shader-stage atom** (`vertex`/`compute`/…). In the CapabilityAtom enum, **stage atoms sort ABOVE all target-version atoms** (e.g. `_GLSL_460`=36 but `vertex`=72). `getElements()` returns the set **sorted**, so the stage atom is last and the highest *version* atom is `[count-2]`.

2. A "max atom ≥ familyAnchor" scan is WRONG — it grabs the stage atom (72) instead of the version atom, silently widening the family's range predicate to swallow other families' atoms (Metal/HLSL/CUDA). Symptom: `getHighestTargetVersionAtomInFamily` returns a CUDA atom for a GLSL query; version-raise checks silently no-op.

3. A "walk contiguously up from anchor, stop at first gap" scan is WORSE — it **segfaults**. `UIntSet::contains((UInt)atom)` past the enum's populated range plus `atom=atom+1` walks into invalid atom values → crash. Any compile *with a `-profile`* then dies (empty output, exit 0 under caught-exception; SIGSEGV under `SLANG_ASSERT=system`).

**Also:** `isSpirvExtensionAtom` and the family range-predicates (`isHlslVersionAtom` etc.) are internal `namespace Slang` funcs with **no `SLANG_API`** — a `tools/slang-unit-test/` C++ test that calls them **fails to link** (undefined reference) because the unit-test module links the slang DLL's *exported* symbols only. Recompiling `slang-capability.cpp` into the test module is too heavy (pulls slang-ast-builder.h). Test such predicates through their observable command-line behavior in a `.slang` test instead (e.g. an `spv<Feature>` extension appended to a profile suppresses the E41012 "profile implicitly upgraded" warning because `getTargetCaps()` pulls it into target caps).

**Meta-lesson:** a codex CODE_REVIEW *approve* is not a substitute for a test build. Codex approved the buggy "max ≥ anchor" scan by reasoning that the alias "expands only to its own family chain plus lower-valued root atoms" — it missed that stage atoms are higher-valued. Only the build+run caught it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md`_
