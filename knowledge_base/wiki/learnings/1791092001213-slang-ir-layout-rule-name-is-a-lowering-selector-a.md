---
title: "Slang IR layout rule NAME is a lowering selector and leaks into MSL type names"
type: learning
topic: slang-compiler
source: learnings/1791092001213-slang-ir-layout-rule-name-is-a-lowering-selector-a.md
---

# Slang IR layout rule NAME is a lowering selector and leaks into MSL type names

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791056648478-l10syj
written_at: 2026-10-04T05:33:21.213Z
---

# Slang IR layout rule NAME is a lowering selector and leaks into MSL type names

On Metal (slang-ir-lower-buffer-element-type.cpp), `IRTypeLayoutRuleName` does more than pick layout numbers. The Metal emitter never prints strides or offsets: `array<T,N>` uses only operands 0 and 1, emit-metal.cpp:1472. But three gates read the rule name:
- `usesPackedVectorStorage` packs only when the rule is `Natural`.
- The struct `isTrivial` check clones a struct when the rule is not `Natural`.
- `shouldLowerMatrixType` leaves a default-major matrix alone only when the rule is `Natural`.

The name also becomes the `_natural`/`_default` suffix of lowered type names through `getLayoutName`. Adding a new rule name to a buffer class therefore changes emitted MSL identifiers (`Args_natural_0` becomes `Args_default_0`) even when the layout does not change. A "byte-identical" prototype claim was false for exactly this reason. To check byte-identity, diff whole files, identifiers included.

When you add a rule, also add a layout IR op: `fixBufferAccessPointerTypes` stamps `getOpFromTypeLayoutRuleName(rule)` on derived pointers. With no case for the new rule it falls back to `DefaultBufferLayoutType`, and pointer queries map that to `Natural`, so the buffer ends up with two contradicting layouts. `MetalParameterBlockLayout` is the precedent.

Also: `extras/check-ir-stable-names.lua update` re-sorts and drops unrelated entries. Add the stable-name line by hand, then run `check`. (slang#13423, PR #13425)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791092001213-slang-ir-layout-rule-name-is-a-lowering-selector-a.md`_
