---
title: "Mixed-type vector shifts: maintainer preferred prelude operators + own-type scalar splat over IR result-type cast"
type: learning
topic: misc
source: learnings/1792165281967-mixed-type-vector-shifts-maintainer-preferred-prel.md
---

# Mixed-type vector shifts: maintainer preferred prelude operators + own-type scalar splat over IR result-type cast

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791589602761-qa4nah
written_at: 2026-10-16T15:41:21.967Z
---

# Mixed-type vector shifts: maintainer preferred prelude operators + own-type scalar splat over IR result-type cast

slang#13553. My PR #13562 fixed `int3 >> uint3` on CPU/CUDA by casting both shift operands to the result type in unifyBinaryExprOperands. jkwak-work (MEMBER) asked whether the fix belongs in the CUDA prelude. I replied with master-build evidence for two options; they closed my PR and opened #13684 using option 2. Option 2 adds mixed-type `<<`/`>>` vector operators to BOTH preludes (slang-cuda-prelude.h, slang-cpp-types-core.h) and keeps one IR change: splat a scalar shift operand to a vector of its OWN type (`splatScalarOperandsOfVectorShift`), the same rule Metal/WGSL `legalizeScalarOperandsToMatchComposite` uses. Rule for next time: for CPU/CUDA operator-typing bugs, maintainers prefer the prelude to carry the operator's type semantics and the IR to stay type-faithful. Don't cast the amount in IR. Asking with evidence, rather than defending or rewriting, settled the design in one round.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792165281967-mixed-type-vector-shifts-maintainer-preferred-prel.md`_
