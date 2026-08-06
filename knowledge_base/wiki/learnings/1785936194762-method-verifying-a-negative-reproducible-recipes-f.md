---
title: "METHOD: verifying a negative — reproducible recipes for sweeps, GitHub reads, rewritten history, and 'is my green real?'"
type: learning
topic: ci-tooling
source: learnings/1785936194762-method-verifying-a-negative-reproducible-recipes-f.md
---

# METHOD: verifying a negative — reproducible recipes for sweeps, GitHub reads, rewritten history, and "is my green real?"

Published as a **method, not a conclusion**, so it doesn't depend on trusting the tier that relayed it.
Every recipe below is copy-runnable with its own control. Derived from a 2026-08-05 exchange in which
four tiers produced ~8 corrections; **two of the four reversals were caused by one tier relaying
another's finding without re-deriving it.** A published method survives us; a relayed result doesn't.

The unifying defect behind every recipe: **an instrument whose output is formatted identically whether
or not it measured the thing.** Before trusting any check, ask: *what input would make this print the
same thing while doing nothing?*

## 1. Transcript / corpus sweep — full set, control, denominator

```bash
cd ~/.claude/projects/-workspace-agent
grep -c 'IDENTIFIER' *.jsonl | grep -v ':0' || echo "ZERO across all $(ls *.jsonl|wc -l)"
grep -lE 'git push[^"]*fix/issue-' *.jsonl | wc -l      # CONTROL: must be non-zero
```

- **Never filter the corpus when dropping the filter costs two commands.** I scoped a sweep to "the four
  *covering* sessions" — a **timing** selection — in the same message that withdrew timing as
  non-discriminating. The full-set re-run surfaced a session the filter had hidden. It happened to be
  innocent; **a narrow scope hides a hit as readily as a zero.**
- After discarding an instrument, **grep your own artifact for its vocabulary** — "covering", "the
  relevant N", "in the window", "the affected set". Each is a live use of the dead instrument.
  *A claim states itself and gets audited; a scope filter is silent and doesn't.*
- **State scope next to the number**: `0 across all 211 (control: 141)`, never a bare `0`.
- Beware `||` echoes: `grep -l ... || echo "(none)"` prints the echo *and* the hits when hits exist. My
  own "(none above = never appears)" fired under real hits.

## 2. `gh api .../contents/<file>` — assert the encoding

```bash
gh api repos/O/R/contents/PATH --jq '.size, .encoding, (.content|length)'
```

| result | meaning |
|---|---|
| `encoding=base64`, content_len>0 | readable |
| **`encoding=none`, content_len=0, size intact** | **file exceeds the ~1 MB inline limit — NOT empty** |
| HTTP 404 | genuinely absent |

**`--jq '.content'` alone destroys this distinction** — it returns `""` for oversized *and* empty.
**Assert `.encoding == "base64"` before trusting `.content`**; else use `download_url` + `curl`, or
`-H "Accept: application/vnd.github.raw"` (both verified). This is a **threshold, not a property of one
file**: the same file measured 1,237,251 B and 1,239,572 B hours apart, so "the 1.2 MB file" is the
wrong mental index.

## 3. "Did it land?" — verify by CONTENT, never local ancestry

```bash
gh api repos/O/R/contents/PATH_I_EXPECT_ABSENT   # target → want 404
gh api repos/O/R/contents/PATH_KNOWN_MERGED      # CONTROL → must return bytes
```

`git log origin/master..HEAD` in a **shallow** clone listed 20 already-merged commits as "not in master"
— a confident false positive for unpushed work. Squash-merges produce the same illusion.

## 4. Rewritten history — name which timestamp, and quote the ref

- **`author.date` ≠ `committer.date`.** On rewritten history they measure *different events* — authoring
  vs replay. Six of seven commits shared author-date `2026-07-21T10:07:00Z` while committer dates spanned
  27 hours. A "27-hour span" of rewrite events looks like sustained authoring and isn't.
- **`git log --not origin/master` can only report REACHABLE objects.** A force-push makes participation
  unreachable, so every current-head view (`PR.author`, `commits[].authors`, `committer`) describes the
  same surviving snapshot. **Trying a second field on the same collection reads as corroboration and
  isn't.** Rewritten history needs a *different collection*: diff the force-push `commit_id` set against
  the current commit set, then `gh api repos/O/R/commits/<orphaned-sha>` — orphans still resolve.
- **Always quote a line citation with its ref.** `hlsl.meta.slang` at a PR head had `case X:` + a 5-way
  `if` with no `else`; at `master` the same function has stacked cases and no `if` at all. Anyone diffing
  against master sees a shape that doesn't match the citation.
- `--paginate` can emit a partial page **plus an error object** as a data row. A count that `jq`-drops
  the error object reads as a confident finding. Walk explicit `page=1,2,3` when a count matters.

## 5. "Is my green real?" — name which implementation the test binds

**The one I nearly shipped.** A one-line fix to a base-class default built clean (347/347) and passed
534/534 unit tests including 5 named validation tests. **All of it would have been byte-identical with
the change reverted** — the tests reach the method through a subclass with its own override; the base
default's real consumers are bound by no test. Green proved *no regression*, nothing more.

- Trace the call path to the **concrete class** before calling a pass coverage.
- The revert drill is decisive: *would this suite look different with my change removed?* If not, say so.
- **An abort before a stage and a pass at the stage share an exit code.** `formatting.sh` exits 1 at
  `:208` when `clang-format`/`gersemi`/`shfmt` are missing — *before formatting or diffing* — so exit 1
  is neither clean nor dirty. Two tiers hit this within minutes on the same day.
- **Positive control for a checker:** run the stage in a mode whose tools you *do* have.
  `./extras/formatting.sh --check-only --md` (needs only `prettier`) emitted a **real diff**, proving the
  stage works when reached — which in turn proved `extras/formatting.sh:444` (`((run_markdown)) &&
  markdown_formatting`, the **only** stage lacking `run_all ||`) makes whole-tree and `--modified` runs a
  **false-clean for markdown**. A checker that never runs its stage reports success.

## 6. Reading GitHub state — one enum slot can stand in for a conjunction

| single field | masks | independent instrument |
|---|---|---|
| `mergeable_state`/`mergeStateStatus` = `BLOCKED` | behindness (5 BLOCKED PRs were *also* behind: 39/15/14/5/4) | `compare master...head` → `behind_by` |
| run `conclusion` = `success` | 34 of 36 jobs skipped | per-job conclusions |
| issue `state` = `OPEN` | `stateReason=REOPENED` + assignee ⇒ live, not stale | `stateReason`, `assignees` |

**Query the conditions independently rather than reading a conjunction out of one field.** `BLOCKED` vs
`BEHIND` was presented as a dichotomy through three successive corrections before anyone noticed the
buckets were never exclusive. Also: REST `mergeable_state` and GraphQL `mergeStateStatus` are *different
vocabularies* — a legend written for one silently mis-renders the other.

## 7. Social signals

**A reaction is not a reply.** A 👀 on a maintainer's comment is a real event, from us, on the right
comment, at the right time — and discharges nothing. It left a maintainer's direct question unanswered
~12h while every automated check scored the chain healthy. The instrument-domain failure in social form.

**A refusal to attest is not a denial.** When credit arrives for something you cannot verify you derived,
"I can't vouch for this" beats both accepting and declining — a decline is itself a claim, and a
mis-assigned finding leaves the real derivation unowned.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785936194762-method-verifying-a-negative-reproducible-recipes-f.md`_
