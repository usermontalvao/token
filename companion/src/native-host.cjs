'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');

const execFile = util.promisify(childProcess.execFile);
const VERSION = '0.1.0';
const HOST_NAME = 'br.com.jurius.token_bridge';
const MAX_NATIVE_MESSAGE_BYTES = 64 * 1024;

class BridgeError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.details = details;
  }
}

function configDirectory(platform = process.platform, env = process.env) {
  if (env.JURIUS_TOKEN_BRIDGE_HOME) return path.resolve(env.JURIUS_TOKEN_BRIDGE_HOME);
  if (platform === 'win32') {
    return path.join(env.LOCALAPPDATA || os.homedir(), 'JuriusTokenBridge');
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Jurius Token Bridge');
  }
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'jurius-token-bridge');
}

function defaultConfig() {
  return {
    serverHost: '10.254.75.75',
    serverPort: 7575,
    tokenPattern: 'GD|Burti|SafeSign|StarSign|Token',
    leaseSeconds: 300,
    connectTimeoutMs: 1800,
    virtualHerePath: '',
    pjeOfficePattern: 'pjeoffice',
    safeSignPattern: 'tokenadmin|safesign|aetpkss',
  };
}

function validateConfig(value) {
  const config = { ...defaultConfig(), ...(value || {}) };
  if (typeof config.serverHost !== 'string' || !/^[A-Za-z0-9_.:-]+$/.test(config.serverHost)) {
    throw new BridgeError('INVALID_CONFIG', 'serverHost invalido no config.json.');
  }
  if (!Number.isInteger(config.serverPort) || config.serverPort < 1 || config.serverPort > 65535) {
    throw new BridgeError('INVALID_CONFIG', 'serverPort invalido no config.json.');
  }
  if (!Number.isInteger(config.leaseSeconds) || config.leaseSeconds < 60 || config.leaseSeconds > 3600) {
    throw new BridgeError('INVALID_CONFIG', 'leaseSeconds deve ficar entre 60 e 3600.');
  }
  if (!Number.isInteger(config.connectTimeoutMs) || config.connectTimeoutMs < 250 || config.connectTimeoutMs > 15000) {
    throw new BridgeError('INVALID_CONFIG', 'connectTimeoutMs deve ficar entre 250 e 15000.');
  }
  for (const key of ['tokenPattern', 'pjeOfficePattern', 'safeSignPattern']) {
    if (typeof config[key] !== 'string' || config[key].length > 240) {
      throw new BridgeError('INVALID_CONFIG', `${key} invalido no config.json.`);
    }
    try {
      new RegExp(config[key], 'i');
    } catch {
      throw new BridgeError('INVALID_CONFIG', `${key} nao e uma expressao regular valida.`);
    }
  }
  if (typeof config.virtualHerePath !== 'string' || /[\r\n\0]/.test(config.virtualHerePath)) {
    throw new BridgeError('INVALID_CONFIG', 'virtualHerePath invalido no config.json.');
  }
  return config;
}

function loadConfig() {
  const directory = configDirectory();
  const configPath = process.env.JURIUS_TOKEN_BRIDGE_CONFIG || path.join(directory, 'config.json');
  let stored = {};
  if (fs.existsSync(configPath)) {
    try {
      stored = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      throw new BridgeError('INVALID_CONFIG', `Nao foi possivel ler ${configPath}.`, error.message);
    }
  }
  return { config: validateConfig(stored), directory, configPath };
}

function existingFile(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function virtualHereCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    return [
      '/Applications/VirtualHere/VirtualHere.app/Contents/MacOS/VirtualHere',
      '/Applications/VirtualHere.app/Contents/MacOS/VirtualHere',
      '/Applications/VirtualHereUniversal.app/Contents/MacOS/VirtualHereUniversal',
      path.join(os.homedir(), 'Applications', 'VirtualHere.app', 'Contents', 'MacOS', 'VirtualHere'),
    ];
  }
  if (platform === 'win32') {
    return [
      path.join(env.ProgramFiles || 'C:\\Program Files', 'VirtualHere', 'vhui64.exe'),
      path.join(env.ProgramFiles || 'C:\\Program Files', 'VirtualHere Client', 'vhui64.exe'),
      path.join(env.LOCALAPPDATA || '', 'VirtualHere', 'vhui64.exe'),
      path.join(env.USERPROFILE || '', 'VirtualHere', 'vhui64.exe'),
    ];
  }
  return [
    '/usr/local/bin/vhuit64',
    '/usr/local/bin/vhuitarm64',
    '/usr/local/bin/vhclientx86_64',
    '/usr/local/bin/vhclientarm64',
    '/opt/virtualhere/vhuit64',
    '/opt/virtualhere/vhuitarm64',
  ];
}

function findVirtualHere(config) {
  if (config.virtualHerePath) {
    if (!fs.existsSync(config.virtualHerePath)) {
      throw new BridgeError('VIRTUALHERE_NOT_FOUND', `VirtualHere nao encontrado em ${config.virtualHerePath}.`);
    }
    return config.virtualHerePath;
  }
  const found = existingFile(virtualHereCandidates());
  if (found) return found;
  throw new BridgeError(
    'VIRTUALHERE_NOT_FOUND',
    'VirtualHere Client nao foi encontrado. Instale-o ou informe virtualHerePath no config.json.',
  );
}

function serverAddress(config) {
  return `${config.serverHost}:${config.serverPort}`;
}

async function runVirtualHere(binary, command, options = {}) {
  const timeout = options.timeout || 8000;
  if (process.platform === 'win32') {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jurius-vh-'));
    const resultFile = path.join(tempDirectory, 'result.txt');
    try {
      let executionError = null;
      try {
        await execFile(binary, ['-t', command, '-r', resultFile], {
          timeout,
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        });
      } catch (error) {
        executionError = error;
      }
      const output = fs.existsSync(resultFile) ? fs.readFileSync(resultFile, 'utf8').trim() : '';
      if (executionError && !output) throw executionError;
      return output;
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  }

  const { stdout = '', stderr = '' } = await execFile(binary, ['-t', command], {
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return `${stdout}${stderr}`.trim();
}

function startVirtualHere(binary) {
  const child = childProcess.spawn(binary, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureVirtualHereRunning(binary) {
  try {
    const output = await runVirtualHere(binary, 'LIST', { timeout: 2500 });
    if (!/IPC ERROR|not running/i.test(output)) return output;
  } catch {
    // O cliente ainda nao esta em execucao.
  }

  startVirtualHere(binary);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await sleep(500);
    try {
      const output = await runVirtualHere(binary, 'LIST', { timeout: 2500 });
      if (!/IPC ERROR|not running/i.test(output)) return output;
    } catch {
      // Continua aguardando a inicializacao do driver/cliente.
    }
  }
  throw new BridgeError('VIRTUALHERE_NOT_RUNNING', 'VirtualHere Client nao iniciou a tempo.');
}

function parseVirtualHereList(output, config) {
  const address = serverAddress(config);
  const tokenRegex = new RegExp(config.tokenPattern, 'i');
  const lines = String(output || '').split(/\r?\n/);
  let currentHub = null;
  let serverOnline = false;
  const devices = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const deviceMatch = line.match(/^-->\s*(.*?)\s+\(([^()]+)\)(?:\s+\((.*?)\))?\s*$/i);
    if (deviceMatch) {
      const [, name, deviceAddress, usage = ''] = deviceMatch;
      const belongsToServer = currentHub === address || deviceAddress.startsWith(`${config.serverHost}.`);
      if (belongsToServer) {
        devices.push({
          name: name.trim(),
          address: deviceAddress.trim(),
          usage: usage.trim(),
          matchesToken: tokenRegex.test(name),
        });
      }
      continue;
    }

    const hubMatch = line.match(/\(([^()]+:\d+)\)\s*$/);
    if (hubMatch && !line.startsWith('-->')) {
      currentHub = hubMatch[1];
      if (currentHub === address) serverOnline = true;
    }
  }

  const token = devices.find((device) => device.matchesToken) || null;
  const usage = token?.usage || '';
  const connectedHere = /in[- ]use by you|em uso por voce|em uso por você/i.test(usage);
  const used = /in[- ]use|em uso/i.test(usage);

  return {
    serverOnline,
    devices,
    token: token && {
      name: token.name,
      address: token.address,
      present: true,
      connectedHere,
      inUseElsewhere: used && !connectedHere,
      usage: usage || null,
    },
  };
}

async function tcpReachable(host, port, timeoutMs) {
  if (process.env.JURIUS_TOKEN_BRIDGE_TEST_NETWORK_ONLINE === '1') return true;
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function processList() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFile('tasklist.exe', ['/FO', 'CSV', '/NH'], {
        timeout: 3000,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
      });
      return stdout;
    }
    const { stdout } = await execFile('/bin/ps', ['-ax', '-o', 'command='], {
      timeout: 3000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return '';
  }
}

function safeSignLibraryCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    return [
      '/usr/local/lib/libaetpkss.dylib',
      '/Library/Frameworks/eToken.framework',
      '/Applications/tokenadmin.app',
      '/Applications/TokenAdmin.app',
    ];
  }
  if (platform === 'win32') {
    return [
      path.join(env.WINDIR || 'C:\\Windows', 'System32', 'aetpkss1.dll'),
      path.join(env.WINDIR || 'C:\\Windows', 'SysWOW64', 'aetpkss1.dll'),
      path.join(env.ProgramFiles || 'C:\\Program Files', 'A.E.T. Europe B.V', 'SafeSign IC Standard'),
    ];
  }
  return [
    '/usr/lib/libaetpkss.so',
    '/usr/lib64/libaetpkss.so',
    '/usr/local/lib/libaetpkss.so',
  ];
}

function leasePath(directory) {
  return path.join(directory, 'lease.json');
}

function readLease(directory) {
  try {
    return JSON.parse(fs.readFileSync(leasePath(directory), 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows nao implementa os mesmos bits POSIX.
  }
}

function spawnWatchdog() {
  const runningAsNode = /(?:^|[\\/])node(?:\.exe)?$/i.test(process.execPath);
  const args = runningAsNode ? [__filename, '--watchdog'] : ['--watchdog'];
  const child = childProcess.spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, JURIUS_TOKEN_BRIDGE_WATCHDOG: '1' },
  });
  child.unref();
}

function scheduleLease(directory, deviceAddress, seconds) {
  const lease = {
    nonce: crypto.randomUUID(),
    deviceAddress,
    expiresAt: Date.now() + seconds * 1000,
  };
  writeJsonAtomic(leasePath(directory), lease);
  if (process.env.JURIUS_TOKEN_BRIDGE_DISABLE_WATCHDOG !== '1') spawnWatchdog();
  return lease;
}

function clearLease(directory) {
  fs.rmSync(leasePath(directory), { force: true });
}

async function collectStatus(options = {}) {
  const loaded = options.loaded || loadConfig();
  const { config, directory } = loaded;
  const networkOnline = await tcpReachable(config.serverHost, config.serverPort, config.connectTimeoutMs);
  let binary = '';
  let virtualHereInstalled = false;
  let virtualHereRunning = false;
  let parsed = { serverOnline: false, devices: [], token: null };
  let virtualHereError = null;

  try {
    binary = findVirtualHere(config);
    virtualHereInstalled = true;
    const output = await runVirtualHere(binary, 'LIST', { timeout: 3000 });
    virtualHereRunning = !/IPC ERROR|not running/i.test(output);
    if (virtualHereRunning) parsed = parseVirtualHereList(output, config);
  } catch (error) {
    virtualHereError = error.code || 'VIRTUALHERE_UNAVAILABLE';
  }

  const processes = await processList();
  const pjeOfficeRunning = new RegExp(config.pjeOfficePattern, 'i').test(processes);
  const safeSignRunning = new RegExp(config.safeSignPattern, 'i').test(processes);
  const safeSignInstalled = Boolean(existingFile(safeSignLibraryCandidates())) || safeSignRunning;
  const lease = readLease(directory);
  const activeLease = lease && lease.expiresAt > Date.now() ? lease : null;

  return {
    platform: process.platform,
    architecture: process.arch,
    network: {
      online: networkOnline,
      destination: serverAddress(config),
    },
    virtualHere: {
      installed: virtualHereInstalled,
      running: virtualHereRunning,
      serverOnline: parsed.serverOnline,
      error: virtualHereError,
    },
    token: parsed.token || {
      present: false,
      connectedHere: false,
      inUseElsewhere: false,
      name: null,
      address: null,
      usage: null,
    },
    safeSign: {
      installed: safeSignInstalled,
      running: safeSignRunning,
      certificateVerified: false,
      note: safeSignInstalled
        ? 'Middleware detectado; o reconhecimento do certificado deve ser confirmado no TokenAdmin/PJeOffice.'
        : 'SafeSign nao foi detectado nos caminhos conhecidos.',
    },
    pjeOffice: {
      running: pjeOfficeRunning,
    },
    lease: activeLease && {
      expiresAt: activeLease.expiresAt,
      remainingSeconds: Math.max(0, Math.ceil((activeLease.expiresAt - Date.now()) / 1000)),
    },
  };
}

async function connectToken() {
  const loaded = loadConfig();
  const { config, directory } = loaded;
  if (!(await tcpReachable(config.serverHost, config.serverPort, config.connectTimeoutMs))) {
    throw new BridgeError(
      'PRIVATE_NETWORK_OFFLINE',
      `Servidor ${serverAddress(config)} inacessivel. Verifique Cloudflare One/WARP.`,
    );
  }

  const binary = findVirtualHere(config);
  await ensureVirtualHereRunning(binary);
  try {
    await runVirtualHere(binary, `MANUAL HUB ADD,${serverAddress(config)}`);
  } catch (error) {
    if (!/already|exists|ja existe/i.test(String(error.stdout || error.message))) throw error;
  }

  let parsed = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const output = await runVirtualHere(binary, 'LIST');
    parsed = parseVirtualHereList(output, config);
    if (parsed.token) break;
    await sleep(500);
  }

  if (!parsed?.token) {
    throw new BridgeError('TOKEN_NOT_FOUND', 'Servidor online, mas o token configurado nao foi encontrado.');
  }
  if (parsed.token.inUseElsewhere) {
    throw new BridgeError('TOKEN_IN_USE', 'O token esta em uso em outro computador.', parsed.token.usage);
  }
  if (!parsed.token.connectedHere) {
    let output;
    try {
      output = await runVirtualHere(binary, `USE,${parsed.token.address}`, { timeout: 12000 });
    } catch (error) {
      throw new BridgeError('TOKEN_CONNECT_FAILED', 'VirtualHere nao conseguiu capturar o token.', error.message);
    }
    if (/^FAILED|^ERROR/i.test(output)) {
      throw new BridgeError('TOKEN_CONNECT_FAILED', 'VirtualHere recusou a captura do token.', output);
    }
  }

  const lease = scheduleLease(directory, parsed.token.address, config.leaseSeconds);
  await sleep(700);
  const status = await collectStatus({ loaded });
  status.lease = {
    expiresAt: lease.expiresAt,
    remainingSeconds: config.leaseSeconds,
  };
  return status;
}

async function disconnectToken() {
  const loaded = loadConfig();
  const { config, directory } = loaded;
  let binary;
  try {
    binary = findVirtualHere(config);
  } catch (error) {
    clearLease(directory);
    throw error;
  }

  const current = await collectStatus({ loaded });
  if (current.token.connectedHere && current.token.address) {
    const output = await runVirtualHere(binary, `STOP USING,${current.token.address}`);
    if (/^FAILED|^ERROR/i.test(output)) {
      throw new BridgeError('TOKEN_DISCONNECT_FAILED', 'VirtualHere nao liberou o token.', output);
    }
  }
  clearLease(directory);
  await sleep(300);
  return collectStatus({ loaded });
}

async function renewLease() {
  const loaded = loadConfig();
  const status = await collectStatus({ loaded });
  if (!status.token.connectedHere || !status.token.address) {
    throw new BridgeError('TOKEN_NOT_CONNECTED', 'Este computador nao esta usando o token.');
  }
  const lease = scheduleLease(loaded.directory, status.token.address, loaded.config.leaseSeconds);
  status.lease = {
    expiresAt: lease.expiresAt,
    remainingSeconds: loaded.config.leaseSeconds,
  };
  return status;
}

async function watchdog() {
  const loaded = loadConfig();
  const { directory, config } = loaded;
  while (true) {
    const lease = readLease(directory);
    if (!lease) return;
    const remaining = lease.expiresAt - Date.now();
    if (remaining > 0) {
      await sleep(Math.min(remaining + 100, 30000));
      continue;
    }
    try {
      const binary = findVirtualHere(config);
      await runVirtualHere(binary, `STOP USING,${lease.deviceAddress}`, { timeout: 12000 });
    } catch (error) {
      process.stderr.write(`[${HOST_NAME}] watchdog: ${error.message}\n`);
    } finally {
      const latest = readLease(directory);
      if (latest?.nonce === lease.nonce) clearLease(directory);
    }
    return;
  }
}

async function handleRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new BridgeError('INVALID_REQUEST', 'Requisicao invalida.');
  }
  const action = request.action;
  switch (action) {
    case 'status': return collectStatus();
    case 'connect': return connectToken();
    case 'disconnect': return disconnectToken();
    case 'renew': return renewLease();
    default: throw new BridgeError('UNKNOWN_ACTION', 'Acao nao permitida.');
  }
}

function encodeNativeMessage(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function createNativeMessageDecoder(onMessage, onError) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (length > MAX_NATIVE_MESSAGE_BYTES) {
        onError(new BridgeError('MESSAGE_TOO_LARGE', 'Mensagem Native Messaging excede o limite.'));
        buffer = Buffer.alloc(0);
        return;
      }
      if (buffer.length < 4 + length) return;
      const body = buffer.subarray(4, 4 + length);
      buffer = buffer.subarray(4 + length);
      try {
        onMessage(JSON.parse(body.toString('utf8')));
      } catch {
        onError(new BridgeError('INVALID_JSON', 'Mensagem Native Messaging contem JSON invalido.'));
      }
    }
  };
}

function responseForError(request, error) {
  return {
    id: request?.id ?? null,
    ok: false,
    version: VERSION,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error instanceof BridgeError ? error.message : 'Falha interna no companion.',
      details: error instanceof BridgeError ? error.details || null : null,
    },
  };
}

function runNativeHost() {
  let chain = Promise.resolve();
  const write = (value) => process.stdout.write(encodeNativeMessage(value));
  const consume = createNativeMessageDecoder(
    (request) => {
      chain = chain.then(async () => {
        try {
          const data = await handleRequest(request);
          write({ id: request.id ?? null, ok: true, version: VERSION, data });
        } catch (error) {
          write(responseForError(request, error));
        }
      });
    },
    (error) => write(responseForError(null, error)),
  );
  process.stdin.on('data', consume);
  process.stdin.resume();
}

async function runCommandLine(action) {
  try {
    const data = await handleRequest({ action });
    process.stdout.write(`${JSON.stringify({ ok: true, version: VERSION, data }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(responseForError(null, error), null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  if (process.argv.includes('--watchdog')) {
    watchdog().catch((error) => {
      process.stderr.write(`[${HOST_NAME}] watchdog: ${error.message}\n`);
      process.exitCode = 1;
    });
  } else {
    const requestIndex = process.argv.indexOf('--request');
    if (requestIndex >= 0) runCommandLine(process.argv[requestIndex + 1] || 'status');
    else runNativeHost();
  }
}

module.exports = {
  BridgeError,
  MAX_NATIVE_MESSAGE_BYTES,
  collectStatus,
  connectToken,
  configDirectory,
  createNativeMessageDecoder,
  defaultConfig,
  encodeNativeMessage,
  disconnectToken,
  handleRequest,
  parseVirtualHereList,
  responseForError,
  safeSignLibraryCandidates,
  serverAddress,
  validateConfig,
  virtualHereCandidates,
};
