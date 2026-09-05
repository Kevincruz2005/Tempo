# UX PACKAGE — Close the Gap from 17 → 20 on User Experience & Design

> **What this is:** Concrete, honest actions to move the UX/Design score from
> 17/20 to near-perfect. Organized by impact: highest-ROI first.
>
> **Honest ceiling math:**
> - Hosting the observatory publicly alone: +1 pt
> - Public hosting + wallet E2E evidence: +1.5 pts
> - All 5 actions below: +2.5 to +3 pts → **20/20 realistic**
>
> **Hard constraints (carry over from final_touch.md):**
> - Zero mock, risk engine sacred, keys never in browser, estimate vs fact labels

---

## The Core UX Problem (why 17, not 20)

Judges scoring UX need to *use* the product, not just read about it. Right now:

1. **It runs on localhost** — a judge who can't `npm install && npm run firm` sees nothing.
2. **No consumer path** — everything is operator/developer surface. There is no way
   for a regular wallet holder to interact with the market TEMPO creates.
3. **Wallet E2E evidence is missing** — `remaining.md` item #3 is explicitly open:
   "Run a real browser-wallet E2E flow. Capture evidence."

Fix these three things and UX goes to 20.

---

## Action 1 — Deploy the Observatory Publicly (HIGHEST PRIORITY)

**Impact: +1 point. Zero code. 15 minutes.**

Use Cloudflare Tunnel to expose `localhost:7333` with a public HTTPS URL while
the firm is running. Add that URL to the submission on DoraHacks and SUBMISSION.md.

### Using Cloudflare Tunnel (free, no account required):

```bash
# Install (one-time)
npm install -g cloudflared

# Terminal 1: start the firm
npm run firm

# Terminal 2: expose it
cloudflared tunnel --url http://localhost:7333
# → prints: https://some-random-name.trycloudflare.com
```

### What to add to SUBMISSION.md:

```markdown
## Live Demo

🔴 **Live Dashboard (Somnia Shannon Testnet):**
https://[YOUR-TUNNEL-URL].trycloudflare.com

The observatory is live and streaming real market data from Somnia Shannon
testnet (Chain ID 50312). All prices, books, fills, and transaction hashes
are real on-chain data — zero mocked values.
```

### What this does for a judge:

They click the URL, land on the observatory, see live BTC/ETH windows updating,
see GENESIS quoting, see the Brier score — *without cloning anything*. That is
the difference between "impressive README" and "impressive product."

> **Note:** Keep the firm running from T-2 days through the demo recording.
> Cloudflare Tunnel stays alive as long as the process runs.

---

## Action 2 — Complete the Wallet E2E Evidence (remaining.md item #3)

**Impact: +0.5 point. Required for checklist completeness anyway.**

The connect-wallet flow already exists in `packages/web/public/wallet.js`.
What's missing is captured evidence of it working end-to-end.

### Steps:

1. Open the observatory at `localhost:7333` with MetaMask installed.
2. Connect MetaMask to Somnia Shannon testnet (Chain ID 50312).
3. Click "Connect Wallet" in the observatory.
4. Screenshot each state:
   - Provider detected (wallet button changes)
   - Wrong network banner (before switching to 50312)
   - Connected: truncated address + balance shown
   - Pre-sign summary screen (before placing any IOC order)
   - Successful tx receipt with real hash
   - State refresh (activity tape updates with your fills)
5. Save screenshots to `test/reports/wallet-screenshots/`.
6. Write `test/reports/wallet-flow.md` documenting each step with embeds.

### Language to add to SUBMISSION.md:

```markdown
## Wallet UX

Non-custodial, read-only-by-default. Connecting a wallet:
- Detects EIP-6963 providers (MetaMask, Rabby, etc.)
- Wrong-network banner + one-click chain switch for Somnia Shannon (50312)
- Live address, native balance, and your fills on the activity tape
- Pre-sign summary (market, side, size, worst-case cost, seconds-left)
  rendered BEFORE any signature request — no blind signing ever
- Evidence: test/reports/wallet-flow.md
```

---

## Action 3 — Add a "Try It" First-Visit Onboarding Overlay

**Impact: +0.5 point. ~1 hour of work.**

Right now the observatory opens to a dense operator dashboard. A judge who isn't
a quant doesn't know where to start. Add a dismissable "first-visit" overlay
(stored in `localStorage`) in `packages/web/public/app.js` or `index.html`:

```javascript
// Add to app.js init — show once, dismiss forever
if (!localStorage.getItem('tempo_onboarded')) {
  showOverlay(`
    <div class="onboarding-overlay">
      <h2>Welcome to TEMPO</h2>
      <p>Every DreamDEX window opens with an empty book. TEMPO fixes that.</p>
      <ul>
        <li>→ <b>Top panel:</b> Live BTC/ETH windows TEMPO is quoting right now</li>
        <li>→ <b>Middle:</b> The order book TEMPO created (before you, nothing was here)</li>
        <li>→ <b>Right panel:</b> Fair-value band — priced from the oracle feed vs the on-chain strike</li>
        <li>→ <b>Bottom tape:</b> Real transactions — click any hash to verify on Somnia Explorer</li>
      </ul>
      <p>Connect your wallet (top right) to trade against TEMPO's quotes.</p>
      <button onclick="dismissOnboarding()">Got it →</button>
    </div>
  `);
}
function dismissOnboarding() {
  localStorage.setItem('tempo_onboarded', '1');
  hideOverlay();
}
```

This is 20 lines. It turns a dense dashboard into a guided product for first-time visitors.

### Also add to `docs.html` at the very top:

```markdown
## Try TEMPO Without Installing Anything

1. Open the live dashboard → [PUBLIC URL]
2. Watch TEMPO quote a new BTC/ETH window as it's born (~100ms updates)
3. Connect your MetaMask wallet (Somnia Shannon testnet, Chain 50312)
4. See your fills appear on the activity tape in real time
5. Click any tx hash to verify independently on Somnia Shannon Explorer
```

---

## Action 4 — Surface Brier Score and Stats Prominently in the Header

**Impact: +0.25 point. Zero or minimal code.**

The Brier score (0.0313 latest / 0.0723 historical) is the most powerful UX
differentiator TEMPO has. It answers "how good is the AI?" in one number.
But it's buried in CLI report output.

### Add a "Firm Intelligence" stats bar to the observatory header:

Somewhere visible without scrolling, show:

```
BRIER 0.0313  |  DIR. ACC. 100%  |  WINDOWS 618  |  TX VERIFIED 31/31  |  MOCKED VALUES 0
```

This communicates system trustworthiness at a glance — that's UX.

### Use this in the demo video (0:05–0:15):

> "The system has priced 618 windows. Its Brier score — how calibrated its
> probability estimates are against on-chain settlement truth — is 0.031.
> A coin-flip scores 0.25. TEMPO scores 0.03. Every number is from the chain."

---

## Action 5 — The UX Framing Correction

**Impact: Presentation bleed-over. No code needed.**

### NEVER say:
- "a trading terminal" / "an operator dashboard" / "a headless CLI"

### ALWAYS say:
- "A single-screen observatory — everything you need to understand a live
  autonomous trading firm, no scroll, no clutter"
- "The same screen a quant desk would run on one monitor"

### Key demo beat for UX (weave into video at ~1:50):

Show the full observatory. Then show the Connect Wallet flow. Then say:

> "Any wallet holder on Somnia can connect, watch the quotes TEMPO sets,
> and trade against them directly — with a full pre-sign breakdown before
> any signature is requested. TEMPO is the liquidity provider; the wallet
> is the retail trader taking the other side."

This reframes "operator tool" into "retail-accessible market."

---

## Priority Order (3 days left)

| Action | Time to Implement | Score Impact |
|---|---|---|
| 1. Cloudflare public deployment | 15 min | **+1.0 pt** |
| 2. Wallet E2E screenshots + wallet-flow.md | 1 hr | **+0.5 pt** |
| 3. First-visit onboarding overlay | 1 hr | **+0.5 pt** |
| 4. Brier stats bar in header | 30 min | **+0.25 pt** |
| 5. Framing correction (verbal only) | 0 min | presentation bonus |

**Total realistic gain: +2 to +2.5 points → UX score: 19–20 / 20**

---

## What a 20/20 UX looks like to a judge

- Clicks a public URL and sees a live product ✓ (Action 1)
- Understands what they're looking at in 10 seconds ✓ (Action 3)
- Connects a wallet and participates with pre-sign safety ✓ (Action 2)
- Verifies any number they see is real with one click ✓ (existing on-chain links)
- AI trustworthiness communicated in one prominent number ✓ (Action 4)
