export type UserRole = 'cliente' | 'pro' | 'ops' | 'empresa' | 'staff' | 'admin' 
  | 'protection-coverage' | 'protection-contributions' | 'protection-claims' | 'protection-admin';

export type StaffRole = 'admin' | 'staff' | 'finance';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: StaffRole;
  permissions: string[];
  lastLogin: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  verified: boolean;
}

export interface Service {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

export interface Professional {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  rating: number;
  distance: string;
  priceRange: string;
  available: boolean;
  verified: boolean;
  location: string;
}

export interface ServiceRequest {
  id: string;
  service: string;
  detail: string;
  status: 'pending' | 'assigned' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'accepted';
  client: User;
  professional?: Professional;
  createdAt: Date;
  updatedAt: Date;
  location: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  price?: number;
  distance?: string;
  priceRange?: string;
  time?: string;
}

export interface Metric {
  label: string;
  value: string | number;
  progress: number;
  color?: string;
}

export interface Task {
  id: string;
  title: string;
  client: string;
  location: string;
  distance: string;
  priceRange: string;
  time: string;
  status: 'new' | 'accepted' | 'completed';
}

export interface EnterpriseMetrics {
  locations: number;
  servicesThisMonth: number;
  estimatedSavings: number;
  slaCompliance: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  features: string[];
  price: string;
  featured?: boolean;
  cta: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface TrackingStep {
  id: number;
  label: string;
  status: 'completed' | 'current' | 'pending';
  icon: string;
}

export type PaymentMethod = 'yape' | 'plin' | 'efectivo' | 'tarjeta' | 'transferencia';

export interface PaymentConfig {
  id: string;
  method: PaymentMethod;
  businessName: string;
  phoneNumber: string;
  qrCodeData: string;
  qrCodeImage?: string;
  commissionRate: number;
  isActive: boolean;
  updatedAt: Date;
  updatedBy: string;
}

export interface PaymentSplit {
  totalAmount: number;
  commissionAmount: number;
  workerAmount: number;
  platformAmount: number;
  currency: 'PEN';
}

export interface Transaction {
  id: string;
  requestId: string;
  paymentConfigId: string;
  amount: number;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  split: PaymentSplit;
  paidAt?: Date;
  qrCodeUsed: string;
  clientId: string;
  professionalId: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'staff' | 'finance';
  permissions: string[];
  lastLogin: Date;
}

export interface MembershipConfig {
  earlyAdopterMonthsFree: number;
  earlyAdopterCutoffDate: Date;
  monthlyFee: number;
  currency: 'PEN';
  gracePeriodDays: number;
  isActive: boolean;
  updatedAt: Date;
  updatedBy: string;
}

export interface ProfessionalWallet {
  professionalId: string;
  balance: number;
  currency: 'PEN';
  totalEarned: number;
  totalSpent: number;
  lastRechargeAt?: Date;
  lastFeeDeductedAt?: Date;
  membershipStatus: 'free' | 'active' | 'suspended' | 'grace_period';
  joinedAt: Date;
  freeMonthsUsed: number;
  freeMonthsTotal: number;
}

export interface CreditRecharge {
  id: string;
  professionalId: string;
  amount: number;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed';
  reference: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface FeeDeduction {
  id: string;
  professionalId: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  status: 'pending' | 'completed' | 'failed';
  deductedAt?: Date;
  walletBalanceAfter: number;
}

// Protection types
export interface WorkerProtectionConfig {
  id: string;
  name: string;
  description?: string;
  contributionRate: number;
  minContribution: number;
  maxContribution: number;
  coverageDetails: CoverageDetail[];
  minJobsForFullCover: number;
  waitingPeriodDays: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoverageDetail {
  type: 'WORK_ACCIDENT' | 'ILLNESS' | 'DISABILITY_TEMPORARY' | 'DISABILITY_PERMANENT' | 'DEATH' | 'CIVIL_LIABILITY' | 'TOOLS_THEFT';
  amount: number;
  description?: string;
}

export interface WorkerProtectionContribution {
  id: string;
  requestId: string;
  professionalId: string;
  configId: string;
  serviceAmount: number;
  contributionRate: number;
  contributionAmount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'REFUNDED';
  processedAt?: Date;
  createdAt: Date;
  request?: {
    id: string;
    requestNumber: string;
    service: { name: string };
    completedAt?: Date;
  };
  config?: { id: string; name: string };
}

export interface WorkerProtectionCoverage {
  id: string;
  professionalId: string;
  configId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CLAIMED';
  jobsThisMonth: number;
  totalContributed: number;
  coverageStartDate: Date;
  lastClaimDate?: Date;
  beneficiaries: Beneficiary[];
  config?: WorkerProtectionConfig;
  claims?: WorkerProtectionClaim[];
}

export interface Beneficiary {
  name: string;
  relationship: string;
  percentage: number;
  document?: string;
}

export interface WorkerProtectionClaim {
  id: string;
  coverageId: string;
  professionalId: string;
  type: 'WORK_ACCIDENT' | 'ILLNESS' | 'DISABILITY_TEMPORARY' | 'DISABILITY_PERMANENT' | 'DEATH' | 'CIVIL_LIABILITY' | 'TOOLS_THEFT';
  description: string;
  incidentDate: Date;
  incidentLocation?: string;
  amountClaimed: number;
  amountApproved?: number;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID' | 'APPEALED';
  documents?: Document[];
  reviewedById?: string;
  reviewedAt?: Date;
  resolutionNotes?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  coverage?: { config: { name: string } };
  reviewedBy?: { id: string; name: string };
}

export interface Document {
  name: string;
  url: string;
  type: string;
}

export interface WorkerProtectionStatement {
  id: string;
  professionalId: string;
  periodStart: Date;
  periodEnd: Date;
  jobsCount: number;
  totalServices: number;
  totalContributed: number;
  coverageStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CLAIMED';
  createdAt: Date;
  coverage?: { config: { name: string } };
}