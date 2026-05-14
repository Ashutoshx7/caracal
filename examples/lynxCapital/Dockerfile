# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Lynx Capital application container.

FROM python:3.14-slim

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app

RUN pip install --no-cache-dir \
        "fastapi" "uvicorn[standard]" "sse-starlette" "pydantic" "pyyaml" \
        "httpx" "grpcio" "python-dotenv" "jinja2" "redis>=5.2" \
        "openai" "langchain" "langchain-openai" "langgraph" "deepagents" \
        "caracalai-sdk>=0.1.1"

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
