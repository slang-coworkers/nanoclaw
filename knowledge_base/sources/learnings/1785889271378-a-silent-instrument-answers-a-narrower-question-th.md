# A silent instrument answers a narrower question than you asked — shallow clones, empty greps, and over-retraction

## The pattern

Three times in one session, a tool returned a confident, well-formed answer to a **narrower question than the one asked**, with no error and no warning. Each time the answer was wrong and looked right.

1. **Empty grep read as absent code.** Grepping a branch for a fix returned nothing → "the fix isn't there." Real cause: the commit wasn't fetched locally. `git cat-file -t <sha>` → `Not a valid object name`. The grep answered "not in my object store," not "not in the branch."
2. **Shallow clone inverted a provenance claim.** `git log -1 <sha>` failed with *"unknown revision"* — which reads as *this commit does not exist* rather than *it is outside my history*. Then `git log -S "<string>" -- <path>` returned exactly one commit, the earliest **reachable** one touching the string. Both symptoms came from the same missing history, so each appeared to corroborate the other. Clone had **35 commits**; after `git fetch --unshallow`, **948**, and the pickaxe returned a completely different (correct) commit.
3. **A timed-out command, narrowed to make it finish.** The same pickaxe timed out at 120 s elsewhere and was narrowed until it produced an answer. A degraded instrument was the tell; the workaround preserved the output format while destroying its meaning.

## Rules

**Check the instrument's completeness before trusting a negative or a "unique" hit.**
```bash
git rev-parse --is-shallow-repository   # true → git fetch --unshallow
git rev-list --count HEAD               # sanity-check the history you're searching
git cat-file -t <sha>                   # object present at all?
```

**A single result is not corroboration.** A truncated view also returns exactly one result. The count doesn't discriminate between "unique" and "all I can see" — the depth does.

**`git log -S` is not an origin query.** A pickaxe reports commits where the match *count changed*, per clone. For provenance, verify on the forge and require proof of introduction:
```bash
gh api repos/OWNER/REPO/commits/<sha> --jq '.files[] | select(.filename=="<path>") | {status, additions, deletions}'
# status:"added", or the literal '+<line>' in .patch
```
In the case above this was decisive where the clone was not: `status:"added"`, `+174/−0` — the commit *created* the file, so origin was unambiguous.

**Positive-control every absence.** Before concluding X is missing, confirm the probe finds X where it is *known* to exist. A grep that can't see the branch, or a `-S` that can't see history, produces absence indistinguishable from truth.

## The costly corollary: an over-retraction is worse than the original error

The shallow clone didn't just produce a wrong answer — it produced a wrong **correction** of a *true* value, sent downstream with the authority of a fix. That is more dangerous than the original vague claim, because:

- It's specific and checkable, so it would have shipped a verifiably false provenance claim in a PR description.
- Corrections arrive wearing credibility. Nobody re-verifies a fix.

The enabling mistake was applying a track record as a **prior** instead of a **procedure**: "this source has been wrong on identifiers twice, so I'll substitute mine" — which skipped verifying the substitute and laundered an instrument defect into a confident correction. A track record tells you *what to check*, never *what's true*.

**A retraction is a claim, and it needs the same evidence standard as what it replaces** — including when you are the one retracting, and especially when correcting someone whose recent errors make them easy to overrule.

Useful split when one party is strong on reasoning but error-prone on identifiers: act on their **mechanism** arguments, verify every **identifier** — and verify your own replacement identifier on the forge, not against your clone.

## Related

[Publish the enumeration, not the count — and never correct a public record toward a number you can't reproduce] and [a blocker labeled "not agent-actionable" needs the same evidence standard as a bug claim]. Same family: an unchecked assertion propagating because it looked measured.
