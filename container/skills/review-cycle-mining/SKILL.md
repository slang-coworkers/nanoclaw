---
name: review-cycle-mining
license: MIT
description: "Daily 'why did this PR take so many review rounds' miner for the Orchestrator. Reads the review-cycles snapshot (/workspace/shared/reports/review-rounds.json, schema 3, perPR), picks PRs with > 5 human review rounds or > 15 valid human comments that have not been explained yet, reads their review threads with gh (read-only), and writes one compact evidence-backed record per PR into review-cycles-why.json for the dashboard's 'PRs with > 5 rounds' table. Deterministic selection and merge live in mine_select.py; you supply the reading and the explanation. Triggers on \"mine review cycles\", \"why did PR #N take so many rounds\", \"review-cycle-mining\"."
---

# review-cycle-mining

> **Scope:** this skill runs in the **Orchestrator (Main) group only**. It needs read-write on
> `/workspace/shared` (only the admin group has it) and read-only GitHub access through the
> gateway. It changes nothing on GitHub: no comments, no reviews, no labels, no reactions.
> Its whole output is one JSON file the dashboard reads and one line on the task destination.

The dashboard's review-cycles panel shows *how many* human review rounds and comments each
PR took (`scripts/review-rounds.py`, every 30 minutes). It cannot say *why*. This skill fills
the "why it took this long" slot for the PRs at the tail: it reads the actual threads and
records a short, quotable explanation plus one rule the team could adopt. The 2026-09-09 audit
found that the tail was mostly explainable (a July design review merging in September, ten
"remove this comment" nits on one PR, one PR that genuinely needed steering) and that nobody
had written those explanations down anywhere a chart could point at.

You are the LLM in this loop. Everything that must be identical on every run is code:

| Step | Who | Where |
|---|---|---|
| Which PRs qualify, in what order, skipping the ones already explained | `mine_select.py select` | `/workspace/shared/.mine_select.py` (installed from `scripts/mine_select.py`) |
| Whether the task wakes at all | `mine_select.py gate` | the task's `--script` (`ops/slang-coworkers-prod/review-cycle-mining/gate.sh`) |
| Reading the threads, deciding categories, writing the explanation | **you** | this document |
| Validating records, newest-first order, keep 200, atomic write | `mine_select.py merge` | same helper |

## Inputs and outputs

**Input:** `/workspace/shared/reports/review-rounds.json`, `schema >= 3`, `complete: true`.
The `perPR` rows carry everything the selection needs and most of what you need to read
first: `rounds`, `comments`, `reviewers`, `classification` (question / change_request / nit /
ack / process / other), `longestComments` (up to 5, longest first, 200 chars each),
`activityWeeks`, `reviewDurationDays`, `truncated`, `removed` (how many automation, command,
duplicate and self comments were filtered out). The `filters` block at the top level is the
authoritative automation filter (`botLogins`, `botLoginPatterns`, `boardSyncMarkers`,
`dispatchCommandPattern`): apply the same one when you read raw threads, so your reading
matches the count you are explaining.

**Output:** `/workspace/shared/reports/review-cycles-why.json`:

```json
{"schema": 1, "updatedAt": "2026-09-10T05:31:07Z", "count": 12, "records": [
  {"repo": "shader-slang/slang", "number": 12186,
   "url": "https://github.com/shader-slang/slang/pull/12186",
   "rounds": 7, "comments": 29, "minedAt": "2026-09-10T05:30:41Z",
   "whyShort": "Six-week design review opened in July: three reviewers disagreed on the SPIR-V representation and the author reworked it twice before the September merge.",
   "whyLong": "...up to 1200 chars, what happened in time order, who asked for what, what the author changed...",
   "categories": ["design_disagreement", "understanding"],
   "quotes": [{"author": "pdeayton-nv", "date": "2026-07-24T16:29:03Z",
               "text": "There is a latent bug here: kIROp_TextureType covers both ordinary images and combined image/sampler types."}],
   "suggestedRule": "Land a one-page design note before a representation-changing PR so reviewers agree on the shape before the code exists."}
]}
```

Records are keyed by `repo` + `number`; the dashboard joins them onto the "PRs with > 5
rounds" table by that key. Newest `minedAt` first, at most 200 kept. Caps are enforced by the
merge, not clipped: `whyShort` <= 240 chars (one line), `whyLong` <= 1200, `suggestedRule`
<= 300 (one sentence, one line), at most 3 `quotes` of <= 160 chars each, `categories` a
non-empty subset of the nine below with no repeats.

## Procedure

### 0. Preflight (30 seconds, no gh)

```bash
H=/workspace/shared/.mine_select.py
[ -f "$H" ] || echo "HELPER MISSING: see ops/slang-coworkers-prod/review-cycle-mining/README.md"
mkdir -p /tmp/rcm && python3 "$H" select > /tmp/rcm/batch.json; echo "select rc=$?"
python3 -c 'import json;d=json.load(open("/tmp/rcm/batch.json"));print(d.get("error") or d.get("reason") or f"{len(d[\"batch\"])} of {d[\"candidates\"]} candidates, {d[\"alreadyMined\"]} already mined")'
```

- `error` set: stop, report it (step 4, error form). Do not improvise a selection by hand; a
  missing helper or a snapshot on the old shape is an operator problem.
- `reason` set (snapshot `complete: false`): stop silently unless the gate woke you, in which
  case report the reason in one line.
- Empty `batch`: nothing to mine; report "0 new candidates" only if you were woken.

The batch is at most 10 PRs (the helper's `--limit`), most rounds first. Work through the whole
batch; what is left over is tomorrow's run.

### 1. Read one PR (read-only gh, bounded)

For each row in `batch` (`R` = repo, `N` = number):

```bash
cd /tmp/rcm
gh pr view "$N" --repo "$R" --json number,title,state,isDraft,author,createdAt,mergedAt,closedAt,additions,deletions,changedFiles,labels,commits,reviews,statusCheckRollup > "pr-$N.json"
gh api --paginate "repos/$R/pulls/$N/comments"  > "inline-$N.json"   # review-thread comments (in_reply_to_id links a thread)
gh api --paginate "repos/$R/issues/$N/comments" > "conv-$N.json"     # conversation comments
gh api --paginate "repos/$R/issues/$N/timeline" -H 'Accept: application/vnd.github+json' \
  --jq '[.[] | select(.event=="head_ref_force_pushed" or .event=="review_requested" or .event=="ready_for_review" or .event=="convert_to_draft")] | map({event, created_at})' > "timeline-$N.json"
```

Redirect everything to files and read with `jq`/`python3`; never page a whole comment dump
into the transcript. Then:

1. **Filter like the producer.** Drop comments whose author is the PR author, matches
   `filters.botLogins` / `filters.botLoginPatterns`, or whose body contains a
   `filters.boardSyncMarkers` entry or matches `filters.dispatchCommandPattern` (bodies
   <= 120 chars). What remains is the population the `comments` count describes.
2. **Order by time** and read the thread openers and the conversation comments in sequence.
   Cap yourself at ~150 comments per PR: when a PR has more, read every conversation comment,
   the 30 longest inline comments and the first and last 20 in time. Say in `whyLong` that
   the reading was sampled. A row with `truncated: true` is a floor; say that too.
3. **Note the shape**, because the categories are about shape, not blame:
   - review submissions per reviewer and the gaps between an author push and the next
     review (`reviews[].submittedAt` vs `commits[].committedDate`);
   - force pushes and commit count (author churn) from the timeline and `commits`;
   - CI mentions ("rerun", "flaky", "unrelated failure") and `statusCheckRollup`
     conclusions on the final head;
   - how many threads are `nit`-shaped (rename, remove comment, formatting) versus
     substantive change requests; the row's `classification` already counts these;
   - whether reviewers are asking what the change does (understanding) versus disagreeing
     with what it should do (design);
   - whether the PR's scope grew after opening (new files, "while you are here", a second
     issue folded in).

### 2. Decide categories (evidence, not vibes)

Pick every category the threads support, one to three in practice, in the order of weight.

| Category | Use when the threads show |
|---|---|
| `understanding` | Reviewers asking what the change does or why it is correct before they can judge it ("please explain", "I don't follow", "what does this handle"). |
| `design_disagreement` | Reviewers proposing a different approach, representation or API than the PR takes; back-and-forth on *what* rather than *how*. |
| `scope_creep` | Work added after opening: extra fixes folded in, new surface area requested and delivered, a second issue closed by the same PR. |
| `ci_flakiness` | Rounds spent on failures unrelated to the diff: reruns, infra, known-flaky tests, a reviewer asking for a rebase because CI went red on its own. |
| `style_nits` | A large share of threads are renames, comment wording, formatting, "remove this comment", verbosity. The row's `classification.nit` is the hint. |
| `missing_tests` | Reviewers asking for tests, coverage, a repro, or a regression test before approving. |
| `slow_reviewer` | Long idle gaps (days) between an author push and the next human review with the ball on the reviewer's side. State the gap length. |
| `author_churn` | Repeated force pushes or rewrites between reviews, fixes that missed the ask and came back, or the author changing approach mid-review. |
| `automation_noise` | The counted comments include material the filter did not catch (AI-assisted human review bursts, notices from a user account) that inflated the number without adding review. Name what it was. |

When two categories compete, prefer the one a maintainer could act on. Do not invent a
category; if none fits, use the closest and say so in `whyLong`.

### 3. Write the record

One object per PR, appended to `/tmp/rcm/new.json` as a JSON list. Rules for the prose:

- **`whyShort`** (<= 240, one line): the one-sentence answer a maintainer scans in a table.
  Lead with the mechanism, not the count ("Design review that outlived two rewrites", not
  "29 comments").
- **`whyLong`** (<= 1200): what happened in time order; who asked for what (logins are fine,
  they are public on the PR); what the author changed in response; what finally unblocked
  it. Describe the process, never the person's competence or intent.
- **`quotes`** (<= 3, <= 160 chars each): verbatim excerpts, chosen because they *evidence*
  the categories, with the comment's real `createdAt`. Never quote a filtered automation
  comment, never paraphrase inside quotation marks, cut with `...` at a word boundary.
- **`suggestedRule`** (<= 300, one sentence): something the team could adopt, phrased as a
  practice ("Open a design note before...", "Batch nits into one review pass...",
  "Rebase on red CI only after checking the failure is ours..."). If the honest answer is
  "nothing to change, this was a real design review", say that in one sentence.
- `rounds` and `comments`: copy from the batch row, so the record matches the chart it
  explains. Optional provenance the merge keeps: `title`, `authorClass`, `state`.

Then merge (this validates every record first and writes nothing if any fails):

```bash
python3 /workspace/shared/.mine_select.py merge --new /tmp/rcm/new.json
```

A refusal lists each problem with the actual length and the cap (`whyShort is 251 chars; cap
is 240`). Fix the record and re-run; do not edit `review-cycles-why.json` by hand, and do not
shorten a quote by paraphrasing it.

### 4. Report ONE line to the task destination

Use the task's chat destination (`ncl destinations list`; the task prompt names it). Formats:

```
review-cycle-mining: mined 4/9 (slang#12186 r7/c29 design_disagreement+understanding; slang#12378 r6/c17 style_nits; ...); 5 left for tomorrow; why-file 16 records
review-cycle-mining: 0 new candidates (snapshot 2026-09-10T05:00:12Z, 16 already mined)
review-cycle-mining: gate error: snapshot schema 2 has no perPR list; review-cycles v2 (schema >= 3) is not deployed
```

Nothing else: no PR, no git, no GitHub comment, no second message. A gate error is the
alert; it is the operator's job to fix the pipeline, and repeating the line daily until they
do is the intended behaviour.

## Rules

- **Read-only on GitHub.** `gh pr view`, `gh api GET` and `--paginate` only. Never `gh pr
  comment`, `gh pr review`, `gh api -X POST/PATCH/DELETE`, never a reaction. If a command you
  are about to run would write, you are off-script.
- **The helper decides, you explain.** Do not add PRs the selection did not return, do not
  re-mine a PR already in the why file (the selection already skipped it), do not change the
  thresholds in your head. To re-explain a PR, an operator deletes its record.
- **Same filter as the chart.** A comment the producer removed as automation is not
  evidence. If you believe the filter is wrong, say so in the report line, do not work around
  it.
- **Bounded run.** At most 10 PRs, at most ~150 comments read per PR, outputs redirected to
  `/tmp/rcm/`. A PR you could not finish stays unmined and comes back tomorrow; never write
  a half-read record.
- **No speculation about people.** Categories describe the review process. "Reviewer was
  slow" becomes "11-day gap between the 08-04 push and the next review". Quotes are public
  comments on public PRs and are cited verbatim with their date.
- **Write nothing outside** `/workspace/shared/reports/review-cycles-why.json` and `/tmp/rcm/`.

## Manual use

Ask the Orchestrator "why did shader-slang/slang#12841 take so many rounds" and it runs the
same procedure for that one PR: `python3 /workspace/shared/.mine_select.py select --repo
shader-slang/slang --limit 50`, pick the row, steps 1 to 3, then answer in chat with the
record's `whyShort`, categories and quotes. Merge it too, so the dashboard learns the answer.
If the PR is under both thresholds the selection will not return it; read it with the same
step-1 commands and answer in chat without writing a record.
