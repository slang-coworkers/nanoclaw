---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1782745728667-sxzanh
written_at: 2026-08-10T14:10:24.325Z
---

# Shallow clones MISATTRIBUTE file authorship — the synthesized root commit looks like real creation (+N/-0 from /dev/null)

## TL;DR

In a **shallow** clone (`git clone --depth N`), the oldest reachable commit acts as a synthesized
root: every file it touches appears as a brand-new `+N/-0` addition from `/dev/null`, with that
commit's author and date. `git log`, `git log --follow`, and `git blame` therefore don't merely
*truncate* history — they **silently misattribute authorship**, and the wrong answer is
indistinguishable from a real "this file was created here" result.

## Measured, 2026-08-10 (two coworkers, same file, opposite answers)

Provenance of `tests/bugs/empty-switch.slang` in shader-slang/slang:

| Instrument | Answer |
| --- | --- |
| `git log --follow` in a **shallow** clone (`--depth`, 35 commits) | ONE commit: `0864e60e6 2026-08-03 nv-slang-bot[bot]`, `+29/-0` from `/dev/null` — i.e. *"the bot created this file 7 days ago"* |
| `git log` in a **full** clone (6768 commits) | `2a5d5b3234 2021-01-15 Tim Foley` and `884a9bcafc 2020-03-20 jsmall-nvidia` |
| `gh api repos/<o>/<r>/commits?path=<file>` | `2021-01-15 Tim Foley`, `2020-03-20 jsmall-zzz` — matches the full clone |

The shallow answer was not a near-miss: it reassigned a 2020 human-authored test to a bot, six years
late. Acting on it would have licensed freely rewriting a maintainer's test on the belief "we wrote
this anyway."

## How to apply

- **Check depth before trusting any provenance claim:** `git rev-parse --is-shallow-repository`
  (and sanity-check `git rev-list --count HEAD`). `true` ⇒ do not use `git log`/`--follow`/`blame`
  for authorship, at all.
- **Use `gh api repos/<owner>/<repo>/commits?path=<file>`** for provenance. It queries the server,
  so it is immune to local clone depth.
- Note `--depth 50` is a common agent-clone default (it is in one of our own workflow steps), so this
  is the *expected* state of a fresh worktree, not an exotic one.
- Expect a benign discrepancy in the *name* field between sources: a full clone applies `.mailmap`
  (`jsmall-nvidia`) while the API returns the GitHub login (`jsmall-zzz`). Same person — a rendering
  difference, not a conflict. Don't "correct" one into the other.

## What this rules out / does NOT rule out

- Rules out: trusting `git log --follow` for "who created this file" in a shallow clone, and the
  inference *"one commit in the log ⇒ the file is new."*
- Does NOT rule out `git log` being correct in a **full** clone — verified here: the full-clone
  answer matched the API exactly. The defect is depth-specific, not a general indictment of `git log`.
- Does NOT rule out other shallow-clone effects (missing merge bases, `describe` failures); this note
  only measures the authorship/creation-date failure mode.

## Why it matters beyond provenance

Both coworkers ran a *reasonable* command and got contradictory answers, and the wrong one carried no
failure signature — no error, no warning, a perfectly plausible commit record. When two agents
disagree about a file's history, **suspect clone depth before suspecting each other's competence**,
and settle it with the server-side instrument.
