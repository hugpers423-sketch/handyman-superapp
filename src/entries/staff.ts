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
import { renderStaffPage } from '../pages/StaffPage';
import { renderIntro } from '../components/Intro';
import { renderToast } from '../components/Toast';

function renderApp() {
  const app = document.getElementById('app')!;
  const state = useAppStore.getState();
  
  app.innerHTML = `
    <div class="shell">
      ${renderHeader()}
      <main id="main-content" role="main">
        <section class="page ${state.currentPage === 'staff' ? 'active' : ''}" id="staff" aria-labelledby="staff-heading">${renderStaffPage()}</section>
      </main>
      ${renderFooter()}
    </div>
    ${renderIntro()}
    ${renderToast()}
  `;
  
  attachEventListeners();
}

function attachEventListeners() {
  const header = document.querySelector('.top');
  if (header) {
    header.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-page]');
      if (btn) {
        const page = btn.getAttribute('data-page') as 'cliente' | 'pro' | 'ops' | 'empresa' | 'staff';
        if (page) navigateTo(page);
      }
    });
  }

  const footer = document.querySelector('.bottom');
  if (footer) {
    footer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-page]');
      if (btn) {
        const page = btn.getAttribute('data-page') as 'cliente' | 'pro' | 'ops' | 'empresa' | 'staff';
        if (page) navigateTo(page);
      }
    });
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

  const assignButtons = document.querySelectorAll('[data-assign-staff]');
  assignButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const staffId = btn.getAttribute('data-assign-staff');
      if (staffId) {
        showToast(`Asignando a staff ${staffId}...`, 'info');
        setTimeout(() => showToast('Staff asignado correctamente', 'success'), 800);
      }
    });
  });

  const teamButtons = document.querySelectorAll('[data-team-action]');
  teamButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-team-action');
      if (action) {
        showToast(`Acción de equipo: ${action}`, 'info');
      }
    });
  });

  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        showToast('Documento recibido. Procesando...');
        setTimeout(() => showToast('Documento validado correctamente.', 'success'), 1200);
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
(window as any).navigateToSubTab = navigateToSubTab;
(window as any).navigateBackToPro = navigateBackToPro;