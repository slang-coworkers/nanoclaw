# ncl group container fixes — Bookworm package gaps + approval sequencing

# ncl group container fixes — Bookworm package gaps + approval sequencing

Three lessons from the slang-fixer container rebuild incident (2026-05-29, follow-on from slang issue #11356). Total cost: 6 admin approval cards over 3 failed rebuilds before landing the working state. Avoidable next time.

## 1. Debian Bookworm standard repos ship no `clang-format`

slang-fixer's running container, before the rebuild:

```
$ apt-cache search '^clang-format'   # empty
$ ls /usr/bin/clang-format*           # No such file or directory
$ which clang-format                  # empty
```

The configured apt sources (`bookworm` + `bookworm-updates` + `bookworm-security` + cli.github.com) ship no `clang-format` package at any version. Both `clang-format-17` and `clang-format-18` fail with `E: Unable to locate package`. To get clang-format in a Bookworm-based group container you need:

- `bookworm-backports` apt source (provides `clang-format-19` only — outside slang's documented `extras/formatting.sh` 17–18 acceptance range)
- LLVM apt repo (`apt.llvm.org`) for pinned 17/18/19/20
- Or upstream relaxation of `formatting.sh`'s version range

None achievable through `ncl groups config add-package` alone — all require a Dockerfile-level edit to add the apt source.

## 2. Per-group config can carry stale broken entries that only surface on first rebuild

slang-fixer's config had two broken entries (`clang-format-18` apt, `@bdpiprava/gersemi` npm — the latter is a 404 on npmjs.org) that had sat there for months without breaking anything because no rebuild had been triggered. The first `install_packages` rebuild revealed them serially.

**Before fixing one broken entry, eyeball the full config first** (`ncl groups config get --id <gid>`) and remove ALL stale/broken entries in a single batch — both `apt` and `npm` lists. Each rebuild attempt is an admin approval card; serial discovery is expensive.

## 3. Don't fire `ncl groups restart --rebuild` in parallel with pending config-change approvals — rebuild can race ahead

`ncl ... config remove-package` and `ncl groups restart --rebuild` are independently approval-gated. If you fire them in the same Bash batch and the rebuild approval clears first, the rebuild generates its Dockerfile from the *stale* config snapshot and re-fails on the entry you were just removing. Verified by experiment: notification 96 rebuilt with `@bdpiprava/gersemi` still in the Dockerfile, even though the remove-package approval (notification 98) arrived seconds later.

**Sequence strictly:** wait for the config-change approval result (system notification arrives), THEN fire the rebuild. One extra round-trip; saves a wasted rebuild.

## Verified-good slang-fixer config (post-fix, 2026-05-29)

```
packages_apt: ["libx11-dev"]
packages_npm: ["prettier"]
mcp_servers: {}
```

`slang-test` builds end-to-end, autodiff suite runs, disabled `//TEST_DISABLED:` tests correctly skip. Formatting toolchain (clang-format + gersemi) still missing in slang-fixer's container — separate follow-up, not on critical path until GH_TOKEN is restored for upstream pushes.
