import { generatePaymentQR, processPayment, getActivePaymentConfig } from '../store/payment';
import type { ServiceRequest, Professional } from '../types';

export function renderPaymentQR(request: ServiceRequest, professional: Professional): string {
  const config = getActivePaymentConfig();
  if (!config) return '<div class="payment-error">No hay método de pago activo</div>';

  return `
    <div class="payment-qr-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <div class="payment-qr-overlay" onclick="closePaymentQR()"></div>
      <div class="payment-qr-container">
        <header class="payment-qr-header">
          <h2 id="payment-title">Pagar servicio</h2>
          <button class="payment-close" onclick="closePaymentQR()" aria-label="Cerrar">✕</button>
        </header>
        
        <div class="payment-qr-body">
          <div class="payment-info">
            <div class="payment-method-badge ${config.method}">${config.method.toUpperCase()}</div>
            <p class="payment-instruction">Escanea con tu app <strong>${config.method === 'yape' ? 'Yape' : 'Plin'}</strong> para pagar</p>
          </div>
          
          <div class="payment-qr-code" id="qr-code-container">
            <div class="qr-loading">Generando código QR...</div>
          </div>
          
          <div class="payment-amount">
            <span class="payment-label">Total a pagar</span>
            <span class="payment-total" id="payment-total">S/ 0.00</span>
          </div>
          
          <div class="payment-breakdown" id="payment-breakdown">
            <div class="breakdown-row">
              <span>Subtotal</span>
              <span id="breakdown-subtotal">S/ 0.00</span>
            </div>
            <div class="breakdown-row">
              <span>Comisión plataforma (15%)</span>
              <span id="breakdown-commission">S/ 0.00</span>
            </div>
            <div class="breakdown-row">
              <span>Fee procesamiento (3%)</span>
              <span id="breakdown-platform">S/ 0.00</span>
            </div>
            <div class="breakdown-row total">
              <span><strong>Recibe el profesional</strong></span>
              <span id="breakdown-worker"><strong>S/ 0.00</strong></span>
            </div>
          </div>
          
          <div class="payment-status" id="payment-status" style="display: none;">
            <div class="status-icon success">✓</div>
            <p>¡Pago completado!</p>
            <small>El profesional recibirá su pago en minutos</small>
          </div>
          
          <div class="payment-actions">
            <button class="primary payment-confirm" id="confirm-payment" onclick="confirmPayment('${request.id}', '${professional.id}')" disabled>
              Confirmar pago recibido
            </button>
            <button class="secondary" onclick="closePaymentQR()">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initPaymentQR(request: ServiceRequest, professional: Professional): void {
  const container = document.getElementById('qr-code-container');
  const totalEl = document.getElementById('payment-total');
  const subtotalEl = document.getElementById('breakdown-subtotal');
  const commissionEl = document.getElementById('breakdown-commission');
  const platformEl = document.getElementById('breakdown-platform');
  const workerEl = document.getElementById('breakdown-worker');
  const confirmBtn = document.getElementById('confirm-payment') as HTMLButtonElement;

  if (!container) return;

  generatePaymentQR('config-yape-main', request, professional)
    .then(({ qrDataUrl, split }) => {
      container.innerHTML = `<img src="${qrDataUrl}" alt="Código QR para pago con ${getActivePaymentConfig()?.method || 'Yape'}" class="qr-image">`;
      
      if (totalEl) totalEl.textContent = `S/ ${split.totalAmount.toFixed(2)}`;
      if (subtotalEl) subtotalEl.textContent = `S/ ${split.totalAmount.toFixed(2)}`;
      if (commissionEl) commissionEl.textContent = `S/ ${split.commissionAmount.toFixed(2)}`;
      if (platformEl) platformEl.textContent = `S/ ${split.platformAmount.toFixed(2)}`;
      if (workerEl) workerEl.textContent = `S/ ${split.workerAmount.toFixed(2)}`;
      
      if (confirmBtn) confirmBtn.disabled = false;
    })
    .catch(err => {
      container.innerHTML = `<div class="qr-error">Error generando QR: ${err.message}</div>`;
    });
}

(window as any).closePaymentQR = function() {
  const modal = document.querySelector('.payment-qr-modal');
  if (modal) modal.remove();
};

(window as any).confirmPayment = function(requestId: string, professionalId: string) {
  const request = { id: requestId, price: 150 } as ServiceRequest;
  const config = getActivePaymentConfig();
  if (!config) return;

  processPayment(requestId, config.id, request.price || 150, 'client-1', professionalId);
  
  const statusEl = document.getElementById('payment-status');
  const confirmBtn = document.getElementById('confirm-payment') as HTMLButtonElement;
  const qrContainer = document.getElementById('qr-code-container');
  
  if (statusEl) statusEl.style.display = 'block';
  if (qrContainer) qrContainer.style.display = 'none';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Pago confirmado ✓';
    confirmBtn.classList.add('accepted');
  }
  
  setTimeout(() => {
    const modal = document.querySelector('.payment-qr-modal');
    if (modal) modal.remove();
  }, 2000);
};