import '../styles/main.css';

if (import.meta.env.DEV) {
  import('../mocks/browser').then(({ worker }) => {
    worker.start({ onUnhandledRequest: 'bypass' }).catch(console.error);
  });
}

import { useAppStore, useAuthStore, navigateTo, showToast, selectService, createRequest, acceptTask, assignUrgent, navigateToSubTab, navigateBackToPro } from '../store';
import { renderHeader } from '../components/Header';
import { renderFooter } from '../components/Footer';
import { renderAdminPage } from '../pages/AdminPage';
import { renderEmpresaPage } from '../pages/EmpresaPage';
import { renderIntro } from '../components/Intro';
import { renderToast } from '../components/Toast';
import { ProtectionAdminDashboard } from '../pages/ProtectionAdminDashboard';

let protectionAdminDashboard: any = null;

async function loadProtectionPages() {
  if (!protectionAdminDashboard) {
    const m = await import('../pages/ProtectionAdminDashboard');
    protectionAdminDashboard = m.ProtectionAdminDashboard;
  }
}

function renderApp() {
  const app = document.getElementById('app')!;
  const state = useAppStore.getState();
  
  app.innerHTML = `
    <div class="shell">
      ${renderHeader()}
      <main id="main-content" role="main">
        <section class="page ${state.currentPage === 'admin' ? 'active' : ''}" id="admin" aria-labelledby="admin-heading">${renderAdminPage()}</section>
        <section class="page ${state.currentPage === 'empresa' ? 'active' : ''}" id="empresa" aria-labelledby="empresa-heading">${renderEmpresaPage()}</section>
        <section class="page ${state.currentPage === 'protection-admin' ? 'active' : ''}" id="protection-admin" aria-labelledby="protection-admin-heading"><div id="protection-admin-root"></div></section>
      </main>
      ${renderFooter()}
    </div>
    ${renderIntro()}
    ${renderToast()}
  `;
  
  if (state.currentPage === 'protection-admin') {
    loadProtectionPages().then(() => {
      if (protectionAdminDashboard) {
        import('preact').then(p => p.render(protectionAdminDashboard(), document.getElementById('protection-admin-root')!));
      }
    });
  }
  
  attachEventListeners();
}

function attachEventListeners() {
  const header = document.querySelector('.top');
  if (header) {
    header.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-page]');
      if (btn) {
        const page = btn.getAttribute('data-page') as 'cliente' | 'pro' | 'ops' | 'empresa' | 'admin';
        if (page) navigateTo(page);
      }
    });
  }

  const footer = document.querySelector('.bottom');
  if (footer) {
    footer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-page]');
      if (btn) {
        const page = btn.getAttribute('data-page') as 'cliente' | 'pro' | 'ops' | 'empresa' | 'admin';
        if (page) navigateTo(page);
      }
    });
  }

  const adminTab = document.getElementById('tab-admin');
  if (adminTab) {
    adminTab.addEventListener('click', () => navigateTo('admin'));
  }

  const enterpriseTab = document.getElementById('enterpriseTab');
  if (enterpriseTab) {
    enterpriseTab.addEventListener('click', () => navigateTo('empresa'));
  }

  const introSkip = document.querySelector('.intro-skip');
  if (introSkip) {
    introSkip.addEventListener('click', () => {
      const intro = document.querySelector('.intro') as HTMLElement;
      if (intro) {
        intro.style.animation = 'none';
        intro.style.opacity = '0';
        intro.style.visibility = 'hidden';
      }
    });
  }
}

useAppStore.subscribe(renderApp);
useAuthStore.subscribe(renderApp);

renderApp();

if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  
  navigator.serviceWorker.ready.then(registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Nueva versión disponible. Recargando...', 'info');
            setTimeout(() => window.location.reload(), 2000);
          }
        });
      }
    });
  });
}

(window as any).navigateTo = navigateTo;
(window as any).showToast = showToast;
(window as any).selectService = selectService;
(window as any).createRequest = createRequest;
(window as any).acceptTask = acceptTask;
(window as any).assignUrgent = assignUrgent;
(window as any).navigateToSubTab = navigateToSubTab;
(window as any).navigateBackToPro = navigateBackToPro;