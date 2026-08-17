---
title: "gh patch endpoint 406s above 300 files, poisoning grep scans"
type: learning
topic: misc
source: learnings/1785812823235-gh-patch-endpoint-406s-above-300-files-poisoning-g.md
---

# gh patch endpoint 406s above 300 files, poisoning grep scans

# `gh api …v3.patch` returns a 406 error body above 300 files — grepping it yields a false clean

**Context:** reviewing `slang-coworkers/nanoclaw#1062` (KB sync, 391 files, +34524/−6378) for PII/credential leakage before classifying it.

## What happened

```bash
gh api repos/O/R/pulls/N -H "Accept: application/vnd.github.v3.patch" > p.patch
grep -E '^\+' p.patch | grep -oiE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | grep -c ''
# => 0     ("no PII!")
```

The `0` was worthless. GitHub's patch/diff media types **hard-fail at 300 files**:

```json
{"message":"Sorry, the diff exceeded the maximum number of files (300). Consider using
'List pull requests files' API or locally cloning the repository instead.","status":"406"}
```

`gh api` wrote that **337-byte JSON error into the output file** and the grep dutifully found no emails in it. A scan of an error message looks identical to a clean scan.

## Detection

The byte count gave it away: 337 bytes cannot be a +34,524-line diff. **Print the artifact's size as a non-zero control before grepping it.**

## Working substitute

The `compare` endpoint has no 300-file cap:

```bash
gh api repos/O/R/compare/<sha>^...<sha> -H "Accept: application/vnd.github.v3.diff" > d.diff
wc -c < d.diff          # 3194375 — plausible for the stated diff size
grep -cE '^\+' d.diff   # 34915 — matches PR's stated +34524 (±hunk headers)
```

`pulls/N/files?per_page=100&page=K` (paginated) is the right instrument for *path* enumeration — but note `items`-style pagination caps, and that it gives you filenames and counts, not line content.

## The general rule

**Pair every absence claim with two controls:**
1. **Non-zero control on the artifact** — `wc -c` / `grep -c ''` proving you scanned real content of the expected magnitude.
2. **Positive control on the pattern** — feed the regex a synthetic known-positive:
   ```bash
   printf '+ contact [REDACTED-EMAIL] here\n' | grep -oiE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
   ```
   If that prints nothing, the regex is broken and your `0` means nothing.

With both controls green, the 0 hits on #1062 were real. Without them it was an unfalsified guess dressed as a verification.

## Bonus: credential-shape false positive

`grep -oiE 'sk-[A-Za-z0-9_-]{20,}'` fired twice — on a **filename**, `…a-pin-independent-fix-s-risk-baseline-is-the-pinne.md` (`risk-baseline-is-the-pinne`). Always print surrounding context for a secret-shaped hit before calling it a leak; `diff --git` header lines are a rich source of accidental matches.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785812823235-gh-patch-endpoint-406s-above-300-files-poisoning-g.md`_
