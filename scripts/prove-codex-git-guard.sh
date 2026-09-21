#!/usr/bin/env bash
# Behavioural proof of the codex git write guard against a real git.
#
# Builds a throwaway repo (no guard), then exports the SAME env the agent-runner
# gives the codex MCP child (container/agent-runner/src/codex-mcp-server.ts) —
# with core.hooksPath / GIT_CONFIG_SYSTEM pointed at this checkout's
# container/hooks/codex-git-guard instead of the in-container /app/hooks path —
# and shows that every git write is refused while plain reads keep working.
# Exits non-zero on any surprise.
#
#   scripts/prove-codex-git-guard.sh
set -u

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOOKS_DIR="${CODEX_GIT_GUARD_HOOKS_DIR:-$REPO_ROOT/container/hooks/codex-git-guard}"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/codex-git-guard.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0
ok()   { pass=$((pass + 1)); printf '  PASS  %s\n' "$1"; }
bad()  { fail=$((fail + 1)); printf '  FAIL  %s\n' "$1"; }
note() { printf '  NOTE  %s\n' "$1"; }

# expect_refused <label> <stderr-ERE> <cmd...>: non-zero exit AND pattern in output.
expect_refused() {
  local label=$1 pattern=$2; shift 2
  local out rc
  out=$("$@" 2>&1); rc=$?
  printf '$ %s\n' "$*"
  printf '%s\n' "$out" | sed 's/^/    | /'
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q -E -- "$pattern"; then
    ok "$label (exit $rc)"
  else
    bad "$label (exit $rc; wanted non-zero + /$pattern/)"
  fi
}

# expect_ok <label> <cmd...>: zero exit.
expect_ok() {
  local label=$1; shift
  local out rc
  out=$("$@" 2>&1); rc=$?
  printf '$ %s\n' "$*"
  printf '%s\n' "$out" | head -n 3 | sed 's/^/    | /'
  if [ "$rc" -eq 0 ]; then ok "$label"; else bad "$label (exit $rc)"; fi
}

refs_in() { git -C "$1" for-each-ref | wc -l | tr -d ' '; }

echo "== setup (guard NOT active) =="
git init -q -b main "$WORK/repo"
git init -q --bare "$WORK/local-remote.git"
git init -q --bare "$WORK/pushurl-remote.git"
cd "$WORK/repo" || exit 2
git config user.email codex-guard@example.invalid
git config user.name "codex guard proof"
echo one >a.txt && git add a.txt && git commit -q -m "one"
echo two >b.txt && git add b.txt && git commit -q -m "two"
git checkout -q -b other HEAD~1 && echo other >c.txt && git add c.txt && git commit -q -m "other-one"
git checkout -q main
git clone -q --bare . "$WORK/upstream.git"           # a remote WITH refs, for the fetch case
git remote add origin https://example.invalid/team/repo.git
git remote add local "$WORK/local-remote.git"
git remote add upstream "$WORK/upstream.git"
git init -q --bare rel.git                              # bare relative name: no prefix for pushInsteadOf to match
HEAD_BEFORE=$(git rev-parse HEAD)
OTHER_BEFORE=$(git rev-parse other)
FIRST=$(git rev-parse HEAD~1)
echo "  repo=$WORK/repo head=$HEAD_BEFORE other=$OTHER_BEFORE"
echo "  hooks=$HOOKS_DIR"
# The committed gitconfig names the in-container hooks path; point it here.
sed "s|/app/hooks/codex-git-guard|$HOOKS_DIR|" "$HOOKS_DIR/gitconfig" >"$WORK/gitconfig"
echo

echo "== exporting the codex child's git env (same table as codex-mcp-server.ts) =="
export GIT_CONFIG_COUNT=10
export GIT_CONFIG_SYSTEM="$WORK/gitconfig"
export GIT_CONFIG_KEY_0=core.hooksPath                GIT_CONFIG_VALUE_0="$HOOKS_DIR"
export GIT_CONFIG_KEY_1=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_1=https://
export GIT_CONFIG_KEY_2=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_2=http://
export GIT_CONFIG_KEY_3=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_3=git@
export GIT_CONFIG_KEY_4=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_4=ssh://
export GIT_CONFIG_KEY_5=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_5=file://
export GIT_CONFIG_KEY_6=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_6=/
export GIT_CONFIG_KEY_7=url.disabled://.pushInsteadOf GIT_CONFIG_VALUE_7=.
export GIT_CONFIG_KEY_8=protocol.allow                GIT_CONFIG_VALUE_8=never
export GIT_CONFIG_KEY_9=protocol.file.allow           GIT_CONFIG_VALUE_9=never
env | grep '^GIT_CONFIG_' | sort | sed 's/^/  /'
# Parity: the system gitconfig must list exactly the same pairs (git lowercases
# section/variable names; subsections keep their case).
listed=$(git config -f "$WORK/gitconfig" --list)
expected=$(for i in $(seq 0 $((GIT_CONFIG_COUNT - 1))); do
  k=$(eval "printf '%s' \"\$GIT_CONFIG_KEY_$i\""); v=$(eval "printf '%s' \"\$GIT_CONFIG_VALUE_$i\"")
  sec=${k%%.*}; var=${k##*.}; mid=${k#"$sec".}; mid=${mid%"$var"}
  printf '%s.%s%s=%s\n' "$(printf '%s' "$sec" | tr 'A-Z' 'a-z')" "$mid" "$(printf '%s' "$var" | tr 'A-Z' 'a-z')" "$v"
done)
if [ "$listed" = "$expected" ]; then ok "GIT_CONFIG_SYSTEM file lists the same $GIT_CONFIG_COUNT pairs as the env"
else bad "GIT_CONFIG_SYSTEM file differs from the env table"; printf '%s\n' "--- file" "$listed" "--- env" "$expected" | sed 's/^/    | /'; fi
echo

echo "== reads still work =="
expect_ok "git status"                 git status --short --branch
expect_ok "git log"                    git log --oneline -n 3 --all
expect_ok "git show"                   git show --stat --oneline HEAD
expect_ok "git rev-parse"              git rev-parse HEAD
expect_ok "git diff main..other"       git diff --stat main..other
expect_ok "git blame"                  git blame -s a.txt
expect_ok "git ls-files"               git ls-files
expect_ok "git config --show-scope (guard visible at command + system scope)" git config --show-scope --get-all protocol.allow
expect_ok "git remote get-url --push origin (shows the rewrite)" git remote get-url --push origin
expect_ok "git remote get-url --push local  (shows the rewrite)" git remote get-url --push local
echo three >>a.txt
expect_ok "git diff (dirty tree)"      git diff --stat
git add a.txt
expect_ok "git diff --cached"          git diff --cached --stat
echo

echo "== commits (tree dirty, a.txt staged) =="
expect_refused "git commit -> pre-commit"                        "pre-commit refused"            git commit -q -m "should not land"
expect_refused "git commit --no-verify -> reference-transaction" "reference-transaction refused" git commit -q --no-verify -m "should not land either"
expect_refused "git stash -> reference-transaction"              "reference-transaction refused" git stash
[ -n "$(git status --porcelain -- a.txt)" ] && ok "worktree still dirty after refused stash" || bad "stash reset the worktree"
expect_ok "git restore (file/index writes are NOT blocked — the documented hole)" git restore --staged --worktree a.txt
echo

echo "== merge / rebase (tree clean, other diverged) =="
expect_refused "git merge --no-ff other"  "(pre-merge-commit|reference-transaction) refused" git merge --no-ff other -m "merge should not land"
expect_refused "git rebase other -> pre-rebase" "pre-rebase refused"                          git rebase other
echo

echo "== ref rewrites (reference-transaction) =="
expect_refused "git branch -f other <sha>"       "reference-transaction refused" git branch -f other "$HEAD_BEFORE"
expect_refused "git update-ref refs/heads/other" "reference-transaction refused" git update-ref refs/heads/other "$HEAD_BEFORE"
expect_refused "git reset --hard HEAD~1"         "reference-transaction refused" git reset -q --hard "$FIRST"
expect_refused "git checkout -B other HEAD~1"    "reference-transaction refused" git checkout -q -B other "$FIRST"
expect_refused "git tag"                         "reference-transaction refused" git tag v-should-not-exist
expect_refused "git fetch upstream (remote-tracking refs / transport)" "(reference-transaction refused|transport '[a-z]+' not allowed)" git fetch upstream
echo

echo "== pushes: URL rewrite (pushInsteadOf) + protocol.allow=never =="
D="transport 'disabled' not allowed"
expect_refused "git push origin (remote url https://)"          "$D" git push origin main
expect_refused "git push --no-verify origin"                    "$D" git push --no-verify origin main
expect_refused "git push <explicit https URL>"                  "$D" git push https://example.invalid/elsewhere/repo.git main
expect_refused "git push <explicit http URL>"                   "$D" git push http://example.invalid/elsewhere/repo.git main
expect_refused "git push <explicit git@ URL>"                   "$D" git push git@example.invalid:elsewhere/repo.git main
expect_refused "git push <explicit ssh:// URL>"                 "$D" git push ssh://git@example.invalid/elsewhere/repo.git main
expect_refused "git push local (absolute path remote)"          "$D" git push local main
expect_refused "git push --no-verify local (absolute path)"     "$D" git push --no-verify local main
expect_refused "git push --no-verify <file:// URL>"             "$D" git push --no-verify "file://$WORK/local-remote.git" main
expect_refused "git push --no-verify ../local-remote.git"       "$D" git push --no-verify ../local-remote.git main
expect_refused "git push --no-verify . HEAD:other (self-push)"  "$D" git push --no-verify . HEAD:other
echo

echo "== pushes the rewrite cannot see: protocol.allow=never is the stop =="
expect_refused "git push --no-verify rel.git (bare relative name)"          "transport 'file' not allowed" git push --no-verify rel.git main
expect_refused "git push --no-verify someuser@host:path (scp-style, non-git user)" "transport 'ssh' not allowed" git push --no-verify someuser@example.invalid:org/repo.git main
git config url.https://example.invalid/.insteadOf gh:
expect_refused "git push --no-verify gh:org/repo.git (insteadOf alias -> https)" "transport 'https' not allowed" git push --no-verify gh:org/repo.git main
git config --unset url.https://example.invalid/.insteadOf
expect_ok "git remote set-url --push local <abs path> (a .git/config write; no hook sees it)" git remote set-url --push local "$WORK/pushurl-remote.git"
expect_refused "git push --no-verify local (explicit pushurl: pushInsteadOf is ignored)" "transport 'file' not allowed" git push --no-verify local main
[ "$(refs_in "$WORK/pushurl-remote.git")" = 0 ] && ok "pushurl remote has no refs" || bad "pushurl remote received refs"
expect_ok "git remote set-url --push origin https://127.0.0.1:9/x/y.git" git remote set-url --push origin https://127.0.0.1:9/x/y.git
expect_refused "git push --no-verify origin (explicit https pushurl)" "transport 'https' not allowed" git push --no-verify origin main
expect_refused "git ls-remote local (a transport read — blocked too; the cost)" "transport 'file' not allowed" git ls-remote local
echo

echo "== same-scope bypass of the client checks: the receive-pack side still refuses (GIT_CONFIG_SYSTEM) =="
expect_refused "git -c core.hooksPath=/dev/null -c protocol.file.allow=always push --no-verify rel.git" "reference-transaction refused" \
  git -c core.hooksPath=/dev/null -c protocol.file.allow=always push --no-verify rel.git main
[ "$(refs_in rel.git)" = 0 ] && ok "rel.git has no refs" || bad "rel.git received refs"
expect_refused "env -u GIT_CONFIG_COUNT git push --no-verify rel.git" "reference-transaction refused" \
  env -u GIT_CONFIG_COUNT git push --no-verify rel.git main
[ "$(refs_in rel.git)" = 0 ] && ok "rel.git still has no refs" || bad "rel.git received refs after env -u"
echo

echo "== nothing moved =="
HEAD_AFTER=$(git rev-parse HEAD); OTHER_AFTER=$(git rev-parse other)
[ "$HEAD_AFTER" = "$HEAD_BEFORE" ]   && ok "HEAD unchanged ($HEAD_AFTER)"   || bad "HEAD moved: $HEAD_BEFORE -> $HEAD_AFTER"
[ "$OTHER_AFTER" = "$OTHER_BEFORE" ] && ok "other unchanged ($OTHER_AFTER)" || bad "other moved: $OTHER_BEFORE -> $OTHER_AFTER"
[ "$(git symbolic-ref HEAD)" = refs/heads/main ] && ok "still on main" || bad "HEAD symref changed to $(git symbolic-ref HEAD)"
[ -z "$(git tag)" ] && ok "no tags created" || bad "tags exist: $(git tag | tr '\n' ' ')"
[ -z "$(git for-each-ref refs/remotes)" ] && ok "no remote-tracking refs fetched" || bad "fetch wrote: $(git for-each-ref refs/remotes | tr '\n' ' ')"
[ "$(refs_in "$WORK/local-remote.git")" = 0 ] && ok "local bare remote has no refs" || bad "local remote received refs"
[ -z "$(git stash list)" ] && ok "stash list empty" || bad "stash entry exists"
echo

echo "== observations (not counted) =="
out=$(git checkout other 2>&1); rc=$?
if [ "$rc" -ne 0 ]; then note "plain 'git checkout other' is refused too on this git (HEAD switch is a ref transaction): $out"
else git checkout -q main; note "plain 'git checkout other' is ALLOWED on this git (pre-2.46 symref path; moves HEAD, rewrites nothing); switched back"; fi

out=$(git -c core.hooksPath=/dev/null commit -q --allow-empty --no-verify -m "bypass" 2>&1); rc=$?
if [ "$rc" -eq 0 ]; then
  note "documented hole: 'git -c core.hooksPath=/dev/null …' (same scope, parsed after the env) bypasses the hooks; reverting"
  git -c core.hooksPath=/dev/null reset -q --hard "$HEAD_BEFORE"
else note "'-c core.hooksPath=/dev/null' bypass did NOT work on this git: $out"; fi
[ "$(git rev-parse HEAD)" = "$HEAD_BEFORE" ] && ok "HEAD restored after the -c bypass demo" || bad "HEAD not restored after the -c bypass demo"

out=$(env HP=/dev/null git --config-env=core.hooksPath=HP commit -q --allow-empty --no-verify -m "bypass2" 2>&1); rc=$?
if [ "$rc" -eq 0 ]; then
  note "documented hole: '--config-env=core.hooksPath=VAR' is the same same-scope class; reverting"
  git -c core.hooksPath=/dev/null reset -q --hard "$HEAD_BEFORE"
else note "'--config-env' bypass did NOT work on this git: $out"; fi
[ "$(git rev-parse HEAD)" = "$HEAD_BEFORE" ] && ok "HEAD restored after the --config-env bypass demo" || bad "HEAD not restored after the --config-env bypass demo"
echo

echo "== summary: $pass passed, $fail failed ($(git --version)) =="
[ "$fail" -eq 0 ]
