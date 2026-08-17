---
title: "A capability claim about a backend can rest on the NOUN you happened to grep — 'GLSL has no integer dot' was false because the function is named dotEXT"
type: learning
topic: slang-compiler
source: learnings/1786153580027-a-capability-claim-about-a-backend-can-rest-on-the.md
---

# A capability claim about a backend can rest on the NOUN you happened to grep — "GLSL has no integer dot" was false because the function is named dotEXT

Answering a maintainer's question about why Slang's integer `dot` has no GLSL arm, two of us independently concluded **"GLSL has no integer `dot`"** — from an honest measurement: glslang's builtin table declares plain `dot` over float/double only, **zero** integer overloads (non-zero control: 4 plain-`dot` declarations exist).

The claim is false. GLSL *does* have integer dot products; they are **separately named `dotEXT`** (`int dotEXT(ivec2, ivec2)`, plus `dotAccSatEXT` and `dotPacked4x8EXT` forms). Our grep was correct about `dot` and silent about `dotEXT`, because we searched the **name we assumed** rather than the **capability we were claiming**.

**The shape, which is not a control or normalization failure:** both readings were true of *different nouns*. A grep cannot detect this — it faithfully reports the token you gave it. The failure is upstream of the tool, in choosing the token. So the usual guards (positive control, non-zero denominator, two-arm test) all **pass** while the conclusion is wrong.

**Guard:** when the claim is about a *capability* ("target X cannot do Y"), enumerate candidate spellings before concluding absence, and prefer searching the concept:
```bash
grep -oE '[a-zA-Z0-9]*dot[A-Za-z0-9]*' <builtin-table> | sort -u   # names CONTAINING the concept
```
That one command surfaces `dot`, `dotEXT`, `dotAccSatEXT`, `dotPacked4x8EXT` immediately. A `grep -c '"… dot("'` never can.

**Second-order finding, same shape, discovered while reconciling:** a peer measured **50** `dotEXT` declarations, I measured **42**. Both correct — 50 counts *lines mentioning* `dotEXT`; 42 counts *quoted declarations*, missing `dotAccSatEXT` variants sharing a line. Two honest greps of different populations, producing numbers that look like a disagreement. Same lesson one level down: **state the population, not just the count.**

**And the qualifier neither of us had until a third pass:** `dotEXT` is **extension-gated** — glslang wraps the block in `GL_EXT_integer_dot_product` (ESSL ≥ 300, desktop ≥ 450). So the actionable conclusion isn't "the arm is missing", it's "**an arm would need a capability requirement, not just a different spelling**" — which is a materially different instruction to whoever implements it.

Net: the narrow claim survives ("the *ordinary* `dot` builtin is float/double-only, so forwarding integers to `dot` won't compile"), the broad one doesn't, and the difference is exactly what a reviewer would have caught. Ask what noun your evidence is about before generalizing it to a capability.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786153580027-a-capability-claim-about-a-backend-can-rest-on-the.md`_
