/**
 * Web only: keeps the phone Back button / swipe-back inside the game.
 * A guard history entry sits on top of the real page; every popstate re-arms it and asks the game
 * what Back means right now. Returning 'exit' lets the next Back press actually leave.
 * Electron has no browser history UI, so this is a no-op there.
 */
export type BackResult = 'handled' | 'confirm-exit';

const isDesktopApp = (): boolean => false;

export function installBackGuard(onBack: () => BackResult, isInSortie: () => boolean): void {
  if (isDesktopApp() || !window.history?.pushState) return;
  const toast = document.getElementById('back-toast');
  let armedUntil = 0;
  let leaving = false;
  let toastTimer = 0;

  const depth = (): number => {
    const st = history.state as { oyGuard?: number } | null;
    return st && typeof st.oyGuard === 'number' ? st.oyGuard : 0;
  };
  const push = (): void => {
    try {
      history.pushState({ ...(history.state ?? {}), oyGuard: depth() + 1 }, '');
    } catch {
      // Ignore (sandboxed iframes etc.).
    }
  };
  if (depth() === 0) push();
  // Chrome skips history entries created without a user gesture on Back; re-arm on first interaction.
  const regesture = (): void => {
    window.removeEventListener('pointerdown', regesture, true);
    window.removeEventListener('keydown', regesture, true);
    push();
  };
  window.addEventListener('pointerdown', regesture, true);
  window.addEventListener('keydown', regesture, true);

  window.addEventListener('popstate', () => {
    if (leaving) return;
    const now = performance.now();
    if (now < armedUntil) {
      // Second press within 2 s on the main menu: really leave (unwind every guard entry).
      leaving = true;
      toast?.classList.add('hidden');
      const d = depth();
      if (d > 0) history.go(-d - 1);
      else history.back();
      return;
    }
    if (depth() === 0) push();
    const r = onBack();
    if (r === 'confirm-exit') {
      armedUntil = now + 2000;
      if (toast) {
        toast.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.add('hidden'), 2000);
      }
    } else {
      armedUntil = 0;
    }
  });

  // Reload / close tab / address-bar navigation mid-sortie asks first (browser shows its own dialog).
  window.addEventListener('beforeunload', (e) => {
    if (leaving || !isInSortie()) return;
    e.preventDefault();
    e.returnValue = '';
  });
}
