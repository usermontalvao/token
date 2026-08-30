'use strict';

const NATIVE_HOST = 'br.com.jurius.token_bridge';
const ALLOWED_ACTIONS = new Set(['status', 'connect', 'renew', 'disconnect']);

async function nativeRequest(action) {
  if (!ALLOWED_ACTIONS.has(action)) throw new Error('Acao local nao permitida.');
  let response;
  try {
    response = await chrome.runtime.sendNativeMessage(NATIVE_HOST, {
      id: crypto.randomUUID(),
      action,
    });
  } catch (error) {
    const detail = error?.message || '';
    if (/host.*not found|specified native messaging host/i.test(detail)) {
      throw new Error('Companion Jurius nao instalado neste computador.');
    }
    throw new Error('Nao foi possivel conversar com o companion local.');
  }
  if (!response) throw new Error('O companion local nao respondeu.');
  if (!response.ok) {
    const error = new Error(response.error?.message || 'A operacao local falhou.');
    error.code = response.error?.code;
    error.details = response.error?.details;
    throw error;
  }
  return response.data;
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.scope !== 'token-bridge' || !ALLOWED_ACTIONS.has(message.action)) return false;
  nativeRequest(message.action)
    .then((data) => reply({ ok: true, data }))
    .catch((error) => reply({
      ok: false,
      error: {
        code: error.code || 'COMPANION_ERROR',
        message: error.message,
        details: error.details || null,
      },
    }));
  return true;
});

