#!/usr/bin/env python3
"""Offline run of dispatch-cron.sh, the host-side dispatch tick: fake `hostname`, `curl` and `ncl` on
PATH, the repo's plan and matrix, a synthetic ledger (LOOP-F35 in flight with a tester PASS, so batch
1b wave 1 is eligible and two of three WIP slots are free). Pins: the hostname guard; --dry-run prints
the POST bodies and writes nothing; a fire POSTs at most wip.free rows in eligible_next order, one
body per row {group, thread_id, content: orchestrator_text}, and records each HTTP 200 with record.py
so the next fire dispatches nothing; config.paused dispatches nothing; a non-200 or unreachable API
records nothing and exits 1; a ledger row that appears between the queue run and the POST skips the
row; an architect session already on a row thread (the ncl overlay) counts the row as in flight; the
queue's alerts land in alerts.md once per (row, kind) per 24 h. Skipped when bash is unavailable.
Run: python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parents[2] / "docs" / "hermes-port"
SCRIPT = HERE / "dispatch-cron.sh"
NOW = "2026-09-09T21:00:00Z"
API = "http://127.0.0.1:3937/api/chat/send"

HEADER = (
    "# Hermes PORT work-item ledger\n\n"
    "| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n"
    "| --- | --- | --- | --- | --- | --- | --- |\n"
)
ROW_1A_PASSED = (
    "| LOOP-F35 | 2026-09-09 10:00 IST (to hermes-architect, thread `hermes-LOOP-F35`) | 2026-09-09 12:00 IST "
    "| #3 (draft) | round 1/2 - PASS | - | n |\n"
)

FAKE_HOSTNAME = "#!/usr/bin/env bash\necho \"${FAKE_HOSTNAME:-slang-cpu-coworkers}\"\n"

# Records every call (args + parsed body) to $CURL_CAPTURE, answers $CURL_CODE (default 200) or fails
# like a refused connection when $CURL_FAIL=1. $CURL_APPEND_LEDGER="<path>|<line>" appends a ledger
# row on the first call, the way a hand dispatch landing mid-tick would.
FAKE_CURL = r'''#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
out = args[args.index("-o") + 1] if "-o" in args else None
data = args[args.index("--data-binary") + 1] if "--data-binary" in args else None
body = open(data[1:], encoding="utf-8").read() if data and data.startswith("@") else (data or "")
cap = os.environ.get("CURL_CAPTURE")
if cap:
    with open(cap, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"url": args[args.index("-X") + 2] if "-X" in args else None,
                             "body": json.loads(body) if body else None}) + "\n")
side = os.environ.get("CURL_APPEND_LEDGER")
if side:
    path, line = side.split("|", 1)
    text = open(path, encoding="utf-8").read()
    if line not in text:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
if os.environ.get("CURL_FAIL") == "1":
    sys.stderr.write("curl: (7) Failed to connect to 127.0.0.1 port 3937: Connection refused\n")
    sys.stdout.write("000")
    sys.exit(7)
code = os.environ.get("CURL_CODE", "200")
if out:
    with open(out, "w", encoding="utf-8") as fh:
        fh.write('{"ok": true}' if code == "200" else '{"error": "boom"}')
sys.stdout.write(code)
'''

FAKE_NCL = r'''#!/usr/bin/env python3
import json, sys
args = sys.argv[1:]
fx = json.load(open(sys.argv[0] + ".fixtures.json"))
def out(data): print(json.dumps({"id": "x", "ok": True, "data": data})); sys.exit(0)
if args[:2] == ["groups", "list"]: out(fx["groups"])
if args[:2] == ["sessions", "list"]: out(fx["sessions"])
sys.stderr.write("unexpected: " + " ".join(args)); sys.exit(2)
'''

GROUPS = [
    {"id": "ag-orch", "name": "Orchestrator", "folder": "orchestrator"},
    {"id": "ag-arch", "name": "hermes-architect", "folder": "hermes-architect"},
]
SESSIONS = [
    # a hand dispatch between ticks: the architect already sits on hermes-MEM-F44, the ledger has no row yet
    {"id": "s-arch-f44", "agent_group_id": "ag-arch", "thread_id": "hermes-MEM-F44", "status": "active",
     "container_status": "running", "last_active": "2026-09-09T20:30:00Z", "created_at": "2026-09-09T20:00:00Z"},
]


@unittest.skipUnless(shutil.which("bash"), "bash not available")
class DispatchCronTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.bin = Path(self.tmp.name) / "bin"
        self.bin.mkdir()
        for name, body in (("hostname", FAKE_HOSTNAME), ("curl", FAKE_CURL), ("ncl", FAKE_NCL)):
            p = self.bin / name
            p.write_text(body, encoding="utf-8")
            os.chmod(p, 0o755)
        (self.bin / "ncl.fixtures.json").write_text(json.dumps({"groups": GROUPS, "sessions": SESSIONS}))
        self.capture = Path(self.tmp.name) / "posts.jsonl"
        hermes = self.root / "data" / "shared" / "hermes"
        self.ap = hermes / "autopilot"
        self.ap.mkdir(parents=True)
        shutil.copy(DOCS / "dispatch-plan.md", hermes / "dispatch-plan.md")
        shutil.copy(DOCS / "gap-matrix.md", hermes / "gap-matrix.md")
        (self.ap / "config.json").write_text('{"wip": 3, "paused": false}\n')
        reports = self.root / "groups" / "orchestrator" / "reports"
        reports.mkdir(parents=True)
        self.ledger = reports / "ledger.md"
        self.ledger.write_text(HEADER + ROW_1A_PASSED, encoding="utf-8")
        self.alerts = reports / "status" / "alerts.md"

    def tearDown(self):
        self.tmp.cleanup()

    def run_cron(self, *args, hostname="slang-cpu-coworkers", **env_extra) -> subprocess.CompletedProcess:
        env = {k: v for k, v in os.environ.items() if k not in ("NCL", "CURL_FAIL", "CURL_CODE", "CURL_APPEND_LEDGER", "API")}
        env.update({
            "PATH": f"{self.bin}:{env.get('PATH', '')}", "ROOT": str(self.root), "NOW_OVERRIDE": NOW,
            "SLEEP_BETWEEN": "0", "CURL_CAPTURE": str(self.capture), "FAKE_HOSTNAME": hostname,
        })
        env.update(env_extra)
        return subprocess.run(["bash", str(SCRIPT), *args], capture_output=True, text=True, env=env, check=False)

    def posts(self) -> list[dict]:
        if not self.capture.exists():
            return []
        return [json.loads(l) for l in self.capture.read_text(encoding="utf-8").splitlines() if l.strip()]

    def book(self) -> dict:
        p = self.ap / "nudges.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

    def log_lines(self) -> list[str]:
        p = self.ap / "dispatch.log"
        return p.read_text(encoding="utf-8").splitlines() if p.exists() else []

    def test_refuses_to_run_on_another_host(self):
        proc = self.run_cron(hostname="macbook")
        self.assertEqual(proc.returncode, 1)
        self.assertIn("WRONG_HOST=macbook", proc.stdout)
        self.assertEqual(self.posts(), [])

    def test_dry_run_prints_the_post_bodies_and_writes_nothing(self):
        proc = self.run_cron("--dry-run")
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(proc.stdout.count(f"DRY-RUN POST {API}"), 2)
        bodies = [json.loads(l) for l in proc.stdout.splitlines() if l.startswith("{")]
        self.assertEqual([b["thread_id"] for b in bodies], ["hermes-MEM-F44", "hermes-OPS-F58.a"])
        self.assertEqual({b["group"] for b in bodies}, {"orchestrator"})
        self.assertTrue(bodies[0]["content"].startswith("Autopilot dispatch MEM-F44 (CONFIGURE, batch 1b):"))
        self.assertIn("Dispatch MEM-F44:", bodies[0]["content"])  # the architect text rides underneath
        self.assertEqual(self.posts(), [], "dry run must not call curl")
        for name in ("nudges.json", "dispatch.log", "dispatch-state.json", "raw"):
            self.assertFalse((self.ap / name).exists(), name)
        self.assertFalse(self.alerts.exists())

    def test_fire_posts_the_free_slots_records_them_and_the_next_fire_is_quiet(self):
        proc = self.run_cron()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        posts = self.posts()
        self.assertEqual([p["body"]["thread_id"] for p in posts], ["hermes-MEM-F44", "hermes-OPS-F58.a"])
        self.assertEqual({p["url"] for p in posts}, {API})
        body = posts[0]["body"]
        self.assertEqual(body["group"], "orchestrator")
        self.assertIn("| MEM-F44 | <stamp> (to hermes-architect, thread `hermes-MEM-F44`) |", body["content"])
        self.assertIn('send_message(to="hermes-architect", thread_id="hermes-MEM-F44"', body["content"])
        self.assertIn("\n----\nDispatch MEM-F44:", body["content"])
        # bookkeeping: record.py dispatched, one entry per row, stamped with the tick's NOW
        dispatched = self.book()["dispatched"]
        self.assertEqual([(d["row"], d["batch"], d["at"]) for d in dispatched],
                         [("MEM-F44", "1b", NOW), ("OPS-F58.a", "1b", NOW)])
        lines = self.log_lines()
        self.assertEqual(len(lines), 2)
        self.assertIn(f"{NOW} dispatched MEM-F44 batch 1b thread hermes-MEM-F44 http 200", lines[0])
        self.assertIn("done: dispatched 2 of 2 (MEM-F44,OPS-F58.a)", proc.stdout)
        st = json.loads((self.ap / "dispatch-state.json").read_text(encoding="utf-8"))
        self.assertEqual([e["id"] for e in st["eligible_next"]], ["MEM-F44", "OPS-F58.a"])
        self.assertFalse((self.ap / ".dispatch-cron.lock").exists(), "lock released")
        # next fire: the ledger has not caught up, the bookkeeping alone keeps both rows in flight
        proc = self.run_cron()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(len(self.posts()), 2, "no second POST for a recorded row")
        self.assertIn("nothing to do (in flight 3/3, free 0", proc.stdout)
        self.assertEqual(len(self.log_lines()), 2)

    def test_config_paused_dispatches_nothing(self):
        (self.ap / "config.json").write_text('{"wip": 3, "paused": true}\n')
        proc = self.run_cron()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("dispatch paused (config.paused)", proc.stdout)
        self.assertEqual(self.posts(), [])
        self.assertEqual(self.book().get("dispatched", []), [])

    def test_unreachable_api_records_nothing_and_exits_1(self):
        proc = self.run_cron(CURL_FAIL="1")
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(len(self.posts()), 1, "stops at the first failed POST")
        self.assertEqual(self.book().get("dispatched", []), [])
        lines = self.log_lines()
        self.assertEqual(len(lines), 1)
        self.assertIn("STOP MEM-F44: POST", lines[0])
        self.assertIn("HTTP 000", lines[0])
        self.assertIn("Connection refused", lines[0])
        self.assertFalse((self.ap / ".dispatch-cron.lock").exists(), "lock released on the failure path")

    def test_non_200_stops_the_tick_without_recording(self):
        proc = self.run_cron(CURL_CODE="500")
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(len(self.posts()), 1)
        self.assertEqual(self.book().get("dispatched", []), [])
        self.assertIn("HTTP 500", self.log_lines()[0])

    def test_ledger_row_appearing_before_the_post_skips_the_row(self):
        hand_row = "| OPS-F58.a | 2026-09-09 20:59 IST (to hermes-architect, thread `hermes-OPS-F58.a`) | - | - | - | - | by hand |"
        proc = self.run_cron(CURL_APPEND_LEDGER=f"{self.ledger}|{hand_row}")
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual([p["body"]["thread_id"] for p in self.posts()], ["hermes-MEM-F44"])
        self.assertEqual([d["row"] for d in self.book()["dispatched"]], ["MEM-F44"])
        self.assertTrue(any("skip OPS-F58.a: a ledger row appeared" in l for l in self.log_lines()))

    def test_architect_session_on_a_thread_counts_the_row_in_flight(self):
        proc = self.run_cron(NCL=str(self.bin / "ncl"))
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertNotIn("sessions overlay", proc.stdout, "the overlay ran")
        # MEM-F44 is in flight through its architect session: one free slot, the next wave-1 row takes it
        self.assertEqual([p["body"]["thread_id"] for p in self.posts()], ["hermes-OPS-F58.a"])
        st = json.loads((self.ap / "dispatch-state.json").read_text(encoding="utf-8"))
        self.assertEqual(st["rows"]["MEM-F44"]["state"], "dispatched")
        self.assertEqual(st["wip"], {"limit": 3, "in_flight": 2, "free": 1, "build_in_flight": True})

    def test_missing_ncl_is_a_log_line_not_a_failure(self):
        proc = self.run_cron(NCL=str(self.root / "bin" / "ncl"))
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("sessions overlay skipped", proc.stdout)
        self.assertEqual(len(self.posts()), 2)

    def test_queue_alerts_land_in_alerts_md_once_per_24h(self):
        # a decorated row-id cell: the row keeps its slot (never re-dispatched) and raises ledger-id-spelling
        self.ledger.write_text(HEADER + "| [LOOP-F35] | 2026-09-09 10:00 IST | - | - | - | - | n |\n", encoding="utf-8")
        proc = self.run_cron()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(self.posts(), [], "1a has no tester PASS: nothing eligible")
        self.assertIn("nothing to do (in flight 1/3", proc.stdout)
        self.assertIn("alerts raised 1", proc.stdout)
        alert_lines = [l for l in self.alerts.read_text(encoding="utf-8").splitlines() if l.startswith("- ")]
        self.assertEqual(len(alert_lines), 1)
        self.assertTrue(alert_lines[0].startswith(f"- {NOW} · LOOP-F35 · ledger-id-spelling · "))
        self.assertIn("decision: fix the ledger row", alert_lines[0])
        self.assertTrue(alert_lines[0].endswith("thread hermes-LOOP-F35"))
        self.assertEqual([(a["row"], a["reason"]) for a in self.book()["alerts"]], [("LOOP-F35", "ledger-id-spelling")])
        self.assertEqual(self.log_lines(), [f"{NOW} alerted LOOP-F35 ledger-id-spelling"])
        proc = self.run_cron()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("alerts raised 0", proc.stdout)
        alert_lines = [l for l in self.alerts.read_text(encoding="utf-8").splitlines() if l.startswith("- ")]
        self.assertEqual(len(alert_lines), 1, "the same (row, kind) is not raised twice in 24 h")

    def test_missing_ledger_dispatches_nothing_and_exits_1(self):
        self.ledger.unlink()
        proc = self.run_cron()
        self.assertEqual(proc.returncode, 1)
        self.assertIn("ledger missing or empty", proc.stdout)
        self.assertEqual(self.posts(), [])

    def test_unknown_argument_is_refused(self):
        proc = self.run_cron("--yes")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(self.posts(), [])


if __name__ == "__main__":
    sys.exit(unittest.main())
