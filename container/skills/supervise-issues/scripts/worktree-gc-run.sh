#!/usr/bin/env bash
# worktree-gc-run.sh — reclaim this tier's own per-task checkouts, scratch and run output.
# Runs INSIDE the tier's container (rw mount of its group directory), as the
# pre-task gate of the tier's hourly `worktree-gc` task, or by hand with --sweep.
#
# Steps:
#   1. discover  worktree-gc-discover.py lists every per-task checkout (worktrees
#                registered with /workspace/agent/{slang,slangpy,slang-rhi}, and every
#                top-level wt-* directory whatever its git shape: linked worktree,
#                standalone clone, orphan, plain), every runs/ entry, every top-level
#                scratch directory and wt-* file, and the trash.
#   2. resolve   issue/PR state with one gh GraphQL batch of up to 40 numbers per call.
#   3. classify  worktree-gc.py, the single source of thresholds.
#   4. act       REAP → save unsaved work, then rename the checkout into
#                .worktree-gc/trash/; reclaim → delete <checkout>/build; runs/ entries,
#                scratch directories and wt-* files past retention → rename into the
#                trash (a scratch directory after saving every repository inside it);
#                finally delete trash entries.
#   5. report    /workspace/agent/.worktree-gc/last-run.json (what the supervisor's §8
#                reads) and one history.log line.
#
# A reap is a rename, not a delete: it is O(1), so the gate's time box limits only
# how many bytes are freed per run, never how many checkouts leave the group
# directory, and a deletion cut short by the time box never leaves a half-removed
# tree where the agent or the boot refresh can find it. The trash drains over
# successive runs.
#
# Nothing moves before its save succeeded. Saving, by shape:
#   worktree  uncommitted changes committed; HEAD kept as branch `wip/reap/<name>`
#             in the repository that owns the worktree.
#   clone     uncommitted changes committed; the commits no remote-tracking ref
#             holds are written to .worktree-gc/saved/<name>.<stamp>.bundle.
#   orphan    the tree, minus ignored files and nested repositories, committed with
#             a scratch index as branch `wip/reap/<name>` in the repository its
#             `.git` file names.
#   bare      the commits not reachable from the repository it borrows objects from
#             (`git clone --bare --shared`), written to .worktree-gc/saved/ as a bundle.
# Untracked content above SAVE_MAX_MB is never committed: that checkout is skipped
# and listed under `skipped` in the report. Changes inside submodule working trees
# are third-party content and are not saved.
#
# Modes:
#   --gate     (default) time-boxed for the task runner's 30 s limit: acts for at
#              most GATE_BUDGET_S seconds from start, leaves the rest for the next
#              fire, and prints the gate JSON as the last line. wakeAgent is true only
#              when an action errored or free space is below ESCALATE_PCT of the volume.
#   --sweep    no time box; acts on the whole plan; prints the summary.
#   --dry-run  classify and print the plan; change nothing but git's own worktree
#              bookkeeping (the repair and prune discovery always runs).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT="${WORKTREE_GC_AGENT:-/workspace/agent}"
STATE_DIR="$AGENT/.worktree-gc"
TRASH="$STATE_DIR/trash"
SAVED="$STATE_DIR/saved"
GATE_BUDGET_S="${GATE_BUDGET_S:-18}"
GH_BUDGET_S="${GH_BUDGET_S:-8}"        # share of the gate budget the gh lookups may use
OP_TIMEOUT_S="${RM_TIMEOUT_S:-15}"     # cap on any one git or rm step in --gate mode

MODE=gate
for a in "$@"; do
  case "$a" in
    --gate) MODE=gate ;;
    --sweep) MODE=sweep ;;
    --dry-run) MODE=dry ;;
    -h|--help) sed -n '2,50p' "$0"; exit 0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

START=$(date +%s)
errors=()
actions=()
skipped=()
note() { echo "$*" >&2; }
remaining() { if [ "$MODE" = gate ]; then echo $(( GATE_BUDGET_S - ($(date +%s) - START) )); else echo 86400; fi; }
budget_left() { [ "$(remaining)" -ge 1 ]; }
op_timeout() { local r; r=$(remaining); [ "$MODE" = gate ] && [ "$r" -gt "$OP_TIMEOUT_S" ] && r=$OP_TIMEOUT_S; [ "$r" -lt 1 ] && r=1; echo "$r"; }
stamp() { date -u +%Y%m%dT%H%M%SZ; }

free_gb() { df -BG --output=avail "$AGENT" 2>/dev/null | tail -1 | tr -dc '0-9'; }
total_gb() { df -BG --output=size "$AGENT" 2>/dev/null | tail -1 | tr -dc '0-9'; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
gate_failure() { echo "{\"wakeAgent\": true, \"data\": {\"error\": \"$1\"}}"; exit 0; }

# --- Discover -----------------------------------------------------------------
python3 "$HERE/worktree-gc-discover.py" --agent "$AGENT" --state-dir "$STATE_DIR" > "$WORK/discovery.json" \
  || gate_failure "discovery failed"

# --- Resolve GitHub state (one GraphQL batch of up to 40 numbers per call) -------
GH_DEADLINE=$(( START + GH_BUDGET_S )); [ "$MODE" = gate ] || GH_DEADLINE=0
GH_DEADLINE="$GH_DEADLINE" python3 - "$WORK/discovery.json" > "$WORK/states.json" <<'PY' || echo '{}' > "$WORK/states.json"
import json, os, subprocess, sys, time, datetime
d=json.load(open(sys.argv[1]))
deadline=float(os.environ.get("GH_DEADLINE") or 0)
# key = (repo, number, branch): the PR is looked up under fix/issue-<n> AND the tree's own branch
keys=sorted({(w["repo"], w["number"], w.get("branch") or "") for w in d["worktrees"] if w.get("repo") and w.get("number")})
state={}
def q(s): return s.replace("\\","\\\\").replace('"','\\"')
def run(batch):
    left = (deadline - time.time()) if deadline else 25
    if left < 2:
        return
    parts=[]
    for i,(repo,n,br) in enumerate(batch):
        o,r=repo.split("/")
        extra = f' own: pullRequests(headRefName:"{q(br)}", first:1, orderBy:{{field:UPDATED_AT, direction:DESC}}) {{ nodes {{ state updatedAt }} }}' if br and br!=f"fix/issue-{n}" else ""
        parts.append(f'q{i}: repository(owner:"{o}", name:"{r}") {{ issueOrPullRequest(number:{n}) {{ __typename ... on Issue {{ state updatedAt }} ... on PullRequest {{ state updatedAt }} }} prs: pullRequests(headRefName:"fix/issue-{n}", first:1, orderBy:{{field:UPDATED_AT, direction:DESC}}) {{ nodes {{ state updatedAt }} }}{extra} }}')
    try:
        out=subprocess.run(["gh","api","graphql","-f","query={"+" ".join(parts)+"}"],capture_output=True,text=True,timeout=min(25,left),check=False)
    except (subprocess.TimeoutExpired, OSError) as e:
        print(f"gh resolution cut short: {e}", file=sys.stderr)
        return
    try: data=(json.loads(out.stdout) or {}).get("data") or {}
    except Exception: data={}
    if not data and out.returncode!=0:
        # A failed batch is retried item by item; an item that still fails stays
        # unresolved and is classified on idleness alone.
        if len(batch)>1:
            for item in batch: run([item])
        return
    for i,(repo,n,br) in enumerate(batch):
        dd=data.get(f"q{i}") or {}
        nodes=((dd.get("prs") or {}).get("nodes") or []) + ((dd.get("own") or {}).get("nodes") or [])
        state[(repo,n,br)]=(dd.get("issueOrPullRequest"), nodes)
for i in range(0,len(keys),40): run(keys[i:i+40])
now=datetime.datetime.now(datetime.timezone.utc)
def idle(ts):
    try: return (now-datetime.datetime.fromisoformat(ts.replace("Z","+00:00"))).days
    except Exception: return None
def pick(nodes):
    # an OPEN PR wins over a closed one under another head name
    nodes=sorted(nodes, key=lambda p: (p["state"]!="OPEN", p["updatedAt"]))
    return nodes[0] if nodes else None
out={}
for key in keys:
    if key not in state: continue
    iop,prs=state[key]
    rec={"issue_state":"","pr_state":"","pr_idle_days":None}
    if iop:
        if iop["__typename"]=="PullRequest":
            rec.update(pr_state=iop["state"], pr_idle_days=idle(iop["updatedAt"]))
        else:
            rec["issue_state"]=iop["state"]
            pr=pick(prs)
            if pr: rec.update(pr_state=pr["state"], pr_idle_days=idle(pr["updatedAt"]))
    out["#".join(key)]=rec
print(json.dumps({"states": out, "unresolved": len(keys)-len(out)}))
PY

# --- Classify ---------------------------------------------------------------
FREE_BEFORE=$(free_gb); TOTAL=$(total_gb)
python3 - "$WORK/discovery.json" "$WORK/states.json" "${FREE_BEFORE:-0}" "${TOTAL:-0}" "$MODE" "$HERE/worktree-gc.py" > "$WORK/plan.json" <<'PY' || gate_failure "classifier failed"
import json, subprocess, sys
d=json.load(open(sys.argv[1])); s=json.load(open(sys.argv[2])) or {}
states=s.get("states") or {}
free=int(sys.argv[3] or 0); total=int(sys.argv[4] or 0); mode=sys.argv[5]
wts=[]
for w in d["worktrees"]:
    st=states.get(f'{w.get("repo","")}#{w.get("number","")}#{w.get("branch") or ""}',{})
    w.update(issue_state=st.get("issue_state",""), pr_state=st.get("pr_state",""), pr_idle_days=st.get("pr_idle_days"))
    if mode=="sweep" and w.get("has_build"):
        try: w["build_size_gb"]=round(int(subprocess.run(["du","-sk",w["path"]+"/build"],capture_output=True,text=True,check=False).stdout.split()[0])/1048576,2)
        except Exception: pass
    wts.append(w)
gc=subprocess.run(["python3", sys.argv[6]], input=json.dumps({"free_gb":free,"total_gb":total,"running_dirs":[],"worktrees":wts,"runs":d["runs"],"scratch_dirs":d["scratch_dirs"],"wt_files":d["wt_files"]}), capture_output=True, text=True, check=False)
if gc.returncode!=0 or not gc.stdout.strip():
    sys.exit(1)
plan=json.loads(gc.stdout)
plan["discovery"]={"repaired": d.get("repaired", []), "trash_entries": len(d.get("trash", [])), "gh_unresolved": s.get("unresolved", 0)}
print(json.dumps(plan))
PY

plan_get() { python3 -c "import json,sys; p=json.load(open(sys.argv[1])); print(eval(sys.argv[2], {'p': p}))" "$WORK/plan.json" "$1"; }
plan_list() { python3 - "$WORK/plan.json" "$1" <<'PY'
import json, sys
p=json.load(open(sys.argv[1])); key=sys.argv[2]
if key=="REAP":
    for w in sorted(p["tiers"]["REAP"], key=lambda w: -(w.get("idle_days") or 0)):
        print("\t".join([w.get("shape") or "worktree", w["path"], w["dir"], w.get("owner") or "", w.get("gc_reason","")]))
elif key=="reclaim":
    for w in p["reclaim"]:
        print("\t".join([w["path"], w["dir"], w.get("gc_reason","")]))
elif key=="runs":
    for r in p["runs_expired"]:
        print("\t".join([r["path"], r["name"], str(r.get("idle_days"))]))
elif key=="files":
    for r in p["files_expired"]:
        print("\t".join([r["path"], r["name"], str(r.get("idle_days"))]))
elif key=="scratch":
    # git_inside as `shape|path|owner` items joined by `;`
    for r in p["scratch_expired"]:
        inside=";".join("|".join([g["shape"], g["path"], g.get("owner") or ""]) for g in r.get("git_inside") or [])
        print("\t".join([r["path"], r["name"], str(r.get("idle_days")), inside]))
PY
}
SAVE_MAX_MB=$(plan_get 'p["summary"]["thresholds"]["SAVE_MAX_MB"]')
ESCALATE_PCT=$(plan_get 'p["summary"]["thresholds"]["ESCALATE_PCT"]')

# --- Save ---------------------------------------------------------------------
# Each save_* returns 0 when the tree's work is safe (SAVED_AS says where), 4 when it
# must be skipped (SKIP_WHY says why), anything else on failure.
COMMITTER=(-c user.name=worktree-gc -c user.email=worktree-gc@nanoclaw -c commit.gpgsign=false)

bytes_mb() { awk '{s+=$1} END {print int((s+1048575)/1048576)}'; }

# A timed-out git step leaves its index.lock behind; that lock is ours, and keeping it
# would fail every later run on the same tree.
drop_lock_after_timeout() { [ "$1" -eq 124 ] && rm -f "$(git -C "$2" rev-parse --git-path index.lock 2>/dev/null)"; return "$1"; }

commit_dirty() { # checkout name
  local wt="$1" name="$2" mb rc
  [ -n "$(timeout "$(op_timeout)" git -C "$wt" status --porcelain --ignore-submodules=dirty 2>/dev/null | head -1)" ] || return 0
  mb=$(git -C "$wt" ls-files -z --others --exclude-standard 2>/dev/null | (cd "$wt" && xargs -0 -r stat -c %s --) 2>/dev/null | bytes_mb)
  if [ "${mb:-0}" -gt "$SAVE_MAX_MB" ]; then SKIP_WHY="${mb} MB of untracked files exceeds SAVE_MAX_MB"; return 4; fi
  timeout "$(op_timeout)" git -C "$wt" add -A >/dev/null 2>&1; rc=$?
  drop_lock_after_timeout "$rc" "$wt" || return 1
  timeout "$(op_timeout)" git -C "$wt" "${COMMITTER[@]}" commit -q --no-verify \
    -m "wip(reap): $name @ $(git -C "$wt" rev-parse --short HEAD 2>/dev/null)" >/dev/null 2>&1; rc=$?
  drop_lock_after_timeout "$rc" "$wt" || return 1
}

save_worktree() { # owner path name
  local head
  commit_dirty "$2" "$3" || return $?
  head="$(git -C "$2" rev-parse HEAD 2>/dev/null)" || return 1
  git -C "$1" branch -f "wip/reap/$3" "$head" >/dev/null 2>&1 || return 1
  SAVED_AS="branch wip/reap/$3 in ${1#"$AGENT"/}"
}

save_clone() { # path name
  local n b
  commit_dirty "$1" "$2" || return $?
  n="$(timeout "$(op_timeout)" git -C "$1" rev-list --count HEAD --branches --not --remotes 2>/dev/null)" || return 1
  if [ "${n:-0}" -eq 0 ]; then SAVED_AS="nothing unsaved (every commit is on a remote-tracking ref)"; return 0; fi
  mkdir -p "$SAVED" || return 1
  b="$SAVED/$2.$(stamp).bundle"
  timeout "$(op_timeout)" git -C "$1" bundle create "$b" HEAD --branches --not --remotes >/dev/null 2>&1 \
    || { rm -f "$b"; return 1; }
  SAVED_AS="bundle ${b#"$AGENT"/} ($n commits)"
}

save_orphan() { # owner path name
  local owner="$1" wt="$2" name="$3" idx="$WORK/orphan.index" mb tree commit rc
  local -a gd=(--git-dir="$owner/.git") excl=()
  # Nested repositories (submodules) are excluded; their `.git` files point into the
  # pruned administrative directory, so git would otherwise add their files one by one.
  while IFS= read -r -d '' g; do
    [ "$g" = . ] || excl+=(":(exclude)${g#./}")
  done < <(cd "$wt" && find . \( -type d -name 'build*' -prune \) -o \( -name .git -prune -printf '%h\0' \) 2>/dev/null)
  rm -f "$idx"
  GIT_INDEX_FILE="$idx" git "${gd[@]}" read-tree HEAD >/dev/null 2>&1 || rm -f "$idx"
  mb=$(GIT_INDEX_FILE="$idx" git -C "$wt" "${gd[@]}" --work-tree="$wt" ls-files -z --others --exclude-standard -- . "${excl[@]}" 2>/dev/null \
    | (cd "$wt" && xargs -0 -r stat -c %s --) 2>/dev/null | bytes_mb)
  if [ "${mb:-0}" -gt "$SAVE_MAX_MB" ]; then SKIP_WHY="${mb} MB of files outside the repository's tree exceeds SAVE_MAX_MB"; return 4; fi
  GIT_INDEX_FILE="$idx" timeout "$(op_timeout)" git -C "$wt" "${gd[@]}" --work-tree="$wt" add -A -- . "${excl[@]}" >/dev/null 2>&1; rc=$?
  [ "$rc" -eq 0 ] || return 1
  tree="$(GIT_INDEX_FILE="$idx" git "${gd[@]}" write-tree 2>/dev/null)" || return 1
  commit="$(git "${gd[@]}" "${COMMITTER[@]}" commit-tree "$tree" -m "wip(reap): orphaned $name (snapshot of its files)" 2>/dev/null)" || return 1
  git "${gd[@]}" branch -f "wip/reap/$name" "$commit" >/dev/null 2>&1 || return 1
  SAVED_AS="branch wip/reap/$name in ${owner#"$AGENT"/} (snapshot)"
}

save_bare() { # path name
  local n b mb
  n="$(timeout "$(op_timeout)" git --git-dir="$1" rev-list --count --all --not --alternate-refs 2>/dev/null)" || return 1
  if [ "${n:-0}" -eq 0 ]; then SAVED_AS="nothing unsaved (every commit is in the repository it borrows objects from)"; return 0; fi
  mkdir -p "$SAVED" || return 1
  b="$SAVED/$2.$(stamp).bundle"
  timeout "$(op_timeout)" git --git-dir="$1" bundle create "$b" --all --not --alternate-refs >/dev/null 2>&1 \
    || { rm -f "$b"; return 1; }
  mb=$(stat -c %s "$b" | bytes_mb)
  if [ "${mb:-0}" -gt "$SAVE_MAX_MB" ]; then rm -f "$b"; SKIP_WHY="its ${mb} MB of unsaved history exceeds SAVE_MAX_MB"; return 4; fi
  SAVED_AS="bundle ${b#"$AGENT"/} ($n commits)"
}

# Save one repository by shape; used for a checkout and for each repository inside
# a scratch directory.
save_repo() { # shape path name owner
  case "$1" in
    worktree) save_worktree "$4" "$2" "$3" ;;
    clone) save_clone "$2" "$3" ;;
    orphan) save_orphan "$4" "$2" "$3" ;;
    bare) save_bare "$2" "$3" ;;
    *) SKIP_WHY="no save procedure for shape '$1'"; return 4 ;;
  esac
}

to_trash() { # path label
  mkdir -p "$TRASH" && mv -T -- "$1" "$TRASH/$2.$(stamp).$$" 2>/dev/null
}

# --- Act ----------------------------------------------------------------------
reaped=0; reclaimed=0; runs_expired=0; scratch_expired=0; files_expired=0; drained=0; left=0
if [ "$MODE" != dry ]; then
  while IFS=$'\t' read -r shape path name owner reason; do
    [ -n "$path" ] || continue
    budget_left || { left=$((left+1)); continue; }
    SAVED_AS=""; SKIP_WHY=""
    save_repo "$shape" "$path" "$name" "$owner"
    rc=$?
    if [ "$rc" -eq 4 ]; then skipped+=("$name: $SKIP_WHY"); continue; fi
    if [ "$rc" -ne 0 ]; then
      # A save the time box cut short is retried next fire, not reported as an error.
      if budget_left; then errors+=("save failed: $name ($shape)"); else left=$((left+1)); fi
      continue
    fi
    if to_trash "$path" "$name"; then
      [ "$shape" = worktree ] && git -C "$owner" worktree prune >/dev/null 2>&1
      rm -rf "$AGENT/active-work/${name#wt-}" 2>/dev/null
      reaped=$((reaped+1)); actions+=("reap $name ($shape; $reason); saved: $SAVED_AS")
    else
      errors+=("move to trash failed: $name")
    fi
  done < <(plan_list REAP)

  while IFS=$'\t' read -r path name reason; do
    [ -n "$path" ] || continue
    budget_left || { left=$((left+1)); continue; }
    [ -d "$path/build" ] || continue
    timeout "$(op_timeout)" rm -rf "$path/build" 2>/dev/null
    if [ -d "$path/build" ]; then left=$((left+1)); else reclaimed=$((reclaimed+1)); actions+=("reclaim build $name ($reason)"); fi
  done < <(plan_list reclaim)

  while IFS=$'\t' read -r path name idle; do
    [ -n "$path" ] || continue
    budget_left || { left=$((left+1)); continue; }
    if to_trash "$path" "runs-$name"; then runs_expired=$((runs_expired+1)); actions+=("expire runs/$name (idle ${idle}d)")
    else errors+=("move to trash failed: runs/$name"); fi
  done < <(plan_list runs)

  # Scratch directories: save every repository inside first, then move the directory.
  while IFS=$'\t' read -r path name idle inside; do
    [ -n "$path" ] || continue
    budget_left || { left=$((left+1)); continue; }
    saved=(); rc=0; owners=()
    IFS=';' read -r -a repos <<< "$inside"
    for r in "${repos[@]}"; do
      [ -n "$r" ] || continue
      IFS='|' read -r rshape rpath rowner <<< "$r"
      rel="${rpath#"$path"}"; label="$name$(printf '%s' "$rel" | tr '/' '-')"
      SAVED_AS=""; SKIP_WHY=""
      save_repo "$rshape" "$rpath" "$label" "$rowner"; rc=$?
      [ "$rc" -eq 0 ] || break
      saved+=("${rel:-.}: $SAVED_AS"); [ "$rshape" = worktree ] && owners+=("$rowner")
    done
    if [ "$rc" -eq 4 ]; then skipped+=("$name: $SKIP_WHY"); continue; fi
    if [ "$rc" -ne 0 ]; then
      if budget_left; then errors+=("save failed: $name"); else left=$((left+1)); fi
      continue
    fi
    if to_trash "$path" "$name"; then
      for o in "${owners[@]:-}"; do [ -n "$o" ] && git -C "$o" worktree prune >/dev/null 2>&1; done
      scratch_expired=$((scratch_expired+1))
      actions+=("expire $name (idle ${idle}d)${saved[*]:+; saved: ${saved[*]}}")
    else
      errors+=("move to trash failed: $name")
    fi
  done < <(plan_list scratch)

  while IFS=$'\t' read -r path name idle; do
    [ -n "$path" ] || continue
    budget_left || { left=$((left+1)); continue; }
    if to_trash "$path" "$name"; then files_expired=$((files_expired+1))
    else errors+=("move to trash failed: $name"); fi
  done < <(plan_list files)
  [ "$files_expired" -gt 0 ] && actions+=("expire $files_expired top-level wt-* file(s)")

  # Drain the trash, oldest first. A deletion the time box cuts short resumes next fire.
  if [ -d "$TRASH" ]; then
    while IFS= read -r t; do
      budget_left || { left=$((left+1)); continue; }
      timeout "$(op_timeout)" rm -rf -- "$t" 2>/dev/null; rc=$?
      if [ -e "$t" ] && [ "$rc" -ne 124 ] && budget_left; then
        # Read-only directories (a Go module cache, say) refuse unlinking until made writable.
        chmod -R u+w -- "$t" 2>/dev/null; timeout "$(op_timeout)" rm -rf -- "$t" 2>/dev/null
      fi
      if [ -e "$t" ]; then left=$((left+1)); else drained=$((drained+1)); fi
    done < <(find "$TRASH" -mindepth 1 -maxdepth 1 -printf '%T@\t%p\n' 2>/dev/null | sort -n | cut -f2-)
  fi
fi

# --- Report -----------------------------------------------------------------
FREE_AFTER=$(free_gb)
SUMMARY="$(python3 -c "
import json,sys; p=json.load(open(sys.argv[1])); s=p['summary']
print(json.dumps({'counts': s['counts'], 'shapes': s['shapes'], 'reclaim_count': s['reclaim_count'],
                  'runs_expired_count': s['runs_expired_count'], 'scratch_expired_count': s['scratch_expired_count'],
                  'files_expired_count': s['files_expired_count'], 'free_pct': s['free_pct'],
                  'under_pressure': s['under_pressure'], **p['discovery']}))" "$WORK/plan.json")"
if [ "$MODE" != dry ]; then
  mkdir -p "$STATE_DIR"
  python3 - "$STATE_DIR" "$MODE" "${FREE_BEFORE:-0}" "${FREE_AFTER:-0}" "$reaped" "$reclaimed" "$runs_expired" "$scratch_expired" "$files_expired" "$drained" "$left" "$SUMMARY" \
    "$(printf '%s\n' "${actions[@]:-}")" "$(printf '%s\n' "${skipped[@]:-}")" "$(printf '%s\n' "${errors[@]:-}")" <<'PY'
import json, sys, datetime, os
d, mode, fb, fa, reaped, reclaimed, runs_expired, scratch_expired, files_expired, drained, left, summary, actions, skipped, errors = sys.argv[1:16]
lines = lambda s: [x for x in s.split("\n") if x]
rep = {"at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "mode": mode,
       "free_gb_before": int(fb or 0), "free_gb_after": int(fa or 0), "reaped": int(reaped),
       "build_reclaimed": int(reclaimed), "runs_expired": int(runs_expired),
       "scratch_expired": int(scratch_expired), "files_expired": int(files_expired), "trash_drained": int(drained),
       "left_for_next_run": int(left), "plan": json.loads(summary),
       "actions": lines(actions), "skipped": lines(skipped), "errors": lines(errors)}
json.dump(rep, open(os.path.join(d, "last-run.json"), "w"), indent=1)
with open(os.path.join(d, "history.log"), "a") as f:
    f.write(f"{rep['at']} {mode} free {rep['free_gb_before']}G→{rep['free_gb_after']}G reaped={reaped} build_reclaimed={reclaimed} "
            f"runs_expired={runs_expired} scratch_expired={scratch_expired} files_expired={files_expired} trash_drained={drained} left={left} skipped={len(rep['skipped'])} errors={len(rep['errors'])}\n")
PY
fi

if [ "$MODE" = dry ]; then
  python3 - "$WORK/plan.json" <<'PY'
import json, sys
p=json.load(open(sys.argv[1])); s=p['summary']
print('free_gb', s['free_gb'], 'of', s['total_gb'], '=', s['free_pct'], '% | counts', s['counts'], '| shapes', s['shapes'],
      '| build-reclaim', s['reclaim_count'], '| runs expired', s['runs_expired_count'], 'of', s['runs_count'],
      '| scratch dirs expired', s['scratch_expired_count'], 'of', s['scratch_dirs_count'],
      '| wt-* files expired', s['files_expired_count'], 'of', s['wt_files_count'])
for w in sorted(p['tiers']['REAP'], key=lambda w:-(w.get('idle_days') or 0)): print('REAP   ', w['dir'], f"[{w.get('shape')}]", '|', w.get('gc_reason'))
for w in p['reclaim']: print('RECLAIM', w['dir'], '|', w.get('gc_reason'))
for w in p['tiers']['NO-PR']: print('NO-PR  ', w['dir'], '|', w.get('gc_reason'))
for w in p['tiers']['KEEP']:
    if w.get('shape') in ('orphan', 'plain') or w.get('dependents'): print('KEEP   ', w['dir'], f"[{w.get('shape')}]", '|', w.get('gc_reason'))
for r in p['runs_expired']: print('EXPIRE  runs/' + r['name'], '| idle', r.get('idle_days'), 'd')
for r in p['scratch_expired']: print('EXPIRE ', r['name'], '| idle', r.get('idle_days'), 'd', '| git:', [g['shape'] for g in r.get('git_inside') or []])
PY
  exit 0
fi

wake=false
[ ${#errors[@]} -gt 0 ] && wake=true
[ -n "$FREE_AFTER" ] && [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] && [ $(( FREE_AFTER * 100 / TOTAL )) -lt "$ESCALATE_PCT" ] && wake=true
printf '{"wakeAgent": %s, "data": {"free_gb": %s, "reaped": %d, "build_reclaimed": %d, "runs_expired": %d, "scratch_expired": %d, "files_expired": %d, "trash_drained": %d, "left_for_next_run": %d, "skipped": %d, "errors": %d, "plan": %s}}\n' \
  "$wake" "${FREE_AFTER:-0}" "$reaped" "$reclaimed" "$runs_expired" "$scratch_expired" "$files_expired" "$drained" "$left" "${#skipped[@]}" "${#errors[@]}" "$SUMMARY"
