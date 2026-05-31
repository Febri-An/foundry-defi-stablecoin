import { ethers } from "ethers";
import { engineState, getTokenContract } from "./engine.js";
import { walletState } from "./wallet.js";
import { friendlyError } from "./errors.js";
import { getPreset } from "../config/networks.js";

export function parseAmount(value, decimals) {
  const clean = (value || "").trim();
  if (!clean) throw new Error("Enter an amount.");
  return ethers.parseUnits(clean, decimals);
}

export async function ensureAllowance(token, spender, owner, amount, autoApprove) {
  const allowance = await token.allowance(owner, spender);
  if (allowance >= amount) return null;
  if (!autoApprove) {
    throw new Error(
      `Insufficient allowance. Click "Approve" first or enable Auto-approve in settings.`,
    );
  }
  const tx = await token.approve(spender, ethers.MaxUint256);
  return tx;
}

export function explorerTxUrl(chainId, txHash) {
  const preset = chainId === 11155111 ? getPreset("sepolia") : null;
  if (!preset?.explorer) return null;
  return `${preset.explorer}/tx/${txHash}`;
}

export async function runTx({ label, fn, onSuccess, autoApprove = true }) {
  try {
    const result = await fn(autoApprove);
    if (onSuccess) await onSuccess(result);
    return result;
  } catch (error) {
    throw new Error(`${label} failed: ${friendlyError(error)}`);
  }
}

export async function approveCollateral(tokenAddress, amountStr, autoApprove) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const amount = parseAmount(amountStr, decimals);
  const tx = await token.approve(engineState.engineAddress, amount);
  await tx.wait();
  return tx.hash;
}

export async function depositCollateral(tokenAddress, amountStr) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const amount = parseAmount(amountStr, decimals);
  const tx = await engineState.engine.depositCollateral(tokenAddress, amount);
  await tx.wait();
  return tx.hash;
}

export async function mintDsc(amountStr) {
  const amount = parseAmount(amountStr, 18);
  const tx = await engineState.engine.mintDsc(amount);
  await tx.wait();
  return tx.hash;
}

export async function depositAndMint(tokenAddress, collateralStr, dscStr, autoApprove) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const collateralAmount = parseAmount(collateralStr, decimals);
  const dscAmount = parseAmount(dscStr, 18);
  const approveTx = await ensureAllowance(
    token,
    engineState.engineAddress,
    walletState.user,
    collateralAmount,
    autoApprove,
  );
  if (approveTx) await approveTx.wait();
  const tx = await engineState.engine.depositCollateralAndMintDsc(
    tokenAddress,
    collateralAmount,
    dscAmount,
  );
  await tx.wait();
  return tx.hash;
}

export async function approveDsc(amountStr) {
  const amount = parseAmount(amountStr, 18);
  const tx = await engineState.dsc.approve(engineState.engineAddress, amount);
  await tx.wait();
  return tx.hash;
}

export async function burnDsc(amountStr, autoApprove) {
  const amount = parseAmount(amountStr, 18);
  const approveTx = await ensureAllowance(
    engineState.dsc,
    engineState.engineAddress,
    walletState.user,
    amount,
    autoApprove,
  );
  if (approveTx) await approveTx.wait();
  const tx = await engineState.engine.burnDsc(amount);
  await tx.wait();
  return tx.hash;
}

export async function redeemCollateral(tokenAddress, amountStr) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const amount = parseAmount(amountStr, decimals);
  const tx = await engineState.engine.redeemCollateral(tokenAddress, amount);
  await tx.wait();
  return tx.hash;
}

export async function redeemForDsc(tokenAddress, collateralStr, dscStr, autoApprove) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const collateralAmount = parseAmount(collateralStr, decimals);
  const dscAmount = parseAmount(dscStr, 18);
  const approveTx = await ensureAllowance(
    engineState.dsc,
    engineState.engineAddress,
    walletState.user,
    dscAmount,
    autoApprove,
  );
  if (approveTx) await approveTx.wait();
  const tx = await engineState.engine.redeemCollateralForDsc(
    tokenAddress,
    collateralAmount,
    dscAmount,
  );
  await tx.wait();
  return tx.hash;
}

export async function mintTestTokens(tokenAddress, amountStr) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const amount = parseAmount(amountStr || "100", decimals);
  const tx = await token.mint(walletState.user, amount);
  await tx.wait();
  return tx.hash;
}

export async function depositCollateralWithApprove(tokenAddress, amountStr, autoApprove) {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals().catch(() => 18n);
  const amount = parseAmount(amountStr, decimals);
  const approveTx = await ensureAllowance(
    token,
    engineState.engineAddress,
    walletState.user,
    amount,
    autoApprove,
  );
  if (approveTx) await approveTx.wait();
  const tx = await engineState.engine.depositCollateral(tokenAddress, amount);
  await tx.wait();
  return tx.hash;
}
