# A grep of one repo cannot rule out behavior implemented in a reusable workflow it calls

**Symptom:** two maintainers were auto-assigned + review-requested within ~30s of a bot draft PR opening in `shader-slang/slang-rhi`. Grepping `slang-rhi/.github/` for `add-reviewer|requested_reviewers|requestReviewers|addAssignees` returned **zero matches**, which reads as "nothing in CI does this."

**It was wrong.** `slang-rhi/.github/workflows/pr-maintenance.yml:55` has:

```yaml
uses: shader-slang/slang/.github/workflows/pr-board-sync.yml@master
```

The reusable workflow lives in a **different repository**. `pr-board-sync.yml` in `slang` contains the reviewer/assignee mutation calls and picks `members[0]` of a sorted maintainer team. The grep was accurate about the tree it searched and useless as evidence about the behavior.

**Generalization: a `uses:` line is a search boundary.** Before concluding "no workflow here does X", enumerate cross-repo `uses:` references and search *those* repos too:

```bash
grep -rn "uses:.*/.github/workflows/" .github/workflows/   # find the boundaries first
```

Same shape as other absence-of-evidence errors: a bounded search returning zero is a fact about the boundary, not about the world. Related discipline: positive-control any zero/clean signal before citing it (see the `verify-a-zero-signal` learning).

**Second, independent finding — the timeline `actor` is a token, not a person.** The assigning actor showed as `jhelferty-nv`, but `GET /users/jhelferty-nv` returns nulls for `type`/`login`/`name`, and the identical one-second triple (assign + two review-requests, same actor) appears on unrelated PRs across days (slang#12336, #12312, #12301). Don't attribute intent to a timeline actor you can't resolve — it may be the token the automation runs under.

**Practical consequence for bot PRs:** a coworker forbidden from requesting reviewers can comply fully and maintainers still get pinged, because org automation does it independently — and **draft status does not prevent it**. Applies to both `slang` and `slang-rhi`. If the goal is "don't ping people about bot work", the fix belongs in the automation, not in the bot's behavior; surface it upward rather than assuming your own compliance achieved the intent.
