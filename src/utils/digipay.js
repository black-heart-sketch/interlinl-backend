const { DigiPay } = require('digipay-sdk');

let client;

const getClient = () => {
  if (client) return client;

  const apiKey = process.env.DIGIPAY_API_KEY;
  if (!apiKey) {
    throw new Error('DIGIPAY_API_KEY is not configured.');
  }

  client = new DigiPay({
    apiKey,
    environment: process.env.DIGIPAY_ENV || 'production'
  });

  return client;
};

const checkBalance = async () => {
  return getClient().settlements.getBalance();
};

const normalizePhone = (phone) => {
  if (!phone) return '';

  let digits = String(phone).trim().replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('6')) digits = `237${digits}`;

  return digits;
};

const toDigipayError = (error, fallbackMessage) => {
  const rawMessage = error.rawResponse?.message || error.response?.data?.message || error.message;
  const message = typeof rawMessage === 'string' && rawMessage !== '[object Object]'
    ? rawMessage
    : fallbackMessage;

  const normalized = new Error(message);
  normalized.statusCode = error.statusCode || error.response?.status;
  normalized.rawResponse = error.rawResponse || error.response?.data;
  return normalized;
};

const initiatePayIn = async ({ amount, customerPhone, customerEmail, metadata, webhookUrl }) => {
  const normalizedPhone = normalizePhone(customerPhone);

  try {
    return await getClient().payments.initiate({
      amount,
      customerPhone: normalizedPhone,
      customerEmail,
      metadata,
      webhookUrl
    });
  } catch (error) {
    throw toDigipayError(error, 'Unable to initiate DigiPay payment. Please verify the phone number and amount.');
  }
};

const buildWebhookUrl = (req) => {
  if (process.env.DIGIPAY_WEBHOOK_URL) return process.env.DIGIPAY_WEBHOOK_URL;

  const apiBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_URL;
  if (apiBaseUrl) return `${apiBaseUrl.replace(/\/$/, '')}/api/payments/digipay/webhook`;

  const protocol = req?.protocol || 'http';
  const host = req?.get?.('host');
  return host ? `${protocol}://${host}/api/payments/digipay/webhook` : undefined;
};

const getTransactionStatus = async (transactionId) => {
  try {
    return await getClient().payments.getStatus(transactionId);
  } catch (error) {
    throw toDigipayError(error, 'Unable to get DigiPay transaction status.');
  }
};

const requestPayout = async ({ amount, recipientPhone }) => {
  const normalizedPhone = normalizePhone(recipientPhone);

  try {
    return await getClient().settlements.requestPayout({
      amount,
      recipientPhone: normalizedPhone
    });
  } catch (error) {
    throw toDigipayError(error, 'Unable to request DigiPay payout. Please verify the phone number and amount.');
  }
};

module.exports = {
  checkBalance,
  buildWebhookUrl,
  getClient,
  getTransactionStatus,
  initiatePayIn,
  normalizePhone,
  requestPayout
};
