import { useAppStore } from '../store';
import { getTotalEarnings, getWallet, getProfessionalMembershipInfo } from '../store/payment';

function getWalletStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'var(--blue)';
    case 'free': return 'var(--green)';
    case 'grace_period': return 'var(--orange)';
    case 'suspended': return 'var(--orange)';
    default: return 'var(--muted)';
  }
}

function getWalletStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'live';
    case 'free': return 'featured';
    case 'grace_period': return 'warning';
    case 'suspended': return 'urgent';
    default: return '';
  }
}

function formatWalletStatus(status: string): string {
  switch (status) {
    case 'active': return 'ACTIVO';
    case 'free': return 'GRATIS (Early Adopter)';
    case 'grace_period': return 'PERÍODO GRACIA';
    case 'suspended': return 'SUSPENDIDO';
    default: return status.toUpperCase();
  }
}

const lineColor = 'var(--line)';

const PRO_TABS = [
  { id: 'solicitudes', label: '📋 Solicitudes', icon: '📋' },
  { id: 'proteccion', label: '🛡️ Mi Protección', icon: '🛡️' },
  { id: 'aportes', label: '📊 Mis Aportes', icon: '📊' },
  { id: 'siniestros', label: '📋 Siniestros', icon: '📋' },
] as const;

function renderSolicitudesTab(state: any, totalEarned: number): string {
  const pendingRequests = state.requests.filter((r: any) => r.status === 'pending' || r.status === 'assigned');
  const myRequests = state.requests.filter((r: any) => r.professional?.id === '1');

  return `
    <div class="split" role="tabpanel" id="solicitudes" aria-labelledby="solicitudes">
      <div class="card">
        <div class="card-title">
          <h3>Solicitudes para ti</h3>
          <span class="eyebrow">3 NUEVAS</span>
        </div>
        ${pendingRequests.map((req: any, index: number) => `
          <div class="task" role="listitem">
            <div class="avatar" style="background:${index === 0 ? '#e8f5e9' : index === 1 ? '#e3f2fd' : '#fff8e1'}">${req.client.avatar}</div>
            <div>
              <h4>${req.service}: ${req.detail}</h4>
              <p>${req.client.name} · ${req.location} · ${req.distance || '—'} · ${req.priceRange || '—'}</p>
            </div>
            <span class="badge ${req.urgency === 'emergency' ? 'urgent' : 'live'}">${req.urgency === 'emergency' ? 'URGENTE' : 'HOY'} · ${index === 0 ? '11:30' : index === 1 ? '13:00' : '9:00'}</span>
            <button 
              class="action" 
              data-task-id="${req.id}"
              ${req.status !== 'pending' ? 'disabled' : ''}
              aria-label="${req.status === 'pending' ? 'Aceptar solicitud' : 'Solicitud ya procesada'}"
            >${req.status === 'pending' ? 'Aceptar' : 'Procesando...'}</button>
          </div>
        `).join('')}
      </div>
      <aside class="card goal">
        <div class="eyebrow" style="color:#6f4717">OBJETIVO DE SEPTIEMBRE</div>
        <h3 style="font:700 27px 'Playfair Display';margin:8px 0">S/ ${totalEarned.toFixed(2)}</h3>
        <div class="progress"><i style="width:${Math.min(totalEarned / 2500 * 100, 100)}%"></i></div>
        <p>Te faltan ${Math.ceil((2500 - totalEarned) / 150)} servicios promedio para llegar a tu objetivo mensual.</p>
        <button class="primary" onclick="showToast('Agenda optimizada: se priorizan servicios cercanos y mejor pagados.')">Optimizar agenda →</button>
      </aside>
    </div>

    <div class="card" style="margin-top: 24px">
      <div class="card-title">
        <h3>Tu agenda de hoy</h3>
        <span class="eyebrow">4 SERVICIOS PROGRAMADOS</span>
      </div>
      <div class="request-history" role="list">
        ${myRequests.map((req: any) => `
          <article class="request-item" role="listitem">
            <div class="service-info">
              <h4>${req.service}</h4>
              <p>${req.client.name} · ${req.location} · ${req.time || '10:00'}</p>
            </div>
            <div class="status">
              <span class="badge ${req.status === 'in_progress' ? 'warning' : req.status === 'en_route' ? 'live' : 'live'}">
                ${req.status === 'in_progress' ? 'En servicio' : req.status === 'en_route' ? 'En ruta' : 'Programado'}
              </span>
            </div>
            <div class="actions">
              <button class="secondary" style="padding: 8px 12px; font-size: 12px;">Ver detalles</button>
              ${req.status === 'en_route' ? '<button class="primary" style="padding: 8px 12px; font-size: 12px;" onclick="startService(\'' + req.id + '\')">Iniciar servicio</button>' : ''}
              ${req.status === 'in_progress' ? '<button class="primary" style="padding: 8px 12px; font-size: 12px;" onclick="finishService(\'' + req.id + '\')">Finalizar y cobrar</button>' : ''}
            </div>
          </article>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin-top: 24px">
      <div class="card-title">
        <h3>Calificaciones recientes</h3>
        <span class="eyebrow">PROMEDIO 4.9 ★</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <div style="background: #f8fef9; padding: 20px; border-radius: 5px; border: 1px solid #d8ffeb;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div class="avatar small">AR</div>
            <div><b>Andrea Ruiz</b><small style="color: var(--muted); margin-left: 8px;">Hace 2 días</small></div>
          </div>
          <div style="color: var(--gold); font-size: 18px;">★★★★★</div>
          <p style="color: var(--muted); font-size: 14px; margin: 8px 0 0;">"Jorge llegó puntual, diagnosticó rápido y solucionó el problema del tomacorriente en 30 min. Muy profesional."</p>
        </div>
        <div style="background: #f8fef9; padding: 20px; border-radius: 5px; border: 1px solid #d8ffeb;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div class="avatar small">JL</div>
            <div><b>Javier León</b><small style="color: var(--muted); margin-left: 8px;">Hace 5 días</small></div>
          </div>
          <div style="color: var(--gold); font-size: 18px;">★★★★★</div>
          <p style="color: var(--muted); font-size: 14px; margin: 8px 0 0;">"Excelente servicio de instalación de AC. Limpio, ordenado y explicó todo el funcionamiento."</p>
        </div>
      </div>
    </div>
  `;
}

function renderProteccionTab(): string {
  return `
    <div class="protection-tab" role="tabpanel" id="proteccion" aria-labelledby="proteccion">
      <div class="card">
        <div class="card-title">
          <h3>🛡️ Mi Protección</h3>
          <span class="eyebrow">CCTR - Seguro Colaborador</span>
        </div>
        <p style="margin-bottom: 16px;">Tu red de seguridad: cada trabajo aporta al 3% (mín S/5, máx S/50). 10 trabajos/mes = cobertura total.</p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;">
          <button class="primary" onclick="navigateToSubTab('proteccion')">Ver mi cobertura</button>
          <button class="secondary" onclick="navigateToSubTab('aportes')">Ver mis aportes</button>
          <button class="secondary" onclick="navigateToSubTab('siniestros')">Mis siniestros</button>
        </div>
        <div class="info-box" style="margin-top: 16px;">
          <h4>Coberturas incluidas:</h4>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>🚑 Accidente Laboral: hasta S/50,000</li>
            <li>⚕️ Enfermedad Profesional: hasta S/15,000</li>
            <li>🤕 Invalidez Temporal: hasta S/20,000</li>
            <li>♿ Invalidez Permanente: hasta S/100,000</li>
            <li>👨‍👩‍👧‍👦 Fallecimiento: hasta S/30,000</li>
            <li>⚖️ Responsabilidad Civil: hasta S/20,000</li>
            <li>🔧 Robo de Herramientas: hasta S/5,000</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function renderAportesTab(): string {
  return `
    <div class="protection-tab" role="tabpanel" id="aportes" aria-labelledby="aportes">
      <div class="card">
        <div class="card-title">
          <h3>📊 Mis Aportes</h3>
          <span class="eyebrow">Historial de contribuciones</span>
        </div>
        <p>Cada servicio completado genera tu aporte automático al fondo de protección.</p>
        <button class="primary" onclick="navigateToSubTab('aportes')" style="margin-top: 16px;">Ver historial completo</button>
      </div>
    </div>
  `;
}

function renderSiniestrosTab(): string {
  return `
    <div class="protection-tab" role="tabpanel" id="siniestros" aria-labelledby="siniestros">
      <div class="card">
        <div class="card-title">
          <h3>📋 Mis Siniestros</h3>
          <span class="eyebrow">Gestión de reclamos</span>
        </div>
        <p>Presenta y da seguimiento a tus siniestros: accidentes, enfermedad, invalidez, etc.</p>
        <button class="primary" onclick="navigateToSubTab('siniestros')" style="margin-top: 16px;">Gestionar siniestros</button>
      </div>
    </div>
  `;
}

export function renderProPage(activeSubTab: string = 'solicitudes'): string {
  const state = useAppStore.getState();
  const totalEarned = getTotalEarnings('1');
  const wallet = getWallet('1');
  const membershipInfo = getProfessionalMembershipInfo('1');

  let walletHtml = '';
  if (wallet) {
    const earlyAdopterBorder = membershipInfo.isEarlyAdopter ? 'var(--blue)' : lineColor;
    const earlyAdopterBg = membershipInfo.isEarlyAdopter ? '#e8f5ff' : '#f5f3eb';
    const earlyAdopterColor = membershipInfo.isEarlyAdopter ? 'var(--blue)' : 'var(--muted)';
    const suspendedBg = wallet.membershipStatus === 'suspended' ? '#ffeae8' : '#f5f3eb';
    const suspendedBorder = wallet.membershipStatus === 'suspended' ? 'var(--orange)' : lineColor;
    const suspendedColor = wallet.membershipStatus === 'suspended' ? 'var(--orange)' : 'var(--muted)';
    
    walletHtml = `
    <div class="card wallet-card" style="margin-bottom: 24px; border-left: 4px solid ${getWalletStatusColor(wallet.membershipStatus)};">
      <div class="card-title">
        <h3>Tu Wallet & Membresía</h3>
        <span class="badge ${getWalletStatusBadgeClass(wallet.membershipStatus)}">${formatWalletStatus(wallet.membershipStatus)}</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px;">
        <div style="background: #f8fef9; padding: 16px; border-radius: 8px; border: 1px solid #d8ffeb; text-align: center;">
          <div style="font: 700 28px 'Playfair Display'; color: var(--green);">S/ ${wallet.balance.toFixed(2)}</div>
          <div style="color: var(--muted); font-size: 12px; margin-top: 4px;">Saldo disponible</div>
        </div>
        <div style="background: #fff8e8; padding: 16px; border-radius: 8px; border: 1px solid #f5e6c8; text-align: center;">
          <div style="font: 700 28px 'Playfair Display'; color: var(--gold);">S/ ${wallet.totalEarned.toFixed(2)}</div>
          <div style="color: var(--muted); font-size: 12px; margin-top: 4px;">Total ganado histórico</div>
        </div>
        <div style="background: ${earlyAdopterBg}; padding: 16px; border-radius: 8px; border: 1px solid ${earlyAdopterBorder}; text-align: center;">
          <div style="font: 700 28px 'Playfair Display'; color: ${earlyAdopterColor};">
            ${membershipInfo.isEarlyAdopter ? membershipInfo.monthsUntilFee + ' meses' : 'Sin beneficio'}
          </div>
          <div style="color: var(--muted); font-size: 12px; margin-top: 4px;">${membershipInfo.isEarlyAdopter ? 'Gratis restantes' : 'Early adopter'}</div>
        </div>
        ${membershipInfo.nextFeeDate ? `
        <div style="background: ${suspendedBg}; padding: 16px; border-radius: 8px; border: 1px solid ${suspendedBorder}; text-align: center;">
          <div style="font: 700 28px 'Playfair Display'; color: ${suspendedColor};">
            S/ ${membershipInfo.config.monthlyFee.toFixed(2)}
          </div>
          <div style="color: var(--muted); font-size: 12px; margin-top: 4px;">Próximo cobro: ${new Date(membershipInfo.nextFeeDate).toLocaleDateString('es-PE')}</div>
        </div>
        ` : ''}
      </div>
      ${wallet.membershipStatus !== 'free' && wallet.balance < membershipInfo.config.monthlyFee ? `
        <div style="background: #fff4d4; border: 1px solid #f5e6c8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; color: #976416;">
            <span style="font-size: 20px;">⚠️</span>
            <div>
              <strong>Saldo insuficiente para próximo cobro</strong>
              <p style="margin: 4px 0 0; font-size: 13px;">Recarga tu wallet para evitar suspensión del servicio. Necesitas S/ ${(membershipInfo.config.monthlyFee - wallet.balance).toFixed(2)} más.</p>
            </div>
          </div>
        </div>
      ` : ''}
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="primary" onclick="showToast('Función de recarga próximamente disponible en app móvil')">Recargar Wallet</button>
        <button class="secondary" onclick="showToast('Historial de transacciones y cobros de membresía')">Ver historial</button>
      </div>
    </div>
    `;
  }
  
  const subNavHtml = `
    <nav class="pro-subnav" role="tablist" aria-label="Secciones del profesional">
      ${PRO_TABS.map(tab => `
        <button 
          role="tab" 
          aria-selected="${activeSubTab === tab.id}" 
          data-pro-tab="${tab.id}"
          class="${activeSubTab === tab.id ? 'active' : ''}"
          aria-controls="${tab.id}"
        >${tab.icon} ${tab.label}</button>
      `).join('')}
    </nav>
  `;

  return `
    <div class="topline">
      <div>
        <div class="eyebrow">PANEL DEL PROFESIONAL</div>
        <h2 id="pro-heading">Hola, Jorge.</h2>
      </div>
      <span class="badge featured">PERFIL 100% VERIFICADO</span>
    </div>

    <div class="metrics" role="region" aria-label="Métricas del profesional">
      <div class="metric">
        <b>S/ ${totalEarned.toFixed(2)}</b>
        <small>Ingresos este mes (neto)</small>
        <div class="meter"><i style="width:${Math.min(totalEarned / 5000 * 100, 100)}%"></i></div>
      </div>
      <div class="metric">
        <b>4.9 ★</b>
        <small>Valoración general</small>
        <div class="meter"><i style="width:96%"></i></div>
      </div>
      <div class="metric">
        <b>${state.requests.filter((r: any) => r.professional?.id === '1' && r.status === 'completed').length}</b>
        <small>Servicios completados</small>
        <div class="meter"><i style="width:70%"></i></div>
      </div>
      <div class="metric">
        <b>92%</b>
        <small>Tasa de aceptación</small>
        <div class="meter"><i style="width:92%"></i></div>
      </div>
    </div>

    ${walletHtml}

    ${subNavHtml}

    ${activeSubTab === 'solicitudes' ? renderSolicitudesTab(state, totalEarned) : ''}
    ${activeSubTab === 'proteccion' ? renderProteccionTab() : ''}
    ${activeSubTab === 'aportes' ? renderAportesTab() : ''}
    ${activeSubTab === 'siniestros' ? renderSiniestrosTab() : ''}
  `;
}