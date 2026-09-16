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
import { renderClientePage } from '../pages/ClientePage';
import { renderIntro } from '../components/Intro';
import { renderToast } from '../components/Toast';

// Dynamic imports for protection pages (Preact components)
let protectionCoveragePage: any = null;
let protectionContributionsPage: any = null;
let protectionClaimsPage: any = null;

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
}

function renderApp() {
  const app = document.getElementById('app')!;
  const state = useAppStore.getState();
  
  app.innerHTML = `
    <div class="shell">
      ${renderHeader()}
      <main id="main-content" role="main">
        <section class="page ${state.currentPage === 'cliente' ? 'active' : ''}" id="cliente" aria-labelledby="cliente-heading">${renderClientePage()}</section>
        <section class="page ${state.currentPage === 'protection-coverage' ? 'active' : ''}" id="protection-coverage" aria-labelledby="protection-coverage-heading"><div id="protection-coverage-root"></div></section>
        <section class="page ${state.currentPage === 'protection-contributions' ? 'active' : ''}" id="protection-contributions" aria-labelledby="protection-contributions-heading"><div id="protection-contributions-root"></div></section>
        <section class="page ${state.currentPage === 'protection-claims' ? 'active' : ''}" id="protection-claims" aria-labelledby="protection-claims-heading"><div id="protection-claims-root"></div></section>
      </main>
      ${renderFooter()}
    </div>
    ${renderIntro()}
    ${renderToast()}
  `;
  
  // Load protection pages if active
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

  const serviceButtons = document.querySelectorAll('.service');
  serviceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const serviceName = btn.querySelector('b')?.textContent;
      if (serviceName) selectService(serviceName);
    });
  });

  const requestForm = document.getElementById('requestForm');
  if (requestForm) {
    requestForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(requestForm as HTMLFormElement);
      const service = formData.get('service') as string;
      const detail = formData.get('detail') as string;
      createRequest(service, detail);
    });
  }

  const emergencyBtn = document.querySelector('[data-emergency]');
  if (emergencyBtn) {
    emergencyBtn.addEventListener('click', () => {
      const serviceSelect = document.getElementById('service') as HTMLSelectElement;
      const detailTextarea = document.getElementById('detail') as HTMLTextAreaElement;
      if (serviceSelect) serviceSelect.value = 'Gasfitería';
      if (detailTextarea) detailTextarea.value = 'EMERGENCIA: necesito atención prioritaria';
      const requestSection = document.getElementById('request');
      if (requestSection) requestSection.scrollIntoView({ behavior: 'smooth' });
      showToast('Modo emergencia activado. Selecciona el tipo de problema y confirma la dirección.', 'warning');
    });
  }

  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        showToast('Análisis iniciado: identificamos el servicio, urgencia y posible material.');
        setTimeout(() => {
          showToast('Diagnóstico sugerido: Gasfitería · urgencia media · revisar sello y sifón.', 'success');
        }, 1600);
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