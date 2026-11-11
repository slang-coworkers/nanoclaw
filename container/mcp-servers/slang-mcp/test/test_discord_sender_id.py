"""The sidecar must post each summon and follow-up as the Discord user.

Dashboard ingress stamps a post without `sender_id` as dashboard-admin, the
owner, so a Discord user would reach the host's admin gates as the owner.
Both forwarders (discord.py and feedback_collector.py) send
`sender_id: "discord:<user id>"`; ingress accepts only that shape.
"""

import ast
from pathlib import Path
from unittest.mock import patch

import pytest

import src.discord.discord as slang_discord
import src.discord.feedback_collector as collector

SRC = Path(__file__).resolve().parent.parent / "src" / "discord"


class _Resp:
    status = 200

    async def text(self):
        return ""

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session:
    sent: list = []

    def __init__(self, *a, **kw):
        pass

    def post(self, url, json=None, headers=None, timeout=None):
        _Session.sent.append(json)
        return _Resp()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
@pytest.mark.parametrize("module", [slang_discord, collector], ids=["discord", "feedback_collector"])
async def test_post_carries_the_discord_sender(module):
    _Session.sent = []
    with patch.object(module.aiohttp, "ClientSession", _Session):
        assert await module._post_to_dashboard("hi", thread_id="t-1", sender_id="discord:123456789012345678")
        assert await module._post_to_dashboard("hi", thread_id="t-1")
    assert _Session.sent[0]["sender_id"] == "discord:123456789012345678"
    assert "sender_id" not in _Session.sent[1]


@pytest.mark.parametrize("name", ["discord.py", "feedback_collector.py"])
def test_every_forward_names_the_acting_user(name):
    tree = ast.parse((SRC / name).read_text())
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "_post_to_dashboard"
    ]
    # The summon button is pressed by interaction.user; a follow-up is written by message.author.
    expected = ["f'discord:{interaction.user.id}'", "f'discord:{message.author.id}'"]
    sent = [ast.unparse(kw.value) for call in calls for kw in call.keywords if kw.arg == "sender_id"]
    assert sorted(sent) == sorted(expected), f"{name}: {sent}"
