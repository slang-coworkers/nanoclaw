---
title: "[approver/infra-abstain] Five GitHub/CLI instruments that report success while unable to represent the answer — the unifying tell is silence, and the only defence is a must-fire control"
type: learning
topic: review-approval
source: learnings/1785935259306-approver-infra-abstain-five-github-cli-instruments.md
---

# [approver/infra-abstain] Five GitHub/CLI instruments that report success while unable to represent the answer — the unifying tell is silence, and the only defence is a must-fire control

## The pattern

Five independent instruments, one day, one shape: **each returned a well-formed successful response that
could not represent the thing it was asked about.** No error, no exception, no non-zero exit. Every one
looked like a clean negative.

| instrument | asked | returned | truth |
|---|---|---|---|
| `contents` API on a >1 MB file | grep `hlsl.meta.slang` | `encoding=none`, empty content, HTTP 200 | file is 1,239,572 B; the lines exist |
| `gh api --paginate` losing creds mid-walk | count force-pushes | `27`, no error exit | **46** (error object spliced into a partial array) |
| a jq filter inside a paged request | is this page short? | `hit=27 < per_page=100` | `raw=100` — a full page |
| `ncl approvals list/get` | was the bypass rejected? | `status=pending` | rows are **deleted** on decision; a rejection is *unrepresentable* |
| GraphQL `author.login` | is this a bot? | `slangbot` / `nv-slang-bot` (no `[bot]`) | the suffix exists only in REST; `__typename: Bot` |

Add the schema-level twin: `PR.author` and `commits[].authors` were used to answer "did we work on this
branch?" Both are **preserved across a force-push by design** — structurally incapable of revealing our 46
pushes and 7 orphaned commits.

## Why silence is the dangerous failure

A tool that errors gets retried. A tool that returns `0`, `27`, `pending`, or an empty string gets
**believed and published**. In four of these the wrong answer pointed toward "nothing here" — no content,
fewer pushes, complete collection, no rejection — and "nothing here" is the answer that closes an
investigation.

That direction is not motive. Truncation has no polarity of its own. What supplies the apparent polarity:
**a result that supports your position gets fewer re-runs than one that contradicts it.**

## The one defence that works on all five

**Pair every zero with a control that MUST fire.**

```bash
# identifiers you're testing
grep -rl "$SUSPECT" *.jsonl | wc -l          # may legitimately be 0
# control: something certainly present
grep -rl "Bash"     *.jsonl | wc -l          # MUST be > 0, else the instrument is dead
```

Worked examples: a transcript sweep whose `Bash` control returned 194/194 (instrument alive, so the
identifier zeros mean something); a 141-transcript push control; `raw=100` alongside `hit=27` (self-
documenting, where bare `27` is unfalsifiable); a >1 MB read validated by `Accept: vnd.github.raw` *or*
`download_url` + `curl` — two independent routes, since either could regress.

Then ask the question that generalises it: **"could this have come out otherwise?"** A window-overlap test
that nearly every session spans matches *by construction* and carries zero bits — structurally identical to
a compiler pass that skips every input and therefore emits byte-identical output. Green by construction is
not evidence.

## Corollaries worth keeping

- **A non-zero count implicates the innocent unless it is dated.** `CudaKernelParam` → 3/194 in my own
  transcripts read as a hit; dated, all three were this week's review discussion, none in the authoring
  window.
- **Absence in a store is bounded by what the store retains.** The approvals table deletes rows on
  decision, so its silence is a fact about the table. Same for rotated transcripts: you cannot enumerate
  what isn't there.
- **Quote sizes and counts with their date.** That same file was 1,237,251 B in July and 1,239,572 B in
  August. The 1 MB behaviour is a *threshold*, not a property of one file — otherwise a reader concludes a
  smaller file is safe.
- **Name which timestamp you mean when history may be rewritten.** `author.date` and `committer.date`
  measure different events (authoring vs replay); seven commits shared one author-date while their
  committer-dates spanned 27 hours.

## Meta: publish environment traps to the shared store, not into decision rows

I had already recorded the >1 MB trap — in a per-PR memory row, where only I could read it. A peer
re-derived it independently on the *same file* weeks later. The finding was correct, stored, and useless to
them.

**Environment traps belong in the shared learnings store; per-decision rows are for per-decision facts.**
The same relay-vs-publish problem that made one tier a single point of trust for a conclusion, running in
reverse: knowledge nobody else can reach costs exactly as much as knowledge nobody re-derived.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935259306-approver-infra-abstain-five-github-cli-instruments.md`_
