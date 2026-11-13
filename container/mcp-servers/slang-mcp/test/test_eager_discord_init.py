"""Eager Discord init must not delay the MCP handshake, and one process holds the Gateway.

The stdio gateway in front of slang-mcp starts one server process per MCP
session. On lego (DISCORD_EAGER_INIT=1) each process waited up to 30 s for the
Discord Gateway before it served, so every session's `initialize` took ~31 s and
Claude Code dropped the server after ~25 s.
"""

import contextlib
import fcntl
import time

import anyio
import pytest

from src import server


@pytest.fixture
def lock_path(tmp_path, monkeypatch):
    path = str(tmp_path / "gateway.lock")
    monkeypatch.setenv("SLANG_MCP_DISCORD_LOCK", path)
    monkeypatch.setenv("DISCORD_EAGER_INIT", "1")
    yield path
    server.release_discord_gateway_lock()


class FakeApp:
    def __init__(self):
        self.served_at = None

    def create_initialization_options(self):
        return {}

    async def run(self, read, write, options):
        self.served_at = time.monotonic()


@contextlib.asynccontextmanager
async def fake_streams():
    yield (None, None)


def test_the_handshake_does_not_wait_for_discord(lock_path, monkeypatch):
    started = []

    async def slow_init():
        started.append(True)
        await anyio.sleep(30)

    monkeypatch.setattr(server, "init_discord_client", slow_init)
    app = FakeApp()
    t0 = time.monotonic()
    anyio.run(server.run_stdio, app, fake_streams)
    assert app.served_at is not None and app.served_at - t0 < 1
    assert time.monotonic() - t0 < 2  # the init is cancelled when the session ends
    assert started == [True]


def test_only_one_process_holds_the_gateway_lock(lock_path):
    assert server.acquire_discord_gateway_lock() is True
    # A second opener (another process on the host) cannot take it.
    with open(lock_path, "a+") as other:
        with pytest.raises(OSError):
            fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)
    server.release_discord_gateway_lock()
    with open(lock_path, "a+") as other:
        fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)


def test_a_process_without_the_lock_does_not_connect(lock_path, monkeypatch):
    calls = []

    async def init():
        calls.append(True)

    monkeypatch.setattr(server, "init_discord_client", init)
    with open(lock_path, "a+") as holder:
        fcntl.flock(holder, fcntl.LOCK_EX | fcntl.LOCK_NB)
        anyio.run(server.eager_discord_init)
    assert calls == []


def test_a_failed_connection_gives_the_lock_back(lock_path, monkeypatch):
    async def failing_init():
        raise TimeoutError("gateway not ready")

    monkeypatch.setattr(server, "init_discord_client", failing_init)
    anyio.run(server.eager_discord_init)
    assert server.acquire_discord_gateway_lock() is True


def test_nothing_happens_without_the_flag(lock_path, monkeypatch):
    monkeypatch.setenv("DISCORD_EAGER_INIT", "0")
    calls = []

    async def init():
        calls.append(True)

    monkeypatch.setattr(server, "init_discord_client", init)
    anyio.run(server.eager_discord_init)
    assert calls == []
