# Release Evidence

- Date: 2026-09-03
- Repository: `Kevincruz2005/Tempo`
- Implementation commit: `8d03791`
- Final release commit: `aa0f2f1fe1f763d09a312b5018f59b9024440a61`
- SDK: `@tempo/core` `0.2.0`
- Tag: `sdk-v0.2.0`
- GitHub release: https://github.com/Kevincruz2005/Tempo/releases/tag/sdk-v0.2.0

## Artifact verification

- Tarball: `release/tempo-core-0.2.0.tgz`
- SHA-256: `fc9b51fe3e9b5e8e0dbc87a3da05ab74fae96f05607d7de8ad4fd9d5f38c4e1c`
- Checksum file: `release/SHA256SUMS-v020`
- SBOM: `release/tempo-core-0.2.0-sbom.cdx.json` (CycloneDX 1.5, 16 dependency components)
- Consumer smoke test: ESM runtime import PASS; strict TypeScript declaration compile PASS; production dependency audit PASS (0 vulnerabilities)
- Package contents include `dist/wallet.js`, `dist/calibration.js`, declarations, README, changelog, and license.
- GitHub API reports three release assets; authenticated API download is byte-identical to the local tarball.

## Repository gates

- `npm test`: 2,099/2,099 PASS across 17 files
- Strict `tsc --noEmit`: core, engine, CLI, and MCP PASS
- `node --check packages/web/public/wallet.js`: PASS
- `npm audit --audit-level=high`: 0 vulnerabilities
- Live MCP stdio probe: PASS (12 tools, 14 live rows, writes disabled)
- Health/readiness curls: PASS (`/health` 200, `/ready` 200)
- Full Shannon evidence: 31/31 receipt hashes successful
