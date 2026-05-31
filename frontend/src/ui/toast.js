const container = () => document.getElementById("toast-container");

export function toast(message, type = "info", durationMs = 5000) {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container()?.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}

export function toastSuccess(message) {
  toast(message, "success");
}

export function toastError(message) {
  toast(message, "error", 8000);
}

export function toastInfo(message) {
  toast(message, "info");
}
