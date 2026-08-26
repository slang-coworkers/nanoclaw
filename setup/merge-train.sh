#!/usr/bin/env bash
#
# nv-* merge step for /setup.
#
# The /setup skill INVOKES this script instead of carrying `git merge` in its
# prose. docs/skills-model.md is explicit that "a skill never merges", but this
# fork's install model IS a merge train (the nv-* branches are the source of
# truth), so the merge lives here in one maintained, deterministic script rather
# than as copy-pasted instructions. Keeping it out of the skill prose is what
# lets /setup stay declarative while the mechanical merge stays testable.
#
# Usage:
#   bash setup/merge-train.sh                # merges origin/nv-main (default)
#   bash setup/merge-train.sh nv-main nv-slang   # merges each, in order
#   bash setup/merge-train.sh --reconcile-stale nv-main nv-dashboard nv-slang …
#                                            # PROD UPDATE off a deeply-stale base
#
# Idempotent: a branch already merged (an ancestor of HEAD) is skipped, so
# re-running /setup — or running this twice — is a no-op.
#
# --reconcile-stale (OPT-IN; off by default): after the per-branch merges, force
# the nv-main-owned trees + shared config back to nv-main and drop stale-deleted
# files an overlay still drags along. This is for the PROD-UPDATE path, where the
# base can be thousands of commits behind nv-main; it is deliberately NOT the
# /setup default, because on a fresh install a blanket checkout would DISCARD an
# overlay's intentional shared-source edits (nv-dashboard edits host src, which
# the project-integrations LLM tier keeps) and there is no stale drift to remove.
# Prod deploys pass the flag; /setup and its project-integrations step do not, so
# their behavior is unchanged. The flag reconciles WHENEVER it is passed, even if
# nothing new merged this run — so a box already composed by an earlier unflagged
# merge can be reconciled by re-running with the flag. It refuses (does not run
# the blanket checkout) if the owned paths carry uncommitted local edits; stash or
# commit them first. See reconcile_stale_drift() below.
set -euo pipefail

# --reconcile-stale is parsed out of the positional list; every other argument is
# a branch name, unchanged from the historical `BRANCHES=("$@")` contract.
RECONCILE_STALE=0
BRANCHES=()
for arg in "$@"; do
  if [ "$arg" = "--reconcile-stale" ]; then
    RECONCILE_STALE=1
  else
    BRANCHES+=("$arg")
  fi
done
[ ${#BRANCHES[@]} -eq 0 ] && BRANCHES=(nv-main)

# nv-main is canonical for every shared-infra file, so a conflict in that set is
# a sibling branch carrying a stale copy — resolve it to nv-main's content, not
# HEAD's. Fetch nv-main up front so `git checkout origin/nv-main -- <f>` has the
# ref even when nv-main is not itself one of the branches being merged. This
# mirrors the composed-state resolver in .github/workflows/ci.yml — keep the two
# in sync.
git fetch origin nv-main "${BRANCHES[@]}"

# OWNED = files nv-main is canonical for on conflict. The SINGLE source of truth
# is nv-main's path-guard allowlist (.github/nv-path-guard/nv-main.txt) — the same
# file the nv-path-guard workflow enforces. A conflict in that set means a sibling
# is carrying a stale copy of a nv-main-owned file (overlays track upstream, not
# nv-main), so take nv-main's.
#
# BOTH the allowlist and the MATCHER come from origin/nv-main, and the matcher is
# the one every other reader uses (.github/nv-path-guard/check.py imports it;
# scripts/check-nv-owned-drift.sh shells out to it). This used to run
#
#     git -c core.excludesFile=<list> check-ignore --no-index -q -- <path>
#
# HERE, IN THE PROJECT REPO — which also consults this repo's .gitignore,
# .git/info/exclude and the user's global excludes. That is not a hypothetical
# leak: this repo's own .gitignore alone hands nv-main ownership of groups/**,
# data/**, logs/**, dist/**, store/**, repos/**, slang_kb/**, coworkers/*.yaml,
# .claude/projects/*/memory/** and forks.md — none of which nv-main.txt lists.
# Auto-resolving a conflict in any of those toward nv-main silently drops the
# sibling's content, which is precisely the failure this guard exists to prevent.
# Running the shared matcher instead sees the allowlist and nothing else.
NV_OWNED_LIST="$(mktemp)"
git show origin/nv-main:.github/nv-path-guard/nv-main.txt > "$NV_OWNED_LIST" 2>/dev/null || true
NV_MATCHER="$(mktemp)"
git show origin/nv-main:.github/nv-path-guard/ownership.py > "$NV_MATCHER" 2>/dev/null || true

# NUL-delimited candidates on stdin → NUL-delimited owned paths on stdout, in ONE
# matcher call. Per-path invocation would be a python start per file, and these
# loops run over the whole nv-main..HEAD diff.
nv_owned() {
  [ -s "$NV_OWNED_LIST" ] && [ -s "$NV_MATCHER" ] || return 1
  python3 "$NV_MATCHER" -0 "$NV_OWNED_LIST"
}

# Exact membership in a NUL-delimited set file. Deliberately not `grep -zxF`:
# `-z` is GNU-only, and in ugrep (which shadows grep on some developer PATHs) it
# means "decompress the input" instead of "NUL-delimited".
nv_set_has() {
  local set_file="$1" want="$2" got
  while IFS= read -r -d '' got; do
    [ "$got" = "$want" ] && return 0
  done < "$set_file"
  return 1
}

# Fail LOUD, not quiet. Every ownership answer below feeds either "abort this
# merge" or "overwrite this file from nv-main"; a matcher that cannot run would
# make both silently no-op, leaving exactly the dangling stale copies this script
# exists to remove.
if ! printf 'probe\0' | nv_owned >/dev/null 2>&1; then
  echo "merge-train: cannot evaluate nv-main ownership — need python3 and" >&2
  echo "  .github/nv-path-guard/{nv-main.txt,ownership.py} on origin/nv-main." >&2
  exit 1
fi

# Pre-merge tip. A merge can resolve cleanly (all conflicts inside nv-main's
# owned set) yet still produce a tree that doesn't build — e.g. is_owned took
# nv-main's version of a shared source file, dropping an overlay's intentional
# edit, and the overlay's *other* (non-conflicting) files now dangle. When that
# happens we roll the whole merge back to START_HEAD rather than leave a broken
# commit that a re-run would skip as "already merged" and falsely report merged.
START_HEAD="$(git rev-parse HEAD)"
rollback_and_fail() {
  echo "merge-train: composed tree failed to install/build — rolling back the merge" >&2
  git reset --hard "$START_HEAD"
  exit 1
}

# Opt-in reconciliation for the PROD-UPDATE path (--reconcile-stale). Runs ONCE,
# AFTER every branch in the train has merged. The per-branch resolver above
# already (a) takes nv-main on any OWNED conflict and (b) re-canonicalizes owned
# files that DIFFER from nv-main — enough for /setup, whose base IS nv-main. It is
# NOT enough for a deploy off a deeply-stale composed base (nv-coworkers ran
# ~1175 commits behind nv-main), which surfaced two classes the diff-scoped
# resolver structurally cannot reach:
#
#   DOWNGRADES    — an overlay's older copy of a shared-infra file that AUTO-merged
#                   (no conflict) and won: src/response-registry.ts losing
#                   getShutdownCallbacks, the src/modules/permissions/user-dm.ts
#                   signature. A blanket checkout of the owned TREES restores every
#                   such file in one pass, so no stale infra copy is left behind
#                   whatever git's three-way diff happened to flag.
#   STALE DELETES — a file nv-main REMOVED that an overlay still carries: the dead
#                   src/host-lifecycle.ts + its test, and orphan *.test.ts on no
#                   composing branch (src/db/migrations/registry.test.ts,
#                   src/modules/permissions/user-dm.test.ts). `git checkout` never
#                   deletes, so canonicalization leaves these dangling and they
#                   break build/tests. They must be removed explicitly.
#
# checkout writes only paths that EXIST on nv-main, so overlay-ADDED files under
# the owned trees (skill-installed adapters like src/channels/dashboard.ts, absent
# on nv-main) are preserved. Idempotent: a second run finds the trees already
# canonical and no stale files, so nothing is staged and no commit is made.
reconcile_stale_drift() {
  echo "merge-train: --reconcile-stale — canonicalizing owned trees + dropping stale-deleted files"

  # (1) DOWNGRADES: blanket-checkout the nv-main-owned trees + shared config to
  # nv-main. container/skills/** is intentionally NOT here, so composed spine
  # bodies (container/skills/spine-base/context/operations.md) stay as ours. Only
  # paths that exist on nv-main are checked out — a synthetic/minimal nv-main that
  # lacks e.g. setup/ or scripts/ simply skips them rather than erroring.
  local restore=(
    src scripts setup container/agent-runner .github
    package.json pnpm-lock.yaml pnpm-workspace.yaml
    tsconfig.json tsconfig.typecheck.json
    vitest.config.ts vitest.setup.ts ruff.toml setup.sh .npmrc
  )
  local present=() p
  for p in "${restore[@]}"; do
    if git cat-file -e "origin/nv-main:$p" 2>/dev/null; then present+=("$p"); fi
  done
  if [ ${#present[@]} -gt 0 ]; then
    # GUARD (prod data-loss): the blanket checkout below overwrites every owned
    # file from nv-main, discarding uncommitted TRACKED edits — and prod boxes
    # routinely carry local hotfixes. The per-branch merges leave a clean tree,
    # so a dirty owned path here is a pre-existing local edit the merges never
    # touched: refuse rather than silently wipe it. (Untracked files are safe —
    # `git checkout` never removes them, so they are intentionally not flagged.)
    if ! git diff --quiet -- "${present[@]}" \
       || ! git diff --cached --quiet -- "${present[@]}"; then
      echo "merge-train: --reconcile-stale would overwrite UNCOMMITTED local changes to" >&2
      echo "  nv-main-owned paths; refusing to discard them. Modified:" >&2
      git diff --name-only -- "${present[@]}" >&2
      git diff --cached --name-only -- "${present[@]}" >&2
      echo "  Commit or stash them first (git stash), then re-run with --reconcile-stale." >&2
      exit 1
    fi
    git checkout origin/nv-main -- "${present[@]}"
  fi

  # A file is legitimate if it lives on nv-main OR any overlay this run merged; a
  # file on none of them is drift the stale base carried. Derived from the branches
  # actually composed — no branch names or filenames hardcoded.
  local keep_refs=(origin/nv-main) b
  for b in "${BRANCHES[@]}"; do
    keep_refs+=("origin/$b")
  done

  # (2) STALE TESTS: drop every *.test.ts under the owned trees present on no
  # composing branch. Single-star git pathspec matches recursively (git's `*`
  # spans `/`), so this sees tests at any depth — the `**` form MISSES the ones
  # directly under the tree root.
  local f ref keep
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    keep=0
    for ref in "${keep_refs[@]}"; do
      if git cat-file -e "$ref:$f" 2>/dev/null; then keep=1; break; fi
    done
    if [ "$keep" -eq 0 ]; then
      echo "merge-train:   stale test on no composing branch — removing $f"
      git rm -q -f -- "$f"
    fi
  done < <(git ls-files -- 'src/*.test.ts' 'setup/*.test.ts' 'container/agent-runner/*.test.ts')

  # (3) STALE DEAD MODULE: src/host-lifecycle.ts + its test were removed on
  # nv-main; a stale overlay still carries them and they fail the build. GUARDED —
  # removed only when nothing under src/ or container/ still imports it, so a
  # legitimate future re-add (with a real importer) is never silently dropped.
  if git ls-files --error-unmatch -- src/host-lifecycle.ts >/dev/null 2>&1; then
    local importers
    importers="$(grep -rIl 'host-lifecycle' src container 2>/dev/null \
                 | grep -Ev '(^|/)host-lifecycle(\.test)?\.ts$' || true)"
    if [ -z "$importers" ]; then
      echo "merge-train:   dead module nothing imports — removing src/host-lifecycle.ts + test"
      # Per-path with --ignore-unmatch: bundling both in ONE `git rm` fails
      # atomically if EITHER is absent (an overlay may carry only the module, not
      # its test), which would leave the module in place while reconcile still
      # reported success. Removing each independently drops whichever exist.
      local hl
      for hl in src/host-lifecycle.ts src/host-lifecycle.test.ts; do
        git rm -q -f --ignore-unmatch -- "$hl" >/dev/null
      done
    fi
  fi

  # (4) OVERLAY-AUTHORITATIVE FILES: a NON-owned file the owned-set logic leaves
  # untouched but a stale auto-merge can still mangle. dashboard/public/app.js is
  # the cost-dashboard frontend, authoritative on nv-dashboard — force it to the
  # overlay's copy. Taken from the first merged overlay (non-nv-main) that carries
  # it, so the branch is derived from the train rather than hardcoded.
  local overlay_only=(dashboard/public/app.js) file
  for file in "${overlay_only[@]}"; do
    for b in "${BRANCHES[@]}"; do
      [ "$b" = "nv-main" ] && continue
      if git cat-file -e "origin/$b:$file" 2>/dev/null; then
        if git checkout "origin/$b" -- "$file" 2>/dev/null; then
          echo "merge-train:   $file — taking origin/$b (overlay is authoritative)"
        fi
        break
      fi
    done
  done

  # Commit the reconciliation in one step. checkout/rm already staged their
  # changes and stage ONLY the paths they touched, so a prod checkout's untracked
  # data/ logs/ groups/ are never swept in; an untouched tree stages nothing and
  # the re-run makes no commit.
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q -m "merge-train: reconcile stale drift against nv-main + overlays"
    RECONCILE_COMMITTED=1
  fi
}

merged_any=0
for branch in "${BRANCHES[@]}"; do
  if git merge-base --is-ancestor "origin/$branch" HEAD 2>/dev/null; then
    echo "merge-train: origin/$branch already merged — skipping"
    continue
  fi
  echo "merge-train: merging origin/$branch"
  if ! git merge "origin/$branch" --no-edit; then
    # Auto-resolve conflicts in nv-main's owned set (stale infra copies on the
    # sibling) by taking nv-main's canonical content. ANY conflict OUTSIDE that
    # set is a real overlay content clash — abort and surface it rather than
    # silently resolving toward one side.
    conflicts="$(git diff --name-only --diff-filter=U)"
    conflicts_owned="$(mktemp)"
    printf '%s\0' $conflicts | nv_owned > "$conflicts_owned" || : > "$conflicts_owned"
    unexpected=""
    for f in $conflicts; do
      nv_set_has "$conflicts_owned" "$f" || unexpected="$unexpected $f"
    done
    rm -f "$conflicts_owned"
    if [ -n "$unexpected" ]; then
      echo "merge-train: conflicts outside nv-main's owned set, aborting:" >&2
      printf '  %s\n' $unexpected >&2
      git merge --abort
      exit 1
    fi
    for f in $conflicts; do
      echo "merge-train: $f conflict — taking nv-main (canonical) version"
      # A delete/modify conflict (removed on nv-main, edited on the sibling) has
      # no nv-main blob to check out — honor the deletion.
      if git checkout origin/nv-main -- "$f" 2>/dev/null; then
        git add -- "$f"
      else
        git rm -f -- "$f" >/dev/null 2>&1 || rm -f "$f"
        git add -A -- "$f"
      fi
    done
    git commit --no-edit
  fi

  # The ENTIRE owned set is canonical to nv-main — not just the files that
  # textually conflicted (resolved above). An overlay carries stale copies of
  # nv-main-owned files (it tracks upstream, not nv-main); when such a copy
  # AUTO-merges (doesn't conflict) it is kept, then dangles against nv-main's
  # evolved code (the nv-dashboard groups.ts / create-agent.ts break) or desyncs
  # package.json from the lockfile (ERR_PNPM_OUTDATED_LOCKFILE). So after the
  # merge, overwrite every owned file that EXISTS on nv-main and differs here to
  # nv-main's version. Overlay-NEW owned files (absent on nv-main — the overlay's
  # own skills/adapters) are left untouched. See setup/merge-train.test.ts.
  # Resolve the whole diff in one matcher call and walk the OWNED set directly,
  # rather than asking "is this owned?" once per file. NUL-delimited throughout,
  # so a path containing whitespace or a newline survives the round trip.
  owned_diff="$(mktemp)"
  git diff --name-only -z origin/nv-main HEAD | nv_owned > "$owned_diff" || : > "$owned_diff"
  while IFS= read -r -d '' f; do
    [ -z "$f" ] && continue
    git cat-file -e "origin/nv-main:$f" 2>/dev/null || continue
    git checkout origin/nv-main -- "$f"
  done < "$owned_diff"
  rm -f "$owned_diff"
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q --amend --no-edit
  fi
  merged_any=1
done

# Opt-in prod-update reconciliation. Runs whenever --reconcile-stale is passed,
# INDEPENDENT of whether this run merged anything: a box already composed by a
# prior UNFLAGGED merge must still be reconcilable by re-running with the flag —
# gating it on merged_any would make the flag a no-op on exactly the already-stale
# boxes it exists for. It runs BEFORE the install/build tail so the composed tree
# is validated AFTER reconciling, and before the MERGE_TRAIN_NO_INSTALL early-exit
# so the tests can assert its effect. reconcile_stale_drift sets
# RECONCILE_COMMITTED=1 iff it committed a change. On the /setup path
# RECONCILE_STALE is 0, so nothing here changes.
RECONCILE_COMMITTED=0
if [ "$RECONCILE_STALE" = "1" ]; then
  reconcile_stale_drift
fi

# The install/build/validate tail runs when THIS TREE changed — a merge landed
# OR reconcile committed something. A flag-only run on an already-clean tree
# falls through to "nothing to merge".
if [ "$merged_any" = "1" ] || [ "$RECONCILE_COMMITTED" = "1" ]; then
  # MERGE_TRAIN_NO_INSTALL lets tests exercise the merge/resolve logic above in a
  # synthetic repo without the Node toolchain. Never set in real setup.
  if [ -n "${MERGE_TRAIN_NO_INSTALL:-}" ]; then
    # test hook: MERGE_TRAIN_FAIL_VALIDATE=1 exercises the rollback path without
    # the Node toolchain.
    [ -n "${MERGE_TRAIN_FAIL_VALIDATE:-}" ] && rollback_and_fail
    echo "merge-train: merged (install/build skipped via MERGE_TRAIN_NO_INSTALL)"
    exit 0
  fi
  # Validate the composed tree: --frozen-lockfile per the supply-chain policy
  # (CLAUDE.md), then build + rebuild. If ANY step fails the merge produced a
  # broken tree — roll it back (see rollback_and_fail) rather than leave a broken
  # commit + false "already merged" success on the next run.
  #
  # check:runtime-deps sits between install and build BECAUSE OF THIS FUNCTION.
  # The canonicalization above overwrites the entire owned set from nv-main, so a
  # dependency a leaf branch added to the root manifest is DISCARDED here — and
  # install still succeeds, build still succeeds, and the consumer degrades to
  # "metric unavailable" in production with nothing going red. That is how
  # ccusage was lost (#1122/#1150). A frozen install cannot see it; only asking
  # whether the specifiers our code resolves still resolve can.
  if ! (pnpm install --frozen-lockfile \
        && pnpm run check:runtime-deps \
        && pnpm run build \
        && npm run rebuild:claude); then
    rollback_and_fail
  fi

  # External skills, then template validation. CI has always done both
  # (ci.yml and compose-check.yml: build → fetch-skills → validate:templates);
  # this path did neither, so the two disagreed about what a deployable tree is.
  # A composed tree missing its external skills installs, passes the runtime-dep
  # gate and BUILDS — then prints "merged, installed, built" and hands
  # production coworkers whose manifests cannot resolve. The failure surfaces
  # hours later at spawn time, which is precisely the case fetch-skills.sh's own
  # header describes.
  #
  # THE FETCH IS SOFT AND THE VALIDATION IS HARD, and that split is the whole
  # point. `gh` throttling is common and transient; letting it roll back an
  # entire five-branch merge would be an outage caused by a rate limit. But a
  # throttled fetch is only harmless if the CACHED skills still satisfy every
  # coworker type — and validate:templates is exactly that question. So:
  #
  #   throttled fetch + usable cache  -> warn, validate passes, deploy proceeds
  #   throttled fetch + no cache      -> validate FAILS, rollback (correct)
  #   clean fetch                     -> validate passes
  #
  # The decision is made by the invariant, never by the weather.
  if [ -f scripts/fetch-skills.sh ]; then
    if ! bash scripts/fetch-skills.sh; then
      echo "merge-train: ⚠ external skill fetch failed (often gh throttling)." >&2
      echo "merge-train:   Continuing on cached skills — validate:templates below decides." >&2
    fi
  fi
  if ! pnpm run validate:templates; then
    echo "merge-train: composed tree has coworker types whose skills do not resolve." >&2
    echo "merge-train:   If the fetch above was throttled, re-run; otherwise the" >&2
    echo "merge-train:   referenced skill is genuinely missing upstream." >&2
    rollback_and_fail
  fi

  # No agent-runner refresh step. /app/src is now ONE shared read-only bind of
  # container/agent-runner/src (src/container-runner.ts), so a merge that lands
  # new agent-runner code reaches every group on its next container start. The
  # per-group copies this used to have to chase are gone, and with them the
  # failure mode where a merge and a build both succeeded while every existing
  # group kept running the pre-merge code (#1105, the agent-runner half of #1110).
  #
  # Groups still need a restart to pick it up — bun has the old modules loaded —
  # but that is the normal deploy restart, not a per-group repair.

  echo "merge-train: done — merged, installed, verified, built, rebuilt CLAUDE.md, validated"
else
  echo "merge-train: nothing to merge (all branches already present)"
fi
