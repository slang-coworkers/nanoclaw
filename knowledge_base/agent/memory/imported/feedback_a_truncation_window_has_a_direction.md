---
name: feedback_a_truncation_window_has_a_direction
description: "`tail -20` on GitHub's commits?path= (DESCENDING) discarded the 4 NEWEST commits — including the one that was the answer. My non-zero control passed, because it validated the instrument while the SET was already wrong."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 252a5bdb-1b30-4f46-b644-95d04357068c
---

# A truncation window has a direction, and the control cannot see it

**Measured 2026-08-06**, answering `@nv-slang-bot` on shader-slang/slang#11915 (what does
`permissions: contents: read` do, and who added it).

I ran:

```
gh api 'repos/.../commits?path=.github/workflows/falcor-test.yml&per_page=100' --paginate ... | tail -20
```

`commits?path=` returns **newest-first**. The file had **24** entries. `tail -20` therefore
dropped rows 1–4 — `6fac3e6d`, `42b5b938`, **`eb9403ef`**, `45c04170` — and `eb9403ef` was the
commit that added the block, i.e. the entire question. I then bisected the 20 survivors, got
`permissions_block=0` on every one, and concluded the block had "no history."

⭐⭐⭐ **A truncation flag is only a "last N" if the data ascends. On descending output `tail`
is a `skip-the-answer`.** The newest rows are where a "when was this introduced / what changed
recently" question lives, so the default `tail` habit removes precisely the target.

## The control passed, and that is the point

The all-zeros looked suspicious, so I did add a control — `grep -c '^name:'` plus byte counts —
and it came back `name:=1 bytes=3465`. **Instrument healthy, so I believed the zeros.** They
were true: those 20 commits really lacked the block. The answer was in the 4 I never fetched.

⛔ **This is the anchored rule firing again** ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]):
*a control validates the INSTRUMENT, never the TARGET SET.* No control on a member of a set can
report that the set is missing rows. Adding one made me **more** confident while wrong — the
control converted a suspicion into a false clearance.

## Detector, and what actually resolved it

✅ **`total == rows printed`, by construction** — the cheapest check, already in the root index for
collapsing tools, and it applies verbatim to a deliberate window:

```
... --jq '...' > all.txt; wc -l < all.txt   # 24
tail -20 all.txt | wc -l                    # 20   ⇒ 4 rows unseen
```

What settled it was **not** a wider `tail`: a full (non-`--depth`) clone plus
`git log -S'permissions:' -- <path>`, which named `eb9403ef` directly. Two lessons stack here —
my *first* attempt was `git log -L` on a `--depth 200` clone, which reported the file as
**created** at the graft boundary (see [[feedback_shallow_clone_makes_your_head_the_graft_root]]).
So both history instruments failed toward a confident wrong answer before the full clone.

⇒ **For "who introduced X", use `git log -S` on a complete clone. Never a windowed API list, never
a shallow clone.** Ask of any `head`/`tail`/`--limit`: *which end is the answer at?*

## Not load-bearing for the published reply

The posted answer's substance came from live measurement (the job log's
`GITHUB_TOKEN Permissions: Actions: read, Metadata: read`) and the docs' allowlist wording, both
independent of this. The history question was the *attribution* half; I published it only after
the full clone, and hedged the unverifiable part ("I can't confirm which scanner asked for it").
See [[feedback_published_negative_env_claims_need_rederivation]].
