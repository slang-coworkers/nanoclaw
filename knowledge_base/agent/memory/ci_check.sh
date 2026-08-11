#!/usr/bin/env bash
# For each PR: state, isDraft, mergeStateStatus, latest non-skipped ci.yml run (event/status/conclusion/id), yield?
while IFS=$'\t' read -r repo iss pr; do
  [ -z "$pr" ] && continue
  meta=$(gh pr view "$pr" --repo "$repo" --json state,isDraft,mergeStateStatus,headRefName --jq '[.state,(.isDraft|tostring),.mergeStateStatus,.headRefName]|@tsv' 2>/dev/null)
  state=$(echo "$meta" | cut -f1); draft=$(echo "$meta" | cut -f2); mss=$(echo "$meta" | cut -f3); head=$(echo "$meta" | cut -f4)
  run=$(gh run list --repo "$repo" --branch "$head" --workflow ci.yml --limit 20 \
    --json databaseId,event,status,conclusion,createdAt \
    --jq '[.[] | select(.conclusion != "skipped")] | sort_by(.createdAt) | last | [(.databaseId|tostring),.event,.status,(.conclusion//"")]|@tsv' 2>/dev/null)
  rid=$(echo "$run" | cut -f1); rev=$(echo "$run" | cut -f2); rstatus=$(echo "$run" | cut -f3); rconc=$(echo "$run" | cut -f4)
  yield=""
  if [ "$rconc" = "failure" ] && [ -n "$rid" ]; then
    yield=$(gh run view "$rid" --repo "$repo" --json jobs --jq 'any(.jobs[]; .name=="wait-for-human-priority" and .conclusion=="failure")' 2>/dev/null)
  fi
  echo -e "$iss\t$pr\t$state\t$draft\t$mss\t$rid\t$rev\t$rstatus\t$rconc\tyield=$yield"
done < <(grep '^shader-slang' /workspace/agent/memory/prchains.txt)
