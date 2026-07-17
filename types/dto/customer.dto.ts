export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  loyaltyPoints?: number;
  tier?: string;
  preferences?: any;
  tags?: string[];

}


export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints?: number;
  tier?: string;
  preferences?: any;
  tags?: string[];

}


export interface CustomerResponse {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}