from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from inject import job_id, run, thread_id


def record(
    note_id: int, kind: str = "issue", iid: int = 5, status: str = "accepted"
) -> dict:
    return {
        "status": status,
        "project_id": 7,
        "project_path": "grp/proj",
        "kind": kind,
        "iid": iid,
        "note_id": note_id,
        "discussion_id": "d",
        "created_at": "2026-11-01T10:00:00Z",
        "author": {"id": 1, "username": "alice"},
        "body_sha256": "0" * 64,
        "command": "do it",
        "model": None,
        "preceding_text": "",
        "reference_context": "Title: t",
        "snapshot": [{"id": "d", "notes": []}],
        "source_key": f"replay:p7:issue-note:{note_id}",
    }


class InjectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.corpus = self.root / "corpus.jsonl"
        recs = [record(11), record(12, status="rejected"), record(30, kind="mr", iid=8)]
        self.corpus.write_text(
            "\n".join(json.dumps(r) for r in recs) + "\n", encoding="utf-8"
        )
        self.sent: list[tuple[str, dict]] = []

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def sender(self, text: str, to: dict) -> None:
        self.sent.append((text, to))

    def go(self, send=True, **kw) -> list[str]:
        return run(
            self.corpus,
            self.root / "groups",
            "khr-implement",
            "dashboard",
            "dashboard:khr-implement",
            self.sender if send else None,
            out=io.StringIO(),
            **kw,
        )

    def test_dry_run_sends_and_writes_nothing(self) -> None:
        self.assertEqual(self.go(send=False), ["p7-i5-n11", "p7-m8-n30"])
        self.assertEqual(self.sent, [])
        self.assertFalse((self.root / "groups").exists())

    def test_sends_accepted_only_with_thread_per_noteable(self) -> None:
        self.go()
        self.assertEqual(
            [to["threadId"] for _, to in self.sent], ["khr:p7:issue:5", "khr:p7:mr:8"]
        )
        self.assertTrue(self.sent[0][0].startswith("/khr-implement job=p7-i5-n11"))
        self.assertIn("never publish", self.sent[0][0])

    def test_stages_job_files(self) -> None:
        self.go()
        root = self.root / "groups" / "khr-implement" / "jobs" / "p7-i5-n11"
        req = json.loads((root / "request.json").read_text())
        self.assertEqual((req["command"], req["mode"]), ("do it", "replay-dry-run"))
        self.assertTrue((root / "issue-discussions.json").exists())
        self.assertTrue(
            (
                self.root / "groups/khr-implement/jobs/p7-m8-n30/mr-discussions.json"
            ).exists()
        )

    def test_idempotent_unless_forced(self) -> None:
        self.go()
        self.go()
        self.assertEqual(len(self.sent), 2)
        self.go(force=True)
        self.assertEqual(len(self.sent), 4)

    def test_only_and_limit(self) -> None:
        self.assertEqual(self.go(only={"p7-m8-n30"}), ["p7-m8-n30"])
        self.assertEqual(self.go(limit=1, force=True), ["p7-i5-n11"])

    def test_ids(self) -> None:
        self.assertEqual(job_id(record(11)), "p7-i5-n11")
        self.assertEqual(thread_id(record(30, kind="mr", iid=8)), "khr:p7:mr:8")


if __name__ == "__main__":
    unittest.main()
