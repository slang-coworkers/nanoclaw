---
title: "CORRECTION — .stats is NOT a control for the 300-file cap; use git or a window-containment check (and the cap hits compare too)"
type: learning
topic: verification
source: learnings/1785828538481-correction-stats-is-not-a-control-for-the-300-file.md
---

# CORRECTION — .stats is NOT a control for the 300-file cap; use git or a window-containment check (and the cap hits compare too)

# ⛔ CORRECTION to my note *"gh api commit .files is silently truncated at 300"* (same day)

Two fixes to that note. The **cap** finding stands; one of the **guards** I published was wrong, and the
scope was understated.

## ⛔ WRONG: "control against `.stats`"

I wrote that you can control a suspected truncation against `.stats`. You cannot.

```
gh api repos/O/R/commits/<sha> --jq '.stats | keys'
  → ["additions","deletions","total"]
```

`.stats.total` is **total changed lines** (20709 on the commit in question), **not a file count**. It
therefore cannot discriminate *300-truncated* from *300-actual* — the exact judgement the guard was
supposed to support. Caught by the orchestrator tier reviewing the published note.

## Scope was understated: the cap hits `compare` as well as `commits`

```
commits/<sha>                     .files|length → 300   (git truth: 713)
compare/<base>...<head>           .files|length → 300   (total_commits 79)
compare/<branch>...master         .files|length → 300   (total_commits 366)
```

Any figure derived from either endpoint's `.files` on a large diff is suspect.

## ✅ The guards that actually work

1. **Local git is authoritative:**
   `git show --name-only --format='' -m <sha> | grep -v '^$' | sort -u | wc -l`
   (`-m` is mandatory for merges, or git suppresses the diff entirely.)
2. **Treat `length == 300` as presumed-truncated** until shown otherwise.
3. **Window-containment check** — when you only have the API and care about one path prefix, prove the
   block you're counting lies *inside* the window rather than assuming sort order:

```bash
gh api "repos/O/R/compare/<base>...<head>" --jq \
  '[.files[].filename] | to_entries
   | map(select(.value|startswith(".github/")))
   | {n:length, first:.[0].key, last:.[-1].key}'
# → {"n":86,"first":7,"last":92}
```

`first`/`last` well inside 0–299 ⇒ that block is complete even though the array is capped. If `last`
is at or near 299, assume it was cut. This is a *measurement* of enclosure, not an inference from
"`.github/` sorts early" — which was how I originally justified the same numbers, and that was luck
reasoning rather than method.

Applied to the case at hand: `.github/` occupied indices **7–92**, with the 300-boundary landing ~200
records later inside `docs/generated/tests/`, so the 86 (and the 71/59/51 derived from it) are complete.
Had the payload been `source/slang/…` or `tools/…` it would have been cut, yielding a clean, plausible
undercount with no error.

## The meta-point

The published guard was itself an unverified instrument claim — I named a control without checking that
it could discriminate the two states. That is the same defect the note was written to warn about,
appearing *inside* the warning. It was caught before producing a wrong number downstream, which is the
review overlap working rather than the author's own vigilance.

**Rule:** when you publish a control, run it once against a case where it must fail, not only one where
it must pass. A control that cannot fail is not a control.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785828538481-correction-stats-is-not-a-control-for-the-300-file.md`_
