---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787128851327-osyppk
written_at: 2026-08-19T09:56:58.793Z
---

# Pinning an unpinned dxvk-remix clone in a GHA workflow — fetch-by-SHA idiom + bot cannot push workflows

**Context:** slang#12617 — the `Nightly Remix Test` workflow (`.github/workflows/nightly-remix-test.yml`) cloned NVIDIAGameWorks/dxvk-remix at HEAD with a comment falsely claiming it was "pinned". It went red every night after dxvk-remix commit `673dc2af` ("Use USD without Python") swapped its USD dependency from the public `usd.py311…stock` packman packages to an `open_usd …-nopython` package **not published on the public CloudFront remote** — packman then falls through to the NVIDIA-internal `gtl` remote and demands `NVM_GTLAPI_TOKEN` (unavailable in public CI). Note the *precise* mechanism: the remote LIST (`config.packman.xml`) did NOT change — it is a **package-identity** change that then falls through to the internal remote. Say it that way, not "moved to the gtl remote."

**Fix that works:** pin the clone to the parent of the breaking commit. A plain `git clone --recursive --depth 1 <url>` can only fetch the remote's current HEAD — it **cannot** check out a non-tip/older commit. The correct shallow-pin idiom (verified: works on GitHub-hosted public repos, which enable `uploadpack.allowReachableSHA1InWant`):
```
git init dxvk-remix && cd dxvk-remix
git remote add origin <url>
git fetch --depth 1 origin <full-40-char-SHA>
git checkout FETCH_HEAD
git submodule update --init --recursive      # full-depth: old `--depth 1` shallowed only the SUPERPROJECT
```
`FETCH_HEAD`'s tree supplies the pinned commit's `.gitmodules`/gitlinks before the recursive submodule init, so it Just Works. GitHub Actions bash runs with `-e -o pipefail` by default, so a failed fetch/checkout fails the step — no extra `set -e` needed.

**Load-bearing delivery constraint (empirically CONFIRMED this run):** the `nv-slang-bot` GitHub App **cannot push any `.github/workflows/*` file** — `git push` is server-rejected with `refusing to allow a GitHub App to create or update workflow ... without workflows permission` (PUSH_EXIT=1), and `gh pr create` via the App route 403s. So a bot-authored PR containing a workflow change is IMPOSSIBLE. Delivery = **route the verified patch UP to the orchestrator** (holds a `workflow`-scope PAT) to open the PR, and/or post a `git apply`-able diff as an issue comment for a maintainer. Do NOT self-block silently, and do NOT fall back to "leave it as a maintainer to-do" (stale). Verify the patch with `prettier --check` (YAML) + `git apply --check` on a pristine base before handing off.

**Before-you-pin checks that saved a round-trip:** (1) confirm the pinned SHA's `packman-external.xml` still lists the public-CDN packages (no `open_usd`); (2) confirm it still has **exactly one** `rtx-remix-ngx_sdk_dlfg` entry, or the pre-existing "Pin NVGTL-only packman entries" regex step's `n != 1` assertion breaks; (3) add a `TODO(#<issue>)` and KEEP the issue OPEN so the unpin breadcrumb stays actionable (auto-close would orphan it).
