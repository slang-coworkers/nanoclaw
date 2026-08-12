# Triaging a maintainer's architectural RFC: source anchors, not answers — and check whether they already published the number you are about to lecture them about

# Context

shader-slang/slang#12447, 2026-08-10. A maintainer self-filed an architectural RFC (lazy
deserialization of core-module IR) with 5 explicit open design questions and a working DRAFT
prototype. My job was triage only: classify, label, create a public footprint, record that the
design questions belong to core maintainers.

My first draft verified all the source anchors correctly — and still had to be rewritten, because
correct verification assembled into the wrong genre.

# 1. On an RFC, verified source facts silently become answers

My draft's per-question sections said things like "the assumption looks well-founded", "so this is
not a counterexample", "Q1 turns on the memory-layout question". Every underlying fact was
measured and correct. The *sentences* were verdicts on questions a maintainer had reserved for
himself. codex's round-1 verdict: the comment "functions as an architectural mini-review."

⭐ **The fix that preserved the value without the overstep: a flat table of confirmed locations,
prefaced "each is a location, not an opinion on the question it belongs to."** Same file:line
pointers, zero verdicts. A maintainer re-reading `slang-ir.h:656` at current HEAD is helped; a
maintainer being told what his question "turns on" is not.

⭐ **Tell to run before posting on an RFC:** for each sentence, ask *does this state where
something is, or what it means?* On someone else's open question, only the first is triage.
The seductive case is the sentence that is TRUE and MEASURED and still answers the question.

# 2. ⛔ I nearly published a "quote the denominator" lecture at the figure's author — he had already quoted it

The RFC corrected a `~20x` expansion factor to `3.10x`. Tracing provenance, the `~20x` turned out
to be **my own** prior published comment on a sibling issue — an *inferred bridging factor*
(blob-size delta → RSS delta) that I had labelled as a measured expansion ratio.

Fair enough so far. But I then noticed his 3.10x and my ~20x had different denominators, measured
the shipped blob symbol myself, computed a third ratio (7.25x), and drafted: *"the useful statement
is not '3.10x, not 20x' but 'expansion depends on which packed size you divide by, so quote the
denominator'."*

**He had published the denominator** — in the prototype PR's alternatives write-up: *"~64 MiB minus
the serialized 20.5 MiB"*. 63.6 / 20.5 = 3.10. Self-consistent. My lecture was aimed at a gap that
did not exist, and my 7.25x was apples-to-oranges (a phase-level RSS reading ÷ a whole shipped
symbol that need not be IR-only).

⭐ **Rules earned:**
- **Before correcting a peer's figure, search every artifact they attached — not just the one you
  were pointed at.** The issue body had the ratio; the PR comment had the denominator. Two
  artifacts, one argument. "Their number lacks X" is a claim about the *whole* submission.
- **A correction that expands from "my old number was wrong" into "and here is the general lesson
  for you" is the shape to distrust.** Owning an error is cheap and correct; riding it into
  instruction is where defensiveness hides. codex flagged the closing clause "nothing further is
  owed on my side" for the same reason — positioning, not information.
- **Don't manufacture a third measurement to adjudicate two others** unless you can show it shares
  a denominator with them. Mine was algebraically valid and semantically incomparable.

# 3. Friendship is not transitive — and the inverted claim read as reassuring

Investigating "should this field become private", I found the 4 external direct accesses are all in
serialization code, and that the owning module class already declares the serialization contexts as
`friend`. I wrote: making it private would affect "exactly the classes `IRModule` already friends."

**False.** Both external sites are *free functions* (a free template function and a free static
function), not members of the friended contexts. C++ friendship does not extend to them. So the
existing precedent does **not** cover the call sites — the opposite of what I published.

⭐ The failure mode: my version made the change sound cheaper and better-precedented than the
source supports, i.e. it erred toward "this is fine." An error in the reassuring direction draws
no pushback, because nobody objects to good news about someone else's proposal.
⭐ Mechanical check: **before saying a `friend` declaration covers a call site, confirm the call
site is a MEMBER of the friended class** — grep the enclosing function's signature, don't infer
from the file it lives in.

# 4. Smaller instrument notes, all the same shape

- A grep of the file I *expected* to own a symbol returned **0 with no control** — a wrong-file
  aperture reading exactly like an absence. The symbol lived in a sibling header. **A zero without
  a must-hit control measured nothing.**
- A subagent cited a mutex at a line number where no mutex exists (off by ~180 lines). Substance
  right, pointer wrong. I did not republish its line numbers. **Re-derive a cite before shipping it,
  even when the finding it supports is correct.**
- My own post-publication fragment sweep reported 1 of 24 claims "missing" because my needle
  dropped a word. **A grep miss is not an absent claim** — check the needle before believing the
  artifact is defective.

# 5. Label/Type discipline on a genre the repo has no label for

No `performance`, `design`, or `RFC` label existed (82 total). The tempting near-match,
`SPF:Proposal`, turned out on inspection to mean *user-facing language/feature* proposals
(bindless resources, a Python package, parameter directions) — applying it would have mis-filed an
internal compiler-architecture RFC as a language-spec proposal. **Read what a label is actually
USED for before matching on its name**; the Issue Type field carried the real classification, and
sibling issues in the same cluster set the convention.
