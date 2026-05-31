import { ethers } from "ethers";
import { getPreset, NETWORK_PRESETS } from "./config/networks.js";
import {
  connectWallet,
  refreshChainId,
  switchToChain,
  walletState,
  onWalletEvents,
  shortAddress,
  hasWallet,
} from "./lib/wallet.js";
import {
  loadEngine,
  refreshPosition,
  engineState,
  tokenSupportsMint,
} from "./lib/engine.js";
import { loadConfig, saveConfig, resetConfig } from "./lib/storage.js";
import {
  runTx,
  approveCollateral,
  depositCollateralWithApprove,
  mintDsc,
  depositAndMint,
  approveDsc,
  burnDsc,
  redeemCollateral,
  redeemForDsc,
  mintTestTokens,
  explorerTxUrl,
} from "./lib/tx.js";
import { toastSuccess, toastError, toastInfo } from "./ui/toast.js";

const $ = (id) => document.getElementById(id);

let config = loadConfig();
let busy = false;
const actionButtons = [];

function setStatus(msg) {
  $("status").textContent = `Status: ${msg}`;
}

function getExpectedChainId() {
  return Number($("expectedChainId").value || "0");
}

function getAutoApprove() {
  return $("autoApprove").checked;
}

function selectedCollateralAddress() {
  const custom = $("customTokenAddress").value.trim();
  if (custom) return ethers.getAddress(custom);
  const sel = $("collateralToken").value;
  if (!sel) throw new Error("Select a collateral token.");
  return ethers.getAddress(sel);
}

function applyPreset(presetId) {
  const preset = getPreset(presetId);
  $("expectedChainId").value = String(preset.chainId);

  const select = $("collateralToken");
  select.innerHTML = "";
  let tokens = preset.collateral;

  if (tokens.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Load contract first";
    select.appendChild(opt);
  } else {
    for (const t of tokens) {
      const opt = document.createElement("option");
      opt.value = t.address;
      opt.textContent = `${t.symbol} (${shortAddress(t.address)})`;
      select.appendChild(opt);
    }
  }
}

function persistFromForm() {
  config = saveConfig({
    preset: $("networkPreset").value,
    engineAddress: $("engineAddress").value.trim(),
    expectedChainId: $("expectedChainId").value,
    autoApprove: $("autoApprove").checked,
  });
}

function loadFormFromConfig() {
  $("networkPreset").value = config.preset || "sepolia";
  $("engineAddress").value = config.engineAddress || "";
  $("expectedChainId").value = config.expectedChainId || "11155111";
  $("autoApprove").checked = config.autoApprove !== false;
  applyPreset($("networkPreset").value);
}

function updateWalletUI() {
  if (walletState.user) {
    $("walletInfo").textContent = `Wallet: ${walletState.user} | Chain: ${walletState.chainId}`;
  } else {
    $("walletInfo").textContent = "Wallet: not connected";
  }
}

function updateContractUI() {
  if (engineState.engineAddress) {
    $("contractInfo").textContent = `DSCEngine: ${engineState.engineAddress} | DSC: ${engineState.dscAddress}`;
  } else {
    $("contractInfo").textContent = "Contract: not loaded";
  }
}

function renderCollateralList(balances) {
  const root = $("collateralList");
  if (!balances?.length) {
    root.innerHTML = '<p class="muted">No collateral tokens.</p>';
    return;
  }
  root.innerHTML = balances
    .map(
      (c) => `
    <div class="collateral-row">
      <strong>${c.symbol}</strong> <span class="muted">${shortAddress(c.address)}</span>
      <div>Deposited: ${ethers.formatUnits(c.deposited, c.decimals)}</div>
      <div>Wallet: ${ethers.formatUnits(c.walletBalance, c.decimals)} | Allowance: ${ethers.formatUnits(c.allowance, c.decimals)}</div>
    </div>`,
    )
    .join("");
}

async function refreshPositionUI() {
  if (!walletState.user || !engineState.engine) return;
  const data = await refreshPosition(walletState.user);
  $("mintedDsc").textContent = ethers.formatUnits(data.totalDscMinted, 18);
  $("collateralUsd").textContent = ethers.formatUnits(data.collateralValueInUsd, 18);
  $("healthFactor").textContent = ethers.formatUnits(data.healthFactor, 18);
  $("dscBalance").textContent = ethers.formatUnits(data.dscBalance, data.dscDecimals);
  renderCollateralList(data.collateralBalances);
  populateCollateralSelectFromEngine(data.collateralBalances);
  await updateTokenBalanceHint();
}

function populateCollateralSelectFromEngine(balances) {
  if (!balances?.length) return;
  const select = $("collateralToken");
  const current = select.value;
  select.innerHTML = "";
  for (const c of balances) {
    const opt = document.createElement("option");
    opt.value = c.address;
    opt.textContent = `${c.symbol} (${shortAddress(c.address)})`;
    select.appendChild(opt);
  }
  if (current) select.value = current;
}

async function updateTokenBalanceHint() {
  if (!walletState.user || !engineState.engine) {
    $("tokenBalances").textContent = "Token balance / allowance: —";
    return;
  }
  try {
    const addr = selectedCollateralAddress();
    const data = await refreshPosition(walletState.user);
    const c = data.collateralBalances.find(
      (x) => x.address.toLowerCase() === addr.toLowerCase(),
    );
    if (c) {
      $("tokenBalances").textContent = `${c.symbol} — Wallet: ${ethers.formatUnits(c.walletBalance, c.decimals)} | Allowance to engine: ${ethers.formatUnits(c.allowance, c.decimals)} | Deposited: ${ethers.formatUnits(c.deposited, c.decimals)}`;
    }
    const canMint = await tokenSupportsMint(addr);
    $("mintTestTokensBtn").hidden = !canMint;
  } catch {
    $("tokenBalances").textContent = "Token balance / allowance: —";
    $("mintTestTokensBtn").hidden = true;
  }
}

function setBusy(isBusy, activeBtn = null) {
  busy = isBusy;
  for (const btn of actionButtons) {
    btn.disabled = isBusy;
  }
  if (activeBtn && isBusy) {
    activeBtn.dataset.originalText = activeBtn.textContent;
    activeBtn.textContent = "Please wait…";
  } else if (activeBtn?.dataset.originalText) {
    activeBtn.textContent = activeBtn.dataset.originalText;
    delete activeBtn.dataset.originalText;
  }
}

async function withAction(btn, label, fn) {
  if (busy) return;
  setBusy(true, btn);
  setStatus(`${label}…`);
  try {
    const hash = await runTx({
      label,
      fn: () => fn(getAutoApprove()),
      autoApprove: getAutoApprove(),
    });
    const url = explorerTxUrl(walletState.chainId, hash);
    if (url) {
      toastSuccess(`${label} confirmed.`);
      toastInfo(`View tx: ${url}`);
    } else {
      toastSuccess(`${label} confirmed. Tx: ${hash.slice(0, 10)}…`);
    }
    setStatus(`${label} succeeded.`);
    await refreshPositionUI();
  } catch (e) {
    const msg = e.message || String(e);
    setStatus(msg);
    toastError(msg);
  } finally {
    setBusy(false, btn);
  }
}

function requireEngine() {
  if (!engineState.engine) throw new Error("Load DSCEngine contract first.");
  if (!walletState.signer) throw new Error("Connect wallet first.");
  const expected = getExpectedChainId();
  if (expected && walletState.chainId !== expected) {
    throw new Error(`Wrong network. Expected chain ${expected}, got ${walletState.chainId}. Click Switch Network.`);
  }
}

async function handleConnect() {
  try {
    await connectWallet();
    updateWalletUI();
    setStatus("Wallet connected.");
    toastSuccess("Wallet connected.");
    if (engineState.engine) await refreshPositionUI();
  } catch (e) {
    setStatus(e.message);
    toastError(e.message);
  }
}

async function handleSwitchNetwork() {
  try {
    if (!hasWallet()) throw new Error("Wallet not found.");
    await switchToChain(getExpectedChainId());
    updateWalletUI();
    setStatus(`Switched to chain ${walletState.chainId}.`);
    toastSuccess(`Network: chain ${walletState.chainId}`);
  } catch (e) {
    setStatus(e.message);
    toastError(e.message);
  }
}

async function handleLoad() {
  try {
    if (!walletState.signer) await connectWallet();
    const addr = $("engineAddress").value.trim();
    if (!addr) throw new Error("Enter DSCEngine address from forge script.");
    const expected = getExpectedChainId();
    if (expected && walletState.chainId !== expected) {
      throw new Error(`Wrong network. Click Switch Network to chain ${expected}.`);
    }
    await loadEngine(addr);
    updateContractUI();
    persistFromForm();
    setStatus("DSCEngine loaded.");
    toastSuccess("Contract loaded.");
    await refreshPositionUI();
  } catch (e) {
    setStatus(e.message);
    toastError(e.message);
  }
}

async function handleRefresh() {
  try {
    requireEngine();
    await refreshPositionUI();
    setStatus("Data refreshed.");
    toastInfo("Position updated.");
  } catch (e) {
    setStatus(e.message);
    toastError(e.message);
  }
}

function initBindings() {
  const ids = [
    "connectBtn",
    "switchNetworkBtn",
    "loadBtn",
    "refreshBtn",
    "saveConfigBtn",
    "resetConfigBtn",
    "approveCollateralBtn",
    "depositBtn",
    "mintBtn",
    "depositAndMintBtn",
    "approveDscBtn",
    "burnBtn",
    "redeemBtn",
    "redeemForDscBtn",
    "mintTestTokensBtn",
  ];
  for (const id of ids) {
    const btn = $(id);
    if (btn && !["connectBtn", "switchNetworkBtn", "loadBtn", "refreshBtn", "saveConfigBtn", "resetConfigBtn"].includes(id)) {
      actionButtons.push(btn);
    }
  }

  $("networkPreset").addEventListener("change", () => {
    applyPreset($("networkPreset").value);
    persistFromForm();
  });
  $("collateralToken").addEventListener("change", updateTokenBalanceHint);
  $("customTokenAddress").addEventListener("input", updateTokenBalanceHint);

  $("saveConfigBtn").addEventListener("click", () => {
    persistFromForm();
    applyPreset($("networkPreset").value);
    toastSuccess("Configuration saved.");
  });

  $("resetConfigBtn").addEventListener("click", () => {
    config = resetConfig();
    loadFormFromConfig();
    toastInfo("Configuration reset.");
  });

  $("connectBtn").addEventListener("click", handleConnect);
  $("switchNetworkBtn").addEventListener("click", handleSwitchNetwork);
  $("loadBtn").addEventListener("click", handleLoad);
  $("refreshBtn").addEventListener("click", handleRefresh);

  $("approveCollateralBtn").addEventListener("click", () =>
    withAction($("approveCollateralBtn"), "Approve collateral", async () => {
      requireEngine();
      return approveCollateral(selectedCollateralAddress(), $("collateralAmount").value);
    }),
  );

  $("depositBtn").addEventListener("click", () =>
    withAction($("depositBtn"), "Deposit collateral", async (autoApprove) => {
      requireEngine();
      return depositCollateralWithApprove(
        selectedCollateralAddress(),
        $("collateralAmount").value,
        autoApprove,
      );
    }),
  );

  $("mintBtn").addEventListener("click", () =>
    withAction($("mintBtn"), "Mint DSC", async () => {
      requireEngine();
      return mintDsc($("dscAmount").value);
    }),
  );

  $("depositAndMintBtn").addEventListener("click", () =>
    withAction($("depositAndMintBtn"), "Deposit and mint", async (autoApprove) => {
      requireEngine();
      return depositAndMint(
        selectedCollateralAddress(),
        $("collateralAmount").value,
        $("dscAmount").value,
        autoApprove,
      );
    }),
  );

  $("approveDscBtn").addEventListener("click", () =>
    withAction($("approveDscBtn"), "Approve DSC", async () => {
      requireEngine();
      return approveDsc($("dscAmount").value);
    }),
  );

  $("burnBtn").addEventListener("click", () =>
    withAction($("burnBtn"), "Burn DSC", async (autoApprove) => {
      requireEngine();
      return burnDsc($("dscAmount").value, autoApprove);
    }),
  );

  $("redeemBtn").addEventListener("click", () =>
    withAction($("redeemBtn"), "Redeem collateral", async () => {
      requireEngine();
      return redeemCollateral(selectedCollateralAddress(), $("collateralAmount").value);
    }),
  );

  $("redeemForDscBtn").addEventListener("click", () =>
    withAction($("redeemForDscBtn"), "Redeem for DSC", async (autoApprove) => {
      requireEngine();
      return redeemForDsc(
        selectedCollateralAddress(),
        $("collateralAmount").value,
        $("dscAmount").value,
        autoApprove,
      );
    }),
  );

  $("mintTestTokensBtn").addEventListener("click", () =>
    withAction($("mintTestTokensBtn"), "Mint test tokens", async () => {
      requireEngine();
      return mintTestTokens(selectedCollateralAddress(), $("collateralAmount").value || "100");
    }),
  );

  onWalletEvents({
    onAccountsChanged: async (accounts) => {
      if (!accounts?.length) {
        walletState.user = null;
        walletState.signer = null;
        updateWalletUI();
        toastInfo("Wallet disconnected.");
        return;
      }
      await connectWallet();
      updateWalletUI();
      if (engineState.engine) await refreshPositionUI();
    },
    onChainChanged: async () => {
      await refreshChainId();
      updateWalletUI();
      toastInfo(`Chain changed to ${walletState.chainId}`);
      if (engineState.engine) await refreshPositionUI();
    },
  });
}

loadFormFromConfig();
initBindings();
updateWalletUI();
updateContractUI();

if (!hasWallet()) {
  toastInfo("Install MetaMask to connect to Sepolia.");
}
