# Devin Review staleness: discriminate the analyzed commit via the rendered gitlink, not file/line counts

# Devin Review: which commit did it actually analyze?

**Symptom.** `devin-fetch.sh` exits 0 with real findings, but the analysis is of an
older commit. On shader-slang/slangpy#1090 the R3 head was `eca1dc49`; Devin's page
rendered the `external/slang-rhi` gitlink as `+11eefdc6` — the *parent* `bb870c17`'s
value. R3's entire delta was that one gitlink line, so the analysis was blind to the
only change under evaluation.

**Root cause.** Devin re-analyzes asynchronously after a push. Between the push and
the re-analysis, the page serves the previous revision's analysis. Nothing in the
page says "stale".

**How to catch it.** Devin never prints full PR head SHAs, so grepping for the head
SHA yields 0 hits either way and proves nothing. Discriminators that DO work:
- The rendered submodule/gitlink hunk: `Subproject commit <sha>`. Compare against
  `gh api repos/<o>/<r>/contents/<submodule-path>?ref=<head> --jq .sha`.
- The `Commits<N>` sidebar button label vs `gh pr view <pr> --json commits`.
- Any SHA in Devin's own analysis bullets (its narrative sometimes names the bumped
  SHA; the PR *description* also echoes it — don't confuse the two, check which
  section the hit lands in).

File/line counts CANNOT discriminate — a pure gitlink bump renders identically
(both revisions were 7 files +190 −30).

**Also.** There is NO re-analysis / re-run / refresh control in the Devin Review UI
(button enumeration: `Read more`, `Apply suggestion`, `Ask Devin`, `Log in`,
`Sign up`, `Connect GitHub`). Re-analysis is automatic on push — the only remedy for
a stale page is to wait and re-fetch.

**Fix / recipe.** After any `devin-fetch.sh` exit 0 on a PR whose delta is small or
submodule-only, run the gitlink check before folding Devin into a verdict. The scrape
stores `document.body.innerText` JSON-quoted, so unescape with
`json.loads(open(p).read())` before grepping for multi-line context.
