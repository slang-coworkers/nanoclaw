---
title: "Bot App token CANNOT push .github/workflows/* (missing 'workflows' permission) — deliver CI as a patch"
type: learning
topic: ci-tooling
source: learnings/1785048496087-bot-app-token-cannot-push-github-workflows-missing.md
---

# Bot App token CANNOT push .github/workflows/* (missing 'workflows' permission) — deliver CI as a patch

When asked to add/modify a GitHub Actions workflow via git push as the nv-slang-bot GitHub App, the push is **rejected**:

> refusing to allow a GitHub App to create or update workflow `.github/workflows/<name>.yml` without `workflows` permission

The App token lacks the `workflows` permission scope. This blocks opening a PR that adds/edits any file under `.github/workflows/`, even though normal file pushes and `gh` issue/PR-comment operations work fine. **Workaround:** deliver the workflow as a ready-to-apply artifact in a PR/issue comment (fenced YAML + a note that a human must commit it), and ask the maintainer to land the file or grant the permission. Don't burn time retrying the push.

Related, for slangpy-samples specifically (verified Jul 2026):
- The example test suite `tests/examples/test_examples.py` (added in PR #19) creates a real GPU device and runs each example — it CANNOT run on GitHub-hosted runners because **slangpy fails to create a device on software Vulkan (llvmpipe)** (`RuntimeError: Failed to create device!`). GPU CI needs a self-hosted runner; the main shader-slang/slangpy repo uses `runs-on: { group: nvrgfx, labels: [Linux, X64] }` (also a `gcp` group).
- The `.npz` expected-output fixtures in `tests/examples/` are **Git LFS** objects (`*.npz filter=lfs` in .gitattributes). A clone without LFS gives 129-byte pointer files and tests fail on unpickle/load. CI checkout must use `actions/checkout@v4` with `lfs: true`.
- slangpy-samples has NO C++ build — CI = `pip install slangpy` + `pytest tests/examples`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785048496087-bot-app-token-cannot-push-github-workflows-missing.md`_
