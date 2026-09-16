import { useAppStore, useAuthStore, hasRole, isAdmin, hasStaffRole, type UserRole, setUserRole, showToast } from '../store';

export function renderAdminPage(): string {
  const authStore = useAuthStore.getState();
  const appStore = useAppStore.getState();
  const isAdminUser = isAdmin();
  const isStaffUser = hasStaffRole();
  
  return `
    <div class="topline">
      <div>
        <div class="eyebrow">Panel de Administración</div>
        <h2>Bienvenido ${authStore.user?.name || ''}</h2>
      </div>
      ${isAdminUser ? `<button class="primary" onclick="showToast('Panel de admin activado')">Modo Admin</button>` : ''}
    </div>

    ${isAdminUser ? `
    <div class="admin-grid">
      <div class="card">
        <div class="card-title">
          <h3>Usuarios del Sistema</h3>
          <span class="eyebrow">Gestión completa</span>
        </div>
        <div style="background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 16px;">
          <select id="userRoleFilter" onchange="filterUsersByRole(this.value)" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--line);">
            <option value="all">Todos los roles</option>
            <option value="admin">Admin General</option>
            <option value="staff">Staff</option>
            <option value="pro">Profesionales</option>
            <option value="cliente">Clientes</option>
          </select>
          <p style="margin: 10px 0 0; font-size: 12px; color: var(--muted);">Filtrar por rol</p>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">
          <h3>Estadísticas Generales</h3>
          <span class="eyebrow">Resumen del sistema</span>
        </div>
        <div class="metrics" style="gap: 20px;">
          <div class="metric">
            <b>Total Usuarios</b>
            <small>Conteo general</small>
            <div class="meter"><i style="width: 80%"></i></div>
          </div>
          <div class="metric">
            <b>Servicios Hoy</b>
            <small>Total procesado</small>
            <div class="meter"><i style="width: 65%"></i></div>
          </div>
          <div class="metric">
            <b>Ingresos Mes</b>
            <small>S/ 18,400</small>
            <div class="meter"><i style="width: 72%"></i></div>
          </div>
          <div class="metric">
            <b>SLA Cumplido</b>
            <small>94.6%</small>
            <div class="meter"><i style="width: 95%"></i></div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}
    
    ${isStaffUser ? `
    <div class="card" style="margin-top: 24px;">
      <div class="card-title">
        <h3>Panel de Staff</h3>
        <span class="eyebrow">Herramientas de operaciones</span>
      </div>
      <div style="background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 20px;">
        <button class="primary" style="width: 100%; padding: 12px; margin-bottom: 12px;" onclick="showToast('Herramientas de staff activadas')">Asignar Solicitudes</button>
        <button class="primary" style="width: 100%; padding: 12px; margin-bottom: 12px;" onclick="showToast('Modo staff activado - vista optimizada')">Ver Mapa de Asignación</button>
        <button class="secondary" style="width: 100%; padding: 12px;" onclick="showToast('Panel de staff cerrado')">Cerrar Panel</button>
      </div>
    </div>
    ` : ''}

    <div class="card" style="margin-top: 24px;">
      <div class="card-title">
        <h3>Roles y Permisos</h3>
        <span class="eyebrow">Configuración de acceso</span>
      </div>
      <div style="background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 20px;">
        <div style="margin: 12px 0;">
          <strong>Rol Actual:</strong> ${authStore.user?.role || 'ninguno'}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0;">
          <div>
            <input type="radio" id="role-cliente" name="role-switch" ${authStore.user?.role === 'cliente' ? 'checked' : ''} onchange="setRole('cliente')">
            <label for="role-cliente">Cliente</label>
          </div>
          <div>
            <input type="radio" id="role-pro" name="role-switch" ${authStore.user?.role === 'pro' ? 'checked' : ''} onchange="setRole('pro')">
            <label for="role-pro">Profesional</label>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0;">
          <div>
            <input type="radio" id="role-staff" name="role-switch" ${authStore.user?.role === 'staff' ? 'checked' : ''} onchange="setRole('staff')">
            <label for="role-staff">Staff</label>
          </div>
          <div>
            <input type="radio" id="role-admin" name="role-switch" ${authStore.user?.role === 'admin' ? 'checked' : ''} onchange="setRole('admin')">
            <label for="role-admin">Admin General</label>
          </div>
        </div>
        <p style="margin: 16px 0 0; font-size: 12px; color: var(--muted);">
          Los cambios requieren re-autenticación
        </p>
      </div>
    </div>
  `;
}

function setRole(role: UserRole) {
  setUserRole(role);
  showToast(`Cambio a rol: ${role}`);
  window.location.href = window.location.href;
}