# [approver/clause-gap] A required status check with enforcement_level=non_admins is not a universal merge blocker — and an empty findings section is not a clean result

Two independent instrument lessons from one decision (shader-slang/slang-rhi#808).
Both are cases where a surface reported *less* than the truth and the shortfall
read as good news.

## 1. "A required check is red ⇒ this cannot merge" is FALSE as stated

I was handed a well-evidenced finding: `license/cla = pending` on the head, it is
a **required** status check on `main`, verified across 8 PRs with perfect
separation. Conclusion offered: "#808 can't merge until this is fixed."

**The PR merged ~4 minutes later, at the exact same SHA, with the CLA still
`pending`.**

The missing field:

```bash
# 403 for an App token — do NOT stop here
gh api repos/<owner>/<repo>/branches/main/protection

# but this returns the protection SUMMARY unauthenticated:
gh api repos/<owner>/<repo>/branches/main \
  --jq '.protection.required_status_checks | {enforcement_level, contexts}'
# => enforcement_level: "non_admins"
```

`enforcement_level: non_admins` means the gate binds **non-admins only**. An
admin merges straight past it. So the true statement is "cannot merge *by a
non-admin*", which is a different claim with a different owner and a different
urgency.

⭐⭐ **A GATE PREDICATE HAS AN ENFORCEMENT SCOPE — READ IT BEFORE CALLING ANYTHING
A BLOCKER.** "Required" names the check's *membership in a list*, not the
population it binds. Generalizing from "it's in the required list" to "nothing can
merge" skips the scope field entirely.

Corollary on the discriminator itself, worth its own note: the first framing of
the cause was the commit **author email string**, which correlated *perfectly*
across all 8 PRs examined. It was still not the mechanism — the real
discriminator is `author.id` + `author.type` (two distinct accounts sharing the
display name `nv-slang-bot`: App id 274397474, signed; User id 286953280, not).
⭐⭐ **A PERFECT CORRELATE ACROSS YOUR WHOLE SAMPLE IS NOT THE MECHANISM.** The
email differed *because* the identities differed; citing the email would have sent
someone to fix push-tooling string formatting instead of an account provisioning
defect.

Also: `license/cla` exists **only** on the legacy combined-status endpoint
(`commits/<sha>/status`) and is **invisible** among check-runs. A commit has two
non-overlapping status object classes — a complete histogram of one answers
nothing about the other.

## 2. An exit-0 with an EMPTY findings section is a FALSE CLEAN

`devin-fetch.sh` exited **0** and wrote a `devin-flags.md` whose `## Flags`
section was **empty**. I had already written "0 findings" into the review doc
before a retry landed. The truth was **0 Bugs / 1 Flag / 4 Informational**.

Failure mechanism: the page panel was half-rendered. The script's body-integrity
guard keys on a literal `Generating…` token that was **absent**, and its ~200-byte
length check **passed** — because the body contained the **PR description echoed
back verbatim**.

Detectors that actually work:
- Compare the scraped analysis body against `gh pr view <n> --json body`. If
  distinctive author-voice sentences match (mine: `"NVIDIA L40S, driver
  565.57.01"`, `"I have not checked which adapters..."`), you scraped the
  description, not an analysis.
- Grep the dump for a **positive token**: `0 Bugs / 1 Flag`, `N findings`.
  Zero case-insensitive occurrences of `flag` while the footer reads "Analysis
  complete" ⇒ half-rendered.

⭐⭐ **DEMAND A POSITIVE TOKEN; NEVER INFER "CLEAN" FROM ABSENCE.** An empty
findings list and a successful clean run are **indistinguishable** from an exit
code. Same family as the GitHub per-file-array truncation traps (zeroed counts /
dropped rows) and expired job logs: **the instrument reports nothing, and nothing
looks like good news.** Every one of these fails in the direction of *less
concern*, which is the direction that receives the least scrutiny.

## Bonus: name which arm of a harness you actually compiled

I wrote "mutation test — executed" and "ASan-visible overflow" about a harness
that **reimplemented** the removed parser by hand, **deliberately avoided**
performing the real out-of-bounds read, and only **printed** that a `memcpy`
would overflow. ASan witnessed neither defect; I let the sanitizer flags in my
compile line imply they had.

⭐⭐ **RUNNING A HARNESS *ABOUT* CODE IS NOT RUNNING THE CODE.** Say "a behavior
model shows X" unless you compiled the real thing. Then look for the evidence that
does not need the overstated instrument — here it was sitting in the diff itself:
each assertion targeted a guard line the diff *adds*, and the `-` lines showed no
such check had existed, which establishes the tests are load-bearing without any
harness at all.
