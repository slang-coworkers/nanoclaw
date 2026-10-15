#!/usr/bin/env bash
# worktree-gc-run.sh — reclaim this tier's own git worktrees. Runs INSIDE the
# tier's container (rw mount of its group directory), as the pre-task gate of
# the tier's hourly `worktree-gc` task, or by hand with --sweep.
#
# Steps: discover every worktree of /workspace/agent/{slang,slangpy,slang-rhi},
# measure filesystem idleness, resolve issue/PR state with one gh GraphQL batch
# per repo, classify with worktree-gc.py (the single source of thresholds),
# then act: REAP → save uncommitted work to a local `wip/reap/<name>` branch and
# remove the worktree; reclaim → delete `<worktree>/build`. Writes
# /workspace/agent/.worktree-gc/last-run.json (what the supervisor's §8 reads)
# and appends one line to history.log.
#
# Modes:
#   --gate     (default) time-boxed for the task runner's 30 s limit: acts for at
#              most GATE_BUDGET_S seconds, leaves the rest for the next fire, and
#              prints the gate JSON as the last line. wakeAgent is true only when
#              an action errored or free space is below ESCALATE_PCT of the volume.
#   --sweep    no time box; acts on the whole plan; prints the summary.
#   --dry-run  classify and print the plan; change nothing.
#
# Every step is bounded and idempotent: a build removal cut short resumes next
# fire, a half-removed worktree is finished by `git worktree prune` + rm, and a
# `wt-*` directory that git no longer knows about is removed once idle.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT=/workspace/agent
STATE_DIR="$AGENT/.worktree-gc"
BASES=(slang slangpy slang-rhi)
GATE_BUDGET_S="${GATE_BUDGET_S:-18}"
ESCALATE_PCT="${ESCALATE_PCT:-10}"   # gate wakes the agent when free is below this share of the volume

MODE=gate
for a in "$@"; do
  case "$a" in
    --gate) MODE=gate ;;
    --sweep) MODE=sweep ;;
    --dry-run) MODE=dry ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

START=$(date +%s)
NOW=$START
errors=()
actions=()
note() { echo "$*" >&2; }
budget_left() { [ "$MODE" != gate ] || [ $(( $(date +%s) - START )) -lt "$GATE_BUDGET_S" ]; }

free_gb() { df -BG --output=avail "$AGENT" 2>/dev/null | tail -1 | tr -dc '0-9'; }
total_gb() { df -BG --output=size "$AGENT" 2>/dev/null | tail -1 | tr -dc '0-9'; }
repo_for() { case "$1" in slangpy) echo shader-slang/slangpy ;; slang-rhi) echo shader-slang/slang-rhi ;; *) echo shader-slang/slang ;; esac; }
mtime() { stat -c %Y "$1" 2>/dev/null || echo 0; }

# --- Discover ---------------------------------------------------------------
# One record per worktree: base, path, name, number, kind, idle_days, has_build, running, branch (tab-separated)
records=()
for base in "${BASES[@]}"; do
  B="$AGENT/$base"
  [ -d "$B/.git" ] || continue
  git -C "$B" worktree prune 2>/dev/null
  while IFS= read -r wt; do
    [ -n "$wt" ] && [ "$wt" != "$B" ] || continue
    case "$wt" in "$AGENT"/*) ;; *) continue ;; esac
    [ -d "$wt" ] || continue
    name="$(basename "$wt")"
    num="$(printf '%s' "$name" | grep -oE '(^|[^0-9])[0-9]{4,}' | head -1 | tr -dc '0-9')"
    # A primary tree is the tier's fix checkout (wt-slang-<n>, wt-slangpy-<n>,
    # wt-slang-rhi-<n>, wt-<repo>-pr-<n>, wt-<n>); every other name is scratch.
    kind=scratch
    [[ "$name" =~ ^wt-(slang|slangpy|slang-rhi)-(pr-)?[0-9]+$ || "$name" =~ ^wt-[0-9]+$ ]] && kind=primary
    meta="$B/.git/worktrees/$name"
    latest=$(mtime "$wt")
    for f in "$wt/.git" "$meta/index" "$meta/HEAD" "$wt/build/.ninja_log" "$wt/build/CMakeCache.txt"; do
      m=$(mtime "$f"); [ "$m" -gt "$latest" ] && latest=$m
    done
    idle=$(awk -v n="$NOW" -v m="$latest" 'BEGIN { printf "%.2f", (n-m)/86400 }')
    has_build=false; [ -d "$wt/build" ] && has_build=true
    running=false
    [ -e "$meta/locked" ] && running=true
    slug="${name#wt-}"
    aw="$AGENT/active-work/$slug"
    [ -d "$aw" ] && [ $(( NOW - $(mtime "$aw") )) -lt 86400 ] && running=true
    branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)"; [ "$branch" = HEAD ] && branch=""
    records+=("$base	$wt	$name	$num	$kind	$idle	$has_build	$running	$branch")
  done < <(git -C "$B" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0, 10)}')
done

RECORDS="$(mktemp)"; trap 'rm -f "$RECORDS"' EXIT
printf '%s\n' "${records[@]}" > "$RECORDS"

# --- Resolve GitHub state (one GraphQL batch of up to 40 numbers per repo) ---
STATES_JSON="$(python3 - "$RECORDS" <<'PY'
import json, re, subprocess, sys, datetime
rows=[l.rstrip("\n").split("\t") for l in open(sys.argv[1]) if l.strip()]
repo_of={"slang":"shader-slang/slang","slangpy":"shader-slang/slangpy","slang-rhi":"shader-slang/slang-rhi"}
# key = (repo, number, branch): the PR is looked up under fix/issue-<n> AND the tree's own branch
keys=sorted({(repo_of.get(r[0],"shader-slang/slang"), r[3], (r[8] if len(r)>8 else "")) for r in rows if r[3]})
state={}
def q(s): return s.replace("\\","\\\\").replace('"','\\"')
def run(batch):
    parts=[]
    for i,(repo,n,br) in enumerate(batch):
        o,r=repo.split("/")
        extra = f' own: pullRequests(headRefName:"{q(br)}", first:1, orderBy:{{field:UPDATED_AT, direction:DESC}}) {{ nodes {{ state updatedAt }} }}' if br and br!=f"fix/issue-{n}" else ""
        parts.append(f'q{i}: repository(owner:"{o}", name:"{r}") {{ issueOrPullRequest(number:{n}) {{ __typename ... on Issue {{ state updatedAt }} ... on PullRequest {{ state updatedAt }} }} prs: pullRequests(headRefName:"fix/issue-{n}", first:1, orderBy:{{field:UPDATED_AT, direction:DESC}}) {{ nodes {{ state updatedAt }} }}{extra} }}')
    out=subprocess.run(["gh","api","graphql","-f","query={"+" ".join(parts)+"}"],capture_output=True,text=True,timeout=25)
    try: data=(json.loads(out.stdout) or {}).get("data") or {}
    except Exception: data={}
    if not data and out.returncode!=0 and len(batch)>1:
        for item in batch: run([item])
        return
    for i,(repo,n,br) in enumerate(batch):
        d=data.get(f"q{i}") or {}
        nodes=((d.get("prs") or {}).get("nodes") or []) + ((d.get("own") or {}).get("nodes") or [])
        state[(repo,n,br)]=(d.get("issueOrPullRequest"), nodes)
try:
    for i in range(0,len(keys),40): run(keys[i:i+40])
except Exception as e:
    print(f"gh resolution failed: {e}", file=sys.stderr)
now=datetime.datetime.now(datetime.timezone.utc)
def idle(ts):
    try: return (now-datetime.datetime.fromisoformat(ts.replace("Z","+00:00"))).days
    except Exception: return None
out={}
def pick(nodes):
    # an OPEN PR wins over a closed one under another head name
    nodes=sorted(nodes, key=lambda p: (p["state"]!="OPEN", p["updatedAt"]), reverse=False)
    return nodes[0] if nodes else None
for repo,n,br in keys:
    iop,prs=state.get((repo,n,br),(None,[]))
    rec={"issue_state":"","pr_state":"","pr_idle_days":None}
    if iop:
        if iop["__typename"]=="PullRequest":
            rec.update(pr_state=iop["state"], pr_idle_days=idle(iop["updatedAt"]))
        else:
            rec["issue_state"]=iop["state"]
            pr=pick(prs)
            if pr: rec.update(pr_state=pr["state"], pr_idle_days=idle(pr["updatedAt"]))
    out[f"{repo}#{n}#{br}"]=rec
print(json.dumps(out))
PY
)" || STATES_JSON="{}"

# --- Classify ---------------------------------------------------------------
FREE_BEFORE=$(free_gb); TOTAL=$(total_gb)
PLAN="$(GC_PY="$HERE/worktree-gc.py" python3 - "$FREE_BEFORE" "$STATES_JSON" "$MODE" "$TOTAL" "$RECORDS" <<'PY'
import json, sys, subprocess, os
free=int(sys.argv[1] or 0); states=json.loads(sys.argv[2] or "{}"); mode=sys.argv[3]; total=int(sys.argv[4] or 0)
repo_of={"slang":"shader-slang/slang","slangpy":"shader-slang/slangpy","slang-rhi":"shader-slang/slang-rhi"}
wts=[]
for l in open(sys.argv[5]):
    if not l.strip(): continue
    f=l.rstrip("\n").split("\t"); base,path,name,num,kind,idle,has_build,running=f[:8]; branch=f[8] if len(f)>8 else ""
    st=states.get(f"{repo_of.get(base,'shader-slang/slang')}#{num}#{branch}",{}) if num else {}
    w={"dir":name,"path":path,"base":base,"number":num,"kind":kind,"idle_days":float(idle),
       "has_build":has_build=="true","running":running=="true",
       "issue_state":st.get("issue_state",""),"pr_state":st.get("pr_state",""),"pr_idle_days":st.get("pr_idle_days")}
    if mode=="sweep" and w["has_build"]:
        try: w["build_size_gb"]=round(int(subprocess.run(["du","-sk",path+"/build"],capture_output=True,text=True).stdout.split()[0])/1048576,2)
        except Exception: pass
    wts.append(w)
gc=subprocess.run(["python3", os.environ["GC_PY"]], input=json.dumps({"free_gb":free,"total_gb":total,"running_dirs":[],"worktrees":wts}), capture_output=True, text=True)
sys.stdout.write(gc.stdout)
PY
)"
[ -n "$PLAN" ] || { echo '{"wakeAgent": true, "data": {"error": "classifier produced no plan"}}'; exit 0; }

plan_list() { printf '%s' "$PLAN" | python3 -c "
import json,sys; p=json.load(sys.stdin); key=sys.argv[1]
items=p['tiers']['REAP'] if key=='REAP' else p['reclaim']
if key=='REAP': items=sorted(items, key=lambda w: -(w.get('idle_days') or 0))
for w in items: print('\t'.join([w['base'], w['path'], w['dir'], w.get('gc_reason','')]))
" "$1"; }

# --- Act ----------------------------------------------------------------------
save_then_remove() { # base path name
  local B="$AGENT/$1" wt="$2" name="$3" head
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null | head -1)" ]; then
    git -C "$wt" add -A >/dev/null 2>&1
    git -C "$wt" -c user.name=worktree-gc -c user.email=worktree-gc@nanoclaw commit -q -m "wip(reap): $name @ $(git -C "$wt" rev-parse --short HEAD 2>/dev/null)" >/dev/null 2>&1 || true
  fi
  head="$(git -C "$wt" rev-parse HEAD 2>/dev/null)"
  [ -n "$head" ] && git -C "$B" branch -f "wip/reap/$name" "$head" >/dev/null 2>&1
  # build/ first, bounded: the bulk of the bytes, and a cut-short rm resumes next fire.
  if [ -d "$wt/build" ]; then
    timeout "${RM_TIMEOUT_S:-15}" rm -rf "$wt/build" 2>/dev/null
    [ -d "$wt/build" ] && { note "partial: $name build/ still present"; return 3; }
  fi
  git -C "$B" worktree remove --force "$wt" >/dev/null 2>&1 || { rm -rf "$wt"; git -C "$B" worktree prune >/dev/null 2>&1; }
  [ -d "$wt" ] && return 1
  rm -rf "$AGENT/active-work/${name#wt-}" 2>/dev/null
  return 0
}

reaped=0; reclaimed=0; partial=0
if [ "$MODE" != dry ]; then
  while IFS=$'\t' read -r base path name reason; do
    [ -n "$path" ] || continue
    budget_left || { partial=$((partial+1)); continue; }
    if save_then_remove "$base" "$path" "$name"; then reaped=$((reaped+1)); actions+=("reap $name ($reason)")
    elif [ $? -eq 3 ]; then partial=$((partial+1))
    else errors+=("reap failed: $name"); fi
  done < <(plan_list REAP)
  while IFS=$'\t' read -r base path name reason; do
    [ -n "$path" ] || continue
    budget_left || { partial=$((partial+1)); continue; }
    [ -d "$path/build" ] || continue
    timeout "${RM_TIMEOUT_S:-15}" rm -rf "$path/build" 2>/dev/null
    if [ -d "$path/build" ]; then partial=$((partial+1)); else reclaimed=$((reclaimed+1)); actions+=("reclaim build $name ($reason)"); fi
  done < <(plan_list reclaim)
  # Directories git no longer tracks (a removal cut short earlier), idle a day or more.
  for base in "${BASES[@]}"; do
    B="$AGENT/$base"; [ -d "$B/.git" ] || continue
    known="$(git -C "$B" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0, 10)}')"
    for d in "$AGENT"/wt-*; do
      [ -d "$d" ] || continue
      printf '%s\n' "$known" | grep -qx "$d" && continue
      [ -e "$d/.git" ] && continue   # another base clone's worktree
      [ $(( NOW - $(mtime "$d") )) -ge 86400 ] || continue
      budget_left || { partial=$((partial+1)); continue; }
      timeout "${RM_TIMEOUT_S:-15}" rm -rf "$d" 2>/dev/null && actions+=("remove orphan $(basename "$d")") || partial=$((partial+1))
    done
    break
  done
fi

# --- Report -----------------------------------------------------------------
FREE_AFTER=$(free_gb)
SUMMARY="$(printf '%s' "$PLAN" | python3 -c "import json,sys; s=json.load(sys.stdin)['summary']; print(json.dumps({'counts': s['counts'], 'reclaim_count': s['reclaim_count'], 'free_pct': s['free_pct'], 'under_pressure': s['under_pressure']}))")"
if [ "$MODE" != dry ]; then
  mkdir -p "$STATE_DIR"
  python3 - "$STATE_DIR" "$MODE" "$FREE_BEFORE" "$FREE_AFTER" "$reaped" "$reclaimed" "$partial" "$SUMMARY" "$(printf '%s\n' "${actions[@]:-}")" "$(printf '%s\n' "${errors[@]:-}")" <<'PY'
import json, sys, datetime, os
d, mode, fb, fa, reaped, reclaimed, partial, summary, actions, errors = sys.argv[1:11]
rep = {"at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "mode": mode,
       "free_gb_before": int(fb or 0), "free_gb_after": int(fa or 0), "reaped": int(reaped), "build_reclaimed": int(reclaimed),
       "left_for_next_run": int(partial), "plan": json.loads(summary),
       "actions": [a for a in actions.split("\n") if a], "errors": [e for e in errors.split("\n") if e]}
json.dump(rep, open(os.path.join(d, "last-run.json"), "w"), indent=1)
with open(os.path.join(d, "history.log"), "a") as f:
    f.write(f"{rep['at']} {mode} free {rep['free_gb_before']}G→{rep['free_gb_after']}G reaped={reaped} build_reclaimed={reclaimed} left={partial} errors={len(rep['errors'])}\n")
PY
fi

if [ "$MODE" = dry ]; then
  printf '%s' "$PLAN" | python3 -c "
import json,sys; p=json.load(sys.stdin)
print('free_gb', p['summary']['free_gb'], 'of', p['summary']['total_gb'], '=', p['summary']['free_pct'], '% | counts', p['summary']['counts'], '| build-reclaim', p['summary']['reclaim_count'])
for w in sorted(p['tiers']['REAP'], key=lambda w:-(w.get('idle_days') or 0)): print('REAP   ', w['dir'], '|', w.get('gc_reason'))
for w in p['reclaim']: print('RECLAIM', w['dir'], '|', w.get('gc_reason'))
for w in p['tiers']['NO-PR']: print('NO-PR  ', w['dir'], '|', w.get('gc_reason'))
"
  exit 0
fi

wake=false
[ ${#errors[@]} -gt 0 ] && wake=true
[ -n "$FREE_AFTER" ] && [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] && [ $(( FREE_AFTER * 100 / TOTAL )) -lt "$ESCALATE_PCT" ] && wake=true
printf '{"wakeAgent": %s, "data": {"free_gb": %s, "reaped": %d, "build_reclaimed": %d, "left_for_next_run": %d, "errors": %d, "plan": %s}}\n' \
  "$wake" "${FREE_AFTER:-0}" "$reaped" "$reclaimed" "$partial" "${#errors[@]}" "$SUMMARY"
