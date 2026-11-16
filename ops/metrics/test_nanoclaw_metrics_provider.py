"""The wire-mix panel must name the provider a group really runs on, and mark open-weights groups.

Run: python3 -m unittest discover -s ops/metrics -p 'test_*.py'
"""
from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


def _load():
    os.environ["NANOCLAW_DIR"] = tempfile.mkdtemp()
    spec = importlib.util.spec_from_file_location("nanoclaw_metrics", os.path.join(HERE, "nanoclaw-metrics.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class ProviderTest(unittest.TestCase):
    def setUp(self):
        self.m = _load()

    def test_group_provider_comes_first_like_the_host(self):
        # `ncl groups update --agent-provider opencode` writes agent_groups, not container_configs.
        self.assertEqual(self.m.effective_provider("opencode", ""), "opencode")
        self.assertEqual(self.m.effective_provider("opencode", "codex"), "opencode")

    def test_config_provider_when_the_group_sets_none(self):
        self.assertEqual(self.m.effective_provider(None, "opencode"), "opencode")

    def test_claude_only_when_nothing_is_set(self):
        self.assertEqual(self.m.effective_provider(None, ""), "claude")


class TierTest(unittest.TestCase):
    def setUp(self):
        self.m = _load()

    def test_unset_model_on_an_open_weights_group(self):
        self.assertEqual(self.m.model_tier("", "open"), "open-default")

    def test_unset_model_on_any_weights_stays_default(self):
        self.assertEqual(self.m.model_tier("", "any"), "default")
        self.assertEqual(self.m.model_tier(None), "default")

    def test_open_and_closed_model_ids(self):
        self.assertEqual(self.m.model_tier("openai/nvidia/zai-org/glm-5.3"), "open")
        self.assertEqual(self.m.model_tier("nvidia/moonshotai/kimi-k3"), "open")
        self.assertEqual(self.m.model_tier("aws/anthropic/bedrock-claude-sonnet-5-5"), "sonnet")


if __name__ == "__main__":
    unittest.main()


class CostSplitTest(unittest.TestCase):
    def setUp(self):
        self.m = _load()

    def test_open_weights_spend_is_its_own_field(self):
        d = {"sessions": [
            {"cost": 6, "claudeUsd": 3, "codexUsd": 1, "openUsd": 2, "group_folder": "main", "group_name": "Orchestrator",
             "session_id": "s1", "container_status": "running"},
            {"cost": 4, "claudeUsd": 0, "codexUsd": 0, "openUsd": 4, "group_folder": "main", "group_name": "Orchestrator",
             "session_id": "s2"},
        ]}
        points = self.m.cost_points(d)
        fleet = next(f for f, t in points if t["scope"] == "fleet")
        self.assertEqual((fleet["usd"], fleet["claude_usd"], fleet["codex_usd"], fleet["open_usd"]), (10, 3, 1, 6))
        self.assertEqual(fleet["active_sessions"], 1)
        group = next(f for f, t in points if t["scope"] == "group")
        self.assertEqual(group["open_usd"], 6)
        sessions = [f for f, t in points if t["scope"] == "session"]
        self.assertEqual([s["open_usd"] for s in sessions], [2, 4])

    def test_older_dashboard_without_open_usd_reads_zero(self):
        points = self.m.cost_points({"sessions": [{"cost": 1, "claudeUsd": 1, "group_folder": "g", "session_id": "s"}]})
        fleet = next(f for f, t in points if t["scope"] == "fleet")
        self.assertEqual(fleet["open_usd"], 0)
        self.assertEqual(fleet["claude_usd"], 1)

    def test_zero_cost_groups_and_sessions_emit_nothing(self):
        points = self.m.cost_points({"sessions": [{"cost": 0, "group_folder": "idle", "session_id": "s0"}]})
        self.assertEqual([t["scope"] for f, t in points], ["fleet"])
