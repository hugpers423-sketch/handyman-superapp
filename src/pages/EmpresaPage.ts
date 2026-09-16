export function renderEmpresaPage(): string {
  return `
    <section class="company-hero" aria-labelledby="empresa-heading">
      <div class="eyebrow" style="color:#c5e9cf">HANDYMAN BUSINESS</div>
      <h2 id="empresa-heading">Una sola plataforma<br>para todas tus sedes.</h2>
      <p>Coordina mantenimiento, emergencias, presupuesto y evidencias de servicio para oficinas, edificios, restaurantes y comercios.</p>
      <button class="primary" onclick="showToast('Solicitud empresarial registrada. Un asesor se comunicará contigo.')">Crear cuenta empresarial →</button>
    </section>

    <div class="metrics" role="region" aria-label="Métricas empresariales">
      <div class="metric">
        <b>08</b>
        <small>Sedes conectadas</small>
      </div>
      <div class="metric">
        <b>32</b>
        <small>Servicios este mes</small>
      </div>
      <div class="metric">
        <b>S/ 8,420</b>
        <small>Ahorro estimado</small>
      </div>
      <div class="metric">
        <b>97%</b>
        <small>SLA cumplido</small>
      </div>
    </div>

    <div class="topline">
      <div>
        <div class="eyebrow">PLANES PARA EMPRESAS</div>
        <h2>Escala sin perder control.</h2>
      </div>
    </div>

    <div class="plans" role="list" aria-label="Planes empresariales">
      <article class="plan" role="listitem">
        <div class="eyebrow">BASE</div>
        <b>Control esencial</b>
        <ul>
          <li>Una sede</li>
          <li>Historial de servicios</li>
          <li>Facturación mensual</li>
          <li>Soporte por email</li>
        </ul>
        <button class="primary" onclick="showToast('Plan Base seleccionado.')" style="width: 100%;">Elegir Base</button>
      </article>
      <article class="plan featured" role="listitem">
        <div class="eyebrow" style="color:#31571d">RECOMENDADO</div>
        <b>Business</b>
        <ul>
          <li>Hasta 10 sedes</li>
          <li>Soporte prioritario 24/7</li>
          <li>Mantenimientos programados</li>
          <li>Aprobaciones por equipo</li>
          <li>Reportes avanzados</li>
          <li>API de integración</li>
        </ul>
        <button class="primary" onclick="showToast('Plan Business seleccionado.')" style="width: 100%;">Elegir Business</button>
      </article>
      <article class="plan" role="listitem">
        <div class="eyebrow">CORPORATE</div>
        <b>Operación crítica</b>
        <ul>
          <li>Sedes ilimitadas</li>
          <li>Gestor dedicado</li>
          <li>Protocolos de emergencia</li>
          <li>Integración y reportes</li>
          <li>SLA garantizado 99.9%</li>
          <li>SSO y auditoría completa</li>
        </ul>
        <button class="secondary" onclick="showToast('Solicitaste una propuesta Corporate.')" style="width: 100%;">Hablar con ventas</button>
      </article>
    </div>

    <div class="card" style="margin-top: 32px">
      <div class="card-title">
        <h3>Mantenimientos programados</h3>
        <span class="eyebrow">PRÓXIMOS 30 DÍAS</span>
      </div>
      <div class="schedule-grid">
        <article class="schedule-card">
          <div class="eyebrow" style="color:#31571d">PREVENTIVO</div>
          <h3>Revisión AC Central</h3>
          <div class="schedule-item">
            <div class="info">
              <b>Sede Principal - Piso 5</b>
              <small>Cada 3 meses · Próximo: 15 Sep</small>
            </div>
            <span class="badge live">Programado</span>
          </div>
          <div class="schedule-item">
            <div class="info">
              <b>Sede Surco - Oficinas</b>
              <small>Cada 6 meses · Próximo: 28 Sep</small>
            </div>
            <span class="badge live">Programado</span>
          </div>
        </article>
        <article class="schedule-card">
          <div class="eyebrow" style="color:#1a5c8a">INSPECCIÓN</div>
          <h3>Sistema contra incendios</h3>
          <div class="schedule-item">
            <div class="info">
              <b>Todas las sedes</b>
              <small>Anual · Próximo: 05 Oct</small>
            </div>
            <span class="badge warning">Próximo</span>
          </div>
        </article>
        <article class="schedule-card">
          <div class="eyebrow" style="color:#8a1a5c">LIMPIEZA</div>
          <h3>Limpieza profunda post-obra</h3>
          <div class="schedule-item">
            <div class="info">
              <b>Sede Nueva - La Molina</b>
              <small>Único · Programado: 22 Sep</small>
            </div>
            <span class="badge live">Confirmado</span>
          </div>
        </article>
      </div>
    </div>

    <div class="card" style="margin-top: 24px">
      <div class="card-title">
        <h3>Facturación consolidada</h3>
        <span class="eyebrow">SEPTIEMBRE 2026</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div style="background: #f8fef9; padding: 20px; border-radius: 5px; border: 1px solid #d8ffeb; text-align: center;">
          <div style="font: 700 32px 'Playfair Display'; color: var(--green);">S/ 12,450</div>
          <div style="color: var(--muted); font-size: 13px; margin-top: 4px;">Total facturado</div>
        </div>
        <div style="background: #fff8e8; padding: 20px; border-radius: 5px; border: 1px solid #f5e6c8; text-align: center;">
          <div style="font: 700 32px 'Playfair Display'; color: var(--gold);">S/ 3,200</div>
          <div style="color: var(--muted); font-size: 13px; margin-top: 4px;">Pendiente pago</div>
        </div>
        <div style="background: #e8f5ff; padding: 20px; border-radius: 5px; border: 1px solid #c5e0ff; text-align: center;">
          <div style="font: 700 32px 'Playfair Display'; color: var(--blue);">S/ 8,420</div>
          <div style="color: var(--muted); font-size: 13px; margin-top: 4px;">Ahorro vs. proveedores</div>
        </div>
      </div>
      <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="primary" onclick="showToast('Descargando reporte PDF...')">Descargar PDF</button>
        <button class="secondary" onclick="showToast('Enviando a contabilidad...')">Enviar a contabilidad</button>
        <button class="secondary" onclick="showToast('Exportando a Excel...')">Exportar Excel</button>
      </div>
    </div>

    <div class="card" style="margin-top: 24px">
      <div class="card-title">
        <h3>Equipo y aprobaciones</h3>
        <span class="eyebrow">12 COLABORADORES</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
        <div style="background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="avatar" style="background: #e3f2fd;">MR</div>
            <div><b>María Rojas</b><small style="color: var(--muted); margin-left: 8px;">Admin</small></div>
          </div>
          <div style="font-size: 13px; color: var(--muted);">Gestiona: Sede Principal, Sede Surco</div>
        </div>
        <div style="background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="avatar" style="background: #fce4ec;">CT</div>
            <div><b>Carlos Torres</b><small style="color: var(--muted); margin-left: 8px;">Supervisor</small></div>
          </div>
          <div style="font-size: 13px; color: var(--muted);">Gestiona: Sede La Molina, Sede Callao</div>
        </div>
        <div style="background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="avatar" style="background: #e8f5e9;">JP</div>
            <div><b>Juan Pérez</b><small style="color: var(--muted); margin-left: 8px;">Solicitante</small></div>
          </div>
          <div style="font-size: 13px; color: var(--muted);">Sede Principal - Mantenimiento</div>
        </div>
      </div>
      <button class="secondary" style="margin-top: 16px;" onclick="showToast('Invitación enviada a nuevo colaborador.')">+ Añadir colaborador</button>
    </div>
  `;
}