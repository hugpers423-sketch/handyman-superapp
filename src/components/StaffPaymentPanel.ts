import { 
  usePaymentStore, 
  getPaymentConfigs, 
  getStaffUsers, 
  updatePaymentConfig, 
  togglePaymentConfig, 
  setActivePaymentConfig, 
  getTotalCommissions, 
  getPlatformRevenue, 
  generateYapePlinQR,
  getMembershipConfig,
  updateMembershipConfig,
  getAllWallets,
  getRecharges,
  getFeeDeductions,
  rechargeWallet,
  deductAllMonthlyFees,
  getProfessionalMembershipInfo
} from '../store/payment';
import { useAppStore, showToast } from '../store';
import QRCode from 'qrcode';
import type { PaymentConfig, PaymentMethod, MembershipConfig } from '../types';

export function renderStaffPaymentPanel(): string {
  const configs = getPaymentConfigs();
  const staff = getStaffUsers();
  const totalCommissions = getTotalCommissions();
  const platformRevenue = getPlatformRevenue();
  const membershipConfig = getMembershipConfig();
  const wallets = getAllWallets();
  const recharges = getRecharges();
  const feeDeductions = getFeeDeductions();

  const totalWalletsBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const activeMembers = wallets.filter(w => w.membershipStatus === 'active').length;
  const suspendedMembers = wallets.filter(w => w.membershipStatus === 'suspended').length;
  const gracePeriodMembers = wallets.filter(w => w.membershipStatus === 'grace_period').length;
  const freeMembers = wallets.filter(w => w.membershipStatus === 'free').length;

  return `
    <section class="staff-payment-panel" aria-labelledby="staff-payment-title">
      <div class="topline">
        <div>
          <div class="eyebrow">PANEL STAFF</div>
          <h2 id="staff-payment-title">Gestión de Pagos, QR y Membresías</h2>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="primary" onclick="openAddPaymentConfig()">+ Config QR</button>
          <button class="secondary" onclick="runMonthlyFeeDeduction()">💰 Cobrar membresías</button>
        </div>
      </div>

      <div class="metrics" role="region" aria-label="Métricas de pagos">
        <div class="metric">
          <b>S/ ${totalCommissions.toFixed(2)}</b>
          <small>Comisiones transacciones (15%)</small>
          <div class="meter"><i style="width:${Math.min(totalCommissions / 10000 * 100, 100)}%"></i></div>
        </div>
        <div class="metric">
          <b>S/ ${platformRevenue.toFixed(2)}</b>
          <small>Revenue plataforma (3%)</small>
          <div class="meter"><i style="width:${Math.min(platformRevenue / 5000 * 100, 100)}%"></i></div>
        </div>
        <div class="metric">
          <b>S/ ${totalWalletsBalance.toFixed(2)}</b>
          <small>Saldo total wallets</small>
          <div class="meter"><i style="width:${Math.min(totalWalletsBalance / 5000 * 100, 100)}%"></i></div>
        </div>
        <div class="metric">
          <b>${membershipConfig.monthlyFee.toFixed(2)}</b>
          <small>Fee mensual configurado</small>
          <div class="meter"><i style="width:100%"></i></div>
        </div>
      </div>

      <div class="metrics" style="margin-bottom: 24px;" role="region" aria-label="Estado de membresías">
        <div class="metric">
          <b>${freeMembers}</b>
          <small>Gratis (early adopters)</small>
          <div class="meter"><i style="width:${wallets.length ? freeMembers / wallets.length * 100 : 0}%" style="background: var(--green)"></i></div>
        </div>
        <div class="metric">
          <b>${activeMembers}</b>
          <small>Activos pagando</small>
          <div class="meter"><i style="width:${wallets.length ? activeMembers / wallets.length * 100 : 0}%" style="background: var(--blue)"></i></div>
        </div>
        <div class="metric">
          <b>${gracePeriodMembers}</b>
          <small>Período gracia</small>
          <div class="meter"><i style="width:${wallets.length ? gracePeriodMembers / wallets.length * 100 : 0}%" style="background: var(--orange)"></i></div>
        </div>
        <div class="metric">
          <b>${suspendedMembers}</b>
          <small>Suspendidos</small>
          <div class="meter"><i style="width:${wallets.length ? suspendedMembers / wallets.length * 100 : 0}%" style="background: var(--orange)"></i></div>
        </div>
      </div>

      <div class="split">
        <div class="card">
          <div class="card-title">
            <h3>Configuración de Membresía</h3>
          </div>
          <div class="membership-config-card">
            <div class="config-details">
              <div class="detail-row">
                <label>Meses gratis early adopters</label>
                <input type="number" min="0" max="12" step="1" value="${membershipConfig.earlyAdopterMonthsFree}" onchange="updateMembershipField('earlyAdopterMonthsFree', parseInt(this.value))" style="width: 80px;">
              </div>
              <div class="detail-row">
                <label>Fecha corte early adopters</label>
                <input type="date" value="${new Date(membershipConfig.earlyAdopterCutoffDate).toISOString().split('T')[0]}" onchange="updateMembershipField('earlyAdopterCutoffDate', new Date(this.value).toISOString())" style="width: 180px;">
              </div>
              <div class="detail-row">
                <label>Fee mensual (S/)</label>
                <input type="number" min="0" max="500" step="0.5" value="${membershipConfig.monthlyFee}" onchange="updateMembershipField('monthlyFee', parseFloat(this.value))" style="width: 100px;">
              </div>
              <div class="detail-row">
                <label>Días período gracia</label>
                <input type="number" min="0" max="30" step="1" value="${membershipConfig.gracePeriodDays}" onchange="updateMembershipField('gracePeriodDays', parseInt(this.value))" style="width: 80px;">
              </div>
              <div class="detail-row">
                <label>
                  <input type="checkbox" ${membershipConfig.isActive ? 'checked' : ''} onchange="updateMembershipField('isActive', this.checked)">
                  Membresía activa
                </label>
              </div>
            </div>
            <div class="config-meta">
              <small>Actualizado: ${new Date(membershipConfig.updatedAt).toLocaleString('es-PE')} por ${membershipConfig.updatedBy}</small>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <h3>Configuraciones de Pago (QR Yape/Plin)</h3>
          </div>
          <div class="config-list">
            ${configs.map(config => renderConfigCard(config)).join('')}
          </div>
        </div>
      </div>

      <div class="split">
        <div class="card">
          <div class="card-title">
            <h3>Wallets de Profesionales</h3>
          </div>
          <div class="wallet-table-container">
            <table class="table" role="table">
              <thead>
                <tr>
                  <th scope="col">Profesional</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Total ganado</th>
                  <th scope="col">Estado membresía</th>
                  <th scope="col">Meses gratis</th>
                  <th scope="col">Próximo cobro</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${wallets.map(wallet => {
                  const info = getProfessionalMembershipInfo(wallet.professionalId);
                  const pro = useAppStore.getState().professionals.find(p => p.id === wallet.professionalId);
                  return `
                    <tr class="${wallet.membershipStatus === 'suspended' ? 'suspended' : ''}">
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div class="avatar small">${pro?.avatar || '?'}</div>
                          <div><b>${pro?.name || wallet.professionalId}</b></div>
                        </div>
                      </td>
                      <td><b>S/ ${wallet.balance.toFixed(2)}</b></td>
                      <td>S/ ${wallet.totalEarned.toFixed(2)}</td>
                      <td><span class="badge ${getStatusBadgeClass(wallet.membershipStatus)}">${formatMembershipStatus(wallet.membershipStatus)}</span></td>
                      <td>${wallet.freeMonthsUsed}/${wallet.freeMonthsTotal}</td>
                      <td>${info.nextFeeDate ? new Date(info.nextFeeDate).toLocaleDateString('es-PE') : '—'}</td>
                      <td>
                        <button class="secondary" style="padding: 6px 10px; font-size: 11px;" onclick="openRechargeModal('${wallet.professionalId}')">💳 Recargar</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <h3>Historial Recargas</h3>
          </div>
          <div class="transaction-table-container">
            <table class="table" role="table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">Monto</th>
                  <th scope="col">Método</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${recharges.slice(0, 15).map(r => {
                  const pro = useAppStore.getState().professionals.find(p => p.id === r.professionalId);
                  return `
                    <tr>
                      <td><code>${r.id}</code></td>
                      <td>${pro?.name || r.professionalId}</td>
                      <td>S/ ${r.amount.toFixed(2)}</td>
                      <td><span class="method-badge ${r.method}">${r.method.toUpperCase()}</span></td>
                      <td><span class="badge ${r.status === 'completed' ? 'live' : 'warning'}">${r.status}</span></td>
                      <td>${r.completedAt ? new Date(r.completedAt).toLocaleDateString('es-PE') : '—'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <div class="card-title">
          <h3>Cobros de Membresía</h3>
        </div>
        <div class="transaction-table-container">
          <table class="table" role="table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Profesional</th>
                <th scope="col">Monto</th>
                <th scope="col">Período</th>
                <th scope="col">Estado</th>
                <th scope="col">Saldo posterior</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${feeDeductions.slice(0, 15).map(f => {
                const pro = useAppStore.getState().professionals.find(p => p.id === f.professionalId);
                return `
                  <tr>
                    <td><code>${f.id}</code></td>
                    <td>${pro?.name || f.professionalId}</td>
                    <td>S/ ${f.amount.toFixed(2)}</td>
                    <td>${new Date(f.periodStart).toLocaleDateString('es-PE')} - ${new Date(f.periodEnd).toLocaleDateString('es-PE')}</td>
                    <td><span class="badge ${f.status === 'completed' ? 'live' : 'warning'}">${f.status}</span></td>
                    <td>S/ ${f.walletBalanceAfter.toFixed(2)}</td>
                    <td>${f.deductedAt ? new Date(f.deductedAt).toLocaleDateString('es-PE') : '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top: 24px">
        <div class="card-title">
          <h3>Equipo Staff</h3>
        </div>
        <div class="staff-grid">
          ${staff.map(member => `
            <div class="staff-card">
              <div class="staff-avatar">${member.avatar}</div>
              <div class="staff-info">
                <h4>${member.name}</h4>
                <small>${member.email}</small>
                <div class="staff-role ${member.role}">${member.role.toUpperCase()}</div>
              </div>
              <div class="staff-permissions">
                ${member.permissions.map(p => `<span class="permission-tag">${p}</span>`).join('')}
              </div>
              <div class="staff-last-login">Último: ${new Date(member.lastLogin).toLocaleDateString('es-PE')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    ${renderAddConfigModal()}
    ${renderRechargeModal()}
  `;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'live';
    case 'free': return 'featured';
    case 'grace_period': return 'warning';
    case 'suspended': return 'urgent';
    default: return '';
  }
}

function formatMembershipStatus(status: string): string {
  switch (status) {
    case 'active': return 'ACTIVO';
    case 'free': return 'GRATIS (Early)';
    case 'grace_period': return 'GRACIA';
    case 'suspended': return 'SUSPENDIDO';
    default: return status.toUpperCase();
  }
}

function renderConfigCard(config: PaymentConfig): string {
  const qrPreview = config.qrCodeImage 
    ? `<img src="${config.qrCodeImage}" alt="QR Preview" class="qr-preview">`
    : '<div class="qr-preview placeholder">Sin QR generado</div>';

  return `
    <article class="config-card ${config.isActive ? 'active' : 'inactive'}" data-config-id="${config.id}">
      <div class="config-header">
        <div class="config-method ${config.method}">${config.method.toUpperCase()}</div>
        <div class="config-status">
          <span class="badge ${config.isActive ? 'live' : 'warning'}">${config.isActive ? 'ACTIVO' : 'INACTIVO'}</span>
          ${config.id === usePaymentStore.getState().activeConfigId ? '<span class="badge featured">PREDETERMINADO</span>' : ''}
        </div>
      </div>
      
      <div class="config-body">
        <div class="config-qr-preview">${qrPreview}</div>
        
        <div class="config-details">
          <div class="detail-row">
            <label>Nombre del negocio</label>
            <input type="text" value="${config.businessName}" onchange="updateConfigField('${config.id}', 'businessName', this.value)">
          </div>
          <div class="detail-row">
            <label>Teléfono (Yape/Plin)</label>
            <input type="tel" value="${config.phoneNumber}" onchange="updateConfigField('${config.id}', 'phoneNumber', this.value)" placeholder="999888777">
          </div>
          <div class="detail-row">
            <label>Comisión transacción (%)</label>
            <input type="number" min="0" max="50" step="0.5" value="${config.commissionRate * 100}" onchange="updateConfigField('${config.id}', 'commissionRate', this.value / 100)" style="width: 100px;">
          </div>
        </div>
        
        <div class="config-actions">
          <button class="secondary btn-regenerate-qr" onclick="regenerateQR('${config.id}')" ${!config.isActive ? 'disabled' : ''}>
            🔄 Regenerar QR
          </button>
          <button class="${config.isActive ? 'secondary' : 'primary'}" onclick="toggleConfig('${config.id}')">
            ${config.isActive ? 'Desactivar' : 'Activar'}
          </button>
          ${config.id !== usePaymentStore.getState().activeConfigId ? `
            <button class="secondary" onclick="setAsDefault('${config.id}')">
              ⭐ Predeterminado
            </button>
          ` : ''}
        </div>
        
        <div class="config-meta">
          <small>Actualizado: ${new Date(config.updatedAt).toLocaleString('es-PE')} por ${config.updatedBy}</small>
        </div>
      </div>
    </article>
  `;
}

function renderAddConfigModal(): string {
  return `
    <div class="modal-overlay" id="add-config-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="add-config-title">
      <div class="modal-container">
        <header class="modal-header">
          <h3 id="add-config-title">Nueva configuración de pago</h3>
          <button class="modal-close" onclick="closeAddConfigModal()" aria-label="Cerrar">✕</button>
        </header>
        <form class="modal-form" onsubmit="submitAddConfig(event)">
          <div class="form-group">
            <label>Método de pago</label>
            <select name="method" required>
              <option value="yape">Yape</option>
              <option value="plin">Plin</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nombre del negocio</label>
            <input type="text" name="businessName" value="HANDYMAN PERÚ" required>
          </div>
          <div class="form-group">
            <label>Teléfono asociado</label>
            <input type="tel" name="phoneNumber" placeholder="999888777" required pattern="[0-9]{9}">
          </div>
          <div class="form-group">
            <label>Comisión transacción (%)</label>
            <input type="number" name="commissionRate" min="0" max="50" step="0.5" value="15" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary">Crear configuración</button>
            <button type="button" class="secondary" onclick="closeAddConfigModal()">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderRechargeModal(): string {
  return `
    <div class="modal-overlay" id="recharge-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="recharge-title">
      <div class="modal-container">
        <header class="modal-header">
          <h3 id="recharge-title">Recargar Wallet Profesional</h3>
          <button class="modal-close" onclick="closeRechargeModal()" aria-label="Cerrar">✕</button>
        </header>
        <form class="modal-form" onsubmit="submitRecharge(event)">
          <input type="hidden" id="recharge-professional-id" name="professionalId">
          <div class="form-group">
            <label>Profesional</label>
            <select id="recharge-professional-select" name="professionalId" required>
              ${useAppStore.getState().professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Monto (S/)</label>
            <input type="number" name="amount" min="10" max="5000" step="0.5" value="50" required>
          </div>
          <div class="form-group">
            <label>Método</label>
            <select name="method" required>
              <option value="yape">Yape</option>
              <option value="plin">Plin</option>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary">Recargar</button>
            <button type="button" class="secondary" onclick="closeRechargeModal()">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

(window as any).updateConfigField = function(configId: string, field: keyof PaymentConfig, value: any) {
  if (field === 'commissionRate') value = parseFloat(value) / 100;
  updatePaymentConfig(configId, { [field]: value }, 'staff-current');
};

(window as any).updateMembershipField = function(field: keyof MembershipConfig, value: any) {
  updateMembershipConfig({ [field]: value }, 'staff-current');
  renderStaffPanel();
};

(window as any).toggleConfig = function(configId: string) {
  togglePaymentConfig(configId, 'staff-current');
  renderStaffPanel();
};

(window as any).setAsDefault = function(configId: string) {
  setActivePaymentConfig(configId);
  renderStaffPanel();
};

(window as any).regenerateQR = async function(configId: string) {
  const configs = getPaymentConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config) return;

  const testAmount = 150;
  const reference = 'TEST-REGENERATE';
  const qrString = generateYapePlinQR(config.method, config.phoneNumber, testAmount, config.businessName, reference);
  const qrDataUrl = await QRCode.toDataURL(qrString, { width: 300, margin: 2, color: { dark: '#0a2922', light: '#ffffff' } });
  
  updatePaymentConfig(configId, { qrCodeData: qrString, qrCodeImage: qrDataUrl }, 'staff-current');
  renderStaffPanel();
};

(window as any).openAddPaymentConfig = function() {
  document.getElementById('add-config-modal')!.style.display = 'flex';
};

(window as any).closeAddConfigModal = function() {
  document.getElementById('add-config-modal')!.style.display = 'none';
};

(window as any).submitAddConfig = async function(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  
  const newConfig = {
    method: formData.get('method') as PaymentMethod,
    businessName: formData.get('businessName') as string,
    phoneNumber: formData.get('phoneNumber') as string,
    commissionRate: parseFloat(formData.get('commissionRate') as string) / 100,
    isActive: true
  };

  const testAmount = 150;
  const reference = 'TEST-INITIAL';
  const qrString = generateYapePlinQR(newConfig.method, newConfig.phoneNumber, testAmount, newConfig.businessName, reference);
  const qrDataUrl = await QRCode.toDataURL(qrString, { width: 300, margin: 2, color: { dark: '#0a2922', light: '#ffffff' } });

  usePaymentStore.setState(s => ({
    paymentConfigs: [...s.paymentConfigs, {
      id: `config-${Date.now()}`,
      ...newConfig,
      qrCodeData: qrString,
      qrCodeImage: qrDataUrl,
      updatedAt: new Date(),
      updatedBy: 'staff-current'
    }]
  }));

  (window as any).closeAddConfigModal();
  renderStaffPanel();
};

(window as any).openRechargeModal = function(professionalId: string) {
  const modal = document.getElementById('recharge-modal');
  if (modal) {
    const select = document.getElementById('recharge-professional-select') as HTMLSelectElement;
    if (select) select.value = professionalId;
    modal.style.display = 'flex';
  }
};

(window as any).closeRechargeModal = function() {
  document.getElementById('recharge-modal')!.style.display = 'none';
};

(window as any).submitRecharge = async function(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  
  const professionalId = formData.get('professionalId') as string;
  const amount = parseFloat(formData.get('amount') as string);
  const method = formData.get('method') as PaymentMethod;
  
  rechargeWallet(professionalId, amount, method, 'staff-current');
  (window as any).closeRechargeModal();
  renderStaffPanel();
};

(window as any).runMonthlyFeeDeduction = function() {
  const results = deductAllMonthlyFees();
  if (results.length > 0) {
    showToast(`Se cobró membresía a ${results.length} profesionales por S/ ${results.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`, 'success');
  } else {
    showToast('No hay profesionales elegibles para cobro de membresía este mes', 'info');
  }
  renderStaffPanel();
};

function renderStaffPanel() {
  const container = document.getElementById('staff-payment-panel-container');
  if (container) container.innerHTML = renderStaffPaymentPanel();
}

// Need to import getProfessionalMembershipInfo
// import { getProfessionalMembershipInfo } from '../store/payment';
// import { useAppStore } from '../store';