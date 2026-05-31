/** Mirrors script/HelperConfig.s.sol addresses */
export const NETWORK_PRESETS = {
  sepolia: {
    id: "sepolia",
    label: "Sepolia",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    collateral: [
      { symbol: "WETH", address: "0xdd13E55209Fd76AfE204dBda4007C227904f0a81" },
      { symbol: "WBTC", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" },
    ],
  },
};

export function getPreset(presetId) {
  return NETWORK_PRESETS[presetId] ?? NETWORK_PRESETS.sepolia;
}
