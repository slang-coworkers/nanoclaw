# [approver/clause-gap] Reviewing a rebased PR: compare/&lt;old-head&gt;...&lt;new-head&gt; lies, and a file leaving the diff can mean merged-upstream

# [approver/clause-gap] Two instrument traps on a rebased revision

From slangpy#1090 R4, where the head moved by a **rebase** rather than a push. Both traps
would have produced a wrong decision, in opposite directions.

## Trap 1 — `compare/<old-head>...<new-head>` manufactures findings out of upstream traffic

The habitual "what changed since I last decided?" call:

    GET /repos/{repo}/compare/{old_head}...{new_head}
    -> status: diverged, ahead_by 6, behind_by 3, 22 files
       including 7 .github/workflows/* and external/slang-rhi

The PR's actual proposed change was **6 files, +189/−29**. The extra 16 files were upstream
`main` commits swept in by the rebase plus the author's rewritten commits appearing as new
SHAs. Had I fed that to the policy clauses it would have produced a **protected-path hit**
(`.github/workflows/**` is protected in the conservative default) and inflated the size caps
— a `CLAUSE_FAIL` abstain caused entirely by commits the author never wrote.

**Rule: when `compare` returns `status: diverged`, it is the wrong instrument. Use the PR's
own base…head diff** (`GET /repos/{repo}/pulls/{n}/files`), which is what "the proposed
change" means. Cross-check the totals against a local `git diff <first-pr-commit>~1..HEAD
--stat`.

Reassuring corollary worth knowing: `eval-clauses.py` is **already correct** here — it
computes changed paths from `compare/{base_ref}...{commit_sha}`, i.e. base→head, not
old-head→new-head. The trap is in the *human/agent* reasoning around the script, not the
script. Don't "helpfully" hand it a diverged file list.

Also: on a rebase, "N heads stale" for an existing human review becomes **ill-defined** — the
review pins a sha that is no longer on the branch, so `git rev-list --count <that>..HEAD`
measures nothing. Report the review as open and undismissed and quote no distance.

## Trap 2 — a file *leaving* the PR's diff has two readings

The previous revision carried a submodule gitlink bump that delivered the fix for a BLOCK.
At R4 `external/slang-rhi` was **absent from the PR's diff entirely**. Absence reads two ways:

- the bump was **reverted** (fix lost ⇒ re-block), or
- it **landed upstream**, so the PR no longer needs to carry it (fix retained ⇒ fine).

These are opposite decisions from identical evidence. **Check the base's value before
concluding anything.** Three facts settled it, none sufficient alone:

1. PR head's pin == **`main`'s** pin (so the bump is in the base, not dropped);
2. the fix commit is an **ancestor** of the pinned sha (`git log --oneline` at the pin showed
   the intervening commit sitting directly on the fix);
3. the fix is **present in the source** at that pin (grep the changed function).

Then check the intervening commit(s) the pin moved through, rather than assuming a pin move is
inert: here one commit, touching only CUDA capability files, `grep -c <the API>` = 0.

This is the mirror of the earlier gitlink lesson: a `+1/−1` gitlink hides its payload on the
way *in*, and its absence hides a non-change on the way *out*. Same file, opposite failure.

## Bonus — staleness discriminators invert when the diff shape changes

Earlier revisions dated a stale bot analysis by *which* gitlink sha it rendered. Post-rebase
the PR has **no gitlink at all**, so the discriminator flipped: rendering *any*
`Subproject commit` hunk now proves staleness. A tool's page *header* may show live metadata
(correct file count) while the analysis panel below is a cached older run — header agreement
is not currency.

When reusing a stale analysis, measure applicability instead of asserting it: compare per-file
**blob shas** across the rebase (`git rev-parse <old>:<path>` vs `HEAD:<path>`). Here 4 of 6
files were byte-identical, so those findings applied verbatim; the 2 that moved had moved for
upstream reasons, not the PR's — which also independently confirmed that a bot's
"Major" finding on one of them was out of scope.
