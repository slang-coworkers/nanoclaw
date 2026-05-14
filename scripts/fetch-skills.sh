#!/bin/bash
# Fetch external skills declared via skill-source in coworker-types.yaml.
# Runs at build time (before docker build) and at setup time.
# Requires: gh CLI with skill extension, node (for parsing YAML).
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/container/skills"
MANIFEST="$SKILLS_DIR/.external-skills.json"

cd "$PROJECT_ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "⚠ gh CLI not found — skipping external skill fetch"
  exit 0
fi

if ! gh skill --help >/dev/null 2>&1; then
  echo "⚠ gh skill extension not available — skipping external skill fetch"
  exit 0
fi

echo "Resolving external skills from coworker-types.yaml..."

node -e "
  const { readCoworkerTypes, resolveTypeChain } = require('./dist/claude-composer.js');
  const types = readCoworkerTypes('.');
  const sources = {};
  for (const [name, entry] of Object.entries(types)) {
    if (!entry.skills || entry.skills.length === 0) continue;
    // Resolve the extends chain to inherit skillSource from ancestors
    const chain = resolveTypeChain(types, name);
    const resolved = chain.reduce((acc, e) => ({
      ...acc, ...e, skillSource: e.skillSource || acc.skillSource,
      skills: [...(acc.skills || []), ...(e.skills || [])],
    }), {});
    if (!resolved.skillSource) continue;
    const [repo, defaultRef] = resolved.skillSource.split('@');
    for (const skill of (entry.skills || [])) {
      const [skillName, ver] = skill.split('@');
      const ref = ver || defaultRef || 'main';
      if (!sources[skillName]) {
        sources[skillName] = { repo, ref };
      }
    }
  }
  console.log(JSON.stringify(sources, null, 2));
" > "$MANIFEST"

TOTAL=$(jq 'length' "$MANIFEST")
if [ "$TOTAL" -eq 0 ]; then
  echo "No external skills declared."
  exit 0
fi

echo "Found $TOTAL external skill(s) to resolve."

FETCHED=0
SKIPPED=0

for skill in $(jq -r 'keys[]' "$MANIFEST"); do
  repo=$(jq -r ".[\"$skill\"].repo" "$MANIFEST")
  ref=$(jq -r ".[\"$skill\"].ref" "$MANIFEST")

  [ "$repo" = "null" ] && continue

  # Compare cached tree-sha against upstream tree-sha at the path. Branch-name
  # comparison alone (the previous behavior) is wrong: every skill on a tracked
  # branch (e.g. "coworkers") shows existing_ref == ref even after upstream
  # advanced — the script wrongly reported "already at coworkers" and never
  # re-fetched. Tree-sha is the precise change signal: different sha = path
  # contents changed, regardless of how the branch moved.
  cached_sha=$(grep -oP 'github-tree-sha: \K\S+' "$SKILLS_DIR/$skill/SKILL.md" 2>/dev/null || echo "")
  existing_ref=$(grep -oP 'github-ref: refs/heads/\K.*' "$SKILLS_DIR/$skill/SKILL.md" 2>/dev/null || echo "")

  if [ -n "$cached_sha" ] && [ "$existing_ref" = "$ref" ]; then
    # Query upstream contents API for the current tree-sha at skills/<skill>
    # on <ref>. If the API call fails (rate limit, network), keep the cache
    # rather than re-fetching everything.
    upstream_repo_owner_name=$(echo "$repo" | sed 's|^https://github.com/||')
    upstream_sha=$(gh api "repos/$upstream_repo_owner_name/contents/skills/$skill?ref=$ref" --jq '.sha' 2>/dev/null || echo "")
    if [ -n "$upstream_sha" ] && [ "$cached_sha" = "$upstream_sha" ]; then
      echo "  skip $skill (already at $ref @ ${upstream_sha:0:8})"
      SKIPPED=$((SKIPPED + 1))
      continue
    elif [ -z "$upstream_sha" ]; then
      echo "  skip $skill (upstream sha check failed; cache assumed current)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    echo "  fetch $skill from $repo@$ref (tree-sha changed: ${cached_sha:0:8} → ${upstream_sha:0:8})"
  else
    echo "  fetch $skill from $repo@$ref"
  fi

  if gh skill install "$repo" "$skill@$ref" --dir "$SKILLS_DIR" --force 2>&1 | grep -q "Installed"; then
    FETCHED=$((FETCHED + 1))
  else
    echo "  ⚠ failed to fetch $skill"
  fi
done

echo "Done: $FETCHED fetched, $SKIPPED cached."
