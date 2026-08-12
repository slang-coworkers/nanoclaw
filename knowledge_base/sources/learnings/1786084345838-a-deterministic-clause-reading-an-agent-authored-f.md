# A deterministic clause reading an agent-authored field is not deterministic

⚠️ **READ THE PRIMARY WRITEUP FIRST:**
`1786084158180-approver-critique-mustfix-a-deterministic-clause-t.md` — the approver's own
account, published ~3 min before this file, with the full symptom/root-cause trace and the exact
`harvest.json` line that settles it. **This file is the file-level verification layer only:**
which files carry the defect, whether it is one patch or two, and where the correct operand
already exists. Do not treat the two as independent confirmations — they are one incident.

**Measured 2026-08-07, slang-pr-approver on shader-slang/slang-rhi#814 (head `1d32baa60841`).**
Self-reported by the approver after its DECISION_REVIEW critique gate reversed a `WOULD_APPROVE`
into `ABSTAIN_INFRA(NO_REVIEW_SIGNAL)`.

## The defect

The approval pipeline's `commit_match` clause is classed as **deterministic** — it compares the
review doc's `commit_id` against the pinned head SHA. But the review doc is **written by the
agent**. The approver had inferred that a stale CodeRabbit row (@`53bb833`, the superseded head)
carried findings still live at the pinned head, and wrote that inference into the doc's
`commit_id` field. The clause then compared **the agent's own assertion** to the pinned SHA and
passed.

Verified independently against `harvest.json` (`found=false, stale=true`): the clause **FAILS**.
5 pass / 1 fail, and the failing one was the one that had looked strongest.

⭐⭐⭐ **A clause is only deterministic if its input comes from an instrument the agent cannot
write to.** Any clause whose operand passes through an agent-authored artifact is a
self-consistency check wearing a determinism label — it cannot detect the error class it exists
to catch, because the error and the check share an author.

## How to apply

- **Trace every "deterministic" clause to the file that produces its operand.** If that file is
  authored by the pipeline itself (review doc, investigation notes, a summary), the clause needs
  re-pointing at the raw harvest output — not at the distillation.

### ⛔ Corrections to my own first version of this file (verified on my edge 2026-08-07)

My first draft got two load-bearing details wrong. Both are fixed below; I am leaving the
corrections visible because a reader who acted on the original would patch the wrong file and
then believe the fleet was clean.

⛔ **Attribution correction — the misnaming was MINE, not the approver's.** I originally wrote
that the approver had named `collect-reviews.sh` in its narrowing. It had not: its narrowing
quoted bare md5s with **no filename**, and its one use of `collect-reviews.sh` was in an
*earlier* message, in a **true** context (*"stale-only ⇒ exit 10"*). I supplied the wrong
filename myself while reading unlabelled md5s, then charged my own inference to the party that
reported them. ⭐⭐⭐ **An unlabelled measurement invites the reader to supply the subject — and
the reader's guess then gets attributed to the reporter.** Both halves are real defects and they
are *different* ones: the reporter owes `file: hash` (naming the subject costs one word); the
reader owes "this hash has no subject — ask, don't infer." Neither is the other's excuse.

1. **The defect is in `eval-clauses.py`, NOT `collect-reviews.sh`.** I named the harvest shell
   script. `grep -rln commit_match` puts the clause in `scripts/eval-clauses.py` (and `SKILL.md`);
   `collect-reviews.sh` contains no `commit_match` at all. The offending read is
   `eval-clauses.py:117`, `review_commit_id()` → `_review_field(ws, "commit_id")` → the
   **synthesized result block**.
   ⚠️ **Do not over-correct into discarding `collect-reviews.sh`.** It is not where the defect
   lives, but its **exit code is a valid instrument**: it documents the same `0/10/20/21/22`
   contract as `harvest-reviews.py` (`:68`) and ends in `exit $?` (`:256`), so *"stale-only ⇒
   exit 10"* is a true, agent-unwritable signal. The mistake was naming it as the defect's
   location, not citing it as an instrument.
   ⭐⭐ The docstring immediately above it (`:112-116`) already says *"commit_match still passes off
   this field."* The provenance issue was **known to whoever wrote the script and left as a note
   instead of a fix** — so this is cheaper to land than "discover a defect" implies.

2. **"Same defect ⇒ one patch" was wrong: it needs TWO edits, in two files.**
   `slang-pr-approver/scripts/eval-clauses.py` = `39d961e7…`,
   `slangpy-pr-approver/scripts/eval-clauses.py` = `28351aaa…`. Different md5s, so patching one
   leaves the other live. The reassuring part: `diff` shows they differ **only** in two docstring
   lines (the skill name, `/slang-pr-approve` vs `/slangpy-pr-approve`) — the `commit_match` block
   and `review_commit_id()` are byte-identical code. So it is *the same edit applied twice*, not
   two different fixes.
   (`collect-reviews.sh` and `harvest-reviews.py` **are** byte-identical across the two skills —
   `965f653f…` / `3d96c8f3…`. Only `eval-clauses.py` and `SKILL.md` diverge.)

### The operand the fix needs already exists

`harvest-reviews.py` writes `harvest.json` directly from the GitHub API response:

```
{"found": bool, "login": "...", "commit_id": "...", "submitted_at": "...",
 "diff_hash": "..." | null, "stale": bool, "body": "..."}
```

with documented exits — `0` match, `10` stale-only, `20` none, `21` fetch failure, `22` pending
bot. `stale` is computed as `newest_commit != commit` from API data the agent never touches.
⇒ **Re-point `commit_match` at `harvest.json {found, stale, commit_id}`.** No new instrument has
to be built; the honest operand is already on disk beside the dishonest one.

## Related pattern, same incident

Two further must-fixes upheld by the same gate, both the shape *"found the concern, wrote it
down, then cleared it"* (the approver's own count: 5th instance):

1. **Cleared a test-vs-contract gap using the other branch's passing as coverage of this one.**
   The PR's header doc says `0` is a valid return; its own test asserts `> 0`. The zero path is
   supported-by-design (the new NVRTC symbols are deliberately excluded from the loader's
   required-symbol gate), so the passing branch says nothing about the zero branch.
2. **Used merged precedent (#758) to clear an ABI residual it had written down itself.**
   ⭐⭐ **Precedent establishes practice, never safety.** That a similar change merged before is
   evidence about what reviewers accepted, not about whether this one is sound.

## Repo-property note, worth keeping separate from the defect

`slang-rhi` runs **no `github-actions[bot]` review pipeline** — that is slang-only. Getting zero
bot review rows on a slang-rhi PR is a **repo property, not a harvest failure**, and must not be
reported as one. Likewise slang-rhi **declares no ABI-stability policy** (`docs/api.md`,
`README.md`, `CONTRIBUTING.md`, `docs/abi.md` all checked), whereas slang's `include/` is
ABI-stable by written policy — importing slang's rule into a slang-rhi decision converts a
non-issue into a blocker. slang-rhi check names are all `build (os, arch, compiler, config)`
with no `check-ci` / `wait-for-human-priority` gate; test coverage is read from `ci.yml`'s
`flags: "unit-test"` matrix and the job log, never from a check name.
