import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useAppStore, useAuthStore, api, showToast, formatCurrency, formatDate, hasRole } from '../store';

export function ProtectionAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'configs' | 'claims' | 'contributions'>('dashboard');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    contributionRate: 0.03,
    minContribution: 5,
    maxContribution: 50,
    coverageDetails: [] as any[],
    minJobsForFullCover: 10,
    waitingPeriodDays: 30,
    isActive: true,
    isDefault: false,
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, configsRes, claimsRes] = await Promise.all([
        api.get<{ data: { stats: any } }>('/protection/admin/dashboard'),
        api.get<{ data: { configs: any[] } }>('/protection/admin/configs'),
        api.get<{ data: { claims: any[] } }>('/protection/admin/claims?limit=20'),
      ]);
      setStats(statsRes.data.stats);
      setConfigs(configsRes.data.configs);
      setClaims(claimsRes.data.claims);
    } catch (e) {
      showToast('Error al cargar dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openConfigModal = (config?: any) => {
    if (config) {
      setEditingConfig(config);
      setConfigForm({
        name: config.name,
        description: config.description || '',
        contributionRate: config.contributionRate,
        minContribution: config.minContribution,
        maxContribution: config.maxContribution,
        coverageDetails: config.coverageDetails || [],
        minJobsForFullCover: config.minJobsForFullCover,
        waitingPeriodDays: config.waitingPeriodDays,
        isActive: config.isActive,
        isDefault: config.isDefault,
      });
    } else {
      setEditingConfig(null);
      setConfigForm({
        name: '',
        description: '',
        contributionRate: 0.03,
        minContribution: 5,
        maxContribution: 50,
        coverageDetails: [],
        minJobsForFullCover: 10,
        waitingPeriodDays: 30,
        isActive: true,
        isDefault: false,
      });
    }
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    try {
      if (editingConfig) {
        await api.patch(`/protection/admin/configs/${editingConfig.id}`, configForm);
        showToast('Configuración actualizada', 'success');
      } else {
        await api.post('/protection/admin/configs', configForm);
        showToast('Configuración creada', 'success');
      }
      setShowConfigModal(false);
      loadAll();
    } catch (e) {
      showToast('Error al guardar', 'error');
    }
  };

  const handleReviewClaim = async (claimId: string, status: string, amountApproved?: number) => {
    try {
      await api.patch(`/protection/admin/claims/${claimId}/review`, { status, amountApproved });
      showToast(`Siniestro ${status.toLowerCase()}`, 'success');
      loadAll();
    } catch (e) {
      showToast('Error al revisar', 'error');
    }
  };

  if (loading) return <div class="page-loader">Cargando protección...</div>;

  const userRole = useAuthStore.getState().user?.role;

  return (
    <div class="page protection-admin">
      <header class="top">
        <div class="brand">
          <div class="logo-mark">🛡️</div>
          <span>ADMIN PROTECCIÓN</span>
        </div>
      </header>

      <main class="content">
        {/* Tabs */}
        <div class="admin-tabs">
          <button class={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
          <button class={activeTab === 'configs' ? 'active' : ''} onClick={() => setActiveTab('configs')}>⚙️ Configuraciones</button>
          <button class={activeTab === 'claims' ? 'active' : ''} onClick={() => setActiveTab('claims')}>📋 Siniestros</button>
          <button class={activeTab === 'contributions' ? 'active' : ''} onClick={() => setActiveTab('contributions')}>💰 Aportes</button>
        </div>

        {activeTab === 'dashboard' && <DashboardTab stats={stats} />}
        {activeTab === 'configs' && <ConfigsTab configs={configs} onEdit={openConfigModal} />}
        {activeTab === 'claims' && <ClaimsTab claims={claims} onReview={handleReviewClaim} />}
        {activeTab === 'contributions' && <ContributionsTab />}
      </main>

      {/* Modal Config */}
      {showConfigModal && (
        <div class="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div class="modal large" onClick={e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>{editingConfig ? 'Editar' : 'Nueva'} Configuración</h3>
              <button class="modal-close" onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleSaveConfig(); }} class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label>Nombre *</label>
                  <input value={configForm.name} onChange={(e: any) => setConfigForm({...configForm, name: e.target.value})} required />
                </div>
                <div class="form-group">
                  <label>% por trabajo *</label>
                  <input type="number" step="0.001" min="0" max="0.1" value={configForm.contributionRate} onChange={(e: any) => setConfigForm({...configForm, contributionRate: parseFloat(e.target.value)})} required />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Mínimo por trabajo (S/)</label>
                  <input type="number" step="0.01" min="0" value={configForm.minContribution} onChange={(e: any) => setConfigForm({...configForm, minContribution: parseFloat(e.target.value)})} />
                </div>
                <div class="form-group">
                  <label>Máximo por trabajo (S/)</label>
                  <input type="number" step="0.01" min="0" value={configForm.maxContribution} onChange={(e: any) => setConfigForm({...configForm, maxContribution: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Trabajos/mes para cobertura total</label>
                  <input type="number" min="1" value={configForm.minJobsForFullCover} onChange={(e: any) => setConfigForm({...configForm, minJobsForFullCover: parseInt(e.target.value)})} />
                </div>
                <div class="form-group">
                  <label>Días de carencia</label>
                  <input type="number" min="0" value={configForm.waitingPeriodDays} onChange={(e: any) => setConfigForm({...configForm, waitingPeriodDays: parseInt(e.target.value)})} />
                </div>
              </div>
              <div class="form-group">
                <label>Descripción</label>
                <textarea value={configForm.description} onChange={(e: any) => setConfigForm({...configForm, description: e.target.value})} rows={2} />
              </div>
              <div class="form-group">
                <label>Coberturas (JSON)</label>
                <textarea value={JSON.stringify(configForm.coverageDetails, null, 2)} onChange={(e: any) => { try { setConfigForm({...configForm, coverageDetails: JSON.parse(e.target.value) }); } catch {} }} rows={6} style="font-family: monospace; font-size: 12px;" />
              </div>
              <div class="form-row checkbox-row">
                <label><input type="checkbox" checked={configForm.isActive} onChange={(e: any) => setConfigForm({...configForm, isActive: e.target.checked})} /> Activa</label>
                <label><input type="checkbox" checked={configForm.isDefault} onChange={(e: any) => setConfigForm({...configForm, isDefault: e.target.checked})} /> Por defecto</label>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn-secondary" onClick={() => setShowConfigModal(false)}>Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardTab({ stats }: { stats: any }) {
  if (!stats) return <div class="loading">Cargando...</div>;

  return (
    <div class="dashboard-tab">
      <div class="stats-grid">
        <StatCard title="Configuraciones" value={stats.configs.total} subtitle={`Activas: ${stats.configs.active}`} icon="⚙️" />
        <StatCard title="Colaboradores Cubiertos" value={stats.coverages.total} subtitle={`Activos: ${stats.coverages.active} | Suspendidos: ${stats.coverages.suspended}`} icon="👷" />
        <StatCard title="Aportes Totales" value={stats.contributions.total} subtitle={`Este mes: ${stats.contributions.thisMonth}`} icon="💰" />
        <StatCard title="Siniestros" value={stats.claims.total} subtitle={`Pendientes: ${stats.claims.pending} | Aprobados: ${stats.claims.approved} | Pagados: ${stats.claims.paid}`} icon="📋" />
        <StatCard title="Total Recaudado" value={formatCurrency(stats.amounts.totalContributed)} subtitle={`Este mes: ${formatCurrency(stats.amounts.thisMonth)}`} icon="📈" />
        <StatCard title="Tasa Éxito" value={`${stats.claims.total > 0 ? ((stats.claims.total - stats.claims.pending) / stats.claims.total * 100).toFixed(1) : 100}%`} subtitle="Verificación/Procesamiento" icon="✅" />
      </div>

      <div class="charts-row">
        <div class="card chart-card">
          <h3>Top Colaboradores por Aportes (Mes)</h3>
          {stats.topProfessionals?.length > 0 ? (
            <ul class="top-pros-list">
              {stats.topProfessionals.map((p: any, i: number) => (
                <li key={p.professionalId}>
                  <span class="rank">#{i + 1}</span>
                  <span class="name">{p.professionalName || 'N/A'}</span>
                  <span class="amount">{formatCurrency(p._sum.contributionAmount)}</span>
                  <span class="count">{p._count.id} trabajos</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="empty">Sin datos este mes</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle: string; icon: string }) {
  return (
    <div class="card stat-card">
      <div class="stat-icon">{icon}</div>
      <div class="stat-value">{value}</div>
      <div class="stat-title">{title}</div>
      <div class="stat-subtitle">{subtitle}</div>
    </div>
  );
}

function ConfigsTab({ configs, onEdit }: { configs: any[]; onEdit: (c: any) => void }) {
  return (
    <div class="configs-tab">
      <div class="tab-header">
        <h3>Planes de Protección</h3>
        <button class="btn-primary" onClick={() => onEdit(undefined)}>+ Nuevo Plan</button>
      </div>
      <div class="configs-list">
        {configs.map((c: any) => (
          <div key={c.id} class="config-card">
            <div class="config-main">
              <div class="config-info">
                <h4>{c.name} {c.isDefault && <span class="badge default">Por defecto</span>}</h4>
                <p>{c.description || 'Sin descripción'}</p>
              </div>
              <div class="config-stats">
                <span>{c.contributionRate * 100}% por trabajo</span>
                <span>{formatCurrency(c.minContribution)}-{formatCurrency(c.maxContribution)}</span>
                <span>{c.minJobsForFullCover} trab/mes</span>
              </div>
            </div>
            <div class="config-footer">
              <span class={`status ${c.isActive ? 'active' : 'inactive'}`}>{c.isActive ? 'Activa' : 'Inactiva'}</span>
              <span class="counts">👷 {c._count?.coverages || 0} | 💰 {c._count?.contributions || 0}</span>
              <button class="btn-secondary" onClick={() => onEdit(c)}>Editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimsTab({ claims, onReview }: { claims: any[]; onReview: (id: string, status: string, amount?: number) => void }) {
  const getStatusColor = (s: string) => s === 'SUBMITTED' ? 'warning' : s === 'UNDER_REVIEW' ? 'info' : s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'error' : s === 'PAID' ? 'success' : 'muted';
  const getStatusLabel = (s: string) => s === 'SUBMITTED' ? 'Enviado' : s === 'UNDER_REVIEW' ? 'En Revisión' : s === 'APPROVED' ? 'Aprobado' : s === 'REJECTED' ? 'Rechazado' : s === 'PAID' ? 'Pagado' : s;

  return (
    <div class="claims-tab">
      <h3>Siniestros Recientes</h3>
      {claims.length === 0 ? (
        <div class="empty-state">No hay siniestros</div>
      ) : (
        <div class="claims-table">
          <table>
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Tipo</th>
                <th>Fecha Inc.</th>
                <th>Reclamado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim: any) => (
                <tr key={claim.id}>
                  <td>{claim.professional?.user?.name || 'N/A'}</td>
                  <td>{formatClaimType(claim.type)}</td>
                  <td>{formatDate(claim.incidentDate)}</td>
                  <td>{formatCurrency(claim.amountClaimed)}</td>
                  <td><span class={`status ${getStatusColor(claim.status)}`}>{getStatusLabel(claim.status)}</span></td>
                  <td>
                    {claim.status === 'SUBMITTED' && (
                      <>
                        <button class="btn-sm btn-primary" onClick={() => onReview(claim.id, 'APPROVED', claim.amountClaimed)}>Aprobar</button>
                        <button class="btn-sm btn-danger" onClick={() => onReview(claim.id, 'REJECTED')}>Rechazar</button>
                      </>
                    )}
                    {claim.status === 'APPROVED' && (
                      <button class="btn-sm btn-success" onClick={() => onReview(claim.id, 'PAID', claim.amountApproved)}>Marcar Pagado</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContributionsTab() {
  return (
    <div class="contributions-tab">
      <div class="card">
        <h3>Ver Aportes</h3>
        <p>Usa la API <code>GET /api/protection/admin/contributions</code> con filtros:</p>
        <ul>
          <li><code>?status=PROCESSED</code> - Solo procesados</li>
          <li><code>?professionalId=xxx</code> - Por colaborador</li>
          <li><code>?from=2024-01-01&to=2024-01-31</code> - Por rango de fechas</li>
        </ul>
        <p class="hint">Incluye: profesional, solicitud, monto servicio, aporte, fecha, config.</p>
      </div>
    </div>
  );
}

function formatClaimType(type: string) {
  const labels: Record<string, string> = {
    WORK_ACCIDENT: '🚑 Accidente Laboral',
    ILLNESS: '⚕️ Enfermedad',
    DISABILITY_TEMPORARY: '🤕 Invalidez Temp.',
    DISABILITY_PERMANENT: '♿ Invalidez Perm.',
    DEATH: '👨‍👩‍👧‍👦 Fallecimiento',
    CIVIL_LIABILITY: '⚖️ Resp. Civil',
    TOOLS_THEFT: '🔧 Robo Herramientas',
  };
  return labels[type] || type;
}