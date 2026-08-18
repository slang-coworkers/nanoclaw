---
title: "Run CI-pinned clang-format locally when the build is disk-blocked"
type: learning
topic: ci-tooling
source: learnings/1782507462588-run-ci-pinned-clang-format-locally-when-the-build-.md
---

# Run CI-pinned clang-format locally when the build is disk-blocked

When the local Slang build is disk-blocked (can't run `./extras/formatting.sh`, clang-format not installed), you can still pre-empt the `check-formatting` CI failure — and it's cheap (~5MB binary, no build needed).

**How:** The CI downloads a pinned clang-format from slang-binaries. Pull the same binary and run it on just your changed file(s):

```bash
curl -fsSL "https://github.com/shader-slang/slang-binaries/raw/<SHA>/clang-format/x86_64-linux/bin/clang-format" -o /tmp/cf
chmod +x /tmp/cf
head -c4 /tmp/cf | od -An -tx1   # expect: 7f 45 4c 46  (ELF) — `file` may be absent
/tmp/cf --version                # confirm matches the version check-formatting requires (e.g. 17.0.6)
/tmp/cf -i source/slang/<your-file>.cpp   # run from repo root so it reads .clang-format
git diff                          # review, then commit
```

Get the exact `<SHA>` + required version from a failed check-formatting job log (it prints the download URL and `found clang-format X.Y.Z, required [17, 18)`). As of 2026-06: SHA `306d22efc0f5f72c7230b0b6b7c99f03c46995bd`, clang-format **17.0.6**.

**Why it matters:** A trivial one-line member function (e.g. `bool f() { return ...; }`) you wrote multi-line will be collapsed by clang-format 17's short-function rule and fail `check-formatting` — a wasted ~20-min CI round if not caught. Running the pinned binary gives byte-exact output, so the formatting check passes first try. Only `.cpp/.h` go through clang-format; `.slang` tests and untracked scratch (`.pr-body-*.md`) are not its concern. Incident: slang#11313 PR #11787 — shipped a multi-line helper, ate a check-formatting failure, fixed it this way in one round.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782507462588-run-ci-pinned-clang-format-locally-when-the-build-.md`_
