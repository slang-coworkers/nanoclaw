# Task script gate for the daily learnings-wiki fold (nemoclaw-coworkers). Runs on the host
# inside the task's script sandbox with /workspace/shared mounted. Prints the scheduler JSON.
# Prefer the builder's own `gate` (same recursive L1 set the fold reads); fall back to the
# bash test when the builder has not been materialised yet (fresh install: step 0 writes it).
cd /workspace/shared 2>/dev/null || { echo '{"wakeAgent": false}'; exit 0; }
if [ -f .learnings_wiki.py ] && python3 .learnings_wiki.py gate 2>/dev/null; then exit 0; fi
NEW=$(find learnings -name '*.md' ! -iname INDEX.md -newer wiki/index.md -print -quit 2>/dev/null | grep -c .)
[ -f wiki/index.md ] || NEW=$(find learnings -name '*.md' ! -iname INDEX.md -print -quit 2>/dev/null | grep -c .)
uncited=$(comm -23 <(ls wiki/learnings/*.md 2>/dev/null | xargs -n1 basename | sort) <(grep -rhoE 'wiki/learnings/[A-Za-z0-9_.-]+\.md' wiki/concepts/ 2>/dev/null | sed 's#wiki/learnings/##' | sort -u))
uncov=0
for f in $uncited; do grep -q '^superseded_by:' "wiki/learnings/$f" 2>/dev/null || uncov=$((uncov+1)); done
if [ "$NEW" -gt 0 ] || [ "$uncov" -gt 60 ]; then echo "{\"wakeAgent\": true, \"data\": {\"uncovered\": $uncov, \"new_learnings\": $NEW}}"; else echo '{"wakeAgent": false}'; fi
