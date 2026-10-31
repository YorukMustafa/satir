(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");
  let preference = null;
  try {
    const saved = localStorage.getItem("satir-theme");
    if (saved === "dark" || saved === "light") preference = saved;
  } catch {
    /* Theme switching still works when storage is unavailable. */
  }
  function applyTheme(theme) {
    root.dataset.theme = theme;
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const label = theme === "dark" ? "Açık moda geç" : "Koyu moda geç";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", String(theme === "dark"));
  }
  applyTheme(preference || (systemTheme?.matches ? "dark" : "light"));
  systemTheme?.addEventListener("change", (event) => {
    if (!preference) applyTheme(event.matches ? "dark" : "light");
  });
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.theme);
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      preference = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(preference);
      try {
        localStorage.setItem("satir-theme", preference);
      } catch {
        /* Optional persistence. */
      }
    });
  });
  // Small pointer-driven depth on the decorative notebook; no continuous motion.
  let frame = null;
  let activeArt = null;
  let nextX = 0,
    nextY = 0;
  function resetArt() {
    if (!activeArt) return;
    activeArt.style.removeProperty("--move-x");
    activeArt.style.removeProperty("--move-y");
    activeArt.style.removeProperty("--tilt");
    activeArt = null;
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (reducedMotion?.matches || !finePointer?.matches) return;
      const art = event.target.closest?.(".hero-art");
      if (!art) {
        resetArt();
        return;
      }
      if (art !== activeArt) {
        resetArt();
        activeArt = art;
      }
      const rect = art.getBoundingClientRect();
      nextX = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      );
      nextY = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!activeArt) return;
        activeArt.style.setProperty("--move-x", nextX * 5 + "px");
        activeArt.style.setProperty("--move-y", nextY * 4 + "px");
        activeArt.style.setProperty("--tilt", nextX * 2 + "deg");
      });
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerout",
    (event) => {
      if (activeArt && !activeArt.contains(event.relatedTarget)) resetArt();
    },
    { passive: true },
  );
  reducedMotion?.addEventListener("change", () => {
    if (reducedMotion.matches) resetArt();
  });
})();
