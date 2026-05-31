import { ethers } from "ethers";

const ERROR_MESSAGES = {
  DSCEngine__NeedsMoreThanZero: "Amount must be greater than zero.",
  DSCEngine__NotAllowedToken: "This token is not accepted as collateral.",
  DSCEngine__TransferFailed: "Token transfer failed. Approve the engine first or check your balance.",
  DSCEngine__BreaksHealthFactor: "This action would break your health factor (position undercollateralized).",
  DSCEngine__MintFailed: "Minting DSC failed.",
  DSCEngine__HealthFactorOk: "Position health is already fine (not liquidatable).",
  DSC_HealthFactorNotImproved: "Health factor did not improve after liquidation.",
};

export function friendlyError(error) {
  if (!error) return "Unknown error";

  const data = error.data ?? error.info?.error?.data;
  if (data) {
    for (const [name, msg] of Object.entries(ERROR_MESSAGES)) {
      try {
        const iface = new ethers.Interface([`error ${name}()`]);
        const parsed = iface.parseError(data);
        if (parsed) return msg;
      } catch {
        /* try next */
      }
    }
    try {
      const iface = new ethers.Interface([
        "error DSCEngine__BreaksHealthFactor(uint256 healthFactor)",
      ]);
      const parsed = iface.parseError(data);
      if (parsed?.name === "DSCEngine__BreaksHealthFactor") {
        const hf = parsed.args[0];
        return `Health factor too low after action (${ethers.formatUnits(hf, 18)}). Deposit more collateral or burn DSC.`;
      }
    } catch {
      /* ignore */
    }
  }

  const msg = error.shortMessage || error.reason || error.message || String(error);
  for (const [name, text] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(name)) return text;
  }
  if (msg.includes("user rejected")) return "Transaction cancelled in wallet.";
  if (msg.includes("insufficient funds")) return "Insufficient ETH for gas.";
  return msg;
}
