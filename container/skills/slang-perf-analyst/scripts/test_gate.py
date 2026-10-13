"""Test gate.sh against a stub `gh`: which nights wake the agent, and the contract.

The contract under test (ncl tasks create --script): exit 0 on every path, and the
last stdout line is JSON {wakeAgent, data}. A violation backs the series off.
"""
import json
import os
import shutil
import stat
import subprocess
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(HERE, "gate.sh")

STUB = """#!/usr/bin/env bash
# Stub gh: replays fixtures named by GH_FIXTURES, or fails/garbles on request.
case "$1 $2" in
  "run list")
    [ -n "${GH_LIST_FAIL:-}" ] && { echo "boom" >&2; exit 1; }
    cat "$GH_FIXTURES/list.json" ;;
  "run view")
    [ -n "${GH_VIEW_FAIL:-}" ] && exit 1
    cat "$GH_FIXTURES/view-$3.json" ;;
  "api repos/shader-slang/slang/actions/jobs/123")
    cat "$GH_FIXTURES/job.json" ;;
  "api repos/shader-slang/slang/check-runs/456/annotations?per_page=100")
    [ -n "${GH_ANNOTATIONS_FAIL:-}" ] && exit 1
    cat "$GH_FIXTURES/annotations.json" ;;
  *) exit 2 ;;
esac
"""


def iso(hours_ago):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - hours_ago * 3600))


def run(id, conclusion="failure", status="completed", hours_ago=1):
    return {"databaseId": id, "conclusion": conclusion, "status": status, "createdAt": iso(hours_ago),
            "headSha": "abc" * 13 + "a", "event": "schedule", "url": f"https://x/runs/{id}"}


def jobs(nightly, analyze):
    out = [{"name": "nightly", "conclusion": nightly}]
    if analyze is not None:
        out.append({"name": "analyze", "conclusion": analyze, "databaseId": 123,
                    "steps": [{"name": "Report confirmed trend (fail on confirmed regression)",
                               "conclusion": analyze}]})
    return {"jobs": out}


class GateTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.bin = os.path.join(self.dir, "bin")
        self.fix = os.path.join(self.dir, "fixtures")
        self.state = os.path.join(self.dir, "state")
        for d in (self.bin, self.fix, self.state):
            os.makedirs(d)
        stub = os.path.join(self.bin, "gh")
        with open(stub, "w") as fh:
            fh.write(STUB)
        os.chmod(stub, os.stat(stub).st_mode | stat.S_IEXEC)
        self.put("job.json", {"check_run_url": "https://api.github.com/repos/shader-slang/slang/check-runs/456"})
        self.put("annotations.json", [[{"annotation_level": "failure",
                                       "title": "Perf regressions overload_resolution/SemanticChecking"}]])

    def tearDown(self):
        shutil.rmtree(self.dir)

    def put(self, name, data):
        with open(os.path.join(self.fix, name), "w") as fh:
            fh.write(data if isinstance(data, str) else json.dumps(data))

    def fire(self, **env):
        e = dict(os.environ, PATH=f"{self.bin}:{os.environ['PATH']}", GH_FIXTURES=self.fix,
                 PERF_STATE_DIR=self.state, **env)
        p = subprocess.run(["bash", GATE], capture_output=True, text=True, env=e, timeout=30, check=False)
        self.assertEqual(p.returncode, 0, p.stderr)  # the contract: exit 0 on every path
        last = p.stdout.strip().splitlines()[-1]
        payload = json.loads(last)                    # the contract: last line is JSON
        self.assertEqual(set(payload), {"wakeAgent", "data"})
        return payload

    def test_a_confirmed_regression_wakes_the_agent_with_its_run(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        out = self.fire()
        self.assertTrue(out["wakeAgent"])
        self.assertEqual((out["data"]["run_id"], out["data"]["kind"]), (11, "regression"))

    def test_a_successful_night_stays_quiet(self):
        self.put("list.json", [run(11, conclusion="success")])
        out = self.fire()
        self.assertFalse(out["wakeAgent"])
        self.assertEqual(out["data"]["checked_runs"], 1)

    def test_an_analyze_checkout_failure_is_a_throttled_error(self):
        self.put("list.json", [run(11)])
        data = jobs("success", "failure")
        data["jobs"][1]["steps"][0]["conclusion"] = "skipped"
        self.put("view-11.json", data)
        first = self.fire()
        self.assertEqual(first["data"]["error"], "trend_not_evaluated")
        self.assertNotIn("kind", first["data"])
        self.assertFalse(self.fire()["wakeAgent"])

    def test_an_evaluation_failure_is_not_a_regression(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        self.put("annotations.json", [[{"annotation_level": "failure", "title": None,
                                       "message": "Process completed with exit code 2."},
                                      {"annotation_level": "warning", "title": "Perf warnings w/c"}]])
        self.assertEqual(self.fire()["data"]["error"], "regression_not_confirmed")
        self.assertFalse(self.fire()["wakeAgent"])

    def test_regression_annotations_on_later_pages_are_read(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        self.put("annotations.json", [[], [{"annotation_level": "failure", "title": "Perf regressions w/c"}]])
        self.assertEqual(self.fire()["data"]["kind"], "regression")

    def test_annotation_api_failures_are_errors(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        self.assertEqual(self.fire(GH_ANNOTATIONS_FAIL="1")["data"]["error"], "annotations_failed")

    def test_annotation_error_bodies_are_not_evidence(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        self.put("annotations.json", [{"message": "Not Found"}])
        self.assertEqual(self.fire()["data"]["error"], "annotations_unparseable")

    def test_a_run_still_in_progress_stays_quiet(self):
        self.put("list.json", [run(11, conclusion=None, status="in_progress")])
        self.assertFalse(self.fire()["wakeAgent"])

    def test_a_failed_sweep_is_not_a_regression(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("failure", None))
        self.assertFalse(self.fire()["wakeAgent"])

    def test_an_already_analyzed_run_stays_quiet_until_a_newer_one_arrives(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        with open(os.path.join(self.state, "perf-analyzed.json"), "w") as fh:
            json.dump([11], fh)
        self.assertFalse(self.fire()["wakeAgent"])
        self.put("list.json", [run(12), run(11)])
        self.put("view-12.json", jobs("success", "failure"))
        self.assertEqual(self.fire()["data"]["run_id"], 12)

    def test_a_stale_failure_is_not_analyzed(self):
        self.put("list.json", [run(11, hours_ago=80)])
        self.put("view-11.json", jobs("success", "failure"))
        self.assertFalse(self.fire()["wakeAgent"])

    def test_the_gate_does_not_mark_a_run_analyzed_itself(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        self.fire()
        self.assertTrue(self.fire()["wakeAgent"])  # a wake that died is retried
        self.assertFalse(os.path.exists(os.path.join(self.state, "perf-analyzed.json")))

    def test_an_api_failure_wakes_once_then_is_suppressed(self):
        self.put("list.json", [])
        first = self.fire(GH_LIST_FAIL="1")
        self.assertTrue(first["wakeAgent"])
        self.assertEqual(first["data"]["error"], "run_list_failed")
        second = self.fire(GH_LIST_FAIL="1")
        self.assertFalse(second["wakeAgent"])
        self.assertTrue(second["data"]["suppressed"])

    def test_an_error_body_that_exits_zero_is_not_read_as_data(self):
        # gh api can print an error object and still exit 0.
        self.put("list.json", {"message": "Not Found", "documentation_url": "https://docs"})
        out = self.fire()
        self.assertTrue(out["wakeAgent"])
        self.assertEqual(out["data"]["error"], "run_list_unparseable")

    def test_garbage_from_gh_is_an_error_not_silence(self):
        self.put("list.json", "<html>rate limited</html>")
        self.assertEqual(self.fire()["data"]["error"], "run_list_unparseable")

    def test_a_failed_job_lookup_is_an_error(self):
        self.put("list.json", [run(11)])
        self.assertEqual(self.fire(GH_VIEW_FAIL="1")["data"]["error"], "run_view_failed")

    def test_a_corrupt_ledger_is_treated_as_empty(self):
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        with open(os.path.join(self.state, "perf-analyzed.json"), "w") as fh:
            fh.write("{not json")
        self.assertTrue(self.fire()["wakeAgent"])

    def pending_report(self, status="queued", check_after=0):
        directory = os.path.join(self.state, "perf-deliveries")
        os.makedirs(directory, exist_ok=True)
        with open(os.path.join(directory, "11.json"), "w") as fh:
            json.dump({"run_id": 11, "created_at": iso(80), "status": status,
                       "check_after": check_after,
                       "run_url": "https://github.com/shader-slang/slang/actions/runs/11"}, fh)

    def test_saved_delivery_is_resumed_after_the_nightly_ages_out(self):
        self.pending_report()
        result = self.fire(GH_LIST_FAIL="1")
        self.assertEqual(result["data"]["kind"], "delivery-retry")
        self.assertEqual(result["data"]["run_id"], 11)

    def test_delivered_report_without_final_ledger_mark_resumes_recording(self):
        self.pending_report("delivered")
        self.assertEqual(self.fire()["data"]["delivery_status"], "delivered")

    def test_completed_report_does_not_wake_again(self):
        self.pending_report("delivered")
        self.put("list.json", [])
        with open(os.path.join(self.state, "perf-analyzed.json"), "w") as fh:
            json.dump([11], fh)
        self.assertFalse(self.fire()["wakeAgent"])

    def test_deferred_delivery_cannot_fall_through_to_reanalysis(self):
        self.pending_report("reserved", int(time.time()) + 3600)
        self.put("list.json", [run(11)])
        self.put("view-11.json", jobs("success", "failure"))
        self.assertFalse(self.fire()["wakeAgent"])


if __name__ == "__main__":
    unittest.main()
