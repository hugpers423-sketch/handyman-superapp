import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useAppStore, useAuthStore, api, showToast, formatCurrency, getValue, getNumberValue } from '../store';

export function ProtectionCoveragePage() {
  const [coverage, setCoverage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [editingBeneficiaries, setEditingBeneficiaries] = useState<any[]>([]);
  const authStore = useAuthStore.getState();

  useEffect(() => {
    loadCoverage();
  }, []);

  const loadCoverage = async () => {
    try {
      const res = await api.get<{ data: { coverage: any } }>('/protection/my-coverage');
      setCoverage(res.data.coverage);
      if (res.data.coverage?.beneficiaries) {
        setBeneficiaries(res.data.coverage.beneficiaries);
        setEditingBeneficiaries(JSON.parse(JSON.stringify(res.data.coverage.beneficiaries)));
      }
    } catch (e) {
      showToast('Error al cargar cobertura', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBeneficiaries = async () => {
    // Validar que sumen 100%
    const total = editingBeneficiaries.reduce((sum, b) => sum + (b.percentage || 0), 0);
    if (total !== 100) {
      showToast('Los porcentajes deben sumar 100%', 'error');
      return;
    }
    try {
      await api.patch('/protection/my-coverage/beneficiaries', { beneficiaries: editingBeneficiaries });
      setBeneficiaries(JSON.parse(JSON.stringify(editingBeneficiaries)));
      setShowBeneficiaryModal(false);
      showToast('Beneficiarios actualizados', 'success');
    } catch (e) {
      showToast('Error al guardar', 'error');
    }
  };

  const addBeneficiary = () => {
    setEditingBeneficiaries([...editingBeneficiaries, { name: '', relationship: '', percentage: 0, document: '' }]);
  };

  const removeBeneficiary = (index: number) => {
    setEditingBeneficiaries(editingBeneficiaries.filter((_, i) => i !== index));
  };

  const updateBeneficiary = (index: number, field: string, value: any) => {
    setEditingBeneficiaries(editingBeneficiaries.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  if (loading) return <div class="page-loader">Cargando tu protección...</div>;
  if (!coverage) return <ProtectionNotActive onActivate={loadCoverage} />;

  const { config, progress, jobsThisMonth, minJobsForFullCover, status, totalContributed, recentClaims } = coverage;
  const isActive = status === 'ACTIVE';

  return (
    <div class="page protection-coverage">
      <header class="top">
        <div class="brand">
          <div class="logo-mark">🛡️</div>
          <span>MI PROTECCIÓN</span>
        </div>
      </header>

      <main class="content">
        {/* Status Card */}
        <div class="card status-card {isActive ? 'active' : 'inactive'}">
          <div class="status-header">
            <div class="status-icon">{isActive ? '●' : '○'}</div>
            <div class="status-info">
              <h3>{isActive ? 'COBERTURA ACTIVA' : 'COBERTURA SUSPENDIDA'}</h3>
              <p class="plan-name">{config.name}</p>
            </div>
          </div>
          
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div class="progress-label">
              <span>Trabajos este mes: {jobsThisMonth}/{minJobsForFullCover}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <p class="progress-hint">
              {isActive 
                ? '¡Cobertura completa activa! Tu familia está protegida.'
                : `Faltan ${minJobsForFullCover - jobsThisMonth} trabajos para cobertura total`}
            </p>
          </div>

          <div class="stats-grid">
            <div class="stat">
              <span class="stat-value">{formatCurrency(totalContributed)}</span>
              <span class="stat-label">Total aportado</span>
            </div>
            <div class="stat">
              <span class="stat-value">{config.contributionRate * 100}%</span>
              <span class="stat-label">Por trabajo</span>
            </div>
            <div class="stat">
              <span class="stat-value">{formatCurrency(config.minContribution)}-{formatCurrency(config.maxContribution)}</span>
              <span class="stat-label">Rango por servicio</span>
            </div>
          </div>
        </div>

        {/* Coberturas */}
        <div class="card">
          <h3 class="card-title">🛡️ Coberturas Incluidas</h3>
          <div class="coverages-list">
            {config.coverages?.map((cov: any, i: number) => (
              <div key={i} class="coverage-item">
                <div class="coverage-icon">{getCoverageIcon(cov.type)}</div>
                <div class="coverage-info">
                  <strong>{formatCoverageType(cov.type)}</strong>
                  <small>{cov.description}</small>
                </div>
                <div class="coverage-amount">{formatCurrency(cov.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Beneficiarios */}
        <div class="card">
          <div class="card-header">
            <h3>👨‍👩‍👧‍👦 Beneficiarios</h3>
            <button class="btn-secondary" onClick={() => { setEditingBeneficiaries(JSON.parse(JSON.stringify(beneficiaries))); setShowBeneficiaryModal(true); }}>
              Editar
            </button>
          </div>
          {beneficiaries.length === 0 ? (
            <p class="empty-state">No hay beneficiarios registrados. Toca "Editar" para agregarlos.</p>
          ) : (
            <ul class="beneficiaries-list">
              {beneficiaries.map((b: any, i: number) => (
                <li key={i} class="beneficiary-item">
                  <div class="beneficiary-info">
                    <strong>{b.name}</strong>
                    <span class="relationship">{b.relationship}</span>
                  </div>
                  <div class="beneficiary-percentage">{b.percentage}%</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Últimos siniestros */}
        {recentClaims && recentClaims.length > 0 && (
          <div class="card">
            <h3 class="card-title">📋 Últimos Siniestros</h3>
            <ul class="claims-list">
              {recentClaims.slice(0, 3).map((claim: any) => (
                <li key={claim.id} class="claim-item">
                  <div class="claim-info">
                    <span class="claim-type">{formatClaimType(claim.type)}</span>
                    <span class="claim-date">{new Date(claim.incidentDate).toLocaleDateString()}</span>
                  </div>
                  <span class={`claim-status ${claim.status.toLowerCase()}`}>{claim.status}</span>
                </li>
              ))}
            </ul>
            <a href="#/protection/claims" class="btn-link">Ver todos →</a>
          </div>
        )}

        {/* Accesos rápidos */}
        <div class="quick-actions">
          <a href="#/protection/contributions" class="action-btn">
            <span class="icon">📊</span>
            <span>Ver mis aportes</span>
          </a>
          <a href="#/protection/claims" class="action-btn">
            <span class="icon">📋</span>
            <span>Mis siniestros</span>
          </a>
          <a href="#/protection/statements" class="action-btn">
            <span class="icon">📄</span>
            <span>Estados de cuenta</span>
          </a>
        </div>
      </main>

      {/* Modal Beneficiarios */}
      {showBeneficiaryModal && (
        <div class="modal-overlay" onClick={() => setShowBeneficiaryModal(false)}>
          <div class="modal" onClick={e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Editar Beneficiarios</h3>
              <button class="modal-close" onClick={() => setShowBeneficiaryModal(false)}>✕</button>
            </div>
            <div class="modal-body">
              <p class="modal-hint">Los porcentajes deben sumar 100%</p>
              {editingBeneficiaries.map((b, i) => (
                <div key={i} class="beneficiary-form-row">
                  <input placeholder="Nombre" value={b.name} onChange={(e: any) => updateBeneficiary(i, 'name', e.target.value)} />
                  <input placeholder="Parentesco" value={b.relationship} onChange={(e: any) => updateBeneficiary(i, 'relationship', e.target.value)} />
                  <input type="number" min="0" max="100" placeholder="%" value={b.percentage} onChange={(e: any) => updateBeneficiary(i, 'percentage', parseInt(e.target.value) || 0)} />
                  <input placeholder="DNI (opcional)" value={b.document} onChange={(e: any) => updateBeneficiary(i, 'document', e.target.value)} />
                  {editingBeneficiaries.length > 1 && (
                    <button class="btn-danger" onClick={() => removeBeneficiary(i)}>🗑️</button>
                  )}
                </div>
              ))}
              <button class="btn-secondary" onClick={addBeneficiary}>+ Agregar beneficiario</button>
              <div class="modal-total">
                Total: {editingBeneficiaries.reduce((sum, b) => sum + (b.percentage || 0), 0)}%
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onClick={() => { setEditingBeneficiaries(JSON.parse(JSON.stringify(beneficiaries))); setShowBeneficiaryModal(false); }}>Cancelar</button>
              <button class="btn-primary" onClick={handleSaveBeneficiaries}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProtectionNotActive({ onActivate }: { onActivate: () => void }) {
  return (
    <div class="page protection-not-active">
      <div class="card centered">
        <div class="icon-large">🛡️</div>
        <h2>Sin Cobertura Activa</h2>
        <p>Completa trabajos para activar tu protección automáticamente.</p>
        <div class="info-box">
          <p><strong>Cómo funciona:</strong></p>
          <ul>
            <li>Cada trabajo aporta el 3% (mín S/5, máx S/50)</li>
            <li>Al llegar a 10 trabajos/mes → Cobertura total</li>
            <li>Cubre: accidentes, enfermedad, invalidez, vida, RC</li>
          </ul>
        </div>
        <button class="btn-primary large" onClick={onActivate}>Entendido</button>
      </div>
    </div>
  );
}

function getCoverageIcon(type: string) {
  const icons: Record<string, string> = {
    WORK_ACCIDENT: '🚑',
    ILLNESS: '⚕️',
    DISABILITY_TEMPORARY: '🤕',
    DISABILITY_PERMANENT: '♿',
    DEATH: '👨‍👩‍👧‍👦',
    CIVIL_LIABILITY: '⚖️',
    TOOLS_THEFT: '🔧',
  };
  return icons[type] || '🛡️';
}

function formatCoverageType(type: string) {
  const labels: Record<string, string> = {
    WORK_ACCIDENT: 'Accidente Laboral',
    ILLNESS: 'Enfermedad Profesional',
    DISABILITY_TEMPORARY: 'Invalidez Temporal',
    DISABILITY_PERMANENT: 'Invalidez Permanente',
    DEATH: 'Fallecimiento',
    CIVIL_LIABILITY: 'Responsabilidad Civil',
    TOOLS_THEFT: 'Robo de Herramientas',
  };
  return labels[type] || type;
}

function formatClaimType(type: string) {
  return formatCoverageType(type);
}