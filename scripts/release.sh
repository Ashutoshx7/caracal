#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Cuts a release: applies pending changesets, tags HEAD with the new version, pushes branch and tag.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "release: working tree is dirty; commit or stash before releasing" >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "release: must run from main (current: ${branch})" >&2
  exit 1
fi

git pull --ff-only origin main

if [[ -z "$(ls .changeset/*.md 2>/dev/null | grep -v -E '(README|instructions)\.md$' || true)" ]]; then
  echo "release: no pending changesets in .changeset/" >&2
  exit 1
fi

pnpm changeset version

version="$(node -p "require('./packages/core/ts/package.json').version")"
tag="v${version}"

git add -A
git commit -m "release: ${tag}"
git tag -a "${tag}" -m "${tag}"
git push origin main
git push origin "${tag}"

echo "release: pushed ${tag}; GitHub Actions will publish npm, PyPI, GHCR images, and the GitHub Release."
