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

  existing_ref=$(grep -oP 'github-ref: refs/heads/\K.*' "$SKILLS_DIR/$skill/SKILL.md" 2>/dev/null || echo "")
  if [ "$existing_ref" = "$ref" ]; then
    echo "  skip $skill (already at $ref)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  fetch $skill from $repo@$ref"
  if gh skill install "$repo" "$skill@$ref" --dir "$SKILLS_DIR" --force 2>&1 | grep -q "Installed"; then
    FETCHED=$((FETCHED + 1))
  else
    echo "  ⚠ failed to fetch $skill"
  fi
done

echo "Done: $FETCHED fetched, $SKIPPED cached."
