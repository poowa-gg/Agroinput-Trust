export interface AgroInput {
  id?: string;
  code: string;
  product: string;
  manufacturer: string;
  status: 'VERIFIED' | 'USED' | 'UNKNOWN' | 'SUSPICIOUS';
  expiryDate: string;
}

export interface VerificationLog {
  id?: string;
  code: string;
  phoneNumber: string;
  result: string;
  timestamp: string;
}

export interface CounterfeitReport {
  id?: string;
  phoneNumber: string;
  location: string;
  description: string;
  timestamp: string;
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED';
}
