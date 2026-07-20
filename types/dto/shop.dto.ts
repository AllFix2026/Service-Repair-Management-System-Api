export interface GenerateShopIdsRequest {
  shop_name: string;
  owner_email: string;
}

export interface GenerateShopIdsResponse {
  shop_id: string;
  tenant_id: string;
}

export interface RegisterShopOwner {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface RegisterShopRequest {
  shop_id: string;
  tenant_id: string;
  shop_name: string;
  businessRegistration?: string;
  brn?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  branches?: string;
  repairTypes?: string[];
  plan?: string;
  owner: RegisterShopOwner;
}

export interface RegisterShopResponse {
  tenant: {
    id: string;
    name: string;
    createdAt: Date;
  };
  shop: {
    id: string;
    name: string;
    businessRegistration: string | null;
    tenantId: string;
    createdAt: Date;
  };
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    shopId: string | null;
  };
}

export interface SendVerificationRequest {
  user_id: string;
  email: string;
}