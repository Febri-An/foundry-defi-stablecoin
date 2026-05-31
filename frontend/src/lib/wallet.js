import { ethers } from "ethers";

export const walletState = {
  provider: null,
  signer: null,
  user: null,
  chainId: null,
};

export function hasWallet() {
  return Boolean(window.ethereum);
}

export async function connectWallet() {
  if (!hasWallet()) throw new Error("MetaMask (or compatible wallet) not found.");

  walletState.provider = new ethers.BrowserProvider(window.ethereum);
  await walletState.provider.send("eth_requestAccounts", []);
  walletState.signer = await walletState.provider.getSigner();
  walletState.user = await walletState.signer.getAddress();
  const network = await walletState.provider.getNetwork();
  walletState.chainId = Number(network.chainId);
  return walletState;
}

export async function refreshChainId() {
  if (!walletState.provider) return null;
  const network = await walletState.provider.getNetwork();
  walletState.chainId = Number(network.chainId);
  return walletState.chainId;
}

export async function switchToChain(expectedChainId) {
  if (!hasWallet()) throw new Error("Wallet not found.");
  const hex = "0x" + Number(expectedChainId).toString(16);
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: hex }],
  });
  await refreshChainId();
}

export function onWalletEvents({ onAccountsChanged, onChainChanged }) {
  if (!window.ethereum) return;
  window.ethereum.on("accountsChanged", onAccountsChanged);
  window.ethereum.on("chainChanged", onChainChanged);
}

export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
