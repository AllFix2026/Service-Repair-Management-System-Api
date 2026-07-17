import crypto from 'crypto';
import { logger } from '@/config/logger.config';

interface PayHereParams {
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: string;
  amount: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

export const generatePayHereHash = (
  merchantId: string,
  orderId: string,
  amount: number,
  currency: string,
  merchantSecret: string
): string => {
  const amountFormatted = amount.toFixed(2);
  const hash = crypto
    .createHash('md5')
    .update(
      merchantId +
      orderId +
      amountFormatted +
      currency +
      crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
    )
    .digest('hex')
    .toUpperCase();
  
  return hash;
};

export const getPayHereConfig = () => {
  return {
    merchant_id: process.env.PAYHERE_MERCHANT_ID || '',
    merchant_secret: process.env.PAYHERE_MERCHANT_SECRET || process.env.PAYHERE_SECRET || '',
    is_sandbox: process.env.PAYHERE_MODE === 'sandbox',
  };
};
