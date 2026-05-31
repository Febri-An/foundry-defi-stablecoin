# DSC Frontend

Vite + ethers.js UI for the DSCEngine stablecoin protocol.

## Development

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and connect MetaMask to **Anvil** (`31337`) or **Sepolia** (`11155111`).

## Build for GitHub Pages

```sh
npm run build
```

Output is written to `../docs/` with base path `/foundry-defi-stablecoin/` for project Pages URLs.

Enable Pages in the repo: **Settings → Pages → Deploy from branch → `main` → `/docs`**.

## Configuration

1. Deploy contracts: `forge script script/DeployDSC.s.sol --rpc-url <RPC> --broadcast`
2. Copy the **DSCEngine** address into the UI.
3. **Sepolia**: WETH/WBTC addresses are prefilled from `HelperConfig`.
4. **Anvil**: paste WETH/WBTC mock addresses from deploy logs into the Anvil token fields.

Settings persist in browser `localStorage`. Enable **Auto-approve** for one-click deposit/burn flows during testing.

## Testing flow

See the root [README.md](../README.md#frontend) for the full Anvil and Sepolia checklists.

### Smoke test (after Anvil deploy)

```sh
ENGINE=0xYourEngine WETH=0xYourWeth npm run verify-ui
```

### Regression checklist

- [ ] Connect Wallet
- [ ] Switch Network
- [ ] Load Contract
- [ ] Refresh Data
- [ ] Approve Collateral
- [ ] Deposit Collateral
- [ ] Mint DSC
- [ ] Deposit + Mint
- [ ] Approve DSC
- [ ] Burn DSC
- [ ] Redeem Collateral
- [ ] Redeem for DSC
