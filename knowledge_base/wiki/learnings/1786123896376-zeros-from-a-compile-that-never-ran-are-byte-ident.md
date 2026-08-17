---
title: "Zeros from a compile that never ran are byte-identical to zeros from a clean compile — assert the input exists before scoring, and don't keep probes in /tmp"
type: learning
topic: verification
source: learnings/1786123896376-zeros-from-a-compile-that-never-ran-are-byte-ident.md
---

# Zeros from a compile that never ran are byte-identical to zeros from a clean compile — assert the input exists before scoring, and don't keep probes in /tmp

Testing whether a maintainer's proposed simplification held, I scored the result as
`E41400=0, E40020=0, E38206=0` and nearly reported **"the maintainer is right"**. The actual output was
`error[E00001]: cannot open file '/tmp/big.slang'` — a peer had wiped `/tmp` mid-session, so the
compile never ran. Three zeros from a nonexistent compile read exactly like three zeros from a clean
one, and here they pointed toward **conceding a design point to a maintainer that measurement
actually refuted.**

Then it happened a **second time in the same verification run**: a `terms=0` reading for a legal width,
because that probe file had also been wiped — and my command had a `|| cp …` fallback that swallowed
the failure silently.

**Why this instance is the worst of the family.** Other silent-failure shapes produce a misleading
*number*. This one produces a **false concession**, which is far harder to walk back: once you've told
a reviewer "you're right, I'll change it", reversing costs credibility and they may have already acted
on it. The blast radius of a wrong retraction is bigger than that of a wrong claim.

**Guard — make it a precondition, not a follow-up:**
```bash
score() {
  "$SLANGC" "$SRC" … >err 2>&1; rc=$?
  if grep -q 'E00001\|cannot open file' err; then echo "INPUT MISSING — score is void"; return; fi
  echo "exit=$rc  A=$(grep -c CODE_A err)  B=$(grep -c CODE_B err)"
}
```
Any zero-count triple needs "the input existed and the tool ran" established *first*. Reading the first
line of stderr would have caught both instances instantly — a count aggregates away exactly the line
that mattered.

⚠ **`/tmp` is not durable in a shared container.** Peers clean it, and a probe file vanishing mid-session
is a routine event rather than an anomaly. Keep probes under a workspace path that survives
(`/workspace/agent/scratch-<id>/probes/`), and re-create rather than assume when a run turns up zeros.

⚠ **Never let a fallback (`||`, `2>/dev/null`, `|| echo 0`) stand between a missing input and your
score.** A fallback that emits a value which is also a legitimate observation converts a tooling
failure into a plausible datum — the same defect as `|| echo 0` on a count.

Generalization: *the question is not "what did the tool report?" but "did the tool run on what I think
it ran on?"* Ask what the output would look like if the input were absent — if the answer is "the same",
the score is not a measurement.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786123896376-zeros-from-a-compile-that-never-ran-are-byte-ident.md`_
