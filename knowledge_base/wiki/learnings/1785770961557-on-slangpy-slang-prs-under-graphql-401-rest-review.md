---
title: "On slangpy/slang PRs under GraphQL 401: REST review checks GraphQL can't make, and enabled ≠ executed in doctest pass tallies"
type: learning
topic: slang-compiler
source: learnings/1785770961557-on-slangpy-slang-prs-under-graphql-401-rest-review.md
---

# On slangpy/slang PRs under GraphQL 401: REST review checks GraphQL can't make, and enabled ≠ executed in doctest pass tallies

Two verification techniques from slangpy#1087 → PR #1088 (blocking slang#11225), both reusable on any slangpy/slang PR.

## Verifying an approval over REST — and one check GraphQL structurally cannot make

With the GitHub GraphQL API returning 401 (`gh pr view --json` / `gh pr checks` phantom-succeed on empty stdout), verify a PR's review state over REST:

```bash
gh api repos/<owner>/<repo>/pulls/<N>/reviews \
  --jq '.[]|"\(.user.login) | \(.author_association) | \(.state) | \(.commit_id[0:7])"'
gh api repos/<owner>/<repo>/pulls/<N> --jq '{draft,merged,mergeable_state,head:.head.sha[0:7]}'
gh api repos/<owner>/<repo>/commits/<sha>/check-runs \
  --jq '[.check_runs[]|.conclusion]|group_by(.)|map({(.[0]//"null"):length})'
```

Three things this catches that are worth doing deliberately:

- **`commit_id` vs PR head.** A review's `commit_id` tells you *which commit was approved*. If it differs from the current head, the approval is stale — someone pushed after it. GraphQL's `reviewDecision: APPROVED` is an aggregate and **cannot** express this; only the per-review `commit_id` can. Compare them explicitly.
- **`author_association`.** `MEMBER`/`OWNER` distinguishes a maintainer approval from a drive-by. A **zero-length body** on an APPROVED review is a go-ahead, not an empty/failed submission.
- **Reconcile check-runs against `total_count`**, not the array length — pagination can truncate the array and make a partial set look complete.

**An approval is not authorization to promote a draft.** `state=APPROVED` with `draft=true` still means the maintainer owns the `gh pr ready` call. Leaving it draft is correct.

## `enabled` ≠ `executed`: reading doctest pass tallies in sgl_tests

To claim a device/config was actually exercised by a green `sgl_tests` run, the configure flags and the aggregate pass tally are both insufficient — flags show the path was *possible*, and the tally cannot distinguish "ran and passed" from "enabled but skipped." The load-bearing fact is the fixture loop:

- `tests/sgl/testing.cpp` — `run_gpu_test` builds `device_types{d3d12, vulkan}` under `#if SGL_WINDOWS` (`{vulkan}` on Linux, `{metal}` on macOS), then iterates with a **`SUBCASE(enum_to_string(device_type))` per entry**. That per-device SUBCASE is what makes "d3d12 executed" true rather than inferred.
- Narrow "every `TEST_CASE_GPU`" to "every **non-skipped** one": some are declared `TEST_CASE_GPU("..." * doctest::skip())`. Reconcile the reported skip count against the actual `doctest::skip()` sites before treating the tally as complete coverage.
- **Do not cite the absence of a `DEEPEST SUBCASE` block in a green run as evidence any particular device passed** — doctest emits that block only while logging failures, so in a 0-failure run its absence is guaranteed regardless. See the companion learning on non-discriminating signals.
- A cross-platform **assertion-count delta** (e.g. Windows 20238 vs Linux's lower count) is *consistent with* an extra device iterating, but is not proof of which subcases ran — platform-conditional assertions inside otherwise-shared cases produce the same delta. State it as consistency, not evidence.

Related environment notes for this repo pair: `gh pr create` fails under the GraphQL 401 but REST `POST /repos/.../pulls` with `draft=true` works; and Windows CI logs are **CRLF**, so pipe through `tr -d '\r'` before any line-anchored matching.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785770961557-on-slangpy-slang-prs-under-graphql-401-rest-review.md`_
