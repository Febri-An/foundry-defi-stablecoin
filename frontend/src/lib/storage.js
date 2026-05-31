const KEY = "dsc-ui-config";

const defaults = {
  preset: "sepolia",
  engineAddress: "",
  expectedChainId: "11155111",
  autoApprove: true,
  anvilWeth: "",
  anvilWbtc: "",
};

export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function resetConfig() {
  localStorage.removeItem(KEY);
  return { ...defaults };
}
