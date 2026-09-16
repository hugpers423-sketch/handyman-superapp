import { useAppStore } from '../store';

export function renderClientePage(): string {
  const state = useAppStore.getState();
  const selectedService = state.selectedService;
  
  return `
    <section class="page animate-slide-up" id="cliente" aria-labelledby="cliente-heading">
      <!-- Hero Section -->
      <div class="hero animate-fade-in stagger-1">
        <div class="hero-content">
          <div class="eyebrow animate-slide-up stagger-2">Lima · servicio disponible ahora</div>
          <h1 class="headline animate-slide-up stagger-3" id="cliente-heading">Cualquier problema.<br><b>Una sola app.</b></h1>
          <p class="sub animate-slide-up stagger-4">Conecta en minutos con profesionales verificados para tu hogar, negocio o empresa. Seguimiento en vivo y garantía incluida.</p>
          <button class="btn btn-primary btn-lg animate-scale-in stagger-5" onclick="document.getElementById('request').scrollIntoView({behavior:'smooth'})">
            Solicitar servicio ahora →
          </button>
        </div>
        <div class="hero-side animate-float stagger-6">
          <div class="hero-visual">
            <div class="ring-container">
              <div class="ring" aria-hidden="true"></div>
              <div class="ring-inner"></div>
            </div>
          </div>
          <div class="status-card card-hover animate-slide-up stagger-7">
            <div class="avatar-ring">
              <div class="avatar avatar-md">JM</div>
            </div>
            <div>
              <div style="font-weight: 600; color: var(--text-primary);">Jorge Mendoza</div>
              <small style="color: var(--text-tertiary);">Electricista · llega en 18 min</small>
            </div>
            <div class="status-dot online" style="width: 10px; height: 10px; margin-left: auto;" aria-hidden="true"></div>
          </div>
        </div>
      </div>

      <!-- Services Grid -->
      <section class="section animate-slide-up stagger-2" aria-labelledby="services-heading">
        <div class="section-header">
          <div class="eyebrow">Servicios disponibles</div>
          <h2 id="services-heading" style="font: var(--font-bold) var(--text-2xl) var(--font-display); color: var(--text-primary); margin: var(--space-2) 0;">¿Qué necesitas hoy?</h2>
        </div>
        <div class="service-grid" role="list" aria-label="Servicios disponibles">
          ${state.services.map((service, index) => `
            <button 
              class="service-card ${selectedService === service.name ? 'active' : ''}" 
              role="listitem"
              aria-pressed="${selectedService === service.name}"
              data-service="${service.name}"
              style="animation-delay: ${index * 50}ms;"
            >
              <div class="service-icon">${service.icon}</div>
              <div class="service-info">
                <b>${service.name}</b>
                <small>${service.description}</small>
              </div>
              <span class="service-arrow" aria-hidden="true">→</span>
            </button>
          `).join('')}
        </div>
      </section>

      <!-- Professionals & History -->
      <section class="split animate-slide-up stagger-3" aria-labelledby="pros-heading">
        <article class="card card-hover" aria-labelledby="pros-heading">
          <header class="card-header">
            <h3 id="pros-heading" class="card-title">Profesionales cerca de ti</h3>
            <span class="badge badge-primary">12 DISPONIBLES AHORA</span>
          </header>
          <div class="professionals-grid" role="list">
            ${state.professionals.map((pro, index) => `
              <article class="pro-card card-hover" role="listitem" style="animation-delay: ${index * 80}ms;">
                <div class="pro-header">
                  <div class="avatar-ring">
                    <div class="avatar avatar-md">${pro.avatar}</div>
                  </div>
                  <div>
                    <h4 style="margin: 0; font-size: var(--text-base);">${pro.name}</h4>
                    ${pro.verified ? '<span class="badge badge-success" style="font-size: var(--text-xs); margin-top: var(--space-1);">✓ Verificado</span>' : ''}
                  </div>
                </div>
                <div class="rating" style="margin: var(--space-3) 0;">
                  <span aria-hidden="true">★</span>
                  <b style="color: var(--text-primary);">${pro.rating}</b>
                  <span style="color: var(--text-tertiary); margin-left: var(--space-2);">(${pro.distance})</span>
                  ${pro.available ? '<span class="status-dot online" style="margin-left: var(--space-2);" aria-label="Disponible"></span>' : ''}
                </div>
                <div class="meta" style="margin-bottom: var(--space-3);">
                  <span>🛠 ${pro.specialty}</span>
                  <span>💰 ${pro.priceRange}</span>
                  <span>📍 ${pro.location}</span>
                </div>
                <button class="btn btn-primary btn-full" onclick="navigateTo('pro')">Ver perfil</button>
              </article>
            `).join('')}
          </div>
        </article>
        <article class="card" aria-labelledby="history-heading">
          <header class="card-header">
            <h3 id="history-heading" class="card-title">Tu historial reciente</h3>
            <span class="eyebrow">5 SERVICIOS ESTE MES</span>
          </header>
          <div class="request-history" role="list">
            ${state.requests.filter(r => r.client.role === 'cliente').slice(0, 3).map((req, index) => `
              <article class="request-item card-hover" role="listitem" style="animation-delay: ${index * 80}ms;">
                <div class="service-info">
                  <h4 style="margin: 0 0 var(--space-1);">${req.service}</h4>
                  <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-sm);">${req.detail}</p>
                </div>
                <div class="status">
                  <span class="badge ${getStatusBadgeClass(req.status)}">${getStatusLabel(req.status)}</span>
                </div>
              </article>
            `).join('')}
          </div>
        </article>
      </section>

      <!-- Emergency -->
      <section class="emergency-card animate-slide-up stagger-4" role="region" aria-label="Servicio de emergencia">
        <div class="emergency-icon" aria-hidden="true">🚨</div>
        <div>
          <strong>¿Es una emergencia?</strong>
          <p>Gas, electricidad, cerrajería o seguridad. Priorizamos tu solicitud y enviamos ayuda certificada.</p>
        </div>
        <button class="btn btn-error" data-emergency>Pedir ayuda urgente →</button>
      </section>

      <!-- Features -->
      <section class="section animate-slide-up stagger-5" aria-labelledby="features-heading">
        <div class="section-header">
          <div class="eyebrow">MÁS QUE UN SERVICIO</div>
          <h2 id="features-heading" style="font: var(--font-bold) var(--text-2xl) var(--font-display); color: var(--text-primary); margin: var(--space-2) 0;">Una app que anticipa.</h2>
        </div>
        <div class="features-grid">
          <article class="feature-card card-hover">
            <div class="feature-icon" style="background: linear-gradient(135deg, #d8ff67, #a4da36);">⌁</div>
            <h3>Diagnóstico Visual</h3>
            <p>Una foto o video ayuda a clasificar el oficio, urgencia y materiales.</            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('camera-input').click()">Probar ahora</button>
            <input type="file" id="camera-input" accept="image/*,video/*" hidden onchange="handleScan(this)">
          </article>
          <article class="feature-card feature-card-dark card-hover">
            <div class="feature-icon" style="background: var(--ink); color: var(--accent-lime);">✦</div>
            <h3>Garantía Handyman</h3>
            <p>Cada servicio registra evidencia antes/después y garantía según categoría.</            <div class="guarantee-badge">SERVICIO<br>GARANTIZADO</div>
          </article>
          <article class="feature-card feature-card-gold card-hover">
            <div class="feature-icon" style="background: #fff2d4; color: var(--gold);">★</div>
            <h3>Handy Points</h3>
            <div class="points">1,240</div>
            <p>Canjéalos por descuentos, mantenimientos y prioridad de atención.</            <button class="btn btn-primary btn-sm">Ver beneficios</button>
          </article>
        </div>
      </section>

      <!-- Tracking -->
      <section class="section animate-slide-up stagger-6" aria-labelledby="tracking-heading">
        <div class="section-header">
          <div class="eyebrow" style="color: var(--accent-lime);">SEGUIMIENTO EN TIEMPO REAL</div>
          <h2 id="tracking-heading" style="font: var(--font-bold) var(--text-2xl) var(--font-display); color: var(--text-primary); margin: var(--space-2) 0;">Tu servicio siempre bajo control.</h2>
          <span class="badge badge-warning">DEMO ACTIVA</span>
        </div>
        <div class="tracking-steps" role="list" aria-label="Pasos del servicio">
          ${state.trackingSteps.map((step, index) => `
            <div class="tracking-step ${step.status}" role="listitem" aria-current="${step.status === 'current' ? 'step' : undefined}" style="animation-delay: ${index * 100}ms;">
              <div class="step-marker">${step.icon}</div>
              <span class="step-label">${step.label}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Request Form -->
      <section id="request" class="section animate-slide-up stagger-7" aria-labelledby="request-heading">
        <div class="section-header">
          <div class="eyebrow">SOLICITAR SERVICIO</div>
          <h2 id="request-heading" style="font: var(--font-bold) var(--text-2xl) var(--font-display); color: var(--text-primary); margin: var(--space-2) 0;">Cuéntanos qué necesitas.</h2>
        </div>
        <form id="requestForm" class="card" novalidate>
          <div class="form-group">
            <label class="form-label" for="service">Tipo de servicio <span class="required"></span></label>
            <div class="input-wrapper">
              <select id="service" name="service" class="input-field select-field" required aria-required="true">
                <option value="">Selecciona un servicio</option>
                ${state.services.map(s => `<option value="${s.name}" ${selectedService === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="detail">Describe el problema <span class="required"></span></label>
            <div class="input-wrapper">
              <textarea id="detail" name="detail" class="input-field textarea-field" placeholder="Ej: Fuga de agua en cocina, necesito revisión de tuberías..." required aria-required="true"></textarea>
            </div>
          </div>
          <div class="form-actions" style="display: flex; gap: var(--space-3); margin-top: var(--space-6);">
            <button type="submit" class="btn btn-primary btn-full">Crear solicitud →</button>
            <button type="button" class="btn btn-secondary btn-full" onclick="navigateTo('cliente')">Cancelar</button>
          </div>
        </form>
      </section>
    </section>
  `;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge-success';
    case 'in_progress': return 'badge-warning';
    case 'en_route': return 'badge-info';
    case 'assigned': return 'badge-primary';
    default: return 'badge-neutral';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'Completado';
    case 'in_progress': return 'En servicio';
    case 'en_route': return 'En ruta';
    case 'assigned': return 'Asignado';
    default: return 'Pendiente';
  }
}