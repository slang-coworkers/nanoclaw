"""Repository-write classifier behind gate-eval-sandbox.sh (run as `python3 eval_sandbox.py`).

An evaluation copy of a coworker runs real tasks against a fork and must never write
to a production repository or reach a human. The shell hook decides whether the gate is
active and refuses the MCP tools; this module answers one question about a Bash
command: would it write to a GitHub repository that is not in the allow-list? The
answer is a reason string (deny) or None (allow).

Reads the PreToolUse hook JSON on stdin. Splits the command into simple segments
(`&&`, `||`, `;`, `|`, newlines; heredoc bodies are dropped first so quoted text is
never mistaken for a command), and applies these rules to each segment:

  gh <resource> <verb>   A verb that writes (pr create/comment/review/edit/merge/close,
                         issue create/comment/edit/close, repo/release/label/... writes)
                         must name `--repo <allowed>` explicitly. The target is not
                         inferred from the working directory: `gh` would, and that
                         inference is exactly what cannot be checked here.
  gh api                 GET without fields is a read. Any other method, or -f/-F/
                         --field/--raw-field/--input/--json (which make gh POST), must
                         address `repos/<allowed>/...`. `graphql` mutations are refused.
  git push               The remote must be an allowed repo. A URL is parsed; a remote
                         name is resolved with `git -C <cwd> remote get-url`, where cwd
                         is a leading `cd <dir>` in the command, else the hook's cwd.
                         A remote that cannot be resolved is refused (fail closed).
  http clients           A curl/wget/python/node call that carries api.github.com (or
                         uploads.github.com) with a mutating method or a request body
                         must address `/repos/<allowed>/`; GraphQL mutations are refused.

Exit 0 = allow. Exit 2 = deny, one line on stderr saying what was refused and why.
Any other exit is a parse failure the shell hook also treats as a refusal.

Python 3.9+, standard library only.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from typing import Callable

DEFAULT_ALLOWED = "slang-coworkers/slang-eval"

# Verbs per gh resource that create, change or remove something on GitHub. Verbs not
# listed (view, list, diff, checks, status, checkout, clone, download, ...) read, or
# only touch the local checkout, and pass.
GH_WRITE_VERBS = {
    "pr": {"create", "comment", "review", "edit", "merge", "close", "reopen", "ready", "lock", "unlock",
           "update-branch"},
    "issue": {"create", "comment", "edit", "close", "reopen", "lock", "unlock", "pin", "unpin", "transfer",
              "delete", "develop"},
    "repo": {"create", "delete", "edit", "fork", "archive", "unarchive", "rename", "sync", "deploy-key",
             "autolink", "gitignore"},
    "release": {"create", "delete", "edit", "upload", "delete-asset"},
    "label": {"create", "delete", "edit", "clone"},
    "workflow": {"run", "enable", "disable"},
    "run": {"rerun", "cancel", "delete"},
    "secret": {"set", "delete"},
    "variable": {"set", "delete"},
    "gist": {"create", "delete", "edit", "rename"},
    "project": {"create", "delete", "edit", "close", "copy", "item-add", "item-create", "item-delete",
                "item-edit", "field-create", "field-delete", "link", "unlink", "mark-template"},
    "ruleset": {"create", "delete", "edit"},
    "cache": {"delete"},
}

# Flags on `gh api` that make gh send a POST even without -X (gh's own rule), so a
# command carrying any of them is a write.
GH_API_BODY_FLAGS = {"-f", "-F", "--field", "--raw-field", "--input", "--json"}
READ_METHODS = {"GET", "HEAD", "OPTIONS"}

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)-?[ \t]*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
GITHUB_URL_RE = re.compile(
    r"(?:https?://|ssh://)?(?:[\w.-]+@)?(?:www\.)?github\.com[:/]([\w.-]+)/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$",
    re.IGNORECASE,
)
API_REPO_RE = re.compile(r"(?:https?://api\.github\.com/)?/?repos/([\w.-]+)/([\w.-]+)(?:[/?#]|$)", re.IGNORECASE)
HTTP_HOST_RE = re.compile(r"\b(api|uploads)\.github\.com\b|github\.com/graphql", re.IGNORECASE)
MUTATION_RE = re.compile(r"\bmutation\b")
CD_RE = re.compile(r"^\s*cd\s+[\"']?([^\"'\s;&|)]+)")


def parse_allowed(value: str | None) -> set:
    """Lower-cased `owner/repo` set from a comma- or space-separated allow-list."""
    raw = value if value and value.strip() else DEFAULT_ALLOWED
    out = set()
    for item in re.split(r"[,\s]+", raw.strip()):
        if not item:
            continue
        m = GITHUB_URL_RE.match(item)
        out.add(f"{m.group(1)}/{m.group(2)}".lower() if m else item.strip("/").lower())
    return out


def repo_from_url(url: str) -> str | None:
    """`owner/repo` (lower-case) from any GitHub clone URL or `owner/repo` spelling."""
    m = GITHUB_URL_RE.match(url.strip())
    if m:
        return f"{m.group(1)}/{m.group(2)}".lower()
    bare = re.fullmatch(r"([\w.-]+)/([\w.-]+?)(?:\.git)?", url.strip())
    return f"{bare.group(1)}/{bare.group(2)}".lower() if bare else None


def strip_heredocs(command: str) -> str:
    """Drop heredoc bodies so quoted text (a PR body, a JSON payload) is not parsed as
    commands. The `<<TAG` operator itself stays so the segment keeps its shape."""
    lines = command.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        tags = [m.group(2) for m in HEREDOC_RE.finditer(line)]
        i += 1
        for tag in tags:
            while i < len(lines) and lines[i].strip() != tag:
                i += 1
            i += 1  # the terminator line
    return "\n".join(out)


def split_segments(command: str):
    """Simple commands of a shell line, in order. `$(...)` substitutions stay inside
    their segment; the http-client and gh rules scan the whole segment text, so a
    write hidden in a substitution is still seen."""
    text = strip_heredocs(command)
    return [s.strip() for s in re.split(r"\s*(?:&&|\|\||;|\||\n)\s*", text) if s and s.strip()]


def tokens_of(segment: str):
    try:
        return shlex.split(segment, posix=True)
    except ValueError:
        return segment.split()


def leading_cd(command: str) -> str | None:
    for seg in split_segments(command):
        m = CD_RE.match(seg)
        if m:
            return m.group(1)
        break
    return None


def strip_env_prefix(tokens):
    """Drop leading `VAR=value` assignments and `env`/`sudo` wrappers."""
    i = 0
    while i < len(tokens) and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[i]) or tokens[i] in ("env", "sudo")):
        i += 1
    return tokens[i:]


def flag_value(tokens, names):
    """Value of the first flag in `names`, written `--flag value` or `--flag=value`."""
    for i, tok in enumerate(tokens):
        for name in names:
            if tok == name and i + 1 < len(tokens):
                return tokens[i + 1]
            if tok.startswith(name + "="):
                return tok[len(name) + 1:]
    return None


def check_gh(tokens, allowed) -> str | None:
    if len(tokens) < 2:
        return None
    resource = tokens[1]
    if resource == "api":
        return check_gh_api(tokens, allowed)
    verb = tokens[2] if len(tokens) > 2 else ""
    if verb not in GH_WRITE_VERBS.get(resource, set()):
        return None
    what = f"`gh {resource} {verb}`"
    target = flag_value(tokens, ("--repo", "-R"))
    if target is None:
        return (f"{what} names no --repo; a mutating gh command in the eval sandbox must say "
                f"--repo <allowed repo> so the target can be checked")
    repo = repo_from_url(target)
    if repo not in allowed:
        return f"{what} targets {target}, which is not an allowed repository"
    return None


def check_gh_api(tokens, allowed) -> str | None:
    method = (flag_value(tokens, ("--method", "-X")) or "").upper()
    has_body = any(t in GH_API_BODY_FLAGS or t.split("=", 1)[0] in GH_API_BODY_FLAGS for t in tokens[2:])
    if not method:
        method = "POST" if has_body else "GET"
    path = gh_api_path(tokens)
    if path.lower().rstrip("/") == "graphql" or "github.com/graphql" in path.lower():
        body = " ".join(tokens)
        if MUTATION_RE.search(body):
            return "`gh api graphql` with a mutation: GraphQL writes cannot be checked for their target"
        return None
    if method in READ_METHODS and not has_body:
        return None
    m = API_REPO_RE.match(path)
    repo = f"{m.group(1)}/{m.group(2)}".lower() if m else None
    if repo not in allowed:
        return f"`gh api {method} {path or '<no path>'}` writes outside the allowed repositories"
    return None


# `gh api` flags that take a value, so the path scan skips what follows them. The
# remaining flags (--include, --paginate, --silent, --slurp, --verbose) are boolean.
GH_API_VALUED_FLAGS = {"-X", "--method", "-H", "--header", "-f", "--field", "-F", "--raw-field", "--input",
                       "-q", "--jq", "-t", "--template", "--hostname", "--cache", "-p", "--preview"}


def gh_api_path(tokens) -> str:
    """The REST path of a `gh api` command: its first positional argument."""
    i = 2
    while i < len(tokens):
        tok = tokens[i]
        if tok in GH_API_VALUED_FLAGS:
            i += 2
            continue
        if tok.startswith("-"):
            i += 1
            continue
        return tok
    return ""


def check_git_push(tokens, allowed, resolve_remote: Callable[[str], str | None]) -> str | None:
    # `git [-C dir] [other opts] push [opts] [remote] [refspec...]`
    try:
        idx = tokens.index("push")
    except ValueError:
        return None
    positionals = []
    i = idx + 1
    valued = {"-o", "--push-option", "--receive-pack", "--exec", "--repo", "--force-with-lease", "--recurse-submodules",
              "--signed"}
    while i < len(tokens):
        tok = tokens[i]
        if tok == "--":
            positionals.extend(tokens[i + 1:])
            break
        if tok.startswith("--repo="):
            positionals.insert(0, tok.split("=", 1)[1])
        elif tok in valued and "=" not in tok and i + 1 < len(tokens) and tok not in ("--force-with-lease",
                                                                                      "--recurse-submodules",
                                                                                      "--signed"):
            i += 1
        elif not tok.startswith("-"):
            positionals.append(tok)
        i += 1
    remote = positionals[0] if positionals else "origin"
    repo = repo_from_url(remote) if ("/" in remote or ":" in remote) else None
    if repo is None:
        url = resolve_remote(remote)
        if not url:
            return (f"`git push` to remote \"{remote}\" whose URL could not be resolved from the command's "
                    f"working directory; push with the full fork URL or run from the checkout")
        repo = repo_from_url(url)
    if repo not in allowed:
        return f"`git push` to {remote} ({repo or 'not a GitHub repository'}), which is not an allowed repository"
    return None


def check_http(segment: str, tokens, allowed) -> str | None:
    """curl / wget / python / node calls that carry a GitHub API host."""
    if not HTTP_HOST_RE.search(segment):
        return None
    if MUTATION_RE.search(segment) and "graphql" in segment.lower():
        return "a GraphQL mutation against api.github.com: its target cannot be checked"
    method = (flag_value(tokens, ("-X", "--request", "--method")) or "").strip("'\"").upper()
    body_flags = {"-d", "--data", "--data-binary", "--data-raw", "--data-urlencode", "--json", "-F", "--form",
                  "-T", "--upload-file", "--post-data", "--post-file", "--body-data", "--body-file"}
    has_body = any(t in body_flags or t.split("=", 1)[0] in body_flags for t in tokens)
    code_write = re.search(
        r"requests\.(post|patch|put|delete)\(|method\s*[=:]\s*[\"'](POST|PATCH|PUT|DELETE)[\"']|"
        r"urlopen\([^)]*\bdata\s*=|\.(post|patch|put|delete)\(\s*[\"'`]?https?://(api|uploads)\.github\.com",
        segment, re.IGNORECASE)
    if method in READ_METHODS and not has_body and not code_write:
        return None
    if not method and not has_body and not code_write:
        return None
    targets = [f"{m.group(1)}/{m.group(2)}" for m in
               re.finditer(r"(?:api|uploads)\.github\.com/repos/([\w.-]+)/([\w.-]+)", segment, re.IGNORECASE)]
    if not targets:
        return "a write to api.github.com that does not address repos/<allowed repo>/"
    for target in targets:
        if target.lower() not in allowed:
            return f"a write to api.github.com/repos/{target}, which is not an allowed repository"
    return None


def classify(command: str, allowed, resolve_remote: Callable[[str], str | None]) -> str | None:
    """Reason the command would write outside `allowed`, or None when it only reads or
    writes to an allowed repository."""
    for segment in split_segments(command):
        tokens = strip_env_prefix(tokens_of(segment))
        if not tokens:
            continue
        prog = os.path.basename(tokens[0])
        reason = None
        if prog == "gh":
            reason = check_gh(tokens, allowed)
        elif prog == "git":
            reason = check_git_push(tokens, allowed, resolve_remote)
        else:
            reason = check_http(segment, tokens, allowed)
        if reason is None and prog in ("gh", "git") and HTTP_HOST_RE.search(segment):
            # `gh api https://api.github.com/...` was handled above; anything else that
            # smuggles an API URL through gh/git (e.g. `git push https://api...`) fell
            # through, so run the http rule as well.
            reason = check_http(segment, tokens, allowed)
        if reason:
            return reason
    return None


def git_remote_resolver(cwd: str | None) -> Callable[[str], str | None]:
    def resolve(name: str) -> str | None:
        if not cwd or not os.path.isdir(cwd):
            return None
        try:
            r = subprocess.run(["git", "-C", cwd, "remote", "get-url", name], capture_output=True, text=True,
                               timeout=3, check=False)
        except (OSError, subprocess.SubprocessError):
            return None
        return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None
    return resolve


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except ValueError as exc:
        print(f"hook input is not JSON: {exc}", file=sys.stderr)
        return 3
    command = str((payload.get("tool_input") or {}).get("command") or "")
    if not command:
        return 0
    hook_cwd = payload.get("cwd") or os.getcwd()
    cd = leading_cd(command)
    cwd = cd if cd and os.path.isabs(cd) else (os.path.join(hook_cwd, cd) if cd else hook_cwd)
    allowed = parse_allowed(os.environ.get("EVAL_ALLOWED_REPOS"))
    reason = classify(command, allowed, git_remote_resolver(cwd))
    if reason:
        print(reason, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
