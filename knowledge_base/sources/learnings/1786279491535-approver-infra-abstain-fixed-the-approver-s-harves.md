# [approver/infra-abstain] FIXED: the approver's harvest scripts never read pulls/N/comments, where the findings actually live — and original_commit_id is the only usable SHA attribution

## Symptom

On shader-slang/slang-rhi#817 `collect-reviews.sh` returned **exit 0, `found:true`,
`stale:false`** — a clean, head-current harvest — and the harvested review body was
pure boilerplate: `**Actionable comments posted: 2**` plus run-configuration. Both
of CodeRabbit's 🟠 Major findings were invisible to the harvest. Deciding from the
synthesized doc alone, on a PR whose clauses were 6/6 and whose CI was green, would
have produced a **false WOULD_APPROVE**.

Measured byte sizes on that PR (three revisions' worth):

| endpoint | content |
|---|---|
| `pulls/817/reviews` | 3 envelopes: 699 / 699 / 1695 chars, near-boilerplate |
| `pulls/817/comments` | the 3 real findings: 2627 / 1882 / **7061** chars |
| `issues/817/comments` | board-sync notice + a CodeRabbit summary |

## Root cause

Two of the three PR comment endpoints were being read and the findings-bearing one
was not:

- `collect-reviews.sh` fetched `pulls/$PR/reviews` and `issues/$PR/comments`.
- `harvest-reviews.py` fetched only `pulls/$PR/reviews`.
- **Neither fetched `pulls/$PR/comments`** — the inline review-comments endpoint.

A review's `body` and its inline comments are separate objects. CodeRabbit (and any
reviewer working inline) puts the substance in the comments and leaves a summary
envelope in the body, so a review with N findings and an empty-looking body is the
*normal* case, not an anomaly. `Actionable comments posted: N` with N>0 and no
severity markers in the body is the tell.

## The second trap: `commit_id` lies on this endpoint

`pulls/N/comments[].commit_id` is **re-pointed by GitHub to the current head** as the
branch moves. On #817 all three findings — raised at `f7b5b798`, `f7b5b798`, and
`0d8fadad` — reported `commit_id = 4a9c1ade` once the branch reached that head. Use
**`original_commit_id`**, which preserves the sha the comment was raised at.

Note the asymmetry, because it matters for staleness logic: `pulls/N/reviews[].commit_id`
does **not** drift — each review keeps a stable per-push sha. So `harvest-reviews.py`'s
staleness computation (which keys on the reviews endpoint) was never compromised. I
suspected it was, checked before propagating the suspicion, and it was fine. An
instrument-doubt is a hypothesis, not a finding.

## Fix (applied and verified, both scripts)

Patched on my container at `/home/node/.claude/skills/slang-pr-approver/scripts/`.
**Strictly additive — the exit-code contract the workflow branches on is untouched:**

- `collect-reviews.sh`: fetches `pulls/$PR/comments`; filters to the trusted bot
  logins; attributes each comment by `original_commit_id`; writes a new
  `review/inline-comments.md` artifact (each finding headed with `path:line` and the
  sha it was raised at, marked `**(pinned)**` when it matches); adds
  `inline_comment_count` / `inline_comment_count_at_pinned` to `harvest.json` and
  `collect.json`, plus a dry-run line.
- `harvest-reviews.py`: same fetch, best-effort (`except → []`, so a comments-fetch
  failure never converts a review we *did* fetch into a failure), with the two counts
  merged into all four return payloads (exit 0 / 10 / 20 / 22).

Verified rather than assumed — exit codes still propagate exactly:

    match sha        -> 0     bogus sha -> 10     bad PR -> 21     (collect-reviews.sh)
    match sha        -> 0     bogus sha -> 10                      (harvest-reviews.py)

and on #817 both now report `inline_comment_count: 3`, with
`inline-comments.md` carrying all three findings correctly attributed
(`:146` and `:148` at `f7b5b798b2b6`, `:394` at `0d8fadad2077`).

## How to catch this class

- **A non-zero inline-comment count against a boilerplate review body means the
  findings are elsewhere.** That is now a field in `harvest.json`; read it.
- **Exit 0 tells you which bot was found, not that the primary bot was found, and
  not that the body carries the findings.** Check `collect.json.claude_collected`
  and the inline count separately.
- Generalization worth keeping: **when a rule names a target, enumerate every
  target.** "Read the posted review" has three endpoints, and I was reading two for
  months. Ask what other surfaces the same object is split across.
- The orchestrator could confirm the public half (endpoint byte sizes) but
  `find /workspace -name 'collect-reviews.sh'` returns nothing on its edge — the
  scripts are per-container. **A claim about a per-container artifact can only be
  verified, and fixed, by the container that holds it.** Don't file it as someone
  else's bug.
