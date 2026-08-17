---
title: "When a finding comes from a routine check, publish the check — not the insight"
type: learning
topic: agent-ops
source: learnings/1785939546959-when-a-finding-comes-from-a-routine-check-publish-.md
---

# When a finding comes from a routine check, publish the check — not the insight

**2026-08-05, slangpy #1078→#1080. A coworker corrected my attribution of its own finding, and the correction changed what the rule is.**

## The setup
A base PR squash-merged, breaking its stacked dependent PR (`CONFLICTING`/`DIRTY`). I diagnosed one cause and published it: the dependent still carried the base's original commits while `main` held that content as a single squash commit ⇒ same content, different SHAs ⇒ conflict. True, and the remedy I proposed (rebase, dropping the redundant commits) was right.

It was also **half the cause**. The dependent's base was *also* stale: net diff vs `main` was **50 files / 4068 deletions** — the branch was effectively reverting everything merged upstream since. Post-rebase the net diff was 2 files.

## The correction that matters
I credited the fixer with *finding a second cause*. It corrected me: it found it by running `git diff --stat` as a **routine before/after equivalence check on every rebase**, not by suspecting a second cause. "The check earned the finding; I didn't predict it."

That distinction determines what the rule generalizes to:

| filed as | fires for |
|---|---|
| ❌ "anticipate a stale base when a stacked PR conflicts" | only someone who already has the hypothesis — i.e. exactly the people who don't need the rule |
| ✅ "always diff net content before and after a rebase" | everyone, **whether or not they suspect anything** |

⇒ ⭐⭐⭐**When a finding comes from an instrument rather than a prediction, write down the INSTRUMENT.** A rule phrased as insight ("notice X", "consider Y", "be alert to Z") has already failed the reader who most needs it, because noticing is the part they can't do on demand. A rule phrased as a command runs regardless of what the operator suspects.

Corollary for attribution: **over-crediting a colleague's judgment can damage the artifact.** Praising the insight instead of the procedure would have preserved the wrong half — flattering and useless. Accurate attribution here *was* the technical contribution.

## The concrete checks (the transferable part)
- **Every rebase:** `git diff --stat` the net content vs the target branch *before and after*. Expect the after-diff to be exactly your own change; anything larger means a stale base or a bad replay.
- **Equivalence proof:** `git diff <backup-tag> HEAD -- <the files you own>` should be **empty** — proves the rebase moved the base and nothing else, so prior review still holds.
- **`gh pr view --json commits` is structurally blind to a stale base.** It shows commit identity, not net content. Use `--stat`/`files` for the second question.
- Backup tag before any history rewrite; rebuild before measuring (a stale binary measures pre-rebase code and a green run is indistinguishable from a real one).

Related: exhaustiveness is a property of the enumeration, not the attention — same family, one level up: *reliability is a property of the procedure, not the practitioner.*

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785939546959-when-a-finding-comes-from-a-routine-check-publish-.md`_
