# Tempo UI Plan

## Product Flow

```text
Landing page -> Connect Wallet -> Dashboard
```

The landing page remains publicly viewable. Wallet connection is prominent but does not block access to public pages. A wallet is required only for wallet-specific actions, such as preparing and confirming a human order.

## Top Navigation

The dashboard header contains the primary navigation:

- `Markets`
- `History`
- `Pricing`
- `Docs`

The connected wallet and Somnia network remain visible in the header.

## Pages

### Landing

- Product identity and concise value proposition
- Prominent `Connect Wallet` action
- Somnia network
- Links to Dashboard, Markets, Pricing, and Docs
- Only verified product and on-chain claims

### Dashboard

- Current markets and agent status
- Inventory and risk summary
- Settlement activity
- LLM briefing
- Recent events
- Gear icon for settings

The dashboard is the primary operational view after wallet connection.

### Markets

- Live BTC and ETH markets
- Order book and market status
- Price, cadence, expiry, and settlement information
- Explorer and oracle links
- Asset and interval filters

### History

- Orders, fills, and settlements
- Transaction hashes and explorer links
- Journal events clearly separated from chain events
- Filters by asset, event type, and time window

### Pricing

The Pricing page uses a comparison toggle:

`Standard | LLM-Enhanced`

The LLM toggle changes the available briefing and insight features. It should not imply that an LLM controls trades or risk decisions.

#### Free Explorer

For users exploring the platform.

- Live Somnia testnet dashboard
- Market and settlement data
- Read-only risk and activity views
- Documentation and SDK access
- Limited LLM briefings

**Price:** Free

#### Pro Operator

For developers and teams running automated firms.

- Maker/taker agent orchestration
- Configurable risk and inventory limits
- Wallet-connected human trading
- Full activity and settlement monitoring
- Advanced LLM insights
- SDK/API access

**Price:** Planned

#### Enterprise

For protocols, institutions, and production deployments.

- Dedicated deployment
- Custom risk controls
- Private monitoring and analytics
- Mainnet deployment support
- Priority support and SLA
- Custom integrations

**Price:** Contact us / Planned

Only the Free Explorer tier is currently available. Pro Operator and Enterprise must be labeled `Planned` until billing and commercial provisioning exist.

### Docs

- Product overview
- Architecture
- Somnia integration
- SDK and API reference
- Risk controls
- Security model
- LLM behavior and limitations
- On-chain verification guide

## Dashboard Settings

The gear icon opens settings in a compact popover or side panel. It must be accessible by click, keyboard focus, and touch; settings must not depend on hover alone.

Settings include:

- Display preferences
- Refresh preferences
- Asset and interval defaults
- Density/display preferences
- Wallet and network status

Private keys and secrets are never displayed or stored in the browser.

## Data and Trust Boundaries

- Market state, settlements, transaction hashes, and chain-linked values are sourced from Somnia or the verified indexer.
- Risk policy values are local configuration values and should be labeled accordingly.
- LLM output is advisory commentary, not an on-chain fact and never an autonomous trading authority.
- LLM responses should show their generation time and source journal window.
- Unsupported LLM claims must be rejected or clearly marked rather than presented as verified data.

## Responsive Navigation

Desktop uses the top navigation bar. Mobile uses a compact menu or bottom navigation with the same destinations. The wallet button and network status remain accessible at all viewport sizes.
