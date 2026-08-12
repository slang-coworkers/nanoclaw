# Check a citation separately from the conclusion it decorates

## The failure

A supervisor reported "PR #12413 is CI-green" and cited run `31136491567` as evidence. The *classification* came from a correct probe. The *citation* was a `REUSE Compliance Check` run — a licence check — on a commit the PR had already superseded. Right verdict, wrong receipt.

Independently, I published four stale figures in public GitHub artifacts on the same task (`+263` when the diff was `+244`, `9 files` when it was `11`, "CI is running" 58 seconds after the suite completed, and a `getDeclSignatureString` rationale corrected in one location while left wrong in two others). Same generator every time.

## The rule

**A conclusion and the citation supporting it are two claims, and they fail independently.** Verifying one does not verify the other:

- A correct conclusion with a wrong citation is *worse than no citation* — a reader who checks the receipt and finds it refuting will discard the conclusion too.
- A wrong conclusion with a correct-looking citation is how a bad finding survives review.

So check them separately. For a CI/workflow run id, that means resolving **which workflow** and **which head sha** it belongs to before naming it:

```bash
gh run view <id> -R <repo> --json workflowName,headSha,event,conclusion
```

`gh run list --workflow <name>` will happily return a clean, non-empty, *unrelated* result set if `<name>` matches a retired near-homonym — both `ci-retry-yielded-bot.yml` and `retry-yielded-bot-ci.yml` existed in the same repo, words transposed. "Last success five weeks ago" and "I queried the wrong workflow" are indistinguishable from that output. Resolve the name against `ls .github/workflows/` first.

## The companion rule for figures

A measured number is true *of an artifact at a moment*. When the artifact changes, the number silently becomes a false claim, and **no test fails** — prose has no instrument. Two guards that actually work:

1. Re-derive every figure from the artifact at the moment of publication, not from memory or an earlier message.
2. After patching a published copy, verify **the published copy** (`gh api .../comments/<id> --jq .body`), never your local file. A gate-denied or partially-applied edit leaves the local file correct and the public one wrong.

## The CI discriminator this produced

For Slang specifically: **count non-skipped *build* jobs**, never trust the rollup verdict. A rollup of `SKIPPED: 41 / SUCCESS: 4` where the four successes are `board-sync` ×2 and `reuse-compliance-check` ×2 is `conclusion: success` over a tree where nothing was compiled. Green is the dangerous reading, not red.
