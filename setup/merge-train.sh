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
#
# Idempotent: a branch already merged (an ancestor of HEAD) is skipped, so
# re-running /setup — or running this twice — is a no-op.
set -euo pipefail

BRANCHES=("$@")
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
# nv-main), so take nv-main's. We match with git's OWN gitignore engine, which is
# exactly the gitwildmatch syntax .github/nv-path-guard/check.py matches with, so
# is_owned can NEVER drift from path-guard and a missing entry (the class of bug a
# hand-maintained list produced — e.g. setup.sh) is impossible. ci.yml and
# setup.sh's compose_fork read the same file the same way.
NV_OWNED_LIST="$(mktemp)"
git show origin/nv-main:.github/nv-path-guard/nv-main.txt > "$NV_OWNED_LIST" 2>/dev/null || true
is_owned() {
  # No allowlist (unexpected) → own nothing, so every conflict surfaces loudly
  # rather than being silently resolved toward nv-main.
  [ -s "$NV_OWNED_LIST" ] || return 1
  git -c core.excludesFile="$NV_OWNED_LIST" check-ignore --no-index -q -- "$1"
}

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
    unexpected=""
    for f in $conflicts; do
      is_owned "$f" || unexpected="$unexpected $f"
    done
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
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    is_owned "$f" || continue
    git cat-file -e "origin/nv-main:$f" 2>/dev/null || continue
    git checkout origin/nv-main -- "$f"
  done < <(git diff --name-only origin/nv-main HEAD)
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q --amend --no-edit
  fi
  merged_any=1
done

if [ "$merged_any" = "1" ]; then
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

  echo "merge-train: done — merged, installed, verified, built, rebuilt CLAUDE.md, and validated"
else
  echo "merge-train: nothing to merge (all branches already present)"
fi
