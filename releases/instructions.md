# Releases

## Scope
- Only release manifests that pin every Caracal artifact version to a single GitHub release tag.

## Required
- One directory per release tag, named exactly `vYYYY.MM.DD` (with `.N` suffix on same-day re-cuts).
- Each directory must contain exactly one `manifest.json`.
- `manifest.json` must list `release`, `publishedAt`, `binaries` (cli, tui), `containers`, `pypi`, and `npm` with every published artifact mapped to its version string.
- Container versions and binary versions must equal the CalVer release tag without the leading `v`.
- PyPI and npm versions must equal the semver string actually published to each registry.
- Every release cut must add its manifest in the same commit as the changeset version bump.

## Forbidden
- Must not edit a published manifest after the release lands; cut a new tag instead.
- Must not omit artifacts that were published under the release tag.
- Must not store secrets, signing keys, or unrelated release notes here.
