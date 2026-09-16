import { useAppStore } from '../store';

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
        ><span>🏠</span> <span>Cliente</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'pro'}" 
          data-page="pro"
          class="${state.currentPage === 'pro' ? 'active' : ''}"
          aria-controls="pro"
        ><span>👷</span> <span>Pro</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'ops'}" 
          data-page="ops"
          class="${state.currentPage === 'ops' ? 'active' : ''}"
          aria-controls="ops"
        ><span>📊</span> <span>Ops</span></button>
        <button 
          role="tab" 
          aria-selected="${state.currentPage === 'empresa'}" 
          data-page="empresa"
          id="enterpriseTab"
          class="${state.currentPage === 'empresa' ? 'active' : ''}"
          aria-controls="empresa"
        ><span>🏢</span> <span>Empresa</span></button>
      </nav>
    </footer>
  `;
}