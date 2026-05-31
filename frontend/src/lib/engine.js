import { ethers } from "ethers";
import { ENGINE_ABI, ERC20_ABI } from "../config/abis.js";
import { walletState } from "./wallet.js";

export const engineState = {
  engine: null,
  dsc: null,
  engineAddress: null,
  dscAddress: null,
  collateralTokens: [],
};

export async function loadEngine(engineAddress) {
  if (!walletState.signer) throw new Error("Connect wallet first.");

  const address = ethers.getAddress(engineAddress.trim());
  const engine = new ethers.Contract(address, ENGINE_ABI, walletState.signer);
  try {
    const dscAddress = await engine.getDsc();

    if (!dscAddress || dscAddress === ethers.ZeroAddress) {
      throw new Error("Invalid DSCEngine: getDsc() returned zero address.");
    }

    engineState.engine = engine;
    engineState.engineAddress = address;
    engineState.dscAddress = dscAddress;
    engineState.dsc = new ethers.Contract(dscAddress, ERC20_ABI, walletState.signer);

    const tokens = await engine.getCollateralTokens();
    engineState.collateralTokens = tokens.map((t) => ethers.getAddress(t));

    return engineState;
  } catch (err) {
    if (err.code === "BAD_DATA" || String(err).includes("BAD_DATA")) {
      throw new Error("Contract not found on this network. Please switch to the correct network or ensure you inputted the correct DSCEngine address.");
    }
    throw err;
  }
}

export async function refreshPosition(user) {
  if (!engineState.engine || !engineState.dsc) {
    throw new Error("Load DSCEngine contract first.");
  }

  try {
    const dscDecimals = await engineState.dsc.decimals().catch(() => 18n);
    const dscBalance = await engineState.dsc.balanceOf(user).catch(() => 0n);
    const [totalDscMinted, collateralValueInUsd] =
      await engineState.engine.getAccountInformation(user).catch(() => [0n, 0n]);
    const healthFactor = await engineState.engine.getHealthFactor(user);

    const collateralBalances = [];
    for (const tokenAddr of engineState.collateralTokens) {
      const token = new ethers.Contract(tokenAddr, ERC20_ABI, walletState.signer);
      const [symbol, decimals, deposited, walletBal, allowance] = await Promise.all([
        token.symbol().catch(() => "Unknown"),
        token.decimals().catch(() => 18n),
        engineState.engine.getCollateralBalanceOfUser(user, tokenAddr).catch(() => 0n),
        token.balanceOf(user).catch(() => 0n),
        token.allowance(user, engineState.engineAddress).catch(() => 0n),
      ]);
      collateralBalances.push({
        address: tokenAddr,
        symbol,
        decimals: Number(decimals),
        deposited,
        walletBalance: walletBal,
        allowance,
      });
    }

    return {
      dscBalance,
      dscDecimals: Number(dscDecimals),
      totalDscMinted,
      collateralValueInUsd,
      healthFactor,
      collateralBalances,
    };
  } catch (err) {
    if (err.code === "BAD_DATA" || String(err).includes("BAD_DATA")) {
      throw new Error("Contract data missing or incompatible. The DSCEngine or tokens are not configured correctly for this network. Please click Load Contract again.");
    }
    throw err;
  }
}

export async function getTokenContract(tokenAddress) {
  return new ethers.Contract(tokenAddress, ERC20_ABI, walletState.signer);
}

export async function tokenSupportsMint(tokenAddress) {
  try {
    const token = await getTokenContract(tokenAddress);
    await token.mint.estimateGas(walletState.user, 1n);
    return true;
  } catch {
    return false;
  }
}
