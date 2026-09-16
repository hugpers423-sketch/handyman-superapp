import QRCode from 'qrcode';
import { useAppStore, showToast } from './index';
import type { 
  PaymentConfig, PaymentMethod, PaymentSplit, Transaction, StaffUser, 
  ServiceRequest, Professional, MembershipConfig, ProfessionalWallet, 
  CreditRecharge, FeeDeduction
} from '../types';

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((s: T) => Partial<T>)) => {
      state = typeof partial === 'function' ? { ...state, ...partial(state) } : { ...state, ...partial };
      listeners.forEach(l => l());
    },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); }
  };
}

const DEFAULT_COMMISSION_RATE = 0.15;
const PLATFORM_FEE_RATE = 0.03;

const now = new Date();
const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

export function generateYapePlinQR(method: PaymentMethod, phoneNumber: string, amount: number, businessName: string, reference: string): string {
  const currency = 'PEN';
  const formattedAmount = amount.toFixed(2);
  
  if (method === 'yape') {
    return `yape://pay?phone=${phoneNumber}&amount=${formattedAmount}&currency=${currency}&merchant=${encodeURIComponent(businessName)}&reference=${reference}`;
  }
  
  if (method === 'plin') {
    return `plin://pay?phone=${phoneNumber}&amount=${formattedAmount}&currency=${currency}&merchant=${encodeURIComponent(businessName)}&reference=${reference}`;
  }
  
  return `https://www.bcp.com.pe/yape/plin?phone=${phoneNumber}&amount=${formattedAmount}`;
}

function calculateSplit(totalAmount: number, commissionRate: number = DEFAULT_COMMISSION_RATE): PaymentSplit {
  const commissionAmount = Math.round(totalAmount * commissionRate * 100) / 100;
  const platformFee = Math.round(totalAmount * PLATFORM_FEE_RATE * 100) / 100;
  const workerAmount = Math.round((totalAmount - commissionAmount - platformFee) * 100) / 100;
  
  return {
    totalAmount,
    commissionAmount,
    workerAmount,
    platformAmount: platformFee,
    currency: 'PEN'
  };
}

function isEarlyAdopter(joinedAt: Date): boolean {
  return joinedAt <= twoMonthsAgo;
}

function getMonthsSinceJoined(joinedAt: Date): number {
  const now = new Date();
  return (now.getFullYear() - joinedAt.getFullYear()) * 12 + (now.getMonth() - joinedAt.getMonth());
}

function calculateMembershipStatus(wallet: ProfessionalWallet, config: MembershipConfig): ProfessionalWallet['membershipStatus'] {
  if (!config.isActive) return 'free';
  
  const monthsSinceJoined = getMonthsSinceJoined(wallet.joinedAt);
  const isEarlyAdopterUser = isEarlyAdopter(wallet.joinedAt);
  const freeMonthsAllowed = isEarlyAdopterUser ? config.earlyAdopterMonthsFree : 0;
  
  if (monthsSinceJoined < freeMonthsAllowed) return 'free';
  if (wallet.balance >= config.monthlyFee) return 'active';
  if (wallet.balance > 0) return 'grace_period';
  return 'suspended';
}

export const usePaymentStore = createStore<{
  paymentConfigs: PaymentConfig[];
  transactions: Transaction[];
  staffUsers: StaffUser[];
  activeConfigId: string | null;
  membershipConfig: MembershipConfig;
  wallets: ProfessionalWallet[];
  recharges: CreditRecharge[];
  feeDeductions: FeeDeduction[];
}>({
  paymentConfigs: [
    {
      id: 'config-yape-main',
      method: 'yape',
      businessName: 'HANDYMAN PERÚ',
      phoneNumber: '999888777',
      qrCodeData: '',
      commissionRate: 0.15,
      isActive: true,
      updatedAt: new Date(),
      updatedBy: 'admin'
    },
    {
      id: 'config-plin-main',
      method: 'plin',
      businessName: 'HANDYMAN PERÚ',
      phoneNumber: '999888777',
      qrCodeData: '',
      commissionRate: 0.15,
      isActive: true,
      updatedAt: new Date(),
      updatedBy: 'admin'
    }
  ],
  transactions: [],
  staffUsers: [
    { id: 'staff-1', name: 'Admin Principal', email: 'admin@handyman.pe', avatar: 'AP', role: 'admin', permissions: ['all'], lastLogin: new Date() },
    { id: 'staff-2', name: 'María Finanzas', email: 'finanzas@handyman.pe', avatar: 'MF', role: 'finance', permissions: ['payments', 'reports', 'commissions'], lastLogin: new Date() },
    { id: 'staff-3', name: 'Carlos Operaciones', email: 'ops@handyman.pe', avatar: 'CO', role: 'staff', permissions: ['payments', 'qr-management'], lastLogin: new Date() }
  ],
  activeConfigId: 'config-yape-main',
  membershipConfig: {
    earlyAdopterMonthsFree: 2,
    earlyAdopterCutoffDate: twoMonthsAgo,
    monthlyFee: 49.00,
    currency: 'PEN',
    gracePeriodDays: 7,
    isActive: true,
    updatedAt: new Date(),
    updatedBy: 'admin'
  },
  wallets: [
    {
      professionalId: '1',
      balance: 0,
      currency: 'PEN',
      totalEarned: 0,
      totalSpent: 0,
      membershipStatus: 'free',
      joinedAt: new Date('2026-07-01'),
      freeMonthsUsed: 0,
      freeMonthsTotal: 2
    },
    {
      professionalId: '2',
      balance: 0,
      currency: 'PEN',
      totalEarned: 0,
      totalSpent: 0,
      membershipStatus: 'free',
      joinedAt: new Date('2026-08-15'),
      freeMonthsUsed: 0,
      freeMonthsTotal: 2
    },
    {
      professionalId: '3',
      balance: 0,
      currency: 'PEN',
      totalEarned: 0,
      totalSpent: 0,
      membershipStatus: 'free',
      joinedAt: new Date('2026-09-01'),
      freeMonthsUsed: 0,
      freeMonthsTotal: 0
    }
  ],
  recharges: [],
  feeDeductions: []
});

export async function generatePaymentQR(
  configId: string, 
  request: ServiceRequest, 
  professional: Professional
): Promise<{ qrDataUrl: string; qrString: string; split: PaymentSplit }> {
  const config = usePaymentStore.getState().paymentConfigs.find(c => c.id === configId);
  if (!config || !config.isActive) throw new Error('Configuración de pago no válida');

  const amount = request.price || parseFloat(professional.priceRange.split('–')[0].replace('S/ ', ''));
  const reference = `HM-${request.id}-${professional.id}`;
  
  const qrString = generateYapePlinQR(config.method, config.phoneNumber, amount, config.businessName, reference);
  const qrDataUrl = await QRCode.toDataURL(qrString, {
    width: 300,
    margin: 2,
    color: { dark: '#0a2922', light: '#ffffff' },
    errorCorrectionLevel: 'M'
  });

  const split = calculateSplit(amount, config.commissionRate);
  
  usePaymentStore.setState(s => ({
    paymentConfigs: s.paymentConfigs.map(c => c.id === configId ? { ...c, qrCodeData: qrString, qrCodeImage: qrDataUrl, updatedAt: new Date() } : c)
  }));

  return { qrDataUrl, qrString, split };
}

export function processPayment(
  requestId: string,
  configId: string,
  amount: number,
  clientId: string,
  professionalId: string
): Transaction {
  const config = usePaymentStore.getState().paymentConfigs.find(c => c.id === configId);
  if (!config) throw new Error('Configuración no encontrada');

  const split = calculateSplit(amount, config.commissionRate);
  
  const transaction: Transaction = {
    id: `TXN-${Date.now()}`,
    requestId,
    paymentConfigId: configId,
    amount,
    method: config.method,
    status: 'completed',
    split,
    paidAt: new Date(),
    qrCodeUsed: config.qrCodeData,
    clientId,
    professionalId
  };

  usePaymentStore.setState(s => { 
    const updatedTransactions = [transaction, ...s.transactions];
    const updatedWallets = s.wallets.map(w => {
      if (w.professionalId === professionalId) {
        return {
          ...w,
          balance: w.balance + split.workerAmount,
          totalEarned: w.totalEarned + split.workerAmount,
          membershipStatus: calculateMembershipStatus(
            { ...w, balance: w.balance + split.workerAmount, totalEarned: w.totalEarned + split.workerAmount },
            s.membershipConfig
          )
        };
      }
      return w;
    });
    return { transactions: updatedTransactions, wallets: updatedWallets };
  });
  
  return transaction;
}

export function updatePaymentConfig(configId: string, updates: Partial<PaymentConfig>, staffId: string): void {
  usePaymentStore.setState(s => ({
    paymentConfigs: s.paymentConfigs.map(c => c.id === configId ? { ...c, ...updates, updatedAt: new Date(), updatedBy: staffId } : c)
  }));
}

export function togglePaymentConfig(configId: string, staffId: string): void {
  usePaymentStore.setState(s => ({
    paymentConfigs: s.paymentConfigs.map(c => c.id === configId ? { ...c, isActive: !c.isActive, updatedAt: new Date(), updatedBy: staffId } : c)
  }));
}

export function setActivePaymentConfig(configId: string): void {
  usePaymentStore.setState({ activeConfigId: configId });
}

export function getActivePaymentConfig(): PaymentConfig | undefined {
  const state = usePaymentStore.getState();
  return state.paymentConfigs.find(c => c.id === state.activeConfigId && c.isActive);
}

export function getPaymentConfigs(): PaymentConfig[] {
  return usePaymentStore.getState().paymentConfigs;
}

export function getTransactions(): Transaction[] {
  return usePaymentStore.getState().transactions;
}

export function getStaffUsers(): StaffUser[] {
  return usePaymentStore.getState().staffUsers;
}

export function getTransactionByRequestId(requestId: string): Transaction | undefined {
  return usePaymentStore.getState().transactions.find(t => t.requestId === requestId);
}

export function getTotalEarnings(professionalId: string): number {
  return usePaymentStore.getState().transactions
    .filter(t => t.professionalId === professionalId && t.status === 'completed')
    .reduce((sum, t) => sum + t.split.workerAmount, 0);
}

export function getTotalCommissions(): number {
  return usePaymentStore.getState().transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.split.commissionAmount, 0);
}

export function getPlatformRevenue(): number {
  return usePaymentStore.getState().transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.split.platformAmount, 0);
}

// ===== WALLET & MEMBERSHIP =====

export function getWallet(professionalId: string): ProfessionalWallet | undefined {
  return usePaymentStore.getState().wallets.find(w => w.professionalId === professionalId);
}

export function getAllWallets(): ProfessionalWallet[] {
  return usePaymentStore.getState().wallets;
}

export function getMembershipConfig(): MembershipConfig {
  return usePaymentStore.getState().membershipConfig;
}

export function updateMembershipConfig(updates: Partial<MembershipConfig>, staffId: string): void {
  usePaymentStore.setState(s => ({
    membershipConfig: { ...s.membershipConfig, ...updates, updatedAt: new Date(), updatedBy: staffId }
  }));
  
  recalculateAllMembershipStatus();
}

function recalculateAllMembershipStatus(): void {
  usePaymentStore.setState(s => ({
    wallets: s.wallets.map(w => ({
      ...w,
      membershipStatus: calculateMembershipStatus(w, s.membershipConfig)
    }))
  }));
}

export function rechargeWallet(
  professionalId: string, 
  amount: number, 
  method: PaymentMethod,
  _staffId: string = 'staff-current'
): CreditRecharge {
  const recharge: CreditRecharge = {
    id: `RCH-${Date.now()}`,
    professionalId,
    amount,
    method,
    status: 'completed',
    reference: `RECHARGE-${professionalId}-${Date.now()}`,
    createdAt: new Date(),
    completedAt: new Date()
  };

  usePaymentStore.setState(s => {
    const updatedWallets = s.wallets.map(w => {
      if (w.professionalId === professionalId) {
        const newBalance = w.balance + amount;
        return {
          ...w,
          balance: newBalance,
          totalSpent: w.totalSpent + amount,
          lastRechargeAt: new Date(),
          membershipStatus: calculateMembershipStatus(
            { ...w, balance: newBalance },
            s.membershipConfig
          )
        };
      }
      return w;
    });
    return { wallets: updatedWallets, recharges: [recharge, ...s.recharges] };
  });

  showToast(`Recarga de S/ ${amount.toFixed(2)} procesada`, 'success');
  return recharge;
}

export function deductMonthlyFee(professionalId: string): FeeDeduction | null {
  const state = usePaymentStore.getState();
  const wallet = state.wallets.find(w => w.professionalId === professionalId);
  const config = state.membershipConfig;
  
  if (!wallet || !config.isActive) return null;

  const monthsSinceJoined = getMonthsSinceJoined(wallet.joinedAt);
  const isEarlyAdopterUser = isEarlyAdopter(wallet.joinedAt);
  const freeMonthsAllowed = isEarlyAdopterUser ? config.earlyAdopterMonthsFree : 0;
  
  if (monthsSinceJoined < freeMonthsAllowed) {
    return null;
  }

  if (wallet.balance < config.monthlyFee) {
    return null;
  }

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(0);
  periodEnd.setHours(23, 59, 59, 999);

  const deduction: FeeDeduction = {
    id: `FEE-${Date.now()}`,
    professionalId,
    amount: config.monthlyFee,
    periodStart,
    periodEnd,
    status: 'completed',
    deductedAt: new Date(),
    walletBalanceAfter: wallet.balance - config.monthlyFee
  };

  usePaymentStore.setState(s => {
    const updatedWallets = s.wallets.map(w => {
      if (w.professionalId === professionalId) {
        return {
          ...w,
          balance: w.balance - config.monthlyFee,
          lastFeeDeductedAt: new Date(),
          membershipStatus: calculateMembershipStatus(
            { ...w, balance: w.balance - config.monthlyFee },
            s.membershipConfig
          )
        };
      }
      return w;
    });
    return { wallets: updatedWallets, feeDeductions: [deduction, ...s.feeDeductions] };
  });

  return deduction;
}

export function deductAllMonthlyFees(): FeeDeduction[] {
  const state = usePaymentStore.getState();
  const results: FeeDeduction[] = [];
  
  state.wallets.forEach(wallet => {
    const deduction = deductMonthlyFee(wallet.professionalId);
    if (deduction) results.push(deduction);
  });
  
  return results;
}

export function getRecharges(professionalId?: string): CreditRecharge[] {
  const state = usePaymentStore.getState();
  return professionalId 
    ? state.recharges.filter(r => r.professionalId === professionalId)
    : state.recharges;
}

export function getFeeDeductions(professionalId?: string): FeeDeduction[] {
  const state = usePaymentStore.getState();
  return professionalId 
    ? state.feeDeductions.filter(f => f.professionalId === professionalId)
    : state.feeDeductions;
}

export function getProfessionalMembershipInfo(professionalId: string): {
  wallet: ProfessionalWallet | undefined;
  config: MembershipConfig;
  isEarlyAdopter: boolean;
  monthsUntilFee: number;
  nextFeeDate: Date | null;
} {
  const state = usePaymentStore.getState();
  const wallet = state.wallets.find(w => w.professionalId === professionalId);
  const config = state.membershipConfig;
  
  if (!wallet) {
    return { wallet: undefined, config, isEarlyAdopter: false, monthsUntilFee: 0, nextFeeDate: null };
  }

  const isEarlyAdopterUser = isEarlyAdopter(wallet.joinedAt);
  const monthsSinceJoined = getMonthsSinceJoined(wallet.joinedAt);
  const freeMonthsAllowed = isEarlyAdopterUser ? config.earlyAdopterMonthsFree : 0;
  const monthsUntilFee = Math.max(0, freeMonthsAllowed - monthsSinceJoined);
  
  let nextFeeDate: Date | null = null;
  if (monthsSinceJoined >= freeMonthsAllowed) {
    nextFeeDate = new Date();
    nextFeeDate.setDate(1);
    nextFeeDate.setMonth(nextFeeDate.getMonth() + 1);
    nextFeeDate.setHours(0, 0, 0, 0);
  } else {
    nextFeeDate = new Date(wallet.joinedAt);
    nextFeeDate.setMonth(nextFeeDate.getMonth() + freeMonthsAllowed);
    nextFeeDate.setDate(1);
    nextFeeDate.setHours(0, 0, 0, 0);
  }

  return { wallet, config, isEarlyAdopter: isEarlyAdopterUser, monthsUntilFee, nextFeeDate };
}

export function startService(requestId: string): void {
  useAppStore.setState(s => ({
    requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'in_progress', updatedAt: new Date() } : r)
  }));
  
  showToast('Servicio iniciado. Buen trabajo!', 'success');
}

export function finishService(requestId: string): void {
  const requests = useAppStore.getState().requests;
  const request = requests.find(r => r.id === requestId);
  if (!request || !request.professional) return;

  const config = getActivePaymentConfig();
  if (!config) {
    showToast('No hay método de pago configurado', 'error');
    return;
  }

  const amount = request.price || 150;
  const modalHTML = `
    <div class="payment-qr-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <div class="payment-qr-overlay" onclick="closePaymentQR()"></div>
      <div class="payment-qr-container">
        <header class="payment-qr-header">
          <h2 id="payment-title">Cobrar servicio</h2>
          <button class="payment-close" onclick="closePaymentQR()" aria-label="Cerrar">✕</button>
        </header>
        <div class="payment-qr-body">
          <div class="payment-info">
            <div class="payment-method-badge ${config.method}">${config.method.toUpperCase()}</div>
            <p class="payment-instruction">Muestra este QR al cliente para que pague con <strong>${config.method === 'yape' ? 'Yape' : 'Plin'}</strong></p>
          </div>
          <div class="payment-qr-code" id="qr-code-container">
            <div class="qr-loading">Generando código QR...</div>
          </div>
          <div class="payment-amount">
            <span class="payment-label">Total a cobrar</span>
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
              <span><strong>Tu ganancia neta</strong></span>
              <span id="breakdown-worker"><strong>S/ 0.00</strong></span>
            </div>
          </div>
          <div class="payment-status" id="payment-status" style="display: none;">
            <div class="status-icon success">✓</div>
            <p>¡Pago confirmado!</p>
            <small>Recibirás S/ <span id="worker-amount">0.00</span> en tu cuenta</small>
          </div>
          <div class="payment-actions">
            <button class="primary payment-confirm" id="confirm-payment" onclick="confirmPaymentFinish('${requestId}', '${request.professional.id}')" disabled>
              Confirmar pago recibido
            </button>
            <button class="secondary" onclick="closePaymentQR()">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  initPaymentQRFinish(request, request.professional, amount);
}

async function initPaymentQRFinish(request: any, professional: any, amount: number): Promise<void> {
  const config = getActivePaymentConfig();
  if (!config) return;

  const container = document.getElementById('qr-code-container');
  const totalEl = document.getElementById('payment-total');
  const subtotalEl = document.getElementById('breakdown-subtotal');
  const commissionEl = document.getElementById('breakdown-commission');
  const platformEl = document.getElementById('breakdown-platform');
  const workerEl = document.getElementById('breakdown-worker');
  const confirmBtn = document.getElementById('confirm-payment') as HTMLButtonElement;
  const workerAmountEl = document.getElementById('worker-amount');

  if (!container) return;

  try {
    const qrString = generateYapePlinQR(config.method, config.phoneNumber, amount, config.businessName, `HM-${request.id}-${professional.id}`);
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      width: 300,
      margin: 2,
      color: { dark: '#0a2922', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });

    const split = calculateSplit(amount, config.commissionRate);
    
    container.innerHTML = `<img src="${qrDataUrl}" alt="Código QR para pago con ${config.method}" class="qr-image">`;
    
    if (totalEl) totalEl.textContent = `S/ ${split.totalAmount.toFixed(2)}`;
    if (subtotalEl) subtotalEl.textContent = `S/ ${split.totalAmount.toFixed(2)}`;
    if (commissionEl) commissionEl.textContent = `S/ ${split.commissionAmount.toFixed(2)}`;
    if (platformEl) platformEl.textContent = `S/ ${split.platformAmount.toFixed(2)}`;
    if (workerEl) workerEl.textContent = `S/ ${split.workerAmount.toFixed(2)}`;
    if (workerAmountEl) workerAmountEl.textContent = split.workerAmount.toFixed(2);
    
    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    container.innerHTML = `<div class="qr-error">Error generando QR: ${errorMessage}</div>`;
  }
}

(window as any).confirmPaymentFinish = function(requestId: string, professionalId: string) {
  const requests = useAppStore.getState().requests;
  const request = requests.find(r => r.id === requestId);
  if (!request) return;

  const config = getActivePaymentConfig();
  if (!config) return;

  const amount = request.price || 150;
  processPayment(requestId, config.id, amount, request.client.id, professionalId);
  
  useAppStore.setState(s => ({
    requests: s.requests.map(r => r.id === requestId ? { ...r, status: 'completed', updatedAt: new Date() } : r)
  }));

  const statusEl = document.getElementById('payment-status');
  const qrContainer = document.getElementById('qr-code-container');
  const confirmBtn = document.getElementById('confirm-payment') as HTMLButtonElement;
  const breakdown = document.getElementById('payment-breakdown');
  
  if (statusEl) statusEl.style.display = 'block';
  if (qrContainer) qrContainer.style.display = 'none';
  if (breakdown) breakdown.style.display = 'none';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Pago confirmado ✓';
    confirmBtn.classList.add('accepted');
  }
  
  showToast(`¡Servicio completado! Ganancia: S/ ${calculateSplit(amount, config.commissionRate).workerAmount.toFixed(2)}`, 'success');
  
  setTimeout(() => {
    const modal = document.querySelector('.payment-qr-modal');
    if (modal) modal.remove();
  }, 2500);
};

(window as any).closePaymentQR = function() {
  const modal = document.querySelector('.payment-qr-modal');
  if (modal) modal.remove();
};