type ToastType = 'info' | 'success' | 'warning';

interface ToastEntry {
  el: HTMLElement;
  timer: number;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 3000;

let container: HTMLElement | null = null;
const toasts: ToastEntry[] = [];

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(container);
  }
  return container;
}

function dismissToast(entry: ToastEntry): void {
  const idx = toasts.indexOf(entry);
  if (idx === -1) return;
  toasts.splice(idx, 1);
  clearTimeout(entry.timer);
  entry.el.classList.remove('toast--visible');
  entry.el.classList.add('toast--dismissing');
  entry.el.addEventListener('transitionend', () => {
    entry.el.remove();
  }, { once: true });
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const parent = ensureContainer();

  // Dismiss oldest if at max
  while (toasts.length >= MAX_VISIBLE) {
    dismissToast(toasts[0]);
  }

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;

  const textEl = document.createElement('span');
  textEl.className = 'toast__text';
  textEl.textContent = message;
  el.appendChild(textEl);

  // Use assertive for warnings so screen readers announce immediately
  parent.setAttribute('aria-live', type === 'warning' ? 'assertive' : 'polite');

  parent.appendChild(el);

  // Force reflow then trigger slide-in transition
  void el.offsetHeight;
  el.classList.add('toast--visible');

  const timer = window.setTimeout(() => {
    dismissToast(entry);
  }, AUTO_DISMISS_MS);

  const entry: ToastEntry = { el, timer };
  toasts.push(entry);
}
