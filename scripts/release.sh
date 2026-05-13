#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Cuts a Caracal release: applies pending changesets, computes the next CalVer tag (vYYYY.MM.DD with .N suffix on same-day re-cuts), tags HEAD, and pushes branch + tag.

set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck source=lib/style.sh
. "scripts/lib/style.sh"

mode="release"
for arg in "$@"; do
    case "$arg" in
        --dry-run) mode="dryrun" ;;
        -h|--help)
            cat <<EOF
Usage: scripts/release.sh [--dry-run]

  --dry-run   Print the planned tag, run \`changeset version\`, run \`changeset publish --dry-run\`, then revert local changes.

Tag format: vYYYY.MM.DD (with .N suffix on additional cuts the same day).
Per-package versions follow semver and are bumped by Changesets.
EOF
            exit 0
            ;;
        *) say_error "release: unknown arg: $arg"; exit 2 ;;
    esac
done

if [[ -n "$(git status --porcelain)" ]]; then
    say_error "release: working tree is dirty; commit or stash before releasing"
    exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" && "$mode" != "dryrun" ]]; then
    say_error "release: must run from main (current: ${branch})"
    exit 1
fi

git fetch --tags --quiet origin || true
if [[ "$mode" == "release" ]]; then
    git pull --ff-only origin main
fi

today="$(date -u +%Y.%m.%d)"
prefix="v${today}"
suffix=""
n=1
while git rev-parse --quiet --verify "refs/tags/${prefix}${suffix}" >/dev/null; do
    n=$((n+1))
    suffix=".${n}"
done
tag="${prefix}${suffix}"

pending="$(find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' 2>/dev/null | wc -l | tr -d ' ')"

say_header "release: ${tag}"
say_info "${pending} pending changeset(s)"

if [[ "$mode" == "dryrun" ]]; then
    if [[ "$pending" != "0" ]]; then
        pnpm changeset status
        pnpm changeset version
        say_step "dry-run package version preview"
        git --no-pager diff -- '**/package.json'
        git checkout -- .
        git clean -fd .changeset/ packages/ apps/
    else
        say_info "initial release; no changesets to apply"
    fi
    say_success "dry-run complete; no commits made"
    exit 0
fi

if [[ "$pending" != "0" ]]; then
    pnpm changeset version
fi

git add -A
if ! git diff --cached --quiet; then
    git commit -m "release: ${tag}"
fi
git tag -a "${tag}" -m "${tag}"
git push origin main
git push origin "${tag}"

say_success "pushed ${tag}"
say_info "GitHub Actions will publish npm, PyPI, GHCR images, and the GitHub Release"
say_label "monitor at https://github.com/Garudex-Labs/caracal/actions"
