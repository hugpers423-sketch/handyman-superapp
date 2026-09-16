import { renderStaffPaymentPanel } from '../components/StaffPaymentPanel';

export function renderStaffPage(): string {
  return `
    <div class="staff-dashboard">
      <header class="staff-header">
        <h1>Panel Staff - Gestión Operativa</h1>
        <div class="staff-user-info">
          <span id="staff-user-name">Cargando...</span>
          <button class="btn-secondary" data-page="cliente">Volver a Cliente</button>
        </div>
      </header>

      <nav class="staff-tabs">
        <button class="staff-tab active" data-staff-tab="asignaciones">📋 Asignaciones</button>
        <button class="staff-tab" data-staff-tab="equipos">👥 Equipos</button>
        <button class="staff-tab" data-staff-tab="reportes">📊 Reportes</button>
        <button class="staff-tab" data-staff-tab="configuracion">⚙️ Configuración</button>
      </nav>

      <main class="staff-content">
        <section id="staff-asignaciones" class="staff-tab-panel active">
          <h2>Asignaciones del Día</h2>
          <div class="filters">
            <select id="staff-filter-status">
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="ASSIGNED">Asignadas</option>
              <option value="IN_PROGRESS">En progreso</option>
              <option value="COMPLETED">Completadas</option>
            </select>
            <input type="date" id="staff-filter-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div id="staff-assignments-list" class="assignments-list">
            <div class="loading">Cargando asignaciones...</div>
          </div>
        </section>

        <section id="staff-equipos" class="staff-tab-panel">
          <h2>Gestión de Equipos</h2>
          <div class="team-actions">
            <button class="btn-primary" id="btn-create-team">+ Crear Equipo</button>
            <button class="btn-secondary" id="btn-assign-staff">Asignar Staff</button>
          </div>
          <div id="staff-teams-list" class="teams-list">
            <div class="loading">Cargando equipos...</div>
          </div>
        </section>

        <section id="staff-reportes" class="staff-tab-panel">
          <h2>Reportes Operativos</h2>
          <div class="report-cards">
            <div class="report-card">
              <h3>Servicios Hoy</h3>
              <p class="metric" id="metric-services-today">0</p>
            </div>
            <div class="report-card">
              <h3>Completados</h3>
              <p class="metric" id="metric-completed">0</p>
            </div>
            <div class="report-card">
              <h3>En Progreso</h3>
              <p class="metric" id="metric-in-progress">0</p>
            </div>
            <div class="report-card">
              <h3>Personal Activo</h3>
              <p class="metric" id="metric-active-staff">0</p>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="staff-performance-chart"></canvas>
          </div>
        </section>

        <section id="staff-configuracion" class="staff-tab-panel">
          <h2>Configuración</h2>
          <div class="config-sections">
            <div class="config-card">
              <h3>Notificaciones</h3>
              <label class="toggle">
                <input type="checkbox" id="config-notif-push" checked>
                <span class="slider"></span>
                Push notifications
              </label>
              <label class="toggle">
                <input type="checkbox" id="config-notif-email">
                <span class="slider"></span>
                Email notifications
              </label>
              <label class="toggle">
                <input type="checkbox" id="config-notif-sms">
                <span class="slider"></span>
                SMS alerts
              </label>
            </div>
            <div class="config-card">
              <h3>Zona de Cobertura</h3>
              <input type="text" id="config-zone" placeholder="Código de zona" class="input-field">
              <button class="btn-primary" id="btn-save-zone">Guardar Zona</button>
            </div>
            <div class="config-card">
              <h3>Turnos</h3>
              <select id="config-shift" class="input-field">
                <option value="morning">Mañana (6:00 - 14:00)</option>
                <option value="afternoon">Tarde (14:00 - 22:00)</option>
                <option value="night">Noche (22:00 - 6:00)</option>
                <option value="full">Día completo</option>
              </select>
            </div>
          </div>
        </section>
      </main>

      <div id="staff-payment-panel-container">
        ${renderStaffPaymentPanel()}
      </div>
    </div>
  `;
}