"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Provisioning script security regression tests.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from scripts import provision


@dataclass
class _Application:
    id: str
    applicationName: str


class _Client:
    def invoke(self, command: str, action: str, payload: dict | None = None) -> list | dict:
        if command == "app" and action == "list":
            return []
        if command == "app" and action == "create" and payload:
            return {
                "id": f"app_{payload['name']}",
                "client_secret": f"secret_{payload['name']}",
            }
        raise AssertionError(f"unexpected control call: {command} {action}")


class _Model:
    applications = [
        _Application(id="operations", applicationName="Lynx Operations"),
        _Application(id="payments", applicationName="Lynx Payments"),
    ]


def test_application_client_secrets_are_written_without_stdout(tmp_path, monkeypatch, capsys):
    root = tmp_path / "lynx"
    config = root / "config"
    config.mkdir(parents=True)
    monkeypatch.setattr(provision, "ROOT", root)
    monkeypatch.setattr(provision, "APPLICATION_ENV_PATH", config / "provisioned.env")

    application_ids = provision.ensure_applications(_Client(), _Model())

    output = capsys.readouterr().out
    env = (config / "provisioned.env").read_text(encoding="utf-8")
    assert application_ids == {
        "operations": "app_Lynx Operations",
        "payments": "app_Lynx Payments",
    }
    assert "secret_Lynx" not in output
    assert "_CLIENT_SECRET=" not in output
    assert "LYNX_CARACAL_OPERATIONS_CLIENT_SECRET=secret_Lynx Operations" in env
    assert "LYNX_CARACAL_PAYMENTS_CLIENT_SECRET=secret_Lynx Payments" in env
    assert (config / "provisioned.env").stat().st_mode & 0o777 == 0o600
