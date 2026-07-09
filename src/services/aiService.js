const { OpenRouter } = require('@openrouter/sdk');
const Setting = require('../models/Setting');

const generateText = async ({ prompt, temperature = 0.25, maxOutputTokens = 1600, jsonMode = false }) => {
  // 1. Check database settings first
  let apiKey = '';
  let model = '';

  try {
    const openRouterApiKeySetting = await Setting.findOne({ key: 'openRouterApiKey' });
    const openRouterModelSetting = await Setting.findOne({ key: 'openRouterModel' });
    
    if (openRouterApiKeySetting && openRouterApiKeySetting.value) {
      apiKey = String(openRouterApiKeySetting.value).trim();
    }
    if (openRouterModelSetting && openRouterModelSetting.value) {
      model = String(openRouterModelSetting.value).trim();
    }
  } catch (err) {
    console.error('[AI Service] Failed to retrieve settings from DB:', err.message);
  }

  // 2. Fallback to process.env if database settings are empty
  if (!apiKey && process.env.OPENROUTER_API_KEY) {
    apiKey = process.env.OPENROUTER_API_KEY.trim();
  }
  if (!model && process.env.OPENROUTER_MODEL) {
    model = process.env.OPENROUTER_MODEL.trim();
  }

  // Use a default model if model is still not resolved
  if (!model) {
    model = 'google/gemini-2.5-flash';
  }

  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured. Please configure it in Settings or environment variables.');
  }

  try {
    console.log(`[AI Service] Calling OpenRouter: ${model}`);
    const openRouter = new OpenRouter({ apiKey });
    const response = await openRouter.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        maxTokens: maxOutputTokens,
        responseFormat: jsonMode ? { type: 'json_object' } : undefined,
      },
    });

    const text = response.choices?.[0]?.message?.content || '';
    return { text, provider: 'openrouter' };
  } catch (err) {
    console.error('[AI Service] OpenRouter execution failed:', err);
    throw err;
  }
};

module.exports = {
  generateText,
};
