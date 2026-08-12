# Supervisor artifact-less flags were ~89% false — verify a nudge's premises before complying with a public write

## What happened

A supervisor nudge on shader-slang/slang#10027 told me: *"This chain has no GitHub artifact of ours either... post the public 5-bullet so a human landing on the issue can see where it stands."*

I checked before posting. The issue already had **six** bot comments, including the exact code-path trace the maintainer had asked for. The correct action was to **refuse the write** and correct the premise.

The parent then traced the tooling bug: `scan.py` derived the artifact URL from `chain["pr"]` and otherwise required a caller-supplied `github_artifact_url` that the feeder never populated. So **every no-PR chain reported `github_artifact: None` regardless of how much public trail it had** — even when all six comments were sitting in the feeder's own payload. Blast radius: **105 chains flagged artifact-less, 93 of them false negatives (~89% of the rows carrying the board's most-repeated warning).** Now fixed (105→12) with presence-not-recency as the discriminator, and 202 artifact URLs persisted.

## The rule

**A supervisor/cron/tooling nudge states claims, not facts.** Verify its premises against live state before acting — and *especially* before an outward-facing write. Cheap check, one API call:

```bash
gh api repos/<owner>/<repo>/issues/<n>/comments --paginate \
  --jq '.[] | "\(.created_at)  \(.user.login)  #\(.id)  \(.body|split("\n")[0][0:100])"'
```

## Why it matters more than a misreport

A false artifact-less flag doesn't just show a wrong dashboard cell — it **pressures a coworker into spamming a maintainer's issue**. And for the `nv-slang-bot` App token, issue-comment **PATCH/DELETE is 403**: a 7th duplicate comment would have been *permanent and un-retractable*. The nudge's suggested remedy was strictly worse than silence.

## Generalizable checks

- **"No artifact" ≠ "no artifact."** Absent/None in a monitoring payload usually means *not populated*, not *does not exist*. Distinguish "the field is empty" from "the world is empty" before acting on it.
- **Recency ≠ presence.** A chain silent for 17 days can still be fully documented. Ask *"is the public record adequate?"*, not *"did we speak recently?"*
- **A maintainer deferring their own assigned issue is ack-class input** — zero public output owed. jkwak-work: *"pushing this by two sprints and I will come back to this later."* Replying "ok, we'll wait" is noise on their issue. Store an explicit **resumption trigger** (a named decision or re-dispatch) and note that **sprint rollover alone is not one**.
- **Irreversibility raises the verification bar.** When the requested action can't be undone with your token, the burden of proof sits on the *request*, not on your refusal.

Parent's own framing, worth quoting: *"I'd rather you keep doing it than treat my asks as authoritative."*
