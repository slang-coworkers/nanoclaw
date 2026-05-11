---
name: ikd
description: Issue Knowledge Database specification — structure, templates, file layout, branching, commit discipline, and review log conventions.
provides: [fix.ikd]
---

# Issue Knowledge Database

A separate git repository located at `knowledge/`. Serves as both working state for the agent and a reference package for human reviewers.

## Contents

Each issue branch should contain:

- An **issue plan** (see [issue plan template](#issue-plan-template)) — the top-level view of the issue.
- A **subproblem plan** for each subproblem (see [subproblem plan template](#subproblem-plan-template)).
- Transient data relevant to the issue: dumped IR passes for repro cases, IR pass details, compiler diagnostic output, build logs, test results, and any other artifacts that aid understanding. Transient data must not be LLM-generated — use unix tools (e.g., `sed`, `head`, `tail`) to capture relevant ranges of generated files into clippings. This grows as implementation proceeds — continue capturing transient data throughout the lifecycle, not just during research.
- An **index** explaining what each transient document is and why it was captured.
- Output of tools used during analysis that is fundamental to understanding the problem or the solution.
- Decision rationale: why a particular approach was chosen over alternatives, including evidence or reasoning that led to the decision. Update as implementation reveals new information or trade-offs.
- Vectored review reports (plans reviews, peel reviews, repository reviews).

## Branching

- Each issue has a separate branch named `<repo>-<issue#>`.
- New issues start from a clean (empty) branch.
- Always ensure all changes are committed on the current branch before switching to another.

## Commit discipline

- Iteratively commit changes as we go — at minimum before review and after review updates are completed.
- IKD commits are independent of code branch commits. Commit IKD changes at least before and after each vectored review, and whenever pausing or switching work.

## Retention

- Do not remove information about subproblems that have already been solved for a given issue — we may need to refer to them when reviewing later subproblems.

## Progress convention

### Issue plan

The Progress section has three parts:

- **Phase line** — a single keyword matching the dispatch table: `ingesting`, `reproducing`, `planning`, `implementing`, or `closed: <reason>`. Used by `/issue-fix` to determine which workflow to dispatch. Can have a `, blocked: <reason>` suffix.
- **Status paragraph** — freeform prose describing what the agent is doing right now, what it's blocked on, or what it's waiting for. Updated each session. Provides context beyond the phase keyword.
- **Subproblem list** — ordered list of subproblems, each tagged with its current phase.

Tags for subproblems:

| Tag | Meaning |
|-----|---------|
| `[planned]` | Subproblem plan exists, not yet implementing |
| `[implementing]` | Actively working on code |
| `[peeling]` | Undergoing peel-and-land; peeled chunks are listed as separate entries above this one, each noting "Peeled from PR repo#N" |
| `[in-review]` | PR pushed, waiting for CI/feedback |
| `[landed]` | PR merged |
| `[spun-off → <url>]` | Spun off as a separate issue |

Any non-terminal tag (`planned`, `implementing`, `peeling`, `in-review`) can have a `, blocked: <reason>` suffix — e.g. `[implementing, blocked: waiting for dep]`. Blocking is an annotation on the current state, not a separate state.

### Subproblem plan

Each subproblem plan has a Status field showing its current phase. Used by `/subproblem-fix` to determine which workflow to dispatch. The tag in the issue plan's Progress section must stay in sync with this Status.

### Common blocking reasons

**Issue-level:**
- Repro code looks suspicious — waiting for maintainer safety confirmation.
- Can't reproduce — waiting for reporter clarification.
- Decomposition proposes creating new issues — waiting for maintainer approval (or operator approval in local mode).
- Significant overlap with existing issues — waiting for shader-slang maintainer decision. If overlap is <50 source lines projected, note it and proceed.
- Waiting for dependency — blocks downstream implementation until an implementation exists (even locally), and blocks review until the dependency has landed.

**Subproblem-level:**
- Depends on another subproblem or external issue — blocks implementation until the dependency has an implementation (even if only a local branch), and blocks transition to review until the dependency has landed on main/master.
- Change exceeds size threshold and can't find a clean peel. Push the full PR and request guidance.
- Feedback needs human judgment (maintainer disagreement, ambiguous direction).
- CI failure can't be resolved independently.
- Proposing spin-off as separate issue — waiting for maintainer approval (or operator approval in local mode).

---

## Issue plan template

```
# <repo>#<issue>: <title>

- Primary repository: <repo>
- Status comment: (none | <comment-id>)

## Root cause analysis
...

## Reproduction
...

## Solution overview
How the subproblems fit together, their interrelationships, and the overall approach.

## Risks / blast radius
...

## Test plan
...

## Progress

Phase: <ingesting | reproducing | planning | implementing | closed: <reason>>

<Freeform paragraph describing current status: what the agent is doing right now, what it's blocked on, what it's waiting for. Updated each session.>

1. [planned] <subproblem-1-descriptor> [<target-repo>] → coworker/fix-<issue#>-<descriptor> | PR: (none | <target-repo>#N)
2. [planned] <subproblem-2-descriptor> [<target-repo>] → coworker/fix-<issue#>-<descriptor> | PR: (none | <target-repo>#N)
```

## Subproblem plan template

```
# <subproblem-descriptor>

- Target repo: <repo>
- Branch: coworker/fix-<issue#>-<descriptor> (or coworker/fix-<reponame>-<issue#>-<descriptor> if cross-repo)
- PR: (none | #N)
- Status comment: (none | <comment-id>)
- Status: <planned | implementing | peeling | in-review | landed | spun-off → <url>>

## Definition
...

## Root cause analysis
...

## Reproduction
...

## Proposed change
...

## Alternatives considered
...

## Risks / blast radius
...

## Test plan
...
```

## File layout

```
<branch root>/
  issue-plan.md
  index.md                          # describes each transient document and why it was captured
  reviews-log.md                    # chronological log of all vectored reviews (see below)
  subproblems/
    <descriptor>/
      plan.md                       # subproblem plan from template
      data/                         # transient data specific to this subproblem
      reviews/                      # repo reviews, peel reviews for this subproblem
  data/                             # transient data at issue level (not subproblem-specific)
  reviews/                          # plans reviews (issue-level scope)
```

## Heartbeat file

`knowledge/.issue-heartbeat` — one line per active issue. Used by `/issue-heartbeat` to iterate active issues on a timer. Not per-branch; lives at the `knowledge/` root alongside the indexes.

```
<owner>/<repo>#<number>
```

Example:

```
shader-slang/slang#4521
shader-slang/slang#4530
shader-slang/slangpy#218
```

Rules:
- Added by `/issue-ingest` after initializing the IKD branch.
- Entry removed by `/issue-close` when finalizing the IKD.
- Order does not matter. The heartbeat workflow processes all entries each run.
- If the file is missing or empty, there are no active issues.
- Rebuilt from IKD branch contents if lost (scan branches for non-closed Phase lines).

## Reviews log

`reviews-log.md` at the branch root. Additive — entries are never deleted. Each entry is a single line:

```
<timestamp> | <filepath> | <reason>
```

- **timestamp**: `YYYYMMDDTHHmm` (e.g., `20260508T1340`)
- **filepath**: path to the review report relative to the branch root
- **reason**: one-sentence description of why the review was triggered

Review report filenames: `<timestamp>-<variant>.md`.

### Placement

- **Plans reviews** → `reviews/` (issue-level scope)
- **Repo reviews** → `subproblems/<descriptor>/reviews/` (scoped to the subproblem's code change)
- **Peel reviews** → `subproblems/<descriptor>/reviews/` (scoped to the parent subproblem being peeled from)

## Conventions

- Code branch naming: `coworker/fix-<issue#>-<subproblem-descriptor>` (same repo) or `coworker/fix-<reponame>-<issue#>-<subproblem-descriptor>` (cross-repo).
- IKD branch naming (`<repo>-<issue#>`) is distinct from code branch naming.
- Subproblem tags in the issue plan's Progress section are updated as subproblems advance (e.g., `[planned]` → `[implementing]` → `[in-review]` → `[landed]`).
- For peel-and-land decompositions, the parent subproblem is tagged `[peeling]` and peeled chunks are inserted as separate entries above it in the list. Each peeled chunk's description includes "Peeled from PR repo#N". When the parent is small enough to land directly, it transitions to `[in-review]`.
