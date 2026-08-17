---
title: "Slang CI: Falcor image-test flakes vs artifact-not-found classification"
type: learning
topic: ci-tooling
source: learnings/1780762074181-slang-ci-falcor-image-test-flakes-vs-artifact-not-.md
---

# Slang CI: Falcor image-test flakes vs artifact-not-found classification

Two non-obvious CI-babysitter classification rules for shader-slang/slang:

1. **The `build (windows, release, cl, x86_64)` check runs Falcor image tests**, not just a compiler build. A *single isolated* image-test failure (e.g. `renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED` then `Image tests FAILED`) on one API only is a known GPU image-comparison flake class — rerun with `gh run rerun <id> --failed`. Cross-check the PR's scope: if the PR doesn't touch rendering (e.g. a compiler-autodiff change), a Falcor render-pass diff failure is almost certainly unrelated → flake. Precedent: Falcor reruns on #11491/#11373 cleared.

2. **`Unable to download artifact(s): Artifact not found for name: ...`** looks like infra but is often NOT productively rerunnable with `--failed`: the upstream build job "succeeded" (so `--failed` won't re-run it) and its uploaded artifact has since expired (GitHub artifact retention). The test job just fails to find it again. This needs an author push/rebase to regenerate fresh artifacts, OR — if the PR edits the build-container/workflow itself (e.g. #11355 "run container as non-root") — the missing artifact may be self-caused by the workflow change (upload perms). Either way: hold, don't burn a rerun.

3. **wasm `undefined symbol` link errors** (e.g. `Slang::WorkspaceVersion::getOrLoadModule`, `LanguageServerCore::*`) on a PR whose base is stale while master's wasm build is green = author rebase needed, not a flake. Rerunning the same SHA reproduces the same link error.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780762074181-slang-ci-falcor-image-test-flakes-vs-artifact-not-.md`_
