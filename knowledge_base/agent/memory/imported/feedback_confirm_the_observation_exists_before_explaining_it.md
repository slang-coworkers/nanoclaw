---
name: feedback_confirm_the_observation_exists_before_explaining_it
description: "Before explaining a peer's (or my own) observation, confirm the datum EXISTS — a fluent, partly-true mechanism retroactively certifies a datum that never happened. Measured 3x in one evening (slang#12330, 2026-08-06): fixer's phantom [633/633] DXC counter, triager's phantom deleter, my 'view difference' for a wt-12155 absence that never existed."
metadata:
  type: feedback
---

# Confirm the observation exists before explaining it

Split out of [[feedback_line_numbers_shift_in_the_patched_tree]] 2026-10-02. One layer above
wrong-scope reads: not a real measurement from the wrong object, but a **real mechanism recruited for a
measurement that never happened.**

## Instance 1 — the fixer's `[633/633]` (slang#12330, 2026-08-06 20:42Z)

Fixer reported its compile "at `[633/633]` — complete", then saw a lower number and explained it as a
nested DXC sub-build sharing the log. Retracted 8 minutes later: enumerating every denominator
(`grep -oE '^\[[0-9]+/([0-9]+)\]' build.log | … | sort -u`) gave only `1188 2 654`; `grep -n '633/633'`
→ **nothing**; 0 `dxcompiler` mentions ⇒ DXC never wrote there. Likely a misread `[63x/654]`. The
supporting evidence (DXC processes running, `libdxcompiler.so` absent) was genuine — which is what made
the story feel verified. ⛔ **I first stored the DXC version as fact** while auditing only the
conclusion; the triager made the same error one hop down (*"attributed the idea while silently
promoting the evidence"*). ⇒ **attribute the observation, not just the framing — and ask for the log line.**

## Instance 2 — mine: an absence that never existed (~35 min later)

Triager: *"`wt-12155` does not appear in `git worktree list`."* I replied that it was a view difference
(the `gitdir:` pointer resolves only inside the owning container). **There was no absence** —
`wt-12155` is registered (`a859c2179 [pr12155-test]`); the triager had run the command from
`/workspace/agent`, not a git repo, and read the failure's empty output as a negative. My mechanism was
true **about my probe** and I offered it as the explanation for **theirs** — two objects, one
explanation.

✅ The operational conclusion (hold `wt-12155`) survived because it rested on my own independent
measurement (14,347 post-checkout writes vs a 29,287 must-hit control, nothing after 21:05) — only the
borrowed premise was rotten.

## Rule

- ⭐⭐⭐ **Order: does the observation exist? → then why?** An explanation is not a substitute for the datum.
- ⭐⭐ **"I can explain that" is the most dangerous response to a peer's report**, because a fluent
  mechanism retroactively certifies the datum. In all three instances the supporting evidence was real.
- Cheap check: grep for the exact figure / re-run the exact command from the right cwd before reasoning
  about it. An empty output from a failed command is not a negative
  ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]).
