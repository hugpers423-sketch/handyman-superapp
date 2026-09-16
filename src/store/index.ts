export { type UserRole, type StaffRole, type ServiceRequest, type Professional, type Service, type Toast, type TrackingStep, type WorkerProtectionConfig, type WorkerProtectionContribution, type WorkerProtectionCoverage, type WorkerProtectionClaim, type WorkerProtectionStatement, type Beneficiary, type CoverageDetail } from '../types';
import type { UserRole, StaffRole, ServiceRequest, Professional, Service, Toast, TrackingStep, WorkerProtectionConfig, WorkerProtectionContribution, WorkerProtectionCoverage, WorkerProtectionClaim, WorkerProtectionStatement, Beneficiary, CoverageDetail } from '../types';

type Listener = () => void;

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((s: T) => Partial<T>)) => {
      state = typeof partial === 'function' ? { ...state, ...partial(state) } : { ...state, ...partial };
      listeners.forEach(l => l());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export const useAuthStore = createStore<{
  user: { id: string; name: string; email: string; avatar: string; role: UserRole; verified: boolean } | null;
  isAuthenticated: boolean;
}>({
  user: null,
  isAuthenticated: false
});

export const useAppStore = createStore<{
  currentPage: UserRole;
  proSubTab: string;
  services: Service[];
  professionals: Professional[];
  requests: ServiceRequest[];
  selectedService: string | null;
  toast: Toast | null;
  trackingSteps: TrackingStep[];
}>({
  currentPage: 'cliente',
  proSubTab: 'solicitudes',
  services: [
    { id: '1', name: 'Gasfitería', icon: '🚰', description: 'Fugas, tuberías y griferías', category: 'hogar' },
    { id: '2', name: 'Electricidad', icon: '⚡', description: 'Instalación y emergencias', category: 'hogar' },
    { id: '3', name: 'Refrigeración', icon: '❄️', description: 'AC y electrodomésticos', category: 'hogar' },
    { id: '4', name: 'Hogar y obra', icon: '🛠️', description: 'Pintura, soldadura y más', category: 'hogar' },
    { id: '5', name: 'Limpieza', icon: '✨', description: 'Hogar, oficina y postobra', category: 'hogar' },
    { id: '6', name: 'Seguridad', icon: '🛡️', description: 'Cámaras, cerrajería y valores', category: 'seguridad' },
    { id: '7', name: 'Tecnología', icon: '💻', description: 'PC, redes y soporte técnico', category: 'tech' },
    { id: '8', name: 'Jardinería', icon: '🌿', description: 'Diseño y mantenimiento', category: 'exterior' }
  ],
  professionals: [
    { id: '1', name: 'Jorge Mendoza', avatar: 'JM', specialty: 'Electricista', rating: 4.9, distance: '2.4 km', priceRange: 'S/ 85–120', available: true, verified: true, location: 'Miraflores' },
    { id: '2', name: 'Rosa Alarcón', avatar: 'RA', specialty: 'Gasfitero', rating: 4.8, distance: '1.8 km', priceRange: 'S/ 70–100', available: true, verified: true, location: 'San Isidro' },
    { id: '3', name: 'Carlos Méndez', avatar: 'CM', specialty: 'Refrigeración', rating: 4.7, distance: '3.2 km', priceRange: 'S/ 120–180', available: true, verified: true, location: 'Surco' },
    { id: '4', name: 'Daniela Vega', avatar: 'DV', specialty: 'Limpieza', rating: 4.9, distance: '2.1 km', priceRange: 'S/ 60–90', available: true, verified: true, location: 'Miraflores' },
    { id: '5', name: 'Miguel Torres', avatar: 'MT', specialty: 'Seguridad', rating: 4.6, distance: '4.0 km', priceRange: 'S/ 150–200', available: true, verified: true, location: 'La Molina' }
  ],
  requests: [
    { id: 'HM-2841', service: 'Gasfitería', detail: 'Posible fuga de gas', status: 'pending', client: { id: '1', name: 'Andrea Ruiz', email: 'andrea@email.com', avatar: 'AR', role: 'cliente', verified: true }, createdAt: new Date(), updatedAt: new Date(), location: 'Miraflores', urgency: 'emergency' },
    { id: 'HM-2839', service: 'Refrigeración', detail: 'Instalación AC', status: 'en_route', client: { id: '2', name: 'Javier León', email: 'javier@email.com', avatar: 'JL', role: 'cliente', verified: true }, professional: { id: '3', name: 'Carlos Méndez', avatar: 'CM', specialty: 'Refrigeración', rating: 4.7, distance: '3.2 km', priceRange: 'S/ 120–180', available: true, verified: true, location: 'Surco' }, createdAt: new Date(), updatedAt: new Date(), location: 'San Isidro', urgency: 'medium' },
    { id: 'HM-2835', service: 'Limpieza', detail: 'Limpieza de oficina', status: 'in_progress', client: { id: '3', name: 'María Torres', email: 'maria@email.com', avatar: 'MT', role: 'cliente', verified: true }, professional: { id: '4', name: 'Daniela Vega', avatar: 'DV', specialty: 'Limpieza', rating: 4.9, distance: '2.1 km', priceRange: 'S/ 60–90', available: true, verified: true, location: 'Miraflores' }, createdAt: new Date(), updatedAt: new Date(), location: 'Surco', urgency: 'low' }
  ],
  selectedService: null,
  toast: null,
  trackingSteps: [
    { id: 1, label: 'Solicitud', status: 'completed', icon: '✓' },
    { id: 2, label: 'Asignado', status: 'completed', icon: '✓' },
    { id: 3, label: 'En ruta', status: 'current', icon: '◉' },
    { id: 4, label: 'En servicio', status: 'pending', icon: '4' },
    { id: 5, label: 'Completado', status: 'pending', icon: '5' }
  ]
});

export function showToast(message: string, type: Toast['type'] = 'info') {
  const id = Date.now().toString();
  useAppStore.setState({ toast: { id, message, type } });
  setTimeout(() => {
    const current = useAppStore.getState().toast;
    if (current?.id === id) useAppStore.setState({ toast: null });
  }, 3500);
}

export function navigateTo(page: UserRole) {
  useAppStore.setState({ currentPage: page });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function selectService(serviceName: string) {
  useAppStore.setState({ selectedService: serviceName });
}

export function createRequest(service: string, detail: string) {
  if (!service) return showToast('Selecciona un servicio para continuar.', 'warning');
  
  const newRequest: ServiceRequest = {
    id: `HM-${Date.now()}`,
    service,
    detail,
    status: 'pending',
    client: { id: 'current', name: 'Usuario', email: 'user@email.com', avatar: 'US', role: 'cliente', verified: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    location: 'Lima',
    urgency: detail.includes('EMERGENCIA') ? 'emergency' : 'medium'
  };

  useAppStore.setState(s => ({ requests: [newRequest, ...s.requests] }));
  showToast(`Solicitud creada: estamos encontrando al profesional ideal para ${service}.`);
  
  setTimeout(() => {
    showToast('Match encontrado · Rosa Alarcón puede llegar en 18 minutos.', 'success');
    useAppStore.setState(s => ({
      requests: s.requests.map(r => r.id === newRequest.id ? { ...r, status: 'assigned', professional: s.professionals[1] } : r),
      trackingSteps: s.trackingSteps.map((step, i) => i <= 1 ? { ...step, status: 'completed' as const } : i === 2 ? { ...step, status: 'current' as const } : step)
    }));
  }, 1600);
}

export function acceptTask(taskId: string) {
  useAppStore.setState(s => ({
    requests: s.requests.map(r => r.id === taskId ? { ...r, status: 'accepted' } : r)
  }));
  showToast('Servicio añadido a tu agenda y cliente notificado.', 'success');
}

export function assignUrgent(requestId: string, professionalId: string) {
  const prof = useAppStore.getState().professionals.find(p => p.id === professionalId);
  useAppStore.setState(s => ({
    requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'assigned', professional: prof } : r)
  }));
  showToast(`${prof?.name} fue asignada. Protocolo de seguridad iniciado.`, 'success');
}

export function setUserRole(role: UserRole) {
  useAuthStore.setState(s => ({ ...s, user: { ...s.user!, role } }));
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated;
}

export function hasRole(role: UserRole): boolean {
  const user = useAuthStore.getState().user;
  return user ? user.role === role : false;
}

export function hasAnyRole(...roles: UserRole[]): boolean {
  const user = useAuthStore.getState().user;
  return user ? roles.includes(user.role) : false;
}

export function hasStaffRole(): boolean {
  return hasRole('staff') || hasRole('admin');
}

export function isAdmin(): boolean {
  return hasRole('admin');
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error en la petición' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(amount || 0);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getValue(e: Event): string {
  return (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

export function getChecked(e: Event): boolean {
  return (e.target as HTMLInputElement).checked;
}

export function getNumberValue(e: Event): number {
  return parseFloat((e.target as HTMLInputElement).value) || 0;
}

export function getIntValue(e: Event): number {
  return parseInt((e.target as HTMLInputElement).value) || 0;
}

export function navigateToSubTab(tab: string) {
  useAppStore.setState({ proSubTab: tab });
  // If navigating to full-screen protection pages, change currentPage
  if (['proteccion', 'aportes', 'siniestros'].includes(tab)) {
    useAppStore.setState({ currentPage: `protection-${tab}` as any });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function navigateBackToPro() {
  useAppStore.setState({ currentPage: 'pro', proSubTab: 'solicitudes' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}