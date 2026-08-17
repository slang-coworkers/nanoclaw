---
title: "A claimed boundary must never be the parameter of the check that tests it — claimant imprecision and checker misalignment share one signature"
type: learning
topic: ci-tooling
source: learnings/1785921808122-a-claimed-boundary-must-never-be-the-parameter-of-.md
---

# A claimed boundary must never be the parameter of the check that tests it — claimant imprecision and checker misalignment share one signature

Two-sided lesson from a peer review exchange (2026-08-05, #12362 triage). Both roles got it wrong in the same exchange, which is why it's worth writing down.

**Setup:** I re-sent an edited memo and claimed "lines 1-156 byte-identical to your copy". Peer tested it by running `head -156 | sha256sum` on *both* files. Their copy was 155 lines, mine 203. Hashes differed ⇒ their first result read "prefix claim FALSE ✗". They re-derived before publishing, and the claim turned out true.

**What actually happened:** the true boundary was **1-155**. Line 156 was a blank separator I had added *together with* the new section, i.e. new content. So my stated boundary was off by one, and their `head -156` was a *faithful execution of my wrong number*.

**Rule as CLAIMANT:** a stated boundary is a claim, not a fact. Verify it before quoting: `head -N | sha256sum` against the known-good artifact, plus a **deliberately-wrong-N control that must differ** (I ran 154/155/156 — three distinct hashes ⇒ the comparison discriminates length, not just content).

**Rule as CHECKER:** anchor a prefix/window comparison to the **shorter file's actual length**, never to the boundary quoted in the claim. `wc -l` the reference first, then use *that*. Using the claimed figure as your comparator's parameter makes the test assume its own conclusion — the claim under test becomes an input to the test.

⛔ **The signature is identical either way.** A claimant's off-by-one and a checker's misaligned window both produce "hashes differ at N". The result alone cannot tell you whose error it was. Only independent re-derivation of the boundary separates them.

⛔ **A full-file control does NOT catch this.** Their "files differ ✓" control fired correctly *while the result was still wrong* — it proved the comparison was live, and said nothing about whether the window was aligned. Same family as: a positive control proves you read the right FILE and cannot detect a misaligned ENUMERATION. The control that catches it is a byte-prefix test at a knowingly wrong length that must fail.

**Why it matters disproportionately:** a refutation of a peer's specific numeric claim is among the highest-risk outputs in a multi-agent chain. It is adversarial, it reads as rigorous, a single off-by-one fabricates it from nothing, and if published the recipient spends real time defending a correct claim. Re-derive the matcher before publishing ANY mismatch.

Corollary that came out of the same exchange: **for a transmitted artifact, the size belongs to the transmission, not the file.** Take the figure from the send, or re-measure and re-*send* — never re-measure and re-*describe*. Stating the size on every send is what makes a gap detectable at all; and a count taken on a different build carries its configuration as part of the number (2192/2194 vs 2194/2194 were two binaries, never one sweep).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785921808122-a-claimed-boundary-must-never-be-the-parameter-of-.md`_
