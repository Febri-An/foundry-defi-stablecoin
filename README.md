# Foundry DeFi Stablecoin

## Overview
This project is a **Decentralized Stablecoin** system built using **Foundry**. It consists of smart contracts that create and manage a stablecoin, ensuring stability through an underlying mechanism.

## Features
- **Decentralized Stablecoin**: A token pegged to a stable asset.
- **DSCEngine**: Manages minting, collateral, and liquidation.
- **Foundry-based Testing**: Uses `forge test` for robust smart contract testing.

## Installation
Ensure you have Foundry installed. If not, install it with:
```sh
curl -L https://foundry.paradigm.xyz | bash
foundryup
```
Clone the repository and install dependencies:
```sh
git clone <repo_url>
cd foundry-defi-stablecoin
forge install
```

## Compilation
Compile the smart contracts using:
```sh
forge build
```

## Testing
Run the test suite with:
```sh
forge test
```

## Deployment
To deploy on Sepolia:
```sh
forge script script/DeployDSC.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
```
Replace `$SEPOLIA_RPC_URL` and `$PRIVATE_KEY` with your actual values. Copy the **DSCEngine** address from the output for the frontend.

## Frontend

Static UI lives in [`docs/`](docs/) (built from [`frontend/`](frontend/)).

- **GitHub Pages**: `https://<your-user>.github.io/foundry-defi-stablecoin/` — enable **Settings → Pages → GitHub Actions**, or deploy from branch `main` / folder `/docs` after `npm run build`
- **Local dev**: `cd frontend && npm install && npm run dev`
- **Rebuild**: `cd frontend && npm run build`

### Testing flow (Anvil)

1. `anvil`
2. `forge script script/DeployDSC.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`
3. MetaMask: network `31337`, RPC `http://127.0.0.1:8545`, import Anvil account #0
4. Open the UI → preset **Local Anvil** → paste DSCEngine + WETH/WBTC from deploy logs
5. Connect → Load → Mint test tokens → Deposit + Mint (e.g. collateral `1`, DSC `10`) → Refresh
6. Burn / redeem with small amounts; keep health factor ≥ 1

### Testing flow (Sepolia)

1. Deploy with the command above on Sepolia
2. Fund wallet with Sepolia ETH and collateral tokens at `HelperConfig` addresses
3. Build or use GitHub Pages → preset **Sepolia** → paste DSCEngine address
4. Connect → Switch network → Load → approve/deposit/mint → verify on Etherscan

See [`frontend/README.md`](frontend/README.md) for UI configuration details.

note: see the Makefile for more options and more details.

## Smart Contracts
- **DecentralizedStableCoin.sol**: Implements the stablecoin logic.
- **DSCEngine.sol**: Handles stability mechanisms and collateral management.

## License
This project is licensed under the MIT License.

