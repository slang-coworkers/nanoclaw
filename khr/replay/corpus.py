"""Build a replay corpus of past bot requests from GitLab, read-only.

Usage (on the install host; GitLab is reached only through the credential gateway):

    HTTPS_PROXY=<gateway proxy URL> SSL_CERT_FILE=<gateway CA> \\
    python3 -I khr/replay/corpus.py \\
        --gitlab-url https://<gitlab host> --account <bot account> \\
        --project <id-or-path> [--project ...] \\
        --before 2026-11-20T00:00:00Z \\
        --allow-user <username> [--allow-user ...] \\
        --out <install data dir>/khr-replay/corpus.jsonl

The output holds confidential discussion content. Write it to the install's
data directory, never into this repository.

Discovery uses two sources for each project:

- project note search for the bot mention;
- optionally (``--reply-marker``), the bot's own reply notes, whose
  ``<!-- <prefix>:<kind>:<source_key> -->`` markers name the triggering note.

Each candidate is then re-read from its discussion and checked with the
mention, authorization and bounded-context rules.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gitlab_read import ReadOnlyGitLab, project_path
from mention import parse_mention

CONTEXT_MAX_CHARS = 20_000
MAX_LABELS = 50
HUNK_MAX_CHARS = 4_000
DEFAULT_MODEL_ALIASES = frozenset({"astra", "luna", "terra", "sol", "sol61"})
_MARKER_RE = re.compile(r"<!--\s*[a-z]+:[a-z-]+:(?P<key>[^\s>]+)\s*-->")
_KEY_RE = re.compile(
    r":p(?P<pid>\d+):(?:issue-note:(?P<inote>\d+)|merge-request-discussion-note:(?P<mr>\d+):(?P<disc>[0-9a-f]+):(?P<mnote>\d+))$"
)


@dataclass(frozen=True)
class Candidate:
    project_id: int
    kind: str  # "issue" | "mr"
    iid: int
    note_id: int


def _ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _noteable_kind(noteable_type: str | None) -> str | None:
    return {"Issue": "issue", "MergeRequest": "mr"}.get(noteable_type or "")


class CorpusBuilder:
    def __init__(
        self,
        gl: ReadOnlyGitLab,
        account: str,
        before: datetime,
        allow_users: list[str],
        policy: str = "allowlist",
        model_aliases: frozenset[str] = DEFAULT_MODEL_ALIASES,
        reply_marker: str | None = None,
    ):
        self.reply_marker = reply_marker
        if policy not in {"allowlist", "authenticated-users"}:
            raise ValueError("policy must be allowlist or authenticated-users")
        if policy == "allowlist" and not allow_users:
            raise ValueError("allowlist policy needs at least one --allow-user")
        if policy == "authenticated-users" and allow_users:
            raise ValueError("authenticated-users policy takes no --allow-user")
        self.gl = gl
        self.account = account
        self.before = before
        self.policy = policy
        self.model_aliases = model_aliases
        self._users: dict[int, dict[str, Any]] = {}
        self.account_id = self._resolve_username(account)
        self.allowed_ids = {self._resolve_username(u) for u in allow_users}

    def _resolve_username(self, username: str) -> int:
        matches = [
            u
            for u in self.gl.get("/api/v4/users", {"username": username})
            if u.get("username") == username
        ]
        if len(matches) != 1:
            raise ValueError(
                f"username {username!r} did not resolve to exactly one account"
            )
        return int(matches[0]["id"])

    def _user(self, user_id: int) -> dict[str, Any]:
        if user_id not in self._users:
            self._users[user_id] = self.gl.get(f"/api/v4/users/{user_id}")
        return self._users[user_id]

    def discover(self, project: int | str) -> tuple[int, str, list[Candidate]]:
        meta = self.gl.get(f"/api/v4/projects/{project_path(project)}")
        pid, path = int(meta["id"]), str(meta["path_with_namespace"])
        found: dict[tuple[str, int, int], Candidate] = {}
        for note in self.gl.paged(
            f"/api/v4/projects/{pid}/search",
            {"scope": "notes", "search": f"@{self.account}"},
        ):
            kind = _noteable_kind(note.get("noteable_type"))
            iid = note.get("noteable_iid")
            if kind and iid:
                found[(kind, int(iid), int(note["id"]))] = Candidate(
                    pid, kind, int(iid), int(note["id"])
                )
        replies = (
            self.gl.paged(
                f"/api/v4/projects/{pid}/search",
                {"scope": "notes", "search": self.reply_marker},
            )
            if self.reply_marker
            else []
        )
        for note in replies:
            if int((note.get("author") or {}).get("id", -1)) != self.account_id:
                continue
            kind = _noteable_kind(note.get("noteable_type"))
            iid = note.get("noteable_iid")
            for marker in _MARKER_RE.finditer(note.get("body") or ""):
                key = _KEY_RE.search(marker.group("key"))
                if not key or int(key.group("pid")) != pid or not kind or not iid:
                    continue
                note_id = int(key.group("inote") or key.group("mnote"))
                found[(kind, int(iid), note_id)] = Candidate(
                    pid, kind, int(iid), note_id
                )
        return (
            pid,
            path,
            sorted(found.values(), key=lambda c: (c.kind, c.iid, c.note_id)),
        )

    def build(self, pid: int, path: str, cand: Candidate) -> dict[str, Any]:
        noun = "issues" if cand.kind == "issue" else "merge_requests"
        base = f"/api/v4/projects/{pid}/{noun}/{cand.iid}"
        discussions = list(self.gl.paged(f"{base}/discussions"))
        located = [
            (d, n)
            for d in discussions
            for n in d.get("notes", [])
            if int(n["id"]) == cand.note_id
        ]
        record: dict[str, Any] = {
            "schema": 1,
            "project_id": pid,
            "project_path": path,
            "kind": cand.kind,
            "iid": cand.iid,
            "note_id": cand.note_id,
        }
        if len(located) != 1:
            return {**record, "status": "rejected", "reason": "note-not-found"}
        discussion, note = located[0]
        record.update(
            discussion_id=discussion["id"],
            created_at=note["created_at"],
            author={"id": note["author"]["id"], "username": note["author"]["username"]},
            body_sha256=hashlib.sha256(
                (note.get("body") or "").encode("utf-8")
            ).hexdigest(),
        )
        if cand.kind == "issue":
            record["source_key"] = f"replay:p{pid}:issue-note:{cand.note_id}"
        else:
            record["source_key"] = (
                f"replay:p{pid}:merge-request-discussion-note:{cand.iid}:{discussion['id']}:{cand.note_id}"
            )

        reason = self._gate(note)
        if reason:
            return {**record, "status": "rejected", "reason": reason}
        mention = parse_mention(
            note.get("body") or "", self.account, self.model_aliases
        )
        if mention is None:
            return {**record, "status": "rejected", "reason": "no-mention"}
        if mention.rejected:
            return {
                **record,
                "status": "rejected",
                "reason": mention.rejected,
                "model": mention.model,
            }

        noteable = self.gl.get(base)
        record.update(
            status="accepted",
            command=mention.command,
            model=mention.model,
            preceding_text=mention.context,
            reference_context=self._reference_context(cand, noteable, note, base),
            snapshot=self._snapshot(discussions, cand.note_id),
            outcome=self._outcome(discussions, record["source_key"]),
        )
        return record

    def _gate(self, note: dict[str, Any]) -> str | None:
        if note.get("system"):
            return "system-note"
        if _ts(note["created_at"]) >= self.before:
            return "outside-window"
        author_id = int(note["author"]["id"])
        if author_id == self.account_id:
            return "self"
        if self._user(author_id).get("bot"):
            return "bot-author"
        if self.policy == "allowlist" and author_id not in self.allowed_ids:
            return "unauthorized"
        return None

    def _reference_context(
        self, cand: Candidate, noteable: dict[str, Any], note: dict[str, Any], base: str
    ) -> str:
        labels = [str(x) for x in (noteable.get("labels") or [])][:MAX_LABELS]
        parts = [
            f"Title: {noteable.get('title', '')}",
            f"Labels: {', '.join(labels)}" if labels else "Labels: (none)",
        ]
        if cand.kind == "mr":
            refs = noteable.get("diff_refs") or {}
            parts += [
                f"Source branch: {noteable.get('source_branch', '')}",
                f"Target branch: {noteable.get('target_branch', '')}",
                f"Head SHA: {refs.get('head_sha', '')}",
                f"Base SHA: {refs.get('base_sha', '')}",
                f"Start SHA: {refs.get('start_sha', '')}",
            ]
            position = note.get("position")
            if position:
                parts.append(
                    "Inline position: "
                    f"{position.get('new_path') or position.get('old_path')} "
                    f"new_line={position.get('new_line')} old_line={position.get('old_line')}"
                )
                hunk = self._hunk(base, position)
                if hunk:
                    parts.append(f"Matching diff hunk:\n{hunk}")
        parts.append(f"Description:\n{noteable.get('description') or ''}")
        text = "\n".join(parts)
        if len(text) > CONTEXT_MAX_CHARS:
            text = (
                text[: CONTEXT_MAX_CHARS - 40]
                + "\n[... reference context truncated ...]"
            )
        return text

    def _hunk(self, base: str, position: dict[str, Any]) -> str | None:
        path = position.get("new_path") or position.get("old_path")
        line = position.get("new_line") or position.get("old_line")
        if not path or not line:
            return None
        use_new = bool(position.get("new_line"))
        for diff in self.gl.paged(f"{base}/diffs"):
            if (diff.get("new_path") if use_new else diff.get("old_path")) != path:
                continue
            for hunk in re.split(r"(?m)^(?=@@ )", diff.get("diff") or ""):
                header = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", hunk)
                if not header:
                    continue
                start = int(header.group(3) if use_new else header.group(1))
                count = int((header.group(4) if use_new else header.group(2)) or 1)
                if start <= int(line) < start + max(count, 1):
                    return hunk[:HUNK_MAX_CHARS]
        return None

    @staticmethod
    def _snapshot(
        discussions: list[dict[str, Any]], trigger_id: int
    ) -> list[dict[str, Any]]:
        out = []
        for d in discussions:
            notes = [n for n in d.get("notes", []) if int(n["id"]) <= trigger_id]
            if notes:
                out.append(
                    {
                        "id": d["id"],
                        "individual_note": d.get("individual_note"),
                        "notes": notes,
                    }
                )
        return out

    def _outcome(
        self, discussions: list[dict[str, Any]], source_key: str
    ) -> dict[str, Any]:
        key_tail = source_key.split(":", 1)[1]
        replies = []
        for d in discussions:
            for n in d.get("notes", []):
                body = n.get("body") or ""
                if int(n["author"]["id"]) == self.account_id and any(
                    m.group("key").endswith(key_tail) for m in _MARKER_RE.finditer(body)
                ):
                    replies.append(
                        {
                            "note_id": n["id"],
                            "created_at": n["created_at"],
                            "merge_requests": sorted(
                                set(re.findall(r"/-/merge_requests/\d+", body))
                            ),
                        }
                    )
        return {"source_harness_replies": replies}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--gitlab-url", required=True)
    ap.add_argument("--account", required=True, help="bot account name, without @")
    ap.add_argument("--project", action="append", required=True)
    ap.add_argument(
        "--before",
        required=True,
        help="ISO-8601 UTC; only notes created strictly before this",
    )
    ap.add_argument("--allow-user", action="append", default=[])
    ap.add_argument(
        "--policy", default="allowlist", choices=["allowlist", "authenticated-users"]
    )
    ap.add_argument(
        "--reply-marker",
        default=None,
        help="search term matching the source harness's reply markers (e.g. its marker prefix); omit to skip",
    )
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)

    out = Path(args.out).resolve()
    if (Path(__file__).resolve().parents[2] / ".git").exists() and out.is_relative_to(
        Path(__file__).resolve().parents[2]
    ):
        ap.error("--out must be outside this repository (the corpus is confidential)")

    builder = CorpusBuilder(
        ReadOnlyGitLab(args.gitlab_url),
        args.account.lstrip("@"),
        _ts(args.before),
        args.allow_user,
        args.policy,
        reply_marker=args.reply_marker,
    )
    records: dict[str, dict[str, Any]] = {}
    for project in args.project:
        pid, path, candidates = builder.discover(project)
        for cand in candidates:
            rec = builder.build(pid, path, cand)
            records[
                rec.get("source_key") or f"p{pid}:{cand.kind}:{cand.iid}:{cand.note_id}"
            ] = rec

    ordered = sorted(
        records.values(), key=lambda r: (r.get("created_at") or "", r["note_id"])
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for rec in ordered:
            fh.write(json.dumps(rec, sort_keys=True) + "\n")
    out.chmod(0o600)
    accepted = sum(1 for r in ordered if r["status"] == "accepted")
    print(f"wrote {len(ordered)} records ({accepted} accepted) to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
