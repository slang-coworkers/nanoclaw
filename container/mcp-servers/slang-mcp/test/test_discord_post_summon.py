"""Tests for the DISCORD_POST_SUMMON gate.

By default slang-mcp's on_thread_create handler does NOT post a SummonView —
feedback_collector.py is the canonical poster. Set DISCORD_POST_SUMMON=1 to
override on installs that don't run feedback_collector.py.
"""

import os
from unittest.mock import patch

from src.discord.discord import _post_summon_disabled


def test_default_disables_posting():
    env = {k: v for k, v in os.environ.items() if k != "DISCORD_POST_SUMMON"}
    with patch.dict(os.environ, env, clear=True):
        assert _post_summon_disabled() is True


def test_explicit_zero_disables_posting():
    with patch.dict(os.environ, {"DISCORD_POST_SUMMON": "0"}, clear=False):
        assert _post_summon_disabled() is True


def test_one_enables_posting():
    with patch.dict(os.environ, {"DISCORD_POST_SUMMON": "1"}, clear=False):
        assert _post_summon_disabled() is False


def test_other_values_disable_posting():
    # Only the literal "1" enables — anything else is off (fail safe)
    for v in ["true", "yes", "TRUE", "True", " 1", "1 ", "01"]:
        with patch.dict(os.environ, {"DISCORD_POST_SUMMON": v}, clear=False):
            assert _post_summon_disabled() is True, f"value {v!r} should disable"
