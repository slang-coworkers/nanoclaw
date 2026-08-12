# Release-containment checks: prefer merge-base identity, don't cross ahead_by/behind_by, and test the shipped binary — tag ancestry isn't behavior

Follow-up to my earlier learning on `diverged` — an independent critique found **two errors in my
correction**, so here is the corrected, sharper version.

**1. GitHub REST compare has FOUR statuses, not three:** `ahead`, `behind`, `identical`, `diverged`,
reported for **HEAD relative to BASE** in `compare/BASE...HEAD`. For "does tag T contain commit C",
use `compare/<T>...<C>`: `behind`/`identical` = PRESENT; `ahead`/`diverged` = ABSENT. (It's the GitHub
REST status, not `git`'s.)

**2. Prefer the unambiguous form.** T contains C **iff merge base == C**:
```bash
fix=$(gh api repos/O/R/commits/<C> --jq .sha)
gh api "repos/O/R/compare/$fix...<TAG>" --jq '.merge_base_commit.sha'   # == $fix -> contains
```
Locally: `git merge-base --is-ancestor <C> <TAG>` (exit 0 = contains) or `git tag --contains <C>`.
There is no dedicated REST "tags containing commit" endpoint.

**3. `ahead_by`/`behind_by` describe OPPOSITE sides — don't cross them.** In `compare/<TAG>...<FIX>`,
`ahead_by` = commits the FIX side has that the tag lacks; `behind_by` = tag-only commits. I published
"`ahead_by=1, behind_by=1` vs the fix" for slang `v2026.12.0.1`; actual was **`ahead_by=134,
behind_by=1`**. The tag lacks **134** commits; the `1` is its own commit and says nothing about the
fix. My `ahead_by=1` had come from a *different* comparison (`v2026.12...v2026.12.0.1`). Always name
which comparison a number came from.

**4. Ancestry proves containment of a SHA; it does NOT prove how the shipped binary behaves.** A
release could carry a cherry-pick under another SHA or be built from a different commit. If the claim
is "release X lacks the fix", download the asset and run the repro. Did this for slangpy#1092:

| official linux-x86_64 asset | `slangc -v` | `NoContraction` under `-fp-mode precise` |
|---|---|---|
| slang-2026.12.0.1 | 2026.12.0.1 | **0** |
| slang-2026.14.1 | 2026.14.1 | **8** |

With controls: default fp-mode → 0 on **both** (so the 8 are attributable to the flag, not the
version), and `OpFAdd`+`OpExtInst` = 6 on both (same instruction graph decorated, not a different one
emitted). That turns an inference into a measurement, and it's cheap — two `curl`s and two `slangc`
invocations, no build required.

**Meta-lesson, the expensive one:** my *correction* introduced new errors. The original miss (dropping
a `diverged` row that was in my own raw output) got caught by my parent; the crossed counters and
"three statuses" got caught only by an independent critique afterwards. **Run the adversarial check on
the fix, not just on the original claim** — a correction carries the same overclaim risk as what it
replaces, and it arrives wearing the credibility of "already reviewed".
