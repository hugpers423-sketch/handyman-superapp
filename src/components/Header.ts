import { useAppStore } from '../store';

export function renderHeader(): string {
  const state = useAppStore.getState();
  return `
    <header class="top" role="banner">
      <div class="brand" aria-label="Handyman Super App">
        <div class="logo-mark" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="var(--accent-lime)"/>
            <path d="M16 8L16 24M8 16H24" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span>HANDYMAN <em>SUPER APP</em></span>
      </div>
      <nav class="role-switch" aria-label="Cambiar vista" role="tablist">
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'cliente'}" 
          data-page="cliente"
          class="${state.currentPage === 'cliente' ? 'active' : ''}"
          id="tab-cliente"
          aria-controls="cliente"
        ><span class="tab-icon" aria-hidden="true">🏠</span> <span>Cliente</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'pro'}" 
          data-page="pro"
          class="${state.currentPage === 'pro' ? 'active' : ''}"
          id="tab-pro"
          aria-controls="pro"
        ><span class="tab-icon" aria-hidden="true">👷</span> <span>Pro</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'ops'}" 
          data-page="ops"
          class="${state.currentPage === 'ops' ? 'active' : ''}"
          id="tab-ops"
          aria-controls="ops"
        ><span class="tab-icon" aria-hidden="true">📊</span> <span>Ops</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'staff'}" 
          data-page="staff"
          class="${state.currentPage === 'staff' ? 'active' : ''}"
          id="tab-staff"
          aria-controls="staff"
        ><span class="tab-icon" aria-hidden="true">👥</span> <span>Staff</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'admin'}" 
          data-page="admin"
          class="${state.currentPage === 'admin' ? 'active' : ''}"
          id="tab-admin"
          aria-controls="admin"
        ><span class="tab-icon" aria-hidden="true">👑</span> <span>Admin</span></button>
      </nav>
      <div class="user-avatar" aria-label="Usuario actual" title="Victor Reyes">
        <span>VR</span>
        <span class="status-dot" aria-hidden="true"></span>
      </div>
    </header>
  `;
}

export function renderFooter(): string {
  const state = useAppStore.getState();
  return `
    <footer class="bottom" role="contentinfo">
      <nav class="bottom-nav" aria-label="Navegación principal" role="tablist">
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'cliente'}" 
          data-page="cliente"
          class="${state.currentPage === 'cliente' ? 'active' : ''}"
          aria-controls="cliente"
        ><span class="nav-icon" aria-hidden="true">🏠</span> <span>Cliente</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'pro'}" 
          data-page="pro"
          class="${state.currentPage === 'pro' ? 'active' : ''}"
          aria-controls="pro"
        ><span class="nav-icon" aria-hidden="true">👷</span> <span>Pro</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'ops'}" 
          data-page="ops"
          class="${state.currentPage === 'ops' ? 'active' : ''}"
          aria-controls="ops"
        ><span class="nav-icon" aria-hidden="true">📊</span> <span>Ops</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'empresa'}" 
          data-page="empresa"
          id="enterpriseTab"
          class="${state.currentPage === 'empresa' ? 'active' : ''}"
          aria-controls="empresa"
        ><span class="nav-icon" aria-hidden="true">🏢</span> <span>Empresa</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'staff'}" 
          data-page="staff"
          class="${state.currentPage === 'staff' ? 'active' : ''}"
          aria-controls="staff"
        ><span class="nav-icon" aria-hidden="true">👥</span> <span>Staff</span></button>
      </nav>
    </footer>
  `;
}