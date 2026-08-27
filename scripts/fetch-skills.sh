#!/bin/bash
# Fetch external skills declared via skill-source in coworker-types.yaml.
# Runs at build time (before docker build), at setup time, in CI, and hourly
# from scripts/refresh-skills-cron.sh.
# Requires: gh CLI (>= 2.90, for the built-in `gh skill`), node, jq, a GitHub token.
#
# FAILS LOUD BY DESIGN. Every path that leaves a declared skill un-fetched exits
# non-zero. A partial fetch that exits 0 is the worst outcome available here:
# the missing skill does not break anything at fetch time, it breaks the NEXT
# deploy with `Coworker type "slangpy-reader" references unknown
# skill/workflow/overlay: slangpy-build, ...` — hours later, with no obvious
# link back to the fetch that quietly did nothing. See scripts/lib/gh-token.sh
# for the two distinct ways an unauthenticated `gh` degrades.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/container/skills"
MANIFEST="$SKILLS_DIR/.external-skills.json"

# shellcheck source=scripts/lib/gh-token.sh
. "$PROJECT_ROOT/scripts/lib/gh-token.sh"

cd "$PROJECT_ROOT"

# Count of declared skills we could not bring to their requested ref. Any value
# > 0 makes this script exit 1.
FAILED=0

fail_skill() {
  echo "  ✗ $1"
  FAILED=$((FAILED + 1))
}

echo "Resolving external skills from coworker-types.yaml..."

# The manifest is derived from the built composer. A missing or stale dist would
# otherwise blow up mid-redirect and leave MANIFEST truncated to empty, which
# reads downstream as "no external skills declared" — another silent no-op.
if [ ! -f "$PROJECT_ROOT/dist/claude-composer.js" ]; then
  echo "✗ dist/claude-composer.js missing — run \`pnpm run build\` first" >&2
  exit 1
fi

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

# ── preflight ───────────────────────────────────────────────────────────────
# These two checks used to sit at the top of the file and `exit 0`, which meant
# a host with no gh — or a logged-out gh — reported success while fetching
# nothing. They now run AFTER the manifest: "nothing declared" is still a
# legitimate clean exit, but "skills declared and we cannot fetch them" is not.
if ! command -v gh >/dev/null 2>&1; then
  echo "✗ gh CLI not found, but $TOTAL external skill(s) are declared" >&2
  exit 1
fi

if ! gh skill --help >/dev/null 2>&1; then
  echo "✗ \`gh skill\` unavailable (need gh >= 2.90), but $TOTAL external skill(s) are declared" >&2
  exit 1
fi

# Resolve a token once for the whole run and export GH_TOKEN. Both `gh api` and
# `gh skill install` pick it up from the environment — verified: with a bogus
# GH_TOKEN, `gh skill install` fails with "HTTP 401: Bad credentials" instead of
# quietly falling back to anonymous.
MANIFEST_OWNERS=$(jq -r '[.[].repo] | map(sub("^https://github.com/"; "") | split("/")[0]) | unique[]' "$MANIFEST")
PRIMARY_OWNER=$(printf '%s\n' "$MANIFEST_OWNERS" | head -1)
if ! resolve_gh_token "$PRIMARY_OWNER"; then
  echo "✗ refusing to fetch skills unauthenticated — anonymous GitHub API is 60 req/hour," >&2
  echo "  and \`gh skill install\` will happily use it, then 403 partway through." >&2
  exit 1
fi
echo "Authenticated via ${GH_TOKEN_SOURCE}."

# Prove the token can actually READ every distinct upstream repo before doing
# any work — one call per repo. This is also the empirical check on whether an
# App installation token reaches a given repo: we ask GitHub rather than assume.
MANIFEST_REPOS=$(jq -r '[.[].repo] | map(sub("^https://github.com/"; "")) | unique[]' "$MANIFEST")
for upstream in $MANIFEST_REPOS; do
  if ! gh_probe_repo_readable "$upstream"; then
    exit 1
  fi
done

FETCHED=0
SKIPPED=0

for skill in $(jq -r 'keys[]' "$MANIFEST"); do
  repo=$(jq -r ".[\"$skill\"].repo" "$MANIFEST")
  ref=$(jq -r ".[\"$skill\"].ref" "$MANIFEST")

  [ "$repo" = "null" ] && continue

  # Local skills: a skill listed under a type that declares a skill-source but
  # which lives in-repo and is NOT published upstream (e.g. webhook routers,
  # local-only review runners). The signal is an on-disk SKILL.md with no
  # `github-ref:` frontmatter — external installs always stamp that line; a
  # hand-authored local skill never has it. Without this guard such skills get
  # swept into the fetch list and 404 three times on every build (the upstream
  # repo has no `skills/<name>` path), and worse, would be clobbered if upstream
  # ever added a same-named skill. Skip them entirely.
  if [ -f "$SKILLS_DIR/$skill/SKILL.md" ] && \
     ! grep -q 'github-ref:' "$SKILLS_DIR/$skill/SKILL.md" 2>/dev/null; then
    echo "  skip $skill (local skill — no upstream sync)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Compare cached tree-sha against upstream tree-sha at the path. Branch-name
  # comparison alone (the previous behavior) is wrong: every skill on a tracked
  # branch (e.g. "coworkers") shows existing_ref == ref even after upstream
  # advanced — the script wrongly reported "already at coworkers" and never
  # re-fetched. Tree-sha is the precise change signal: different sha = path
  # contents changed, regardless of how the branch moved.
  cached_sha=$(grep -oP 'github-tree-sha: \K\S+' "$SKILLS_DIR/$skill/SKILL.md" 2>/dev/null || echo "")
  existing_ref=$(grep -oP 'github-ref: refs/heads/\K.*' "$SKILLS_DIR/$skill/SKILL.md" 2>/dev/null || echo "")

  if [ -n "$cached_sha" ] && [ "$existing_ref" = "$ref" ]; then
    # Query upstream for the current tree-sha of the skills/<skill> directory on
    # <ref>. The contents API returns an ARRAY for a directory (its entries),
    # not an object — so `--jq '.sha'` on the dir path always fails ("expected
    # an object but got: array"), the sha-check silently degrades to
    # cache-assumed-current, and skills never refresh. The directory's own sha
    # lives in the PARENT listing; select the matching entry from there.
    #
    # Capture rc IMMEDIATELY, before anything else runs. `$?` is clobbered by
    # the next command of any kind — including a `$(...)` inside an echo, which
    # is why scripts/funnel-cron.sh has always logged "FAILED (rc=0)".
    upstream_repo_owner_name=$(echo "$repo" | sed 's|^https://github.com/||')

    # Retried on the same terms as the install below. This query used to be a
    # SINGLE attempt while the install got three, so a run could survive a
    # throttled download and still be killed by a throttled tree-sha lookup
    # moments earlier — the asymmetry made "too many requests" failures look
    # random. GitHub's SECONDARY rate limit clears in seconds, which is exactly
    # what a backoff is for; the primary one resets on the hour and will still
    # fail, loudly and correctly.
    api_attempt=1
    api_max=3
    while :; do
      set +e
      api_out=$(gh api "repos/$upstream_repo_owner_name/contents/skills?ref=$ref" \
        --jq ".[] | select(.name == \"$skill\") | .sha" 2>&1)
      api_rc=$?
      set -e
      [ $api_rc -eq 0 ] && break
      [ $api_attempt -ge $api_max ] && break
      gh_output_is_throttled "$api_out" || break   # only throttling is worth retrying
      echo "  ⚠ $skill tree-sha query throttled (attempt $api_attempt) — backing off $((api_attempt * 10))s"
      sleep $((api_attempt * 10))
      api_attempt=$((api_attempt + 1))
    done

    # THIS is where rate-limit damage used to become invisible. The old code was
    # `2>/dev/null || echo ""`, so a 403 (throttled) and a 4 (no token at all)
    # both produced an empty string, which the branch below read as "cache
    # assumed current" → skip → exit 0. A failed check is now a failure.
    if [ $api_rc -ne 0 ]; then
      if gh_output_is_throttled "$api_out"; then
        fail_skill "$skill: RATE LIMITED querying upstream tree-sha (rc=$api_rc)"
      elif gh_output_is_unauthenticated "$api_out"; then
        fail_skill "$skill: unauthenticated/rejected querying upstream tree-sha (rc=$api_rc)"
      else
        fail_skill "$skill: upstream tree-sha query failed (rc=$api_rc)"
      fi
      printf '%s\n' "$api_out" | sed 's/^/    | /'
      continue
    fi

    upstream_sha="$api_out"
    if [ -n "$upstream_sha" ] && [ "$cached_sha" = "$upstream_sha" ]; then
      echo "  skip $skill (already at $ref @ ${upstream_sha:0:8})"
      SKIPPED=$((SKIPPED + 1))
      continue
    elif [ -z "$upstream_sha" ]; then
      # rc=0 with no match: the API answered, and `skills/<skill>` genuinely is
      # not in the listing. This skill was installed from upstream once (it
      # carries a github-ref: stamp) and has since disappeared — real drift, not
      # a transient. Surface it instead of pretending the cache is current.
      fail_skill "$skill: not present at $upstream_repo_owner_name/skills on $ref (removed upstream?)"
      continue
    fi
    echo "  fetch $skill from $repo@$ref (tree-sha changed: ${cached_sha:0:8} → ${upstream_sha:0:8})"
  else
    echo "  fetch $skill from $repo@$ref"
  fi

  attempt=1
  max_attempts=3
  installed=0
  while [ $attempt -le $max_attempts ]; do
    set +e
    output=$(gh skill install "$repo" "$skill@$ref" --dir "$SKILLS_DIR" --force 2>&1)
    rc=$?
    set -e
    if [ $rc -eq 0 ] && echo "$output" | grep -q "Installed"; then
      installed=1
      break
    fi
    if [ $attempt -lt $max_attempts ]; then
      echo "  ⚠ fetch $skill attempt $attempt failed (rc=$rc), retrying..."
      # Back off harder when throttled. 2s/4s does nothing against a primary
      # rate limit that resets on the hour, but a SECONDARY rate limit does
      # clear in seconds, and the extra wait costs nothing on the happy path.
      if gh_output_is_throttled "$output"; then
        echo "    (throttled — backing off $((attempt * 10))s)"
        sleep $((attempt * 10))
      else
        sleep $((attempt * 2))
      fi
    fi
    attempt=$((attempt + 1))
  done
  if [ $installed -eq 1 ]; then
    FETCHED=$((FETCHED + 1))
  else
    # Previously this printed a warning and the script still exited 0 — which is
    # exactly how a rate-limited run passed for a successful one.
    if gh_output_is_throttled "$output"; then
      fail_skill "$skill: RATE LIMITED after $max_attempts attempts (rc=$rc)"
    else
      fail_skill "$skill: install failed after $max_attempts attempts (rc=$rc)"
    fi
    printf '%s\n' "$output" | sed 's/^/    | /'
  fi
done

echo "Done: $FETCHED fetched, $SKIPPED cached, $FAILED failed."

if [ "$FAILED" -gt 0 ]; then
  echo "✗ $FAILED of $TOTAL declared skill(s) could not be brought to their requested ref." >&2
  echo "  Do NOT deploy off this tree — container/skills/ is incomplete, and the next" >&2
  echo "  compose will fail with 'references unknown skill/workflow/overlay'." >&2
  exit 1
fi
