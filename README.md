## Simple Cardano Wallet dApp (React + Mesh SDK)

This is a minimal React dApp that connects to Cardano wallets on **testnet** and lets you:
- Connect / disconnect a wallet (Nami, Eternl, Flint)
- See your ADA balance (lovelace + ADA)
- Send **exactly 1 ADA to yourself**
- See transaction status + hash (linked to CardanoScan preprod)

### 1. What wallets should you install?

Install at least these browser wallets (Chrome/Brave/Edge/Firefox):
- Nami
- Eternl
- Flint

For this demo:
- Switch your wallet network to **Preprod / Testnet**
- Fund it with some **test ADA** from a faucet

### 2. How to run the app (basic steps)

In the project root (where `package.json` is):

```bash
npm install
npm run dev
```

Then open the printed URL in your browser (usually `http://localhost:5173`).

### 3. Where is the main logic?

- `src/App.js` – entire dApp UI + logic (heavily commented line by line)
- `src/styles.css` – basic styling and colors

Read `src/App.js` from top to bottom; the comments explain:
- Wallet connection flow
- Balance fetching
- Building/signing/submitting a transaction
- How the transaction status is tracked and displayed




