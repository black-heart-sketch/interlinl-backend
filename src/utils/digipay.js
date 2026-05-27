const { DigiPay } = require('digipay-sdk');

let client;
let cachedApiKey;
let cachedEnv;

const getClient = async () => {
  const Setting = require('../models/Setting');
  let apiKey = null;
  let env = null;

  try {
    const keySetting = await Setting.findOne({ key: 'digipayApiKey' });
    if (keySetting && keySetting.value) {
      apiKey = String(keySetting.value).trim();
    }
    const envSetting = await Setting.findOne({ key: 'digipayEnv' });
    if (envSetting && envSetting.value) {
      env = String(envSetting.value).trim();
    }
  } catch (err) {
    console.error('Error reading DigiPay settings from database:', err);
  }

  // Fallbacks
  if (!apiKey) {
    apiKey = process.env.DIGIPAY_API_KEY;
  }
  if (!env) {
    env = process.env.DIGIPAY_ENV || 'production';
  }

  if (!apiKey) {
    throw new Error('DIGIPAY_API_KEY is not configured in database or environment.');
  }

  // Re-initialize if changed
  if (!client || cachedApiKey !== apiKey || cachedEnv !== env) {
    cachedApiKey = apiKey;
    cachedEnv = env;
    client = new DigiPay({
      apiKey,
      environment: env
    });
  }

  return client;
};

const checkBalance = async () => {
  const sdk = await getClient();
  return sdk.settlements.getBalance();
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
  console.log(`[DigiPay Utility] initiatePayIn called - Amount: ${amount}, Phone: ${normalizedPhone}, Email: ${customerEmail}, Webhook: ${webhookUrl}`);

  try {
    const sdk = await getClient();
    const result = await sdk.payments.initiate({
      amount,
      customerPhone: normalizedPhone,
      customerEmail,
      metadata,
      webhookUrl
    });
    console.log('[DigiPay Utility] initiatePayIn response received:', result);
    return result;
  } catch (error) {
    console.error('[DigiPay Utility] initiatePayIn error occurred:', error);
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
  console.log(`[DigiPay Utility] getTransactionStatus called for transaction: ${transactionId}`);
  try {
    const sdk = await getClient();
    const statusResult = await sdk.payments.getStatus(transactionId);
    console.log(`[DigiPay Utility] getTransactionStatus response for ${transactionId}:`, statusResult);
    return statusResult;
  } catch (error) {
    console.error(`[DigiPay Utility] getTransactionStatus error for ${transactionId}:`, error);
    throw toDigipayError(error, 'Unable to get DigiPay transaction status.');
  }
};

const requestPayout = async ({ amount, recipientPhone }) => {
  const normalizedPhone = normalizePhone(recipientPhone);
  console.log(`[DigiPay Utility] requestPayout called - Amount: ${amount}, Recipient: ${normalizedPhone}`);

  try {
    const sdk = await getClient();
    const result = await sdk.settlements.requestPayout({
      amount,
      recipientPhone: normalizedPhone
    });
    console.log('[DigiPay Utility] requestPayout response received:', result);
    return result;
  } catch (error) {
    console.error('[DigiPay Utility] requestPayout error occurred:', error);
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
