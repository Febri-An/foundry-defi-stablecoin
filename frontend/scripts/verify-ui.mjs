/**
 * Smoke-test DSCEngine reads the UI relies on (run after Anvil deploy).
 * Usage: ENGINE=0x... WETH=0x... RPC=http://127.0.0.1:8545 node scripts/verify-ui.mjs
 */
import { ethers } from "ethers";

const ENGINE_ABI = [
  "function getDsc() view returns (address)",
  "function getCollateralTokens() view returns (address[])",
  "function getAccountInformation(address) view returns (uint256,uint256)",
  "function getHealthFactor(address) view returns (uint256)",
];

const ERC20_ABI = ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"];

const engine = process.env.ENGINE;
const weth = process.env.WETH;
const rpc = process.env.RPC || "http://127.0.0.1:8545";
const user = process.env.USER || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

if (!engine) {
  console.error("Set ENGINE=<DSCEngine address> (and optionally WETH, RPC, USER)");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(rpc);
const contract = new ethers.Contract(engine, ENGINE_ABI, provider);

const dsc = await contract.getDsc();
const tokens = await contract.getCollateralTokens();
console.log("getDsc:", dsc);
console.log("collateral tokens:", tokens);

const [minted, collateralUsd] = await contract.getAccountInformation(user);
const hf = await contract.getHealthFactor(user);
console.log("account:", { minted: minted.toString(), collateralUsd: collateralUsd.toString(), hf: hf.toString() });

if (weth) {
  const token = new ethers.Contract(weth, ERC20_ABI, provider);
  const bal = await token.balanceOf(user);
  console.log("WETH balance:", bal.toString());
}

console.log("UI read smoke test OK");
