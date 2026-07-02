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

git fetch origin "${BRANCHES[@]}"

merged_any=0
for branch in "${BRANCHES[@]}"; do
  if git merge-base --is-ancestor "origin/$branch" HEAD 2>/dev/null; then
    echo "merge-train: origin/$branch already merged — skipping"
    continue
  fi
  echo "merge-train: merging origin/$branch"
  if ! git merge "origin/$branch" --no-edit; then
    # Only the lockfile is expected to conflict (nv-* branches add deps). Take
    # the incoming pnpm-lock.yaml so it stays consistent with the merged
    # package.json. ANY other conflict is a real content clash — abort and
    # surface it rather than silently resolving toward one side.
    conflicts="$(git diff --name-only --diff-filter=U)"
    others="$(printf '%s\n' "$conflicts" | grep -vx 'pnpm-lock.yaml' || true)"
    if [ -n "$others" ]; then
      echo "merge-train: unexpected conflicts outside pnpm-lock.yaml, aborting:" >&2
      printf '  %s\n' $others >&2
      git merge --abort
      exit 1
    fi
    git checkout --theirs pnpm-lock.yaml
    git add pnpm-lock.yaml
    git commit --no-edit
  fi
  merged_any=1
done

if [ "$merged_any" = "1" ]; then
  # --frozen-lockfile per the supply-chain policy (CLAUDE.md): the merge brought
  # a consistent package.json + pnpm-lock.yaml, so a frozen install is correct
  # and a spec/lock mismatch surfaces loudly instead of being papered over.
  pnpm install --frozen-lockfile
  pnpm run build
  npm run rebuild:claude
  echo "merge-train: done — merged, installed, built, and rebuilt CLAUDE.md"
else
  echo "merge-train: nothing to merge (all branches already present)"
fi
