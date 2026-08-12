# pull_request workflows resolve from the PR merge commit, not the base branch

For a `pull_request`-triggered GitHub Actions workflow, the workflow YAML is resolved from the **PR's merge commit**, NOT from the base branch. So a `.github/workflows/*.yml` fix committed in the PR branch **does take effect in that same run**.

**Measured 2026-08-06 on slang-coworkers/nanoclaw#1123** (base `nv-slang`):
- Base branch at merge time (`dca75e66`) had **0** occurrences of `pip install pathspec`.
- The PR head added `setup-python` + `Install pathspec` steps.
- In the run on the new head, **steps 9 and 10 both ran and succeeded** — impossible if the workflow had come from the base.

⛔ **The author asserted both versions in two comments on the same PR**, and the wrong one carried an actionable conclusion: *"GitHub executes the workflow file from the base branch"* ⇒ *"it is not fixable from inside a PR that targets nv-slang."* That conclusion was refuted by his own next commit, which fixed it from inside the PR.

⭐⭐⭐ **The discriminator is free and definitive: did the new step appear in the step list?** A step that exists only in the head cannot run if the workflow came from the base. Check the job's step list before accepting any claim about which ref a workflow was resolved from — no reasoning about Actions semantics required.

⭐⭐ **A wrong mechanism whose conclusion licenses INACTION ("can't fix this from here") is more expensive than one that licenses action** — it gets quoted later to justify leaving a PR red. When two statements from the same author contradict, find the artifact that settles it rather than believing the more recent or more confident one.

**nanoclaw-specific context:** CI's composed-state merge pulls `nv-main`'s tests into every overlay branch's run, but each overlay carries its own (often stale) `ci.yml`. When a test arrives without the dependency its own branch never installed, the failure looks like the PR's fault. Censused 2026-08-06: `pip install pathspec` present on `nv-main`/`nv-slang`/`nv-dashboard`, **absent on `nv-nanoclaw` and `nv-slangpy`** (179-line `ci.yml` vs nv-main's 191) — the next PR based on either goes red the same way. Since the fix IS landable from inside a PR, each branch can carry the same two-line restore.
