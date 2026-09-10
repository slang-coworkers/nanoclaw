---
name: feedback_a_config_discovery_tool_measures_the_directory
description: "prettier/eslint/tsc discover config by walking up from the FILE's path, so writing a base version to /tmp and diffing it measures a different config — my A/B said base had 89 deviations vs 3 at head; in-repo it was 0 vs 3, the opposite direction."
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1157
---

⛔ **Measured 2026-08-10 on nanoclaw#1157.** To ask "did this PR introduce a formatting regression?" I wrote the base
version of a file to `/tmp/claude-base.ts` and diffed `prettier <file>` against the file, for base and head.

```
/tmp/claude-base.ts    89 hunks     <- "base is catastrophically unformatted"
<repo>/…/claude.ts      3 hunks     <- "head is nearly clean"
```

Conclusion I nearly published: *the PR did not regress formatting; the file was already bad.* **Backwards.**

`.prettierrc` lives at the repo root and carries `printWidth: 120`. Prettier discovers config by walking **up from the
path of the file it is given** — so a file in `/tmp` gets the default `printWidth: 80` and every long line becomes a
"deviation". Re-run with both versions inside the repo (`git show base:<path> > .probe/…`):

```
base    0 hunks
head    3 hunks
```

⭐⭐⭐ **The instrument answered a question about `/tmp`, not about the file's content.** Same class as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — the command ran, exited 0, and produced a confident number
about the wrong object. But note the asymmetry that makes this one worse: **a wrong-directory read here INVERTED the
sign.** It did not merely inflate a count; it moved the blame from the PR to the pre-existing tree, which is the
direction that ends a review early.

✅ **Guard: stage the comparison artifact INSIDE the repo** (`.probe/`, or a git worktree), never `/tmp`, for any tool
with hierarchical config discovery — `prettier`, `eslint`, `tsc`, `clang-format`, `black`, `rustfmt`, `stylelint`. If the
tool would read a dotfile, the file's *location* is an input to the measurement.

✅ **Cheapest detector, and the one that caught it: run the CONTROL on the unmodified base and range-check it.** A base
version of a file that a project's own pre-commit hook formats on every commit should be ~0 deviations. **89 was
absurd, and absurdity beats agreement as a detector** — same rule as the `125%` catch in
[[feedback_deference_drifts_to_whoever_corrected_you_last]]. If a control on known-good input reports a large number,
suspect the instrument before the input.

⚠️ **Second half of the same finding: report a gate's SCOPE with its verdict.** The PR claimed
`prettier --check "src/**/*.ts"` clean. True — and that glob *is* the repo's gate (`package.json` `format:check` +
`.husky/pre-commit`), so it is the right gate to cite. But **neither `ci.yml` nor `compose-check.yml` runs prettier at
all**, so "prettier fails" was never CI-blocking, and the glob excludes the whole `container/agent-runner/` tree where
this PR's actual deviation lived. ⇒ **A green whose scope you have not stated is not a finding, and a red outside CI's
scope is not a blocker.** Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]].
