'use strict';

const $ = (selector) => document.querySelector(selector);
const state = { status: null, busy: false, timer: null };

async function request(action) {
  const response = await chrome.runtime.sendMessage({ scope: 'token-bridge', action });
  if (!response?.ok) {
    const error = new Error(response?.error?.message || 'A extensão nao respondeu.');
    error.code = response?.error?.code;
    throw error;
  }
  return response.data;
}

function setComponent(name, kind, label, detail) {
  const badge = $(`#${name}-state`);
  const icon = $(`[data-state-icon="${name}"]`);
  const detailElement = $(`#${name}-detail`);
  badge.className = `badge ${kind}`;
  badge.textContent = label;
  icon.className = `state-icon ${kind}`;
  if (detail != null) detailElement.textContent = detail;
}

function showError(message) {
  const element = $('#error');
  element.textContent = message || '';
  element.classList.toggle('hidden', !message);
}

function setSummary(kind, title, detail) {
  const summary = $('#summary');
  summary.className = `summary ${kind || ''}`.trim();
  $('#summary-dot').className = `summary-dot ${kind === 'loading' ? 'loading' : ''}`.trim();
  $('#summary-title').textContent = title;
  $('#summary-detail').textContent = detail;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function renderLease() {
  const lease = state.status?.lease;
  const connected = Boolean(state.status?.token?.connectedHere);
  $('#lease').classList.toggle('hidden', !connected || !lease);
  if (!connected || !lease) return;
  const remaining = Math.max(0, Math.ceil((lease.expiresAt - Date.now()) / 1000));
  const original = Math.max(remaining, lease.remainingSeconds || 300);
  $('#lease-time').textContent = formatTime(remaining);
  $('#lease-bar').style.width = `${Math.min(100, (remaining / original) * 100)}%`;
}

function render(status) {
  state.status = status;
  const network = status.network?.online;
  const server = status.virtualHere?.serverOnline;
  const token = status.token || {};

  setComponent('network', network ? 'ok' : 'bad', network ? 'Conectada' : 'Offline', status.network?.destination || 'Cloudflare One');
  setComponent(
    'server',
    server ? 'ok' : status.virtualHere?.installed ? 'warn' : 'bad',
    server ? 'Online' : status.virtualHere?.installed ? 'Aguardando' : 'Ausente',
    status.virtualHere?.installed ? 'VirtualHere Client' : 'Instale o VirtualHere Client',
  );

  if (token.connectedHere) {
    setComponent('token', 'ok', 'Neste PC', token.name || 'Dispositivo conectado');
  } else if (token.inUseElsewhere) {
    setComponent('token', 'warn', 'Em uso', 'Reservado por outro computador');
  } else if (token.present) {
    setComponent('token', 'ok', 'Disponível', token.name || 'Pronto para conectar');
  } else {
    setComponent('token', server ? 'warn' : 'bad', 'Não visto', server ? 'Verifique a USB no escritório' : 'Servidor indisponível');
  }

  setComponent(
    'safeSign',
    status.safeSign?.installed ? 'ok' : 'warn',
    status.safeSign?.installed ? 'Instalado' : 'Não visto',
    status.safeSign?.installed ? 'Confirme o certificado no TokenAdmin' : 'Middleware não detectado',
  );
  setComponent(
    'pje',
    status.pjeOffice?.running ? 'ok' : 'warn',
    status.pjeOffice?.running ? 'Ativo' : 'Fechado',
    status.pjeOffice?.running ? 'Processo local encontrado' : 'Abra antes de acessar o PJe',
  );

  if (token.connectedHere) {
    setSummary('', 'Token conectado neste computador', 'Use o PJe e libere assim que terminar');
  } else if (token.inUseElsewhere) {
    setSummary('warn', 'Token em uso por outra pessoa', 'Tente novamente depois que ele for liberado');
  } else if (!network) {
    setSummary('error-state', 'Rede privada indisponível', 'Conecte o Cloudflare One Client/WARP');
  } else if (!server) {
    setSummary('warn', 'Servidor ainda não respondeu', 'Confira VirtualHere e a rota privada');
  } else if (token.present) {
    setSummary('', 'Token disponível para uso', 'A reserva será temporária');
  } else {
    setSummary('warn', 'Token não encontrado', 'Verifique a conexão USB no escritório');
  }

  const canConnect = network && server && token.present && !token.connectedHere && !token.inUseElsewhere;
  $('#connect').disabled = state.busy || !canConnect;
  $('#connect').classList.toggle('hidden', token.connectedHere);
  $('#connected-actions').classList.toggle('hidden', !token.connectedHere);
  $('#renew').disabled = state.busy;
  $('#disconnect').disabled = state.busy;
  renderLease();
}

async function refresh({ quiet = false } = {}) {
  if (state.busy) return;
  if (!quiet) {
    $('#refresh').classList.add('spinning');
    showError('');
  }
  try {
    render(await request('status'));
  } catch (error) {
    if (!quiet) showError(error.message);
    setSummary('error-state', 'Companion indisponível', error.message);
    $('#connect').disabled = true;
  } finally {
    $('#refresh').classList.remove('spinning');
  }
}

async function act(action, busyLabel) {
  if (state.busy) return;
  state.busy = true;
  showError('');
  const button = action === 'connect' ? $('#connect') : action === 'renew' ? $('#renew') : $('#disconnect');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    render(await request(action));
  } catch (error) {
    showError(error.message);
    await refresh({ quiet: true });
  } finally {
    state.busy = false;
    button.textContent = original;
    if (state.status) render(state.status);
  }
}

$('#refresh').addEventListener('click', () => refresh());
$('#connect').addEventListener('click', () => act('connect', 'Conectando…'));
$('#renew').addEventListener('click', () => act('renew', 'Renovando…'));
$('#disconnect').addEventListener('click', () => act('disconnect', 'Liberando…'));

state.timer = setInterval(() => {
  renderLease();
  if (state.status?.lease?.expiresAt <= Date.now()) refresh({ quiet: true });
}, 1000);

refresh();

