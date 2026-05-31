export const ENGINE_ABI = [
  "function getDsc() view returns (address)",
  "function getCollateralTokens() view returns (address[])",
  "function getAccountInformation(address) view returns (uint256 totalDscMinted, uint256 collateralValueInUsd)",
  "function getHealthFactor(address) view returns (uint256)",
  "function getCollateralBalanceOfUser(address,address) view returns (uint256)",
  "function depositCollateral(address,uint256)",
  "function mintDsc(uint256)",
  "function burnDsc(uint256)",
  "function redeemCollateral(address,uint256)",
  "function depositCollateralAndMintDsc(address,uint256,uint256)",
  "function redeemCollateralForDsc(address,uint256,uint256)",
];

export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
];
