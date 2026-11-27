"""Extract dependency pins from a repository's declarations at an exact commit.

Declarations are read from Git objects at the pinned base (``git show <base>:<path>``),
never from the working tree, and never executed. Supported profiles:

- ``known-good``: a ``known_good.json``, either the ``repos`` form (validation
  layers, utility libraries) or the ``commits`` form (glslang);
- ``deps``: a Chromium-style ``DEPS`` file (SPIRV-Tools), parsed as a syntax tree.
  Only string literals, ``Var()`` and ``+`` are understood;
- ``npm``: ``package-lock.json`` registry tarballs with sha512 integrity;
- ``gitmodules``: ``.gitmodules`` URLs plus the gitlink SHAs recorded in the tree.

Every pin is validated against the reviewed allowlist. Anything else becomes an
``unavailable`` entry carrying a fingerprint of the declaration, not the URL.
"""

from __future__ import annotations

import ast
import configparser
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from khrdeps import PinError, clean_git_env, git_pin, npm_pin

# GN/CIPD-only checkouts and the separately gated fuzz dependency are never fetched.
_DEPS_SKIP = {
    "buildtools",
    "buildtools/linux64",
    "buildtools/mac",
    "buildtools/win",
    "build",
    "testing",
    "external/protobuf",
}


def read_at(repo: Path, rev: str, rel: str, limit: int) -> bytes:
    if not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", rev):
        raise PinError("declarations are read only at an exact commit")
    if not re.fullmatch(
        r"[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*", rel
    ) or ".." in rel.split("/"):
        raise PinError("unsafe declaration path")
    ls = subprocess.run(
        ["git", "-C", str(repo), "ls-tree", rev, "--", rel],
        capture_output=True,
        text=True,
        env=clean_git_env(),
        check=False,
    ).stdout
    if not ls.startswith(("100644 blob ", "100755 blob ")):
        raise PinError(f"{rel} is not a regular file at {rev[:12]}")
    size = int(
        subprocess.run(
            ["git", "-C", str(repo), "cat-file", "-s", f"{rev}:{rel}"],
            capture_output=True,
            text=True,
            env=clean_git_env(),
            check=True,
        ).stdout
    )
    if size > limit:
        raise PinError(f"{rel} exceeds the declaration size limit")
    return subprocess.run(
        ["git", "-C", str(repo), "show", f"{rev}:{rel}"],
        capture_output=True,
        env=clean_git_env(),
        check=True,
    ).stdout


def _unavailable(name: str, declaration: str, reason: str) -> dict[str, str]:
    return {
        "kind": "unavailable",
        "name": name,
        "reason": reason,
        "declarationSha256": hashlib.sha256(
            declaration.encode("utf-8", "replace")
        ).hexdigest(),
    }


def _git(name: str, url: str, ref: str, allow: dict[str, Any]) -> dict[str, str]:
    try:
        return {**git_pin(url, ref, allow), "name": name}
    except PinError as exc:
        return _unavailable(
            name,
            f"{url}@{ref}",
            str(exc).split(" ")[0] if str(exc).startswith("unreviewed") else str(exc),
        )


def parse_known_good(raw: bytes, allow: dict[str, Any]) -> list[dict[str, str]]:
    data = json.loads(raw)
    out: list[dict[str, str]] = []
    for r in data.get("repos", []) if isinstance(data, dict) else []:
        out.append(
            _git(
                str(r.get("name", "")),
                str(r.get("url", "")),
                str(r.get("commit", "")),
                allow,
            )
        )
    for c in data.get("commits", []) if isinstance(data, dict) else []:
        if c.get("site", "github") != "github":
            out.append(
                _unavailable(
                    str(c.get("name", "")),
                    json.dumps(c, sort_keys=True),
                    "non-github site",
                )
            )
            continue
        out.append(
            _git(
                str(c.get("name", "")),
                f"https://github.com/{c.get('subrepo', '')}.git",
                str(c.get("commit", "")),
                allow,
            )
        )
    return out


def parse_deps(raw: bytes, allow: dict[str, Any]) -> list[dict[str, str]]:
    try:
        tree = ast.parse(raw)
    except SyntaxError as exc:
        raise PinError("unsupported DEPS syntax") from exc
    found: dict[str, ast.expr] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id in {"vars", "deps"}:
                    if t.id in found:
                        raise PinError("duplicate DEPS declaration")
                    found[t.id] = node.value
    try:
        variables = ast.literal_eval(found["vars"])
    except (KeyError, ValueError, TypeError) as exc:
        raise PinError("DEPS vars must be a literal dictionary") from exc
    if not isinstance(variables, dict) or len(variables) > 64:
        raise PinError("unsupported DEPS vars")

    def ev(node: ast.expr) -> str:
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            return ev(node.left) + ev(node.right)
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "Var"
            and len(node.args) == 1
            and not node.keywords
        ):
            key = ast.literal_eval(node.args[0])
            if not isinstance(key, str) or not isinstance(variables.get(key), str):
                raise PinError("unknown or non-string DEPS variable")
            return variables[key]
        raise PinError("DEPS permits only strings, Var() and +")

    deps = found.get("deps")
    if not isinstance(deps, ast.Dict) or len(deps.keys) > 64:
        raise PinError("DEPS deps must be a bounded dictionary")
    out: list[dict[str, str]] = []
    for k, v in zip(deps.keys, deps.values):
        subdir = ev(k)
        if subdir in _DEPS_SKIP:
            continue
        if isinstance(v, ast.Dict):
            fields = {
                ast.literal_eval(kk): vv
                for kk, vv in zip(v.keys, v.values)
                if isinstance(kk, ast.Constant)
            }
            if "url" not in fields:
                out.append(_unavailable(subdir, subdir, "non-git DEPS entry"))
                continue
            v = fields["url"]
        spec = ev(v)
        url, _, ref = spec.rpartition("@")
        out.append(_git(subdir, url, ref, allow))
    return out


def parse_package_lock(raw: bytes, allow: dict[str, Any]) -> list[dict[str, str]]:
    data = json.loads(raw)
    entries: list[tuple[str, dict]] = []
    if isinstance(data.get("packages"), dict):
        entries = [
            (k, v) for k, v in data["packages"].items() if k and isinstance(v, dict)
        ]
    else:

        def walk(deps: dict, prefix: str) -> None:
            for name, v in (deps or {}).items():
                entries.append((prefix + name, v))
                walk(v.get("dependencies", {}), prefix + name + "/")

        walk(data.get("dependencies", {}), "")
    out: list[dict[str, str]] = []
    for name, v in entries:
        if v.get("link") or not v.get("resolved"):
            continue
        try:
            out.append(
                {
                    **npm_pin(str(v["resolved"]), str(v.get("integrity", "")), allow),
                    "name": name,
                }
            )
        except (PinError, ValueError) as exc:
            out.append(_unavailable(name, str(v.get("resolved")), str(exc)))
    return out


def parse_gitmodules(
    raw: bytes, repo: Path, rev: str, allow: dict[str, Any]
) -> list[dict[str, str]]:
    cp = configparser.ConfigParser()
    cp.read_string(raw.decode("utf-8"))
    out: list[dict[str, str]] = []
    for section in cp.sections():
        path, url = cp[section].get("path", ""), cp[section].get("url", "")
        ls = subprocess.run(
            ["git", "-C", str(repo), "ls-tree", rev, "--", path],
            capture_output=True,
            text=True,
            env=clean_git_env(),
            check=False,
        ).stdout.split()
        if len(ls) < 3 or ls[0] != "160000":
            out.append(
                _unavailable(path, url, "no gitlink recorded at the pinned commit")
            )
            continue
        out.append(_git(path, url, ls[2], allow))
    return out


def extract(
    profile: dict[str, str] | None, repo: Path, rev: str, allow: dict[str, Any]
) -> dict[str, Any]:
    """Pins for one repository. ``profile`` comes from the install manifest."""
    if not profile or profile.get("kind") in (None, "", "toolchain-only"):
        return {"profile": "toolchain-only", "pins": []}
    kind, rel = profile["kind"], profile.get("path", "")
    limit = int(allow["limits"]["manifestBytes"])
    raw = read_at(repo, rev, rel, limit)
    parsers = {
        "known-good": lambda: parse_known_good(raw, allow),
        "deps": lambda: parse_deps(raw, allow),
        "npm": lambda: parse_package_lock(raw, allow),
        "gitmodules": lambda: parse_gitmodules(raw, repo, rev, allow),
    }
    if kind not in parsers:
        raise PinError(f"unsupported dependency profile {kind}")
    pins = parsers[kind]()
    if len(pins) > int(allow["limits"]["pinsPerRepository"]):
        raise PinError("too many dependency pins")
    return {
        "profile": kind,
        "declaration": rel,
        "declarationSha256": hashlib.sha256(raw).hexdigest(),
        "pins": pins,
    }
