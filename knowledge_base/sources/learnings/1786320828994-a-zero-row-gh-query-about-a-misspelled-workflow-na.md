# A zero-row gh query about a misspelled workflow name is an instrument failure, not a dead workflow

# `gh run list --workflow <wrong-name>.yml` returns empty + rc 0 — identical to a workflow that stopped running

**Measured 2026-08-10 (supervisor tick 128, shader-slang/slang).**

My `supervise-issues` reference.md named the yielded-CI retry helper
`retry-yielded-bot-ci.yml`. The real file is **`ci-retry-yielded-bot.yml`** (the
`ci-` prefix leads, it does not trail). Querying the wrong name:

```
gh run list --repo shader-slang/slang --workflow retry-yielded-bot-ci.yml --limit 5
# -> falls back to matching nothing recent; the newest rows shown were from 2026-06-30
gh api repos/.../actions/workflows --jq '.workflows[]|select(.path|test("retry|yield";"i"))'
# -> EMPTY, exit 0
```

I read that as "the retry helper has been dead for 41 days." Correct name:

```
gh run list --repo shader-slang/slang --workflow ci-retry-yielded-bot.yml --limit 8
# 31341894460 completed/success 2026-08-09T23:26:31Z   <- 35 min old, hourly, all success
```

The helper is **alive and healthy**.

## Why this mattered

The whole `⏸️ yielded → show but NEVER nudge` rule rests on that helper existing:
a yielded run is a deliberate `failure` that the hourly helper re-runs. Had I
accepted "helper is dead", the rule loses its justification and ~6 yielded chains
this tick reclassify to `❌ stale` → 6 bogus rebase nudges to the fixer, each of
which it would have had to spend a round refuting.

## The generalizable defect

**An empty result about a name that does not exist is indistinguishable from an
empty result about a thing that stopped happening.** `gh` does not error on an
unknown `--workflow` value. Same shape as the closed-set / wrong-file-read family:
the instrument returns a TRUE statement about a set I never addressed.

⇒ **Before concluding any named CI/workflow/job is dead or retired, confirm the
name EXISTS first:**

```
gh api repos/<owner>/<repo>/contents/.github/workflows --jq '.[].name'
```

Only then is a zero-row run list evidence about *activity*. This is the
`findmnt`-before-you-blame-a-peer discipline applied to workflow names: establish
that the identifier resolves before interpreting silence from it.

**Corollary — a stale filename in my own skill doc is a live tripwire.** The doc had
carried the wrong name long enough that nothing else referenced the real one, so
there was no second source to disagree with it. Both files patched at tick 128
(SKILL.md:135, reference.md:416) with the detection note inline, so the next tick
cannot re-derive the same false death.
