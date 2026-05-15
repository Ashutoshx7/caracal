# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Tests for caracalai_core.logging structured JSON emission and redaction.

import json
import logging

import pytest

from caracalai_core.logging import (
    REDACT_VALUE,
    SECRET_KEYS,
    DevLogger,
    create_logger,
    is_secret_key,
    redact,
)


def _read(capsys: pytest.CaptureFixture[str]) -> dict:
    out = capsys.readouterr().err.strip().splitlines()
    assert out, "expected at least one log line on stderr"
    return json.loads(out[-1])


def test_emits_structured_json(capsys):
    log = create_logger("api", "info")
    log.info("ready", port=3000)
    payload = _read(capsys)
    assert payload["level"] == "info"
    assert payload["service"] == "api"
    assert payload["msg"] == "ready"
    assert payload["port"] == 3000


def test_filters_below_level(capsys):
    log = create_logger("sts", "warn")
    log.info("hidden")
    log.error("visible")
    out = capsys.readouterr().err.strip().splitlines()
    assert len(out) == 1
    assert json.loads(out[0])["msg"] == "visible"


def test_with_propagates_context(capsys):
    create_logger("api", "info").with_(request_id="r1", zone_id="z1").info("ok")
    payload = _read(capsys)
    assert payload["request_id"] == "r1"
    assert payload["zone_id"] == "z1"


def test_redacts_secret_fields(capsys):
    create_logger("api", "info").info("login", user="alice", password="hunter2", api_key="k")
    payload = _read(capsys)
    assert payload["user"] == "alice"
    assert payload["password"] == REDACT_VALUE
    assert payload["api_key"] == REDACT_VALUE


def test_with_redacts_bound_secrets(capsys):
    create_logger("api", "info").with_(access_token="t").info("ok")
    assert _read(capsys)["access_token"] == REDACT_VALUE


def test_redact_handles_nested():
    out = redact({
        "ok": 1,
        "Authorization": "Bearer x",
        "nested": {"secret": "s", "keep": 2},
        "list": [{"token": "t"}, {"keep": "v"}],
    })
    assert out == {
        "ok": 1,
        "Authorization": REDACT_VALUE,
        "nested": {"secret": REDACT_VALUE, "keep": 2},
        "list": [{"token": REDACT_VALUE}, {"keep": "v"}],
    }


def test_is_secret_key_substring_case_insensitive():
    assert is_secret_key("X-Auth-Token")
    assert is_secret_key("user_password")
    assert not is_secret_key("zone_id")


def test_secret_keys_contains_password():
    assert "password" in SECRET_KEYS


@pytest.fixture(autouse=True)
def _reset_handlers():
    # Each test re-uses the same logger name; clear handlers so capsys captures cleanly.
    yield
    for name in list(logging.Logger.manager.loggerDict):
        if name.startswith("caracal."):
            lg = logging.getLogger(name)
            for h in list(lg.handlers):
                lg.removeHandler(h)
