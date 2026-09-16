import { http, HttpResponse } from 'msw';
import type { Service, Professional, ServiceRequest, User } from '../types';

const mockServices: Service[] = [
  { id: '1', name: 'Gasfitería', icon: '🚰', description: 'Fugas, tuberías y griferías', category: 'hogar' },
  { id: '2', name: 'Electricidad', icon: '⚡', description: 'Instalación y emergencias', category: 'hogar' },
  { id: '3', name: 'Refrigeración', icon: '❄️', description: 'AC y electrodomésticos', category: 'hogar' },
  { id: '4', name: 'Hogar y obra', icon: '🛠️', description: 'Pintura, soldadura y más', category: 'hogar' },
  { id: '5', name: 'Limpieza', icon: '✨', description: 'Hogar, oficina y postobra', category: 'hogar' },
  { id: '6', name: 'Seguridad', icon: '🛡️', description: 'Cámaras, cerrajería y valores', category: 'seguridad' },
  { id: '7', name: 'Tecnología', icon: '💻', description: 'PC, redes y soporte técnico', category: 'tech' },
  { id: '8', name: 'Jardinería', icon: '🌿', description: 'Diseño y mantenimiento', category: 'exterior' }
];

const mockProfessionals: Professional[] = [
  { id: '1', name: 'Jorge Mendoza', avatar: 'JM', specialty: 'Electricista', rating: 4.9, distance: '2.4 km', priceRange: 'S/ 85–120', available: true, verified: true, location: 'Miraflores' },
  { id: '2', name: 'Rosa Alarcón', avatar: 'RA', specialty: 'Gasfitero', rating: 4.8, distance: '1.8 km', priceRange: 'S/ 70–100', available: true, verified: true, location: 'San Isidro' },
  { id: '3', name: 'Carlos Méndez', avatar: 'CM', specialty: 'Refrigeración', rating: 4.7, distance: '3.2 km', priceRange: 'S/ 120–180', available: true, verified: true, location: 'Surco' },
  { id: '4', name: 'Daniela Vega', avatar: 'DV', specialty: 'Limpieza', rating: 4.9, distance: '2.1 km', priceRange: 'S/ 60–90', available: true, verified: true, location: 'Miraflores' },
  { id: '5', name: 'Miguel Torres', avatar: 'MT', specialty: 'Seguridad', rating: 4.6, distance: '4.0 km', priceRange: 'S/ 150–200', available: true, verified: true, location: 'La Molina' }
];

let mockRequests: ServiceRequest[] = [
  { id: 'HM-2841', service: 'Gasfitería', detail: 'Posible fuga de gas', status: 'pending', client: { id: '1', name: 'Andrea Ruiz', email: 'andrea@email.com', avatar: 'AR', role: 'cliente', verified: true }, createdAt: new Date(), updatedAt: new Date(), location: 'Miraflores', urgency: 'emergency' },
  { id: 'HM-2839', service: 'Refrigeración', detail: 'Instalación AC', status: 'en_route', client: { id: '2', name: 'Javier León', email: 'javier@email.com', avatar: 'JL', role: 'cliente', verified: true }, professional: mockProfessionals[2], createdAt: new Date(), updatedAt: new Date(), location: 'San Isidro', urgency: 'medium' },
  { id: 'HM-2835', service: 'Limpieza', detail: 'Limpieza de oficina', status: 'in_progress', client: { id: '3', name: 'María Torres', email: 'maria@email.com', avatar: 'MT', role: 'cliente', verified: true }, professional: mockProfessionals[3], createdAt: new Date(), updatedAt: new Date(), location: 'Surco', urgency: 'low' }
];

const mockUser: User = {
  id: 'current',
  name: 'Victor Reyes',
  email: 'victor@email.com',
  avatar: 'VR',
  role: 'cliente',
  verified: true
};

export const handlers = [
  http.get('/api/services', () => {
    return HttpResponse.json(mockServices);
  }),

  http.get('/api/professionals', () => {
    return HttpResponse.json(mockProfessionals);
  }),

  http.get('/api/professionals/:id', ({ params }) => {
    const professional = mockProfessionals.find(p => p.id === params.id);
    if (!professional) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(professional);
  }),

  http.get('/api/requests', () => {
    return HttpResponse.json(mockRequests);
  }),

  http.get('/api/requests/:id', ({ params }) => {
    const request = mockRequests.find(r => r.id === params.id);
    if (!request) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(request);
  }),

  http.post('/api/requests', async ({ request }) => {
    const body = await request.json() as { service: string; detail: string; location?: string };
    const newRequest: ServiceRequest = {
      id: `HM-${Date.now()}`,
      service: body.service,
      detail: body.detail,
      status: 'pending',
      client: mockUser,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: body.location || 'Lima',
      urgency: body.detail.includes('EMERGENCIA') ? 'emergency' : 'medium'
    };
    mockRequests = [newRequest, ...mockRequests];
    return HttpResponse.json(newRequest, { status: 201 });
  }),

  http.patch('/api/requests/:id', async ({ params, request }) => {
    const body = await request.json() as Partial<ServiceRequest>;
    const index = mockRequests.findIndex(r => r.id === params.id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    mockRequests[index] = { ...mockRequests[index], ...body, updatedAt: new Date() };
    return HttpResponse.json(mockRequests[index]);
  }),

  http.post('/api/requests/:id/assign', async ({ params, request }) => {
    const body = await request.json() as { professionalId: string };
    const requestIndex = mockRequests.findIndex(r => r.id === params.id);
    const professional = mockProfessionals.find(p => p.id === body.professionalId);
    
    if (requestIndex === -1 || !professional) {
      return new HttpResponse(null, { status: 404 });
    }
    
    mockRequests[requestIndex] = { 
      ...mockRequests[requestIndex], 
      status: 'assigned', 
      professional, 
      updatedAt: new Date() 
    };
    return HttpResponse.json(mockRequests[requestIndex]);
  }),

  http.get('/api/user/me', () => {
    return HttpResponse.json(mockUser);
  }),

  http.get('/api/metrics', () => {
    return HttpResponse.json({
      activeServices: 126,
      avgAssignmentTime: 24,
      satisfaction: 94.6,
      openIncidents: 18,
      proMetrics: {
        monthlyEarnings: 1840,
        rating: 4.9,
        completedServices: 18,
        acceptanceRate: 92
      },
      enterpriseMetrics: {
        locations: 8,
        servicesThisMonth: 32,
        estimatedSavings: 8420,
        slaCompliance: 97
      }
    });
  }),

  http.post('/api/ai/analyze-image', async () => {
    await new Promise(r => setTimeout(r, 1000));
    return HttpResponse.json({
      service: 'Gasfitería',
      urgency: 'medium',
      suggestedMaterials: ['Sello de goma', 'Sifón', 'Cinta teflón'],
      confidence: 0.87
    });
  })
];