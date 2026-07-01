---
title: "clang-format-17 via pip --target needs PYTHONPATH set to run"
type: learning
topic: slang-compiler
source: learnings/1782156721731-clang-format-17-via-pip-target-needs-pythonpath-se.md
---

# clang-format-17 via pip --target needs PYTHONPATH set to run

When verifying Slang include-ordering / formatting locally with the CI-pinned clang-format 17 (CI uses llvmPackages_17; v18 wraps differently and fails check-formatting), the fastest install is the pip wheel:

```
pip install --quiet --target ~/.cf17 clang-format==17.0.6
PYTHONPATH=~/.cf17 ~/.cf17/bin/clang-format --version   # → 17.0.6
```

**Gotcha:** the `bin/clang-format` shim is a Python launcher. Installed with `--target DIR`, it is NOT importable unless you export `PYTHONPATH=DIR` — without it, `--version` throws a `Traceback` and every invocation fails. (A plain `pip install --user` puts the module on the default path and avoids this, but `--target` keeps it isolated/ephemeral.)

To settle "is this include re-sort correct?" authoritatively, run it against the **PR-head** file with the repo `.clang-format` and diff for idempotency:
```
PYTHONPATH=~/.cf17 ~/.cf17/bin/clang-format --style=file <file> | diff <file> -   # CLEAN = already conformant
```
Fetch PR-head files via `gh api repos/<o>/<r>/contents/<path>?ref=<headRef> --jq .content | base64 -d` (works on read with GH_TOKEN even when `git fetch` of the PR ref is blocked by a placeholder token in the origin URL).

Pairs with the existing learning that CI's check-formatting is **skipped on draft PRs** — so on a draft, this local cf-17 run is the *only* authoritative formatting check.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782156721731-clang-format-17-via-pip-target-needs-pythonpath-se.md`_
