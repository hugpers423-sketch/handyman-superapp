import { useAppStore } from '../store';

export function renderOpsPage(): string {
  const state = useAppStore.getState();
  
  return `
    <div class="topline">
      <div>
        <div class="eyebrow">CENTRO DE OPERACIONES</div>
        <h2 id="ops-heading">La ciudad está en marcha.</h2>
      </div>
      <button class="primary" onclick="showToast('Reporte ejecutivo generado.')">Descargar reporte</button>
    </div>

    <div class="metrics" role="region" aria-label="Métricas operacionales">
      <div class="metric">
        <b>126</b>
        <small>Servicios activos</small>
        <div class="meter"><i style="width:78%"></i></div>
      </div>
      <div class="metric">
        <b>24 min</b>
        <small>Tiempo de asignación</small>
        <div class="meter"><i style="width:46%" class="orange"></i></div>
      </div>
      <div class="metric">
        <b>94.6%</b>
        <small>Satisfacción</small>
        <div class="meter"><i style="width:95%"></i></div>
      </div>
      <div class="metric">
        <b>18</b>
        <small>Incidencias abiertas</small>
        <div class="meter"><i style="width:31%" class="orange"></i></div>
      </div>
    </div>

    <div class="admin-grid">
      <div class="card">
        <div class="card-title">
          <h3>Control de servicios</h3>
          <span class="eyebrow">ACTUALIZADO AHORA</span>
        </div>
        <table class="table" role="table" aria-label="Servicios activos">
          <thead>
            <tr>
              <th scope="col">Solicitud</th>
              <th scope="col">Profesional</th>
              <th scope="col">Estado</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody id="opsRows">
            ${state.requests.map(req => `
              <tr>
                <td>
                  <b>#${req.id}</b><br>
                  <small>${req.service}: ${req.detail}</small>
                </td>
                <td>${req.professional?.name || 'Sin asignar'}</td>
                <td>
                  <span class="badge ${req.urgency === 'emergency' ? 'urgent' : req.status === 'en_route' ? 'live' : req.status === 'in_progress' ? 'warning' : ''}">
                    ${req.urgency === 'emergency' ? 'URGENTE' : req.status === 'en_route' ? 'EN RUTA' : req.status === 'in_progress' ? 'EN EJECUCIÓN' : req.status === 'assigned' ? 'ASIGNADO' : 'PENDIENTE'}
                  </span>
                </td>
                <td>
                  ${req.urgency === 'emergency' && !req.professional 
                    ? `<button data-assign-urgent="${req.id}" class="primary" style="padding: 8px 12px; font-size: 12px;">Asignar</button>`
                    : `<button class="secondary" style="padding: 8px 12px; font-size: 12px;">Ver</button>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="alert" role="alert">
          <b>Atención requerida:</b> #HM-2841 requiere un gasfitero certificado a menos de 5 km. Activar protocolo de seguridad antes de enviar al profesional.
        </div>
      </div>

      <aside class="ai-box">
        <div class="eyebrow" style="color:#c5e9cf">HANDYMAN INTELLIGENCE</div>
        <h3>Decisiones más rápidas, mejores servicios.</h3>
        <p>Motor preparado para priorizar urgencias, optimizar rutas y predecir demanda.</p>
        <div class="ai-features">
          <div class="ai-feature">
            <b>Priorización inteligente</b>
            <p>Clasifica urgencia real vs. percibida y asigna recursos críticos primero.</p>
          </div>
          <div class="ai-feature">
            <b>Routing dinámico</b>
            <p>Recalcula rutas en tiempo real según tráfico, disponibilidad y cercanía.</p>
          </div>
          <div class="ai-feature">
            <b>Predicción de demanda</b>
            <p>Anticipa picos por zona, clima y estacionalidad para tener pros listos.</p>
          </div>
        </div>
        <button class="primary" style="margin-top: 20px; width: 100%;" onclick="showToast('Módulo IA activado. Entrenando modelos con datos históricos...')">Activar IA completa</button>
      </aside>
    </div>

    <div class="card" style="margin-top: 24px">
      <div class="card-title">
        <h3>Mapa de calor de demanda (Simulado)</h3>
        <span class="eyebrow">ÚLTIMAS 24H</span>
      </div>
      <div style="background: #f5f3eb; border-radius: 5px; padding: 40px; text-align: center; border: 1px solid var(--line);">
        <div style="display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px;">
          <span style="background: #ff4444; width: 20px; height: 20px; border-radius: 4px;"></span>
          <span style="font-size: 12px; color: var(--muted);">Alta (Centro, Miraflores)</span>
          <span style="background: #ffaa00; width: 20px; height: 20px; border-radius: 4px;"></span>
          <span style="font-size: 12px; color: var(--muted);">Media (San Isidro, Surco)</span>
          <span style="background: #69a128; width: 20px; height: 20px; border-radius: 4px;"></span>
          <span style="font-size: 12px; color: var(--muted);">Baja (Periferia)</span>
        </div>
        <p style="color: var(--muted); font-size: 14px;">12 profesionales disponibles en zona alta · 8 en zona media · 3 en zona baja</p>
        <button class="secondary" style="margin-top: 16px;" onclick="showToast('Mapa actualizado. Recomendación: mover 2 pros a Miraflores.')">Actualizar mapa</button>
      </div>
    </div>
  `;
}