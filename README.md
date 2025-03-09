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
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
```
Replace `$SEPOLIA_RPC_URL` and `$PRIVATE_KEY` with your actual values.

## Smart Contracts
- **DecentralizedStableCoin.sol**: Implements the stablecoin logic.
- **DSCEngine.sol**: Handles stability mechanisms and collateral management.

## License
This project is licensed under the MIT License.

