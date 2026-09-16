import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, useAuthStore, showToast, navigateTo, selectService, createRequest, acceptTask, assignUrgent } from '../store';

describe('Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentPage: 'cliente',
      services: [
        { id: '1', name: 'Gasfitería', icon: '🚰', description: 'Fugas, tuberías y griferías', category: 'hogar' },
        { id: '2', name: 'Electricidad', icon: '⚡', description: 'Instalación y emergencias', category: 'hogar' }
      ],
      professionals: [
        { id: '1', name: 'Jorge Mendoza', avatar: 'JM', specialty: 'Electricista', rating: 4.9, distance: '2.4 km', priceRange: 'S/ 85–120', available: true, verified: true, location: 'Miraflores' }
      ],
      requests: [],
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
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  describe('useAppStore', () => {
    it('should have initial state', () => {
      const state = useAppStore.getState();
      expect(state.currentPage).toBe('cliente');
      expect(state.services).toHaveLength(2);
      expect(state.professionals).toHaveLength(1);
      expect(state.requests).toHaveLength(0);
      expect(state.selectedService).toBeNull();
      expect(state.toast).toBeNull();
    });

    it('should navigate to different pages', () => {
      navigateTo('pro');
      expect(useAppStore.getState().currentPage).toBe('pro');
      
      navigateTo('ops');
      expect(useAppStore.getState().currentPage).toBe('ops');
      
      navigateTo('empresa');
      expect(useAppStore.getState().currentPage).toBe('empresa');
    });

    it('should select a service', () => {
      selectService('Gasfitería');
      expect(useAppStore.getState().selectedService).toBe('Gasfitería');
    });

    it('should show toast', () => {
      showToast('Test message', 'success');
      const toast = useAppStore.getState().toast;
      expect(toast).not.toBeNull();
      expect(toast?.message).toBe('Test message');
      expect(toast?.type).toBe('success');
    });

    it('should create a request', () => {
      createRequest('Gasfitería', 'Fuga en cocina');
      const state = useAppStore.getState();
      expect(state.requests).toHaveLength(1);
      expect(state.requests[0].service).toBe('Gasfitería');
      expect(state.requests[0].detail).toBe('Fuga en cocina');
      expect(state.requests[0].status).toBe('pending');
    });

    it('should not create request without service', () => {
      createRequest('', 'Detalle');
      expect(useAppStore.getState().requests).toHaveLength(0);
      const toast = useAppStore.getState().toast;
      expect(toast?.message).toContain('Selecciona un servicio');
    });

    it('should accept task', () => {
      createRequest('Electricidad', 'Tomacorriente');
      const requestId = useAppStore.getState().requests[0].id;
      
      acceptTask(requestId);
      const updatedRequest = useAppStore.getState().requests.find(r => r.id === requestId);
      expect(updatedRequest?.status).toBe('accepted');
    });

    it('should assign urgent request', () => {
      createRequest('Gasfitería', 'EMERGENCIA: fuga de gas');
      const requestId = useAppStore.getState().requests[0].id;
      
      assignUrgent(requestId, '1');
      const updatedRequest = useAppStore.getState().requests.find(r => r.id === requestId);
      expect(updatedRequest?.status).toBe('assigned');
      expect(updatedRequest?.professional).toBeDefined();
      expect(updatedRequest?.professional?.name).toBe('Jorge Mendoza');
    });
  });

  describe('useAuthStore', () => {
    it('should have initial auth state', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});