# Release Evidence

- Date: 2026-09-03
- Repository: `Kevincruz2005/Tempo`
- Release commit: `63673a0`
- SDK: `@tempo/core` `0.3.0`
- Immutable tag: `sdk-v0.3.0`
- GitHub Release: https://github.com/Kevincruz2005/Tempo/releases/tag/sdk-v0.3.0

## Published Assets

- Tarball: `tempo-core-0.3.0.tgz` (37,149 bytes)
- SHA-256: `d1b171768f5f2669e07a4932e8fb5edc262782362f3f287c68137669cd4ded18`
- Checksum asset: `SHA256SUMS-v030`
- Install URL:
  `https://github.com/Kevincruz2005/Tempo/releases/download/sdk-v0.3.0/tempo-core-0.3.0.tgz`

## Release Gates

- `npm test`: 2,107/2,107 PASS across 17 files.
- `npm run test:coverage`: 87.35% statements for critical pure core modules
  (85% required threshold).
- `npm run security:check`: secret scan, strict typecheck, and high-severity
  dependency audit PASS.
- `npm pack --workspace @tempo/core --pack-destination release`: PASS.
- `node --check packages/web/public/wallet.js`: PASS.
- `test/reports/contract-live.md`: fresh funded Shannon sequence and redemption PASS.
