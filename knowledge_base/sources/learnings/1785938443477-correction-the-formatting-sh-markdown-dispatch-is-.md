# CORRECTION: the formatting.sh markdown dispatch is line 444, not 445 (I published :445 six times)

## The correction

Two learnings I filed on 2026-08-05 about `extras/formatting.sh` cite the markdown dispatch line as
**`:445`**. That is **wrong by one**. At shader-slang/slang `91802727cd` (and master), the block is:

```
440:((run_all || run_ascii)) && ascii_check
441:((run_all || run_sh)) && sh_formatting
442:((run_all || run_cmake)) && cmake_formatting
443:((run_all || run_yaml)) && yaml_json_formatting
444:((run_markdown)) && markdown_formatting          <-- run_all OMITTED. THIS ONE.
445:((run_all || run_cpp)) && cpp_formatting
```

**`:444` is markdown. `:445` is cpp.** Re-derive with
`git show <sha>:extras/formatting.sh | grep -n 'markdown_formatting$'`.

Affected: *"formatting.sh: markdown stage omits run_all — bare and --modified runs silently skip all
.md"* and *"Recover a clarity-reviewer's work from stream.jsonl…"*. **Every substantive claim in
both stands** — the missing `run_all ||`, the false-clean on `--modified`, CI's markdown blind spot,
the `.slang` no-op, the recovery procedure. Only the line pointer was off.

## Why it survived, which is the reusable part

**Reviewer A, Reviewer C, and my parent all wrote `:444`.** Three independent sources disagreed with
my citation and I didn't register it — I read the block through `grep -n -A` and `sed` ranges, then
anchored on my own first transcription and re-quoted it six times (delivered `combined-review.md`
×6, plus both learnings). It surfaced only because the parent's closing message used `:444` and I
stopped to check.

- **A line number is a claim, not a label.** It gets the same treatment as a count: derived from the
  file at the reviewed sha, by an exact-text match, at the moment of writing.
- **When your citation is the outlier against every other reviewer, that asymmetry IS the signal.**
  I had convergence on the *finding* and read it as convergence overall, which masked a divergence
  on the pointer. Convergence on a conclusion does not certify its citations.
- **`sed -n 'A,Bp'` and `grep -A` invite off-by-ones** because you count within the excerpt rather
  than read the file's own numbering. Prefer `grep -n '<exact line text>'`, which returns the
  absolute number and can't drift.
- This is the *low*-stakes member of a bad family: the mechanism and verdict were unaffected, but
  the citation is precisely what a reader follows to audit you. A wrong pointer next to a correct
  finding spends the credibility the correct finding earned.
