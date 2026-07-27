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

# OWNED = files git-owned by nv-main that are safe to take from the canonical
# (nv-main) side on conflict. Mirrors .github/nv-path-guard/nv-main.txt and the
# is_owned() in ci.yml: host TS (src/**), agent-runner code, base spine/skills,
# and shared config. Overlay branches carry stale copies of these (they lag
# nv-main), so a conflict here is the sibling being behind — take nv-main's.
# A genuine overlay-owned content conflict lands OUTSIDE these paths and still
# fails loudly (the merge aborts). Keep in sync with ci.yml's is_owned().
is_owned() {
  case "$1" in
    package.json|pnpm-lock.yaml) return 0 ;;
    tsconfig.json|vitest.config.ts|vitest.setup.ts) return 0 ;;
    versions.json) return 0 ;;
    .github/*) return 0 ;;
    .claude/skills/*) return 0 ;;
    src/*) return 0 ;;
    scripts/*) return 0 ;;
    setup/*) return 0 ;;
    docs/*) return 0 ;;
    container/agent-runner/*) return 0 ;;
    container/hooks/*) return 0 ;;
    container/config/*) return 0 ;;
    container/cli-tools.json|container/cli-tools.test.ts|container/install-cli-tools.sh) return 0 ;;
    container/spines/base/*) return 0 ;;
    container/skills/spine-base/*) return 0 ;;
    container/skills/base/*) return 0 ;;
    container/Dockerfile|container/build.sh|container/entrypoint.sh) return 0 ;;
    CLAUDE.md|README.md|CONTRIBUTING.md|LICENSE|.gitignore) return 0 ;;
    *) return 1 ;;
  esac
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

  # package.json and pnpm-lock.yaml are jointly canonical to nv-main. A dep line
  # in package.json that doesn't textually conflict can still auto-merge to a
  # value inconsistent with the lockfile (resolved to nv-main) — breaking
  # `pnpm install --frozen-lockfile` (ERR_PNPM_OUTDATED_LOCKFILE). Force both to
  # nv-main's pair after each merge, unconditionally, folding into the merge
  # commit. See setup/merge-train.test.ts.
  git checkout origin/nv-main -- package.json pnpm-lock.yaml 2>/dev/null || true
  if ! git diff --cached --quiet -- package.json pnpm-lock.yaml 2>/dev/null; then
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
  if ! (pnpm install --frozen-lockfile && pnpm run build && npm run rebuild:claude); then
    rollback_and_fail
  fi
  echo "merge-train: done — merged, installed, built, and rebuilt CLAUDE.md"
else
  echo "merge-train: nothing to merge (all branches already present)"
fi
