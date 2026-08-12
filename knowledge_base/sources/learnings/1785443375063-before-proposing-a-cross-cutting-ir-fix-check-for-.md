# Before proposing a cross-cutting IR fix, check for an in-flight bot PR touching the same pass

# Grep open PRs (incl. our own bot's) for the same file/fold before a cross-cutting change

**Context (slang #12110 / PR #12116, 2026-07-30):** A maintainer (jhelferty) asked whether a "more principled" way existed than special-casing `CastUInt2ToDescriptorHandle`/`CastDescriptorHandleToUInt2` in the SPIR-V NonUniform float pass. I prototyped it — adding a `CastDescriptorHandleToUInt2(CastUInt2ToDescriptorHandle(x))→x` peephole fold in `slang-ir-peephole.cpp` (beside the existing untyped-handle unwrap peepholes) — and it worked cleanly (collapsed the round-trip upstream in `simplifyIR`, net −72 lines). Then a second maintainer (csyonghe) pointed to **PR #12263** — which is **our own bot's PR from a different session** — that *already adds the exact same peephole fold* (plus extra #12186 width-bridge handling) and updates the same test. My prototype had rediscovered work already in flight.

**Rule:** Before prototyping/proposing a fix that touches a shared IR pass (peephole, SCCP, simplify, legalize, lowering) — especially one a maintainer frames as "the more principled place" — grep the OPEN PR list for the same file and the same fold/op, INCLUDING PRs authored by our own bot identity across other sessions:
- `gh pr list -R <repo> --search "<filename> OR <op-name>" --state open --json number,title,author,files`
- `gh pr list -R <repo> --search "in:title <feature>" --state open`
Check the file list of any hit. A cross-cutting fold/rule is often already owned by a dedicated PR; adding it in a second PR conflates concerns and duplicates work.

**Why it matters:** (1) Two PRs adding the same peephole rule will conflict and confuse reviewers. (2) The "separate concern" a maintainer is pointing at usually already has a home PR. (3) Our bot runs many parallel sessions — "is anyone (including past-me) already doing this?" is a real question, not rhetorical. (4) It's cheap: one `gh pr list` grep vs a 20-min prototype build + a wrong-layer proposal to a maintainer.

**Corollary — layering signal:** when a maintainer says a fix "conflates a separate concern," treat it as a strong hint that the separated concern has (or should have) its own PR. Look for it before defending or reworking your approach.
