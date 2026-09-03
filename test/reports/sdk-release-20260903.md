# TEMPO Node SDK Release - 2026-09-03

## Release

- Package: `@tempo/core`
- Version: `0.1.0`
- Git tag: `sdk-v0.1.0`
- GitHub Release: `TEMPO Node SDK v0.1.0`
- Runtime: Node.js 20 or newer, ESM
- Official dependency: `@somnia-chain/markets-sdk` exactly `0.29.0`

## Assets

| Asset | Purpose |
| --- | --- |
| `tempo-core-0.1.0.tgz` | Installable npm-format package |
| `SHA256SUMS` | Artifact integrity verification |
| `tempo-core-0.1.0-sbom.cdx.json` | CycloneDX software bill of materials |

Tarball SHA-256:

```text
7b9d19a03332d1de47555d3479086e22a37f70453fbc5a25ef52544d5309ca7a
```

## Package Verification

- Strict SDK compilation: PASS
- Package dry-run allowlist: PASS, 30 intended files
- Compressed size: 29,248 bytes
- Clean external npm install: PASS
- ESM runtime import and pure-function execution: PASS
- TypeScript declaration consumption with `skipLibCheck=false`: PASS
- Consumer production dependency audit: 0 vulnerabilities
- Repository offline suite after packaging: 2,089/2,089 PASS (historical v0.1.0 release)

## Install

```bash
npm install https://github.com/Kevincruz2005/Tempo/releases/download/sdk-v0.1.0/tempo-core-0.1.0.tgz
```

The package excludes `.env`, keys, journal state, test evidence, and application
artifacts. It includes only compiled JavaScript, declarations, package metadata,
README, changelog, and MIT license.
