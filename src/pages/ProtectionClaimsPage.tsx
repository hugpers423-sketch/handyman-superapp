import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useAppStore, useAuthStore, api, showToast, formatCurrency, formatDate } from '../store';

export function ProtectionClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({
    type: 'WORK_ACCIDENT',
    description: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentLocation: '',
    amountClaimed: '',
    documents: [] as any[],
  });

  useEffect(() => {
    loadClaims();
  }, [pagination.page]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { claims: any[]; pagination: any } }>(`/protection/claims?page=${pagination.page}&limit=${pagination.limit}`);
      setClaims(res.data.claims);
      setPagination(res.data.pagination);
    } catch (e) {
      showToast('Error al cargar siniestros', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (e: any) => {
    e.preventDefault();
    if (!claimForm.description.trim()) return showToast('Describe el incidente', 'warning');
    if (!claimForm.amountClaimed) return showToast('Monto reclamado requerido', 'warning');

    try {
      await api.post('/protection/claims', {
        type: claimForm.type,
        description: claimForm.description,
        incidentDate: claimForm.incidentDate,
        incidentLocation: claimForm.incidentLocation,
        amountClaimed: parseFloat(claimForm.amountClaimed),
        documents: claimForm.documents,
      });
      setShowClaimModal(false);
      resetForm();
      loadClaims();
      showToast('Siniestro presentado correctamente', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al presentar siniestro', 'error');
    }
  };

  const resetForm = () => {
    setClaimForm({
      type: 'WORK_ACCIDENT',
      description: '',
      incidentDate: new Date().toISOString().split('T')[0],
      incidentLocation: '',
      amountClaimed: '',
      documents: [],
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'warning';
      case 'UNDER_REVIEW': return 'info';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      case 'PAID': return 'success';
      case 'APPEALED': return 'muted';
      default: return 'muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'Enviado 📤';
      case 'UNDER_REVIEW': return 'En Revisión 🔍';
      case 'APPROVED': return 'Aprobado ✅';
      case 'REJECTED': return 'Rechazado ❌';
      case 'PAID': return 'Pagado 💰';
      case 'APPEALED': return 'Apelado ⚖️';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      WORK_ACCIDENT: '🚑 Accidente Laboral',
      ILLNESS: '⚕️ Enfermedad Profesional',
      DISABILITY_TEMPORARY: '🤕 Invalidez Temporal',
      DISABILITY_PERMANENT: '♿ Invalidez Permanente',
      DEATH: '👨‍👩‍👧‍👦 Fallecimiento',
      CIVIL_LIABILITY: '⚖️ Responsabilidad Civil',
      TOOLS_THEFT: '🔧 Robo de Herramientas',
    };
    return labels[type] || type;
  };

  return (
    <div class="page protection-claims">
      <header class="top">
        <div class="brand">
          <div class="logo-mark">📋</div>
          <span>MIS SINIESTROS</span>
        </div>
      </header>

      <main class="content">
        {/* Botón nuevo siniestro */}
        <div class="card">
          <button class="btn-primary full-width" onClick={() => { resetForm(); setShowClaimModal(true); }}>
            + Presentar Nuevo Siniestro
          </button>
        </div>

        {/* Lista */}
        <div class="card">
          {loading ? (
            <div class="loading">Cargando...</div>
          ) : claims.length === 0 ? (
            <div class="empty-state">
              <p>No has presentado siniestros aún</p>
              <p class="hint">Tu protección cubre: accidentes laborales, enfermedad profesional, invalidez, fallecimiento, responsabilidad civil y robo de herramientas.</p>
            </div>
          ) : (
            <div class="claims-list">
              {claims.map((claim: any) => (
                <div key={claim.id} class="claim-card">
                  <div class="claim-header">
                    <span class="claim-type">{getTypeLabel(claim.type)}</span>
                    <span class={`claim-status ${getStatusColor(claim.status)}`}>{getStatusLabel(claim.status)}</span>
                  </div>
                  <div class="claim-body">
                    <p class="claim-description">{claim.description}</p>
                    <div class="claim-meta">
                      <span>📅 {formatDate(claim.incidentDate)}</span>
                      {claim.incidentLocation && <span>📍 {claim.incidentLocation}</span>}
                      <span>💰 Reclamado: {formatCurrency(claim.amountClaimed)}</span>
                      {claim.amountApproved && <span>✅ Aprobado: {formatCurrency(claim.amountApproved)}</span>}
                    </div>
                  </div>
                  <div class="claim-footer">
                    <span class="claim-date">Presentado: {formatDate(claim.createdAt)}</span>
                    {claim.reviewedAt && <span class="reviewed">Revisado: {formatDate(claim.reviewedAt)}</span>}
                    {claim.resolutionNotes && <span class="notes">{claim.resolutionNotes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div class="pagination">
              <button class="btn-secondary" disabled={pagination.page === 1} onClick={() => setPagination({...pagination, page: pagination.page - 1})}>Anterior</button>
              <span>Página {pagination.page} de {pagination.totalPages}</span>
              <button class="btn-secondary" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({...pagination, page: pagination.page + 1})}>Siguiente</button>
            </div>
          )}
        </div>

        {/* Info coberturas */}
        <div class="card info-card">
          <h3>📖 Qué cubre tu protección</h3>
          <ul class="coverage-info-list">
            <li><strong>🚑 Accidente Laboral:</strong> Gastos médicos + indemnización hasta S/50,000</li>
            <li><strong>⚕️ Enfermedad Profesional:</strong> Tratamiento y reposo hasta S/15,000</li>
            <li><strong>🤕 Invalidez Temporal:</strong> Subsidio diario hasta S/20,000</li>
            <li><strong>♿ Invalidez Permanente:</strong> Capital asegurado hasta S/100,000</li>
            <li><strong>👨‍👩‍👧‍👦 Fallecimiento:</strong> Apoyo a beneficiarios hasta S/30,000</li>
            <li><strong>⚖️ Responsabilidad Civil:</strong> Daños a terceros hasta S/20,000</li>
            <li><strong>🔧 Robo de Herramientas:</strong> Reposición hasta S/5,000</li>
          </ul>
          <p class="requirements">
            <strong>Requisitos:</strong> 10+ trabajos/mes para cobertura total | 30 días de carencia inicial | Documentos: parte médico, denuncia policial, fotos, facturas
          </p>
        </div>
      </main>

      {/* Modal Nuevo Siniestro */}
      {showClaimModal && (
        <div class="modal-overlay" onClick={() => setShowClaimModal(false)}>
          <div class="modal large" onClick={e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Presentar Siniestro</h3>
              <button class="modal-close" onClick={() => setShowClaimModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitClaim} class="modal-body">
              <div class="form-group">
                <label>Tipo de Siniestro *</label>
                <select value={claimForm.type} onChange={(e: any) => setClaimForm({...claimForm, type: e.target.value})} required>
                  <option value="WORK_ACCIDENT">🚑 Accidente Laboral</option>
                  <option value="ILLNESS">⚕️ Enfermedad Profesional</option>
                  <option value="DISABILITY_TEMPORARY">🤕 Invalidez Temporal</option>
                  <option value="DISABILITY_PERMANENT">♿ Invalidez Permanente</option>
                  <option value="DEATH">👨‍👩‍👧‍👦 Fallecimiento</option>
                  <option value="CIVIL_LIABILITY">⚖️ Responsabilidad Civil</option>
                  <option value="TOOLS_THEFT">🔧 Robo de Herramientas</option>
                </select>
              </div>

              <div class="form-group">
                <label>Descripción del Incidente *</label>
                <textarea 
                  value={claimForm.description} 
                  onChange={(e: any) => setClaimForm({...claimForm, description: e.target.value})}
                  rows={4}
                  placeholder="Describe qué pasó, cómo, cuándo y dónde. Incluye testigos si los hay."
                  required
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Fecha del Incidente *</label>
                  <input 
                    type="date" 
                    value={claimForm.incidentDate} 
                    onChange={(e: any) => setClaimForm({...claimForm, incidentDate: e.target.value})}
                    required
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div class="form-group">
                  <label>Ubicación</label>
                  <input 
                    type="text" 
                    value={claimForm.incidentLocation} 
                    onChange={(e: any) => setClaimForm({...claimForm, incidentLocation: e.target.value})}
                    placeholder="Dirección o referencia"
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Monto Reclamado (S/) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={claimForm.amountClaimed} 
                  onChange={(e: any) => setClaimForm({...claimForm, amountClaimed: e.target.value})}
                  required
                />
              </div>

              <div class="form-group">
                <label>Documentos (URLs - opcional)</label>
                <div class="documents-input">
                  {claimForm.documents.map((doc: any, i: number) => (
                    <div key={i} class="doc-row">
                      <input type="text" placeholder="Nombre" value={doc.name} onChange={(e: any) => { const d = [...claimForm.documents]; d[i] = {...d[i], name: e.target.value}; setClaimForm({...claimForm, documents: d}); }} />
                      <input type="url" placeholder="URL" value={doc.url} onChange={(e: any) => { const d = [...claimForm.documents]; d[i] = {...d[i], url: e.target.value}; setClaimForm({...claimForm, documents: d}); }} />
                      <input type="text" placeholder="Tipo (parte médico, denuncia, fotos, factura)" value={doc.type} onChange={(e: any) => { const d = [...claimForm.documents]; d[i] = {...d[i], type: e.target.value}; setClaimForm({...claimForm, documents: d}); }} />
                      <button type="button" class="btn-danger" onClick={() => { const d = claimForm.documents.filter((_: any, j: number) => j !== i); setClaimForm({...claimForm, documents: d}); }}>✕</button>
                    </div>
                  ))}
                  <button type="button" class="btn-secondary" onClick={() => setClaimForm({...claimForm, documents: [...claimForm.documents, { name: '', url: '', type: '' }]})}>
                    + Agregar documento
                  </button>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" onClick={() => setShowClaimModal(false)}>Cancelar</button>
                <button type="submit" class="btn-primary">Presentar Siniestro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}