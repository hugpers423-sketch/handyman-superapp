import '../styles/main.css';
import '../mobile';

if (import.meta.env.DEV) {
  import('../mocks/browser').then(({ worker }) => {
    worker.start({ onUnhandledRequest: 'bypass' }).catch(console.error);
  });
}

import { useAppStore, useAuthStore, navigateTo, showToast, selectService, createRequest, acceptTask, assignUrgent, navigateToSubTab, navigateBackToPro } from '../store';
import { renderHeader } from '../components/Header';
import { renderFooter } from '../components/Footer';
import { renderProPage } from '../pages/ProPage';
import { renderIntro } from '../components/Intro';
import { renderToast } from '../components/Toast';
import { startService, finishService } from '../store/payment';

let protectionCoveragePage: any = null;
let protectionContributionsPage: any = null;
let protectionClaimsPage: any = null;
let protectionAdminDashboard: any = null;

async function loadProtectionPages() {
  if (!protectionCoveragePage) {
    const m = await import('../pages/ProtectionCoveragePage');
    protectionCoveragePage = m.ProtectionCoveragePage;
  }
  if (!protectionContributionsPage) {
    const m = await import('../pages/ProtectionContributionsPage');
    protectionContributionsPage = m.ProtectionContributionsPage;
  }
  if (!protectionClaimsPage) {
    const m = await import('../pages/ProtectionClaimsPage');
    protectionClaimsPage = m.ProtectionClaimsPage;
  }
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
        <section class="page ${state.currentPage === 'pro' ? 'active' : ''}" id="pro" aria-labelledby="pro-heading">${renderProPage(state.proSubTab)}</section>
        <section class="page ${state.currentPage === 'protection-coverage' ? 'active' : ''}" id="protection-coverage" aria-labelledby="protection-coverage-heading"><div id="protection-coverage-root"></div></section>
        <section class="page ${state.currentPage === 'protection-contributions' ? 'active' : ''}" id="protection-contributions" aria-labelledby="protection-contributions-heading"><div id="protection-contributions-root"></div></section>
        <section class="page ${state.currentPage === 'protection-claims' ? 'active' : ''}" id="protection-claims" aria-labelledby="protection-claims-heading"><div id="protection-claims-root"></div></section>
        <section class="page ${state.currentPage === 'protection-admin' ? 'active' : ''}" id="protection-admin" aria-labelledby="protection-admin-heading"><div id="protection-admin-root"></div></section>
      </main>
      ${renderFooter()}
    </div>
    ${renderIntro()}
    ${renderToast()}
  `;
  
  // Mount protection pages if active
  if (state.currentPage === 'protection-coverage') {
    loadProtectionPages().then(() => {
      if (protectionCoveragePage) {
        import('preact').then(p => p.render(protectionCoveragePage(), document.getElementById('protection-coverage-root')!));
      }
    });
  }
  if (state.currentPage === 'protection-contributions') {
    loadProtectionPages().then(() => {
      if (protectionContributionsPage) {
        import('preact').then(p => p.render(protectionContributionsPage(), document.getElementById('protection-contributions-root')!));
      }
    });
  }
  if (state.currentPage === 'protection-claims') {
    loadProtectionPages().then(() => {
      if (protectionClaimsPage) {
        import('preact').then(p => p.render(protectionClaimsPage(), document.getElementById('protection-claims-root')!));
      }
    });
  }
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
        const page = btn.getAttribute('data-page') as 'cliente' | 'pro' | 'ops' | 'empresa';
        if (page) navigateTo(page);
      }
    });
  }

  const footer = document.querySelector('.bottom');
  if (footer) {
    footer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-page]');
      if (btn) {
        const page = btn.getAttribute('data-page') as 'cliente' | 'pro' | 'ops' | 'empresa';
        if (page) navigateTo(page);
      }
    });
  }

  const enterpriseTab = document.getElementById('enterpriseTab');
  if (enterpriseTab) {
    enterpriseTab.addEventListener('click', () => navigateTo('empresa'));
  }

  const adminTab = document.getElementById('tab-admin');
  if (adminTab) {
    adminTab.addEventListener('click', () => navigateTo('admin'));
  }

  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-pro-tab]');
    if (btn) {
      const tab = btn.getAttribute('data-pro-tab');
      if (tab) navigateToSubTab(tab);
    }
  });

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

  const acceptButtons = document.querySelectorAll('.action[data-task-id]');
  acceptButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-task-id');
      if (taskId) {
        acceptTask(taskId);
        btn.textContent = 'Aceptado ✓';
        btn.classList.add('accepted');
        (btn as HTMLButtonElement).disabled = true;
      }
    });
  });

  const startButtons = document.querySelectorAll('[onclick^="startService"]');
  startButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const match = btn.getAttribute('onclick')?.match(/startService\('([^']+)'\)/);
      if (match) {
        startService(match[1]);
        btn.textContent = 'Iniciado ✓';
        btn.classList.add('accepted');
        (btn as HTMLButtonElement).disabled = true;
        const statusEl = btn.closest('.request-item')?.querySelector('.badge');
        if (statusEl) {
          statusEl.textContent = 'En servicio';
          statusEl.className = 'badge warning';
        }
        showToast('Servicio iniciado. Buen trabajo!', 'success');
      }
    });
  });

  const finishButtons = document.querySelectorAll('[onclick^="finishService"]');
  finishButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const match = btn.getAttribute('onclick')?.match(/finishService\('([^']+)'\)/);
      if (match) {
        finishService(match[1]);
      }
    });
  });

  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        showToast('Evidencia recibida. Procesando...');
        setTimeout(() => showToast('Evidencia validada correctamente.', 'success'), 1200);
      }
    });
  });
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
(window as any).startService = startService;
(window as any).finishService = finishService;
(window as any).navigateToSubTab = navigateToSubTab;
(window as any).navigateBackToPro = navigateBackToPro;