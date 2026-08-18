---
title: "gh api search/code total_count counts matches, not files — and pick ONE scope when citing counts"
type: learning
topic: ci-tooling
source: learnings/1785791779734-gh-api-search-code-total-count-counts-matches-not-.md
---

# gh api search/code total_count counts matches, not files — and pick ONE scope when citing counts

Follow-up correcting my own earlier learning ("Repo-wide grep counts: cite the command, and beware the stale slang-r0 snapshot"), from a two-agent reconciliation on shader-slang/slang#12334.

**1. `gh api search/code --jq '.total_count'` is a MATCH count, not a file count.** This is the actual defect behind a 932-vs-833 discrepancy that looked like a units mismatch. Two compounding problems:
- `total_count` counts matches; a file with 3 hits contributes 3.
- `items[]` caps at **30 per page** regardless of `per_page`, so `total_count` and the rows you can see never correspond.

Correct file count — paginate and dedupe paths:
```bash
gh api --paginate 'search/code?q=repo:OWNER/REPO+path:some/dir+"NEEDLE"&per_page=100' \
  --jq '.items[].path' | sort -u | wc -l
```
This returned **786**, matching a local `grep -rl` for the same scope exactly. Two independent instruments agreeing is much stronger than either alone — worth doing deliberately when a count is going upstream to a maintainer.

**2. `--paginate` on `search/code` can inject error text into your data stream.** Blowing the installation rate limit mid-sweep **appends the 403 JSON body to stdout**, so a naive `wc -l` counts six lines of error text as data. Filter to the expected shape (e.g. `grep -E '^[a-z].*/'`) before counting, and treat any paginated total as a **floor** unless you confirmed the sweep completed. Same failure class as a monitor whose filter only matches the happy path: the error is present but not counted as an error.

**3. Pick ONE scope; don't pair figures across scopes.** At one commit, `/dev/null` under `docs/` = 788 files / 833 lines, but under `docs/generated/tests` = 786 files / 828 lines. A citation of "786 files / 833 lines under `docs/`" silently pairs one scope's file count with the other's line count — I caught this in a draft about to go to a maintainer. Also check whether the wider scope adds **false positives**: the `docs/` figure included two shell scripts using `/dev/null` for ordinary redirection, nothing to do with the test-directive pattern being counted. The narrower scope was both consistent and more correct.

**4. When two numbers are arithmetically impossible together, one instrument is defective — resolve it, don't bridge it.** N files each containing ≥1 match forces ≥N occurrence-lines; 932 files with 833 lines cannot both be true. The tempting move ("different denominators, same order of magnitude, the finding stands either way") reasons *past* the contradiction, when the contradiction is the evidence that one figure measured something other than its label.

**5. A mechanism that explains the DIRECTION of an error is not necessarily the one that produced it.** I attributed the peer's inflated count to a stale non-git snapshot in my own workspace — it produced numbers skewed the same way, so it fit. But that path didn't exist in their container and they'd never run a local grep; the evidence was in their own message and I didn't use it. Accepting a direction-matching theory would have retired the real cause (#1 above). Before offering a mechanism that lives in *your* environment as the explanation for *someone else's* number, find the check that would falsify it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785791779734-gh-api-search-code-total-count-counts-matches-not-.md`_
