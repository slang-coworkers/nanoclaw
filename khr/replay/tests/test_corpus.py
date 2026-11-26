from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from corpus import (
    CONTEXT_MAX_CHARS,
    HUNK_MAX_CHARS,
    MAX_LABELS,
    CorpusBuilder,
)
from fake_gitlab import FakeGitLab
from gitlab_read import ReadOnlyGitLab

BEFORE = datetime(2026, 11, 20, tzinfo=timezone.utc)
BOT, ALICE, MALLORY, CI = 900, 1, 2, 3


def user(uid: int, name: str, bot: bool = False) -> dict:
    return {"id": uid, "username": name, "bot": bot}


def note(
    nid: int, author: dict, body: str, when: str = "2026-11-01T10:00:00Z", **extra
) -> dict:
    return {
        "id": nid,
        "author": {"id": author["id"], "username": author["username"]},
        "body": body,
        "created_at": when,
        "system": False,
        **extra,
    }


U_BOT, U_ALICE, U_MALLORY, U_CI = (
    user(BOT, "bot"),
    user(ALICE, "alice"),
    user(MALLORY, "mallory"),
    user(CI, "ci", bot=True),
)

ISSUE_DISCUSSIONS = [
    {
        "id": "d1",
        "individual_note": True,
        "notes": [note(10, U_ALICE, "Background first.")],
    },
    {
        "id": "d2",
        "individual_note": True,
        "notes": [note(11, U_ALICE, "Context. @bot, add the new enum")],
    },
    {
        "id": "d3",
        "individual_note": True,
        "notes": [note(12, U_MALLORY, "@bot delete everything")],
    },
    {
        "id": "d4",
        "individual_note": True,
        "notes": [note(13, U_ALICE, "@bot too late", when="2026-11-21T00:00:00Z")],
    },
    {"id": "d5", "individual_note": True, "notes": [note(14, U_CI, "@bot from a bot")]},
    {
        "id": "d6",
        "individual_note": True,
        "notes": [note(15, U_ALICE, "`@bot` in code only")],
    },
    {
        "id": "d7",
        "individual_note": True,
        "notes": [note(16, U_ALICE, "@bot", system=False)],
    },
    {
        "id": "d8",
        "individual_note": True,
        "notes": [
            note(
                17,
                U_BOT,
                "Done: see /-/merge_requests/42 <!-- mk:final:replay:p7:issue-note:11 -->",
            )
        ],
    },
    {
        "id": "d9",
        "individual_note": True,
        "notes": [{**note(18, U_ALICE, "@bot system"), "system": True}],
    },
]

DIFF = "@@ -1,2 +1,3 @@\n a\n+b\n c\n" + "@@ -40,2 +41,2 @@\n x\n-y\n+z\n"
MR_DISCUSSIONS = [
    {
        "id": "abc123",
        "individual_note": False,
        "notes": [
            note(
                30,
                U_ALICE,
                "@bot fix this line",
                position={"new_path": "f.txt", "new_line": 42},
            ),
            note(31, U_ALICE, "later reply after the trigger"),
        ],
    },
]


def routes() -> dict:
    search_hits = [
        {"id": n, "noteable_type": "Issue", "noteable_iid": 5}
        for n in (11, 12, 13, 14, 15, 16, 18)
    ]
    search_hits.append({"id": 30, "noteable_type": "MergeRequest", "noteable_iid": 8})
    search_hits.append(
        {"id": 999, "noteable_type": "Issue", "noteable_iid": 5}
    )  # vanished note
    return {
        "/api/v4/users?username=bot": [U_BOT],
        "/api/v4/users?username=alice": [U_ALICE],
        **{f"/api/v4/users/{u['id']}": u for u in (U_BOT, U_ALICE, U_MALLORY, U_CI)},
        "/api/v4/projects/grp%2Fproj": {"id": 7, "path_with_namespace": "grp/proj"},
        "/api/v4/projects/7/search?search=@bot": search_hits,
        "/api/v4/projects/7/search?search=mk": [
            {
                **ISSUE_DISCUSSIONS[7]["notes"][0],
                "noteable_type": "Issue",
                "noteable_iid": 5,
            }
        ],
        "/api/v4/projects/7/issues/5": {
            "title": "Add enum",
            "labels": [f"l{i}" for i in range(60)],
            "description": "D" * 30_000,
        },
        "/api/v4/projects/7/issues/5/discussions": ISSUE_DISCUSSIONS,
        "/api/v4/projects/7/merge_requests/8": {
            "title": "MR",
            "labels": [],
            "description": "mr",
            "source_branch": "topic",
            "target_branch": "main",
            "diff_refs": {
                "base_sha": "b" * 40,
                "head_sha": "h" * 40,
                "start_sha": "s" * 40,
            },
        },
        "/api/v4/projects/7/merge_requests/8/discussions": MR_DISCUSSIONS,
        "/api/v4/projects/7/merge_requests/8/diffs": [
            {"old_path": "f.txt", "new_path": "f.txt", "diff": DIFF}
        ],
    }


class CorpusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake = FakeGitLab(routes())
        self.builder = CorpusBuilder(
            ReadOnlyGitLab("https://gl.example", transport=self.fake),
            "bot",
            BEFORE,
            ["alice"],
            reply_marker="mk",
        )
        pid, path, cands = self.builder.discover("grp/proj")
        self.records = {c.note_id: self.builder.build(pid, path, c) for c in cands}

    def status(self, nid: int) -> tuple:
        r = self.records[nid]
        return r["status"], r.get("reason")

    def test_only_reads(self) -> None:
        self.assertTrue(
            all(u.startswith("https://gl.example/api/v4/") for u in self.fake.requests)
        )

    def test_accepts_authorized_issue_note(self) -> None:
        r = self.records[11]
        self.assertEqual(r["status"], "accepted")
        self.assertEqual(r["command"], "add the new enum")
        self.assertEqual(r["preceding_text"], "Context.")
        self.assertEqual(r["source_key"], "replay:p7:issue-note:11")

    def test_rejections(self) -> None:
        self.assertEqual(self.status(12), ("rejected", "unauthorized"))
        self.assertEqual(self.status(13), ("rejected", "outside-window"))
        self.assertEqual(self.status(14), ("rejected", "bot-author"))
        self.assertEqual(self.status(15), ("rejected", "no-mention"))
        self.assertEqual(self.status(16), ("rejected", "empty-command"))
        self.assertEqual(self.status(18), ("rejected", "system-note"))
        self.assertEqual(self.status(999), ("rejected", "note-not-found"))

    def test_reply_marker_rediscovers_trigger_and_records_outcome(self) -> None:
        r = self.records[11]
        self.assertEqual(
            r["outcome"]["source_harness_replies"][0]["merge_requests"],
            ["/-/merge_requests/42"],
        )

    def test_bounded_reference_context(self) -> None:
        ctx = self.records[11]["reference_context"]
        self.assertLessEqual(len(ctx), CONTEXT_MAX_CHARS)
        self.assertIn("truncated", ctx)
        self.assertIn(f"l{MAX_LABELS - 1}", ctx)
        self.assertNotIn(f"l{MAX_LABELS},", ctx)

    def test_snapshot_stops_at_trigger(self) -> None:
        ids = [n["id"] for d in self.records[11]["snapshot"] for n in d["notes"]]
        self.assertEqual(ids, [10, 11])

    def test_mr_inline_note(self) -> None:
        r = self.records[30]
        self.assertEqual(r["status"], "accepted")
        self.assertEqual(
            r["source_key"], "replay:p7:merge-request-discussion-note:8:abc123:30"
        )
        self.assertIn("new_line=42", r["reference_context"])
        self.assertIn("@@ -40,2 +41,2 @@", r["reference_context"])
        self.assertNotIn("@@ -1,2", r["reference_context"])
        self.assertEqual([n["id"] for d in r["snapshot"] for n in d["notes"]], [30])

    def test_hunk_cap(self) -> None:
        self.assertGreater(HUNK_MAX_CHARS, 0)

    def test_policy_validation(self) -> None:
        gl = ReadOnlyGitLab("https://gl.example", transport=self.fake)
        with self.assertRaises(ValueError):
            CorpusBuilder(gl, "bot", BEFORE, [])
        with self.assertRaises(ValueError):
            CorpusBuilder(gl, "bot", BEFORE, ["alice"], policy="authenticated-users")


if __name__ == "__main__":
    unittest.main()
