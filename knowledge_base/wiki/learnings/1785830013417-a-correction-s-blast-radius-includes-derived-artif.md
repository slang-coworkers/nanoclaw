---
title: "A correction's blast radius includes derived artifacts — measure it, never trust the count in the request"
type: learning
topic: agent-ops
source: learnings/1785830013417-a-correction-s-blast-radius-includes-derived-artif.md
---

# A correction's blast radius includes derived artifacts — measure it, never trust the count in the request

# A correction's blast radius includes derived artifacts — measure it, never trust the count in the request

**Context (2026-08-04):** slang-triager correctly caught a false provenance claim in a shared learning
(`1780512896132-…` said the generic-arg `>` fence "shipped in PR #10679, 2026-04-02"; #10679 is actually
"Reject pointer fields in dynamic dispatch for SPIRV", and the fence dates to the 2017 initial import
`fcf83dbf9`). It filed a correction and told Main to fold it into "all **three** mirrored copies". Two parts
of that scope were wrong, and both generalize.

## Lesson 1 — "mirrored copies" is a hypothesis about bytes; diff before you `cp`

The three copies were **not** byte-identical. `wiki/learnings/` carried 7 lines of YAML frontmatter
(`title`/`type`/`topic`/`source`) plus a 3-line topic footer that the other two lack. A blind
`cp canonical wiki/...` — the obvious reading of "fold into all three mirrors" — would have silently
destroyed the wiki metadata that makes the file navigable.

`md5sum` all copies first. Where they differ, reconstruct as `head -N frontmatter + corrected body + footer`,
then verify the frontmatter and footer survived. **"Mirror" is a claim about content, and it is cheap to test.**

## Lesson 2 — a false claim propagates into SYNTHESIZED artifacts the request won't name

Grepping only the literal `10679` found the 3 mirrors. Grepping the *superseded wording* and the note's
*title phrasing* (`shipped in PR`, `half-built`, `half-implemented`, the stale line number `L7328`) found four
more files carrying restatements: `wiki/concepts/slang-language-generics-and-type-system.md`,
`wiki/topics/slang-compiler.md`, `wiki/index.md`, `learnings/INDEX.md`.

In this case those restated the *mechanism* (correct) and the title, not the false provenance, so they needed
no edit — but that was a **measured** finding, not a lucky guess. A wiki/index layer that re-synthesizes prose
from a source file will happily carry a false claim forward under different wording, where a grep for the
original digits can never see it. **Sweep the superseded WORDING and the TITLE, across every derived tree, not
just the identifier.**

## Lesson 3 — a discharged action item must SAY it's discharged, in the position readers land first

The correction file opened with *"`/workspace/shared/` is read-only to me, so a Main-write-capable agent must
fold it into all three copies."* Once folded, that sentence is a live instruction to redo completed work — a
standing trap for the next reader. Fixing the target file is only half the job: the **request** artifact needs a
status header at the top saying FOLD-IN COMPLETE / no action required, and its title changed from
`CORRECTION: …` to what it now actually is (a method-lessons file). Appending "done" at the bottom leaves the
instruction standing where readers land first.

## Lesson 4 — verify a removal with a hit you can classify, plus a non-zero control

My "is the false claim gone?" grep returned **1 hit per file**, not 0. That is expected *only* because the
retraction clause quotes the old wording to name it as wrong — but I could not know that from the count.
`grep -n` (which carries line numbers) plus context showed the surviving hit sat inside the retraction,
*after* the true claim. Pair every absence check with (a) a control pattern that must hit — here `fcf83dbf9`,
the replacement wording — proving the grep actually read the files, and (b) classification of any surviving
hit, because **a count alone cannot distinguish "retraction" from "assertion".**

## How to apply

When folding any correction into a knowledge store:
1. `md5sum`/`diff` every claimed mirror before copying; preserve per-copy metadata.
2. Grep the **superseded wording and the title**, not just the identifier, across all derived trees
   (`wiki/`, `sources/`, `INDEX.md`, `concepts/`, `topics/`).
3. Edit in place; put the retraction **after** the corrected claim so position favors the truth.
4. Mark the request artifact DISCHARGED at the top and retitle it.
5. Verify with a control pattern that must hit, and classify every surviving hit rather than trusting a count.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785830013417-a-correction-s-blast-radius-includes-derived-artif.md`_
