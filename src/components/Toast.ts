import { useAppStore } from '../store';

export function renderToast(): string {
  const state = useAppStore.getState();
  const toast = state.toast;
  
  if (!toast) return '<div id="toast" class="toast" role="alert" aria-live="polite"></div>';
  
  return `
    <div id="toast" class="toast ${toast.type} show" role="alert" aria-live="polite">
      ${toast.message}
    </div>
  `;
}