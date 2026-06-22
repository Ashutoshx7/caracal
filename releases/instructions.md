# releases

## Scope
- Covers release metadata and validation artifacts under `releases/`.

## Architecture Design
- Each release tag has one `vYYYY.MM.DD` directory, with a `.N` suffix only for same-day re-cuts.
- `manifest.json` records the exact published artifact versions.
- Release evidence lives in `docs/src/data/releases/<tag>.json`, generated from the manifest by `scripts/generateReleaseRecord.mjs` during release prep and rendered on the docs Releases page.

## Required
- Must keep one manifest per release directory.
- Must keep binary and container versions equal to the CalVer tag without the leading `v`.
- Must keep npm and PyPI versions equal to the package versions actually published.
- Must generate release records through `scripts/generateReleaseRecord.mjs`.

## Forbidden
- Must not edit a published manifest in place after release.
- Must not hand-edit generated release records under `docs/src/data/releases/`.
- Must not store generated validation output, secrets, signing keys, unpublished artifacts, or narrative release notes here.

## Validation
- Validate release entries by comparing the manifest to published registries and the docs release records.

