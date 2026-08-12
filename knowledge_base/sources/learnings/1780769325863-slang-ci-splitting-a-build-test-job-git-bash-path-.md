# Slang CI: splitting a build/test job — Git-Bash-PATH gotcha + bot cannot push workflow files

When splitting a monolithic Slang CI job (build + test on one runner) into a `build` job (uploads artifact) + `test` job (`needs: build`, downloads artifact), two non-obvious things bite. Learned fixing shader-slang/slang#11495 (split `falcor-test.yml`), 2026-06-06.

## 1. The test job silently loses Git Bash on PATH

The original single job called `./.github/actions/common-setup`, whose first step ("Add bash to PATH", `common-setup/action.yml:26-31`) prepends `C:\Program Files\Git\bin` + `...\usr\bin` to `$GITHUB_PATH`. When you split, the new `test` job usually does NOT call common-setup (it only downloads an artifact + runs tests). But if any test-job step still uses `shell: bash` — e.g. a GNU `cp --recursive --target-directory ... slang-bin/*` (pwsh has no such cp) — it fails on self-hosted Windows runners because Git Bash is not guaranteed on the baseline PATH. The repo treats Git-Bash-on-PATH as something workflows set up explicitly (`ci-slang-build.yml` adds it manually with a comment saying it's required).

**Fix:** add an explicit step at the top of the test job, mirroring `ci-slang-build.yml`:

```yaml
- name: Add Git Bash to PATH
  shell: pwsh
  run: |
    Add-Content -Path $env:GITHUB_PATH -Value "C:\\Program Files\\Git\\bin"
    Add-Content -Path $env:GITHUB_PATH -Value "C:\\Program Files\\Git\\usr\\bin"
```

…or convert the lone bash step to `Copy-Item` under `shell: pwsh`. This was an 85%-confidence catch by the correctness review; a targeted second-pass and the clarity pass both MISSED it. Lesson: when a refactor removes a setup action, audit every `shell: bash` step the removed action used to enable.

## 2. The bot cannot push ANY `.github/workflows/*` change

`nv-slang-bot[bot]`'s GitHub App lacks the `workflows` permission. Pushing a branch that creates/updates a workflow file is rejected server-side:

```
! [remote rejected] <branch> (refusing to allow a GitHub App to create or
  update workflow `.github/workflows/<f>.yml` without `workflows` permission)
```

Critically, `git push --dry-run` does NOT catch this — the rejection only happens at real push time. So for a PURE-workflow task (no non-workflow component to split out), plan for patch-mode from the start: `git diff master..HEAD > patch`, hand the patch to the reviewer + parent, and let a maintainer apply it (or get the App granted `workflows: write`). Don't burn a turn discovering it at push. (Same wall as #11438; confirmed still live on master 2026-06-06.)

## 3. Other split-specific notes

- Use a DISTINCT artifact name (e.g. `slang-falcor-build-windows-release`) so it never collides with the standard `slang-tests-<os>-<plat>-<comp>-<config>` artifact from `ci-slang-build.yml`.
- Artifact layout: `upload path: artifact-staging/bin` roots the artifact at bin's CONTENTS (no `bin/` segment) → download to `slang-bin/` lands them flat → `slang-bin/*` matches the former `build/Release/bin/*`. Uploading `artifact-staging` (one level up) instead would nest under `slang-bin/bin/` and the copy moves nothing useful — a quiet footgun; comment the contract.
- `download-artifact@v4` is attempt-scoped: `gh run rerun --failed` on a green build + failed test won't find the artifact (see learning 1780207481552). Affects every build/test split in this repo. Add a one-line NOTE near the upload.
- Drop `submodules: "recursive"` on the test job if it reads no source from the workspace (consumes only the artifact + a preinstalled tree) — saves ~30s/run on a scarce GPU runner. `materialx-test.yml` keeps recursive submodules, but it runs shaders out of the workspace tree, so that's not a precedent to copy blindly.
- `if: github.event.pull_request.draft != true` belongs on the `build` job (chain entry); the `test` job inherits the skip via `needs: build` (a skipped need fails `success()`), so no separate guard needed.
