"""collect_host must emit host_up_n as an Influx INTEGER next to the boolean host_up.

Grafana's alert expressions cannot reduce a boolean, so the host-down / sweep-stale / crash-loop rules
read host_up_n; if it ever goes missing or turns boolean they sit in NoData and never fire.
Run: python3 -m unittest discover -s ops/metrics -p 'test_*.py'
"""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(nc_dir):
    os.environ["NANOCLAW_DIR"] = nc_dir
    spec = importlib.util.spec_from_file_location("nanoclaw_metrics", os.path.join(HERE, "nanoclaw-metrics.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _host_line(mod):
    return next(line for line in mod._out if line.startswith("nanoclaw_host "))


def _fields(line):
    return dict(kv.split("=", 1) for kv in line.split(" ", 1)[1].split(","))


class HostUpN(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        nc = self.tmp.name
        os.makedirs(os.path.join(nc, "data", "v2-sessions"))
        os.makedirs(os.path.join(nc, "logs"))
        for name in ("nanoclaw.log", "nanoclaw.error.log"):
            open(os.path.join(nc, "logs", name), "w").close()
        self.mod = _load(nc)
        self.pidfile = os.path.join(nc, "data", "nanoclaw.pid")
        self.breaker = os.path.join(nc, "data", "circuit-breaker.json")

    def tearDown(self):
        os.environ.pop("NANOCLAW_DIR", None)
        self.tmp.cleanup()

    def test_up(self):
        with open(self.pidfile, "w") as fh:
            fh.write(str(os.getpid()))
        with open(self.breaker, "w") as fh:
            json.dump({"attempt": 2}, fh)
        self.mod.collect_host({})
        f = _fields(_host_line(self.mod))
        self.assertEqual(f["host_up"], "true")
        self.assertEqual(f["host_up_n"], "1i")  # trailing i = Influx integer, reducible by alert expressions
        self.assertTrue(f["host_uptime_s"].endswith("i"))
        self.assertEqual(f["breaker_attempt"], "2i")

    def test_down(self):
        self.mod.collect_host({})
        f = _fields(_host_line(self.mod))
        self.assertEqual(f["host_up"], "false")
        self.assertEqual(f["host_up_n"], "0i")
        self.assertEqual(f["host_uptime_s"], "0i")  # always present: the crash-loop math needs every input
        self.assertEqual(f["breaker_attempt"], "0i")


if __name__ == "__main__":
    unittest.main()
