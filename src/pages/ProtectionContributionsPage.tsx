import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useAppStore, useAuthStore, api, showToast, formatCurrency, formatDate, getValue } from '../store';

export function ProtectionContributionsPage() {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });

  useEffect(() => {
    loadContributions();
  }, [pagination.page, filters]);

  const loadContributions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        ...(filters.status && { status: filters.status }),
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
      });
      const res = await api.get<{ data: { contributions: any[]; pagination: any } }>(`/protection/my-contributions?${params}`);
      setContributions(res.data.contributions);
      setPagination(res.data.pagination);
    } catch (e) {
      showToast('Error al cargar aportes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROCESSED': return 'success';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'error';
      case 'REFUNDED': return 'muted';
      default: return 'muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PROCESSED': return 'Procesado ✓';
      case 'PENDING': return 'Pendiente ⏳';
      case 'FAILED': return 'Fallido ✗';
      case 'REFUNDED': return 'Reembolsado ↩';
      default: return status;
    }
  };

  return (
    <div class="page protection-contributions">
      <header class="top">
        <div class="brand">
          <div class="logo-mark">📊</div>
          <span>MIS APORTES</span>
        </div>
      </header>

      <main class="content">
        {/* Resumen */}
        <div class="summary-card">
          <div class="summary-item">
            <span class="summary-value">{contributions.filter(c => c.status === 'PROCESSED').reduce((sum, c) => sum + c.contributionAmount, 0).toFixed(2)}</span>
            <span class="summary-label">Total aportado (S/)</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{contributions.filter(c => c.status === 'PROCESSED').length}</span>
            <span class="summary-label">Trabajos con aporte</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{formatCurrency(contributions.filter(c => c.status === 'PROCESSED').reduce((sum, c) => sum + c.serviceAmount, 0) / Math.max(1, contributions.filter(c => c.status === 'PROCESSED').length))}</span>
            <span class="summary-label">Promedio por trabajo</span>
          </div>
        </div>

        {/* Filtros */}
        <div class="card filters-card">
          <div class="filter-row">
            <select value={filters.status} onChange={(e: any) => { setFilters({...filters, status: e.target.value}); setPagination({...pagination, page: 1}); }}>
              <option value="">Todos los estados</option>
              <option value="PROCESSED">Procesados</option>
              <option value="PENDING">Pendientes</option>
              <option value="FAILED">Fallidos</option>
              <option value="REFUNDED">Reembolsados</option>
            </select>
            <input type="date" value={filters.from} onChange={(e: any) => setFilters({...filters, from: e.target.value})} placeholder="Desde" />
            <input type="date" value={filters.to} onChange={(e: any) => setFilters({...filters, to: e.target.value})} placeholder="Hasta" />
            <button class="btn-secondary" onClick={() => { setFilters({ status: '', from: '', to: '' }); loadContributions(); }}>Limpiar</button>
          </div>
        </div>

        {/* Lista */}
        <div class="card">
          {loading ? (
            <div class="loading">Cargando...</div>
          ) : contributions.length === 0 ? (
            <div class="empty-state">No hay aportes registrados aún</div>
          ) : (
            <>
              <div class="contributions-list">
                {contributions.map((c: any) => (
                  <div key={c.id} class="contribution-item">
                    <div class="contrib-main">
                      <div class="contrib-service">
                        <span class="service-name">{c.request?.service?.name || 'Servicio'}</span>
                        <span class="request-number">{c.request?.requestNumber || c.requestId}</span>
                      </div>
                      <div class="contrib-details">
                        <span class="contrib-date">{formatDate(c.createdAt)}</span>
                        <span class={`contrib-status ${getStatusColor(c.status)}`}>{getStatusLabel(c.status)}</span>
                      </div>
                    </div>
                    <div class="contrib-amounts">
                      <div class="amount-row">
                        <span class="label">Servicio:</span>
                        <span class="value">{formatCurrency(c.serviceAmount)}</span>
                      </div>
                      <div class="amount-row highlight">
                        <span class="label">Tu aporte ({c.contributionRate * 100}%):</span>
                        <span class="value">{formatCurrency(c.contributionAmount)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginación */}
              {pagination.totalPages > 1 && (
                <div class="pagination">
                  <button class="btn-secondary" disabled={pagination.page === 1} onClick={() => setPagination({...pagination, page: pagination.page - 1})}>Anterior</button>
                  <span>Página {pagination.page} de {pagination.totalPages}</span>
                  <button class="btn-secondary" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({...pagination, page: pagination.page + 1})}>Siguiente</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}