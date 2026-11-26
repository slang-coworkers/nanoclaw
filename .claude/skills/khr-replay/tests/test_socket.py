from __future__ import annotations

import json
import socket
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from inject import socket_sender


class SocketSenderTests(unittest.TestCase):
    def test_sends_one_routed_json_line(self) -> None:
        with tempfile.TemporaryDirectory(dir="/tmp") as tmp:
            path = str(Path(tmp) / "cli.sock")
            server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            server.bind(path)
            server.listen(1)
            received: list[bytes] = []

            def accept() -> None:
                conn, _ = server.accept()
                with conn:
                    chunks = []
                    while chunk := conn.recv(4096):
                        chunks.append(chunk)
                    received.append(b"".join(chunks))

            t = threading.Thread(target=accept)
            t.start()
            to = {
                "channelType": "dashboard",
                "platformId": "dashboard:x",
                "threadId": "khr:p7:issue:5",
            }
            socket_sender(path)("/khr-implement job=j", to)
            t.join(timeout=5)
            server.close()

            lines = received[0].decode("utf-8").splitlines()
            self.assertEqual(len(lines), 1)
            self.assertEqual(
                json.loads(lines[0]), {"text": "/khr-implement job=j", "to": to}
            )


if __name__ == "__main__":
    unittest.main()
