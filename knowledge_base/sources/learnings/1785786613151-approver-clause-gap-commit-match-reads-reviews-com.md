# [approver/clause-gap] commit_match reads reviews[].commit_id, which GitHub retroactively rewrites to the current head

# `commit_match` passes on a 5-day-stale human approval

**Symptom.** slangpy#1068: the only human review was
`ccummingsNV APPROVED submitted_at=2026-07-29T10:05:29Z`. The head at decision
time was `266b2072e621`, a merge commit whose author **and** committer date is
`2026-08-03T19:22:22Z` — five days *after* the review. Yet
`reviews[].commit_id` reported `266b2072e621`. A review cannot have been
submitted against a commit that did not yet exist.

`eval-clauses.py`'s `commit_match` reads `commit_id` and duly reported
`"review commit_id=266b2072e621 == pinned"` — **pass**, on a stale approval.

**Root cause.** GitHub rewrites `reviews[].commit_id` to the PR's current head
under some update paths (here a web "Update branch" merge). The field is not a
stable record of what was reviewed, so any predicate of the form "the approval
is at the current head" evaluates TRUE on a stale approval. This is a false-safe
in the **approve** direction: the clause reports freshness it did not verify.

**Why the obvious spot-check does not work.** Asking `commit_id == head?` cannot
distinguish the two cases — other PRs (#1063, #1075) retained *historical*
`commit_id`s, so inequality is not a reliable staleness signal either. The
rewrite is silent and inconsistent across PRs.

**How to catch it.** Compare timestamps, not SHAs. A review is stale iff its
`submitted_at` precedes the author date of the commit it claims to review:

```bash
python3 tools/gh_read.py /repos/<owner>/<repo>/pulls/<n>/reviews --paginate  # submitted_at, commit_id
python3 tools/gh_read.py /repos/<owner>/<repo>/pulls/<n>/commits --paginate  # commit.author.date
# stale iff submitted_at < author_date(commit_id)
```

Independent control: slangpy#1084's `jkwak-work APPROVED` at `21:13:48Z` carries
a commit dated `22:22:34Z` (+69 min) — same pattern, different PR.

**Separate the two questions.** "Is the approval record stale?" is not "did the
reviewed code change?" On #1068 the net diff vs `main` was 1 file / +8 / −0 —
the merge commit only absorbed base drift, so the reviewed tree was
byte-identical. Report it as staleness-of-record, not as changed-code, or the
finding reads as more alarming than the evidence supports.

**Fix.** `commit_match` should derive staleness from
`submitted_at` vs `commits[].commit.author.date` and mark a
timestamp-inverted review **stale** (→ Devin-only tier, like harvest exit 10)
rather than passing it. Until then, do the timestamp comparison by hand on any
PR whose head is a merge/update commit, and remember the standing rule: a human
approval — fresh or stale — is a **JOIN signal**, never grounds to lift an
independent abstain.
