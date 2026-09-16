import { useState, useMemo } from 'preact/hooks';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { useAppStore } from '../store';
import { getTransactions, getAllWallets, getFeeDeductions, getMembershipConfig } from '../store/payment';

const COLORS = ['#69a128', '#d7ff61', '#ff7043', '#53d2ed', '#d37018', '#9b59b6', '#1abc9c', '#e74c3c'];

interface AnalyticsProps {
  role: 'pro' | 'ops' | 'staff' | 'empresa';
  professionalId?: string;
}

export function Analytics({ role, professionalId = '1' }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'earnings' | 'services' | 'rating' | 'all'>('all');
  
  const state = useAppStore.getState();
  const transactions = getTransactions();
  const wallets = getAllWallets();
  const feeDeductions = getFeeDeductions();
  const membershipConfig = getMembershipConfig();
  const wallet = wallets.find(w => w.professionalId === professionalId);

  const proTransactions = transactions.filter(t => t.professionalId === professionalId);
  const proCompleted = proTransactions.filter(t => t.status === 'completed');

  const stats = useMemo(() => {
    const now = new Date();
    const filtered = proCompleted.filter(t => {
      if (!t.paidAt) return false;
      const paid = new Date(t.paidAt);
      switch (dateRange) {
        case 'week': return paid >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        case 'month': return paid >= new Date(now.getFullYear(), now.getMonth(), 1);
        case 'quarter': return paid >= new Date(now.getFullYear(), now.getMonth() - 3, 1);
        case 'year': return paid >= new Date(now.getFullYear(), 0, 1);
      }
    });

    const totalEarnings = filtered.reduce((sum, t) => sum + t.split.workerAmount, 0);
    const totalServices = filtered.length;
    const avgRating = 4.9; // mock
    const avgTicket = totalServices > 0 ? totalEarnings / totalServices : 0;

    return { totalEarnings, totalServices, avgRating, avgTicket, filtered };
  }, [proCompleted, dateRange]);

  const monthlyData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months.map((month, i) => {
      const monthTxns = proCompleted.filter(t => {
        if (!t.paidAt) return false;
        const paid = new Date(t.paidAt);
        return paid.getMonth() === i && paid.getFullYear() === new Date().getFullYear();
      });
      return {
        month,
        earnings: monthTxns.reduce((sum, t) => sum + t.split.workerAmount, 0),
        services: monthTxns.length,
        commission: monthTxns.reduce((sum, t) => sum + t.split.commissionAmount, 0)
      };
    });
  }, [proCompleted]);

  const serviceTypeData = useMemo(() => {
    const types: Record<string, { count: number; earnings: number }> = {};
    proCompleted.forEach(t => {
      if (!types[t.requestId]) types[t.requestId] = { count: 0, earnings: 0 };
      types[t.requestId].count++;
      types[t.requestId].earnings += t.split.workerAmount;
    });
    return Object.entries(types).map(([type, data]) => ({
      type: type.replace('HM-', 'Servicio '),
      ...data
    })).slice(0, 6);
  }, [proCompleted]);

  const paymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    proCompleted.forEach(t => {
      methods[t.method] = (methods[t.method] || 0) + 1;
    });
    return Object.entries(methods).map(([method, count]) => ({ method: method.toUpperCase(), count }));
  }, [proCompleted]);

  const formatCurrency = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  const formatNumber = (n: number) => n.toLocaleString('es-PE');

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const pct = ((current - previous) / previous * 100).toFixed(1);
    return current >= previous ? `+${pct}%` : `${pct}%`;
  };

  const prevStats = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    switch (dateRange) {
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        end = new Date(now.getFullYear(), now.getMonth() - 3, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }
    const filtered = proCompleted.filter(t => {
      if (!t.paidAt) return false;
      const paid = new Date(t.paidAt);
      return paid >= start && paid <= end;
    });
    return {
      earnings: filtered.reduce((sum, t) => sum + t.split.workerAmount, 0),
      services: filtered.length
    };
  }, [proCompleted, dateRange]);

  const earningsTrend = getTrend(stats.totalEarnings, prevStats.earnings);
  const servicesTrend = getTrend(stats.totalServices, prevStats.services);

  return (
    <div className="analytics-dashboard" style={{ padding: '24px 0' }}>
      <div className="analytics-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style="margin: 0 0 4px; font: 700 28px 'Playfair Display';">Analytics</h2>
          <p style="margin: 0; color: #65756d;">Panel {role === 'pro' ? 'Profesional' : role === 'staff' ? 'Staff' : role === 'ops' ? 'Operaciones' : 'Empresa'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['week', 'month', 'quarter', 'year'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={dateRange === range ? 'active' : ''}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: '1px solid #dfe3dc',
                background: dateRange === range ? '#0a2922' : '#fff',
                color: dateRange === range ? '#fff' : '#0a2922',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {range === 'week' ? '7 días' : range === 'month' ? '30 días' : range === 'quarter' ? '3 meses' : '1 año'}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard
          title="Ingresos netos"
          value={formatCurrency(stats.totalEarnings)}
          trend={earningsTrend}
          trendPositive={stats.totalEarnings >= prevStats.earnings}
          icon="💰"
          color="#69a128"
        />
        <MetricCard
          title="Servicios"
          value={formatNumber(stats.totalServices)}
          trend={servicesTrend}
          trendPositive={stats.totalServices >= prevStats.services}
          icon="🔧"
          color="#53d2ed"
        />
        <MetricCard
          title="Ticket promedio"
          value={formatCurrency(stats.avgTicket)}
          trend="—"
          icon="📊"
          color="#d37018"
        />
        <MetricCard
          title="Rating"
          value={`${stats.avgRating} ★`}
          trend="—"
          icon="⭐"
          color="#ff7043"
        />
        {wallet && (
          <MetricCard
            title="Wallet"
            value={formatCurrency(wallet.balance)}
            trend={wallet.membershipStatus === 'free' ? 'GRATIS' : wallet.membershipStatus}
            trendPositive={wallet.membershipStatus === 'active' || wallet.membershipStatus === 'free'}
            icon="💳"
            color="#9b59b6"
          />
        )}
        <MetricCard
          title="Fee mensual"
          value={formatCurrency(membershipConfig.monthlyFee)}
          trend={wallet?.membershipStatus || '—'}
          icon="📅"
          color="#ff7043"
        />
      </div>

      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        <ChartCard title="Ingresos mensuales" subtitle={`Total: ${formatCurrency(stats.totalEarnings)}`}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#65756d" fontSize={11} tickLine={false} />
              <YAxis stroke="#65756d" fontSize={11} tickFormatter={v => formatCurrency(v)} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #dfe3dc', borderRadius: '8px', boxShadow: '0 4px 12px #0001' }}
                formatter={(value: any): [string, string] => [value ? formatCurrency(value) : '', 'Ingresos']}
                labelFormatter={(month) => month}
              />
              <Legend />
              <Area type="monotone" dataKey="earnings" stroke="#69a128" fill="#69a128" fillOpacity={0.15} strokeWidth={2} />
              <Line type="monotone" dataKey="services" stroke="#53d2ed" strokeWidth={2} dot={{ r: 4 }} yAxisId="right" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Servicios por tipo" subtitle={`${stats.totalServices} servicios completados`}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={serviceTypeData}
                cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                dataKey="services" nameKey="type"
                label={({ type, percent }: { type: string; percent: number }) => `${type} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {serviceTypeData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any): [string, string] => [value ? formatCurrency(value) : '', 'servicios']} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Métodos de pago" subtitle={`${stats.totalServices} transacciones`}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentMethodData}
                cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                dataKey="count" nameKey="method"
                label={({ method, percent }: { method: string; percent: number }) => `${method} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {paymentMethodData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any): [string, string] => [value ? formatCurrency(value) : '', 'pagos']} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {role === 'staff' && (
          <ChartCard title="Estado de membresías" subtitle={`${wallets.length} profesionales`}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Gratis (Early)', value: wallets.filter(w => w.membershipStatus === 'free').length, color: '#69a128' },
                    { name: 'Activos', value: wallets.filter(w => w.membershipStatus === 'active').length, color: '#53d2ed' },
                    { name: 'Gracia', value: wallets.filter(w => w.membershipStatus === 'grace_period').length, color: '#ff7043' },
                    { name: 'Suspendidos', value: wallets.filter(w => w.membershipStatus === 'suspended').length, color: '#e94931' }
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  dataKey="value" nameKey="name"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {wallets.filter(w => w.membershipStatus === 'free').length > 0 && <Cell key="free" fill="#69a128" />}
                  {wallets.filter(w => w.membershipStatus === 'active').length > 0 && <Cell key="active" fill="#53d2ed" />}
                  {wallets.filter(w => w.membershipStatus === 'grace_period').length > 0 && <Cell key="grace" fill="#ff7043" />}
                  {wallets.filter(w => w.membershipStatus === 'suspended').length > 0 && <Cell key="suspended" fill="#e94931" />}
                </Pie>
                <Tooltip formatter={(value: any): [string, string] => [value ? formatCurrency(value) : '', 'profesionales']} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <ChartCard title="Evolución comisión vs ganancia" subtitle="Últimos 6 meses">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyData.slice(-6)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#65756d" fontSize={11} tickLine={false} />
              <YAxis stroke="#65756d" fontSize={11} tickFormatter={v => formatCurrency(v)} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #dfe3dc', borderRadius: '8px' }}
                formatter={(value: any, name: any): [string, string] => [value ? formatCurrency(value) : '', name === 'commission' ? 'Comisión' : 'Ganancia neta']}
              />
              <Legend />
              <Area type="monotone" dataKey="commission" stroke="#ff7043" fill="#ff7043" fillOpacity={0.15} strokeWidth={2} name="Comisión" />
              <Area type="monotone" dataKey="earnings" stroke="#69a128" fill="#69a128" fillOpacity={0.15} strokeWidth={2} name="Ganancia neta" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {role === 'staff' && (
          <ChartCard title="Revenue plataforma (3%)" subtitle={`Total: ${formatCurrency(transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.split.platformAmount, 0))}`}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#65756d" fontSize={11} tickLine={false} />
                <YAxis stroke="#65756d" fontSize={11} tickFormatter={v => formatCurrency(v)} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #dfe3dc', borderRadius: '8px' }} formatter={(value: any): [string, string] => [value ? formatCurrency(value) : '', 'Revenue']} />
                <Area type="monotone" dataKey="earnings" stroke="#9b59b6" fill="#9b59b6" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {role === 'pro' && (
        <div className="pro-insights" style={{ marginTop: '32px' }}>
          <h3 style="margin: 0 0 16px; font: 700 20px 'Playfair Display';">Insights personales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <InsightCard
              title="Mejor día"
              value="Sábado"
              description="35% más ingresos que promedio"
              icon="📅"
              color="#69a128"
            />
            <InsightCard
              title="Servicio top"
              value="Electricidad"
              description="40% de tus ingresos"
              icon="⚡"
              color="#ff7043"
            />
            <InsightCard
              title="Clientes recurrentes"
              value="68%"
              description="Vuelven a solicitar tus servicios"
              icon="🔄"
              color="#53d2ed"
            />
            <InsightCard
              title="Objetivo mensual"
              value={`${Math.round(stats.totalEarnings / 2500 * 100)}%`}
              description={`Faltan ${formatCurrency(Math.max(0, 2500 - stats.totalEarnings))}`}
              icon="🎯"
              color="#d37018"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, trend, trendPositive, icon, color }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #dfe3dc', borderRadius: '12px',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
      boxShadow: '0 2px 8px #00005'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <span style={{ font: '500 11px "DM Mono"', color: '#65756d', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ font: '700 28px "Playfair Display"', color }}>
        {value}
      </div>
      <div style={{
        fontSize: '12px', fontWeight: 600,
        color: trendPositive ? '#69a128' : '#ff7043',
        display: 'flex', alignItems: 'center', gap: '4px'
      }}>
        {trend !== '—' && <span>{trendPositive ? '↑' : '↓'}</span>}
        {trend} vs periodo anterior
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #dfe3dc', borderRadius: '12px',
      padding: '20px', boxShadow: '0 2px 8px #00005'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style="margin: 0 0 4px; font: 700 16px 'Playfair Display';">{title}</h3>
        <p style="margin: 0; color: #65756d; font-size: 13px;">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function InsightCard({ title, value, description, icon, color }: any) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`,
      borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px'
    }}>
      <div style={{ fontSize: '32px', background: `${color}15`, borderRadius: '12px', padding: '12px' }}>
        {icon}
      </div>
      <div>
        <div style={{ font: '700 24px "Playfair Display"', color, marginBottom: '4px' }}>{value}</div>
        <div style={{ font: '500 13px "Playfair Display"', marginBottom: '4px' }}>{title}</div>
        <div style={{ color: '#65756d', fontSize: '13px' }}>{description}</div>
      </div>
    </div>
  );
}