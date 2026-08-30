'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  BridgeError,
  connectToken,
  createNativeMessageDecoder,
  defaultConfig,
  disconnectToken,
  encodeNativeMessage,
  parseVirtualHereList,
  responseForError,
  validateConfig,
} = require('../src/native-host.cjs');

test('decodifica mensagens Native Messaging fragmentadas', () => {
  const received = [];
  const errors = [];
  const decode = createNativeMessageDecoder((message) => received.push(message), (error) => errors.push(error));
  const first = encodeNativeMessage({ id: 1, action: 'status' });
  const second = encodeNativeMessage({ id: 2, action: 'connect' });
  const combined = Buffer.concat([first, second]);
  decode(combined.subarray(0, 3));
  decode(combined.subarray(3, 11));
  decode(combined.subarray(11));
  assert.deepEqual(received, [
    { id: 1, action: 'status' },
    { id: 2, action: 'connect' },
  ]);
  assert.equal(errors.length, 0);
});

test('identifica token disponivel no servidor configurado', () => {
  const output = `
VirtualHere IPC, below are the available devices:
Jurius Token Office (10.254.75.75:7575)
   --> GD Burti Token (10.254.75.75.114)
Other Hub (192.168.1.4:7575)
   --> Token de outro local (192.168.1.4.12)
`;
  const result = parseVirtualHereList(output, defaultConfig());
  assert.equal(result.serverOnline, true);
  assert.equal(result.devices.length, 1);
  assert.equal(result.token.name, 'GD Burti Token');
  assert.equal(result.token.connectedHere, false);
  assert.equal(result.token.inUseElsewhere, false);
});

test('distingue uso local e uso em outro computador', () => {
  const local = parseVirtualHereList(`
Hub (10.254.75.75:7575)
 --> GD Burti Token (10.254.75.75.114) (In-use by you)
`, defaultConfig());
  assert.equal(local.token.connectedHere, true);
  assert.equal(local.token.inUseElsewhere, false);

  const remote = parseVirtualHereList(`
Hub (10.254.75.75:7575)
 --> GD Burti Token (10.254.75.75.114) (In-use by:Fulano at 100.96.0.3)
`, defaultConfig());
  assert.equal(remote.token.connectedHere, false);
  assert.equal(remote.token.inUseElsewhere, true);
});

test('recusa host com delimitador de comando VirtualHere', () => {
  assert.throws(
    () => validateConfig({ serverHost: '10.0.0.1,STOP USING ALL' }),
    (error) => error instanceof BridgeError && error.code === 'INVALID_CONFIG',
  );
});

test('erro interno nao vaza detalhes para a extensao', () => {
  const response = responseForError({ id: 9 }, new Error('segredo interno'));
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INTERNAL_ERROR');
  assert.equal(response.error.message, 'Falha interna no companion.');
  assert.equal(JSON.stringify(response).includes('segredo interno'), false);
});

test('host responde uma mensagem Native Messaging real', async () => {
  const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jurius-bridge-test-'));
  fs.writeFileSync(path.join(temporaryHome, 'config.json'), JSON.stringify({
    serverHost: '127.0.0.1',
    serverPort: 9,
    connectTimeoutMs: 250,
  }));

  const child = childProcess.spawn(process.execPath, [path.resolve(__dirname, '../src/native-host.cjs')], {
    env: { ...process.env, JURIUS_TOKEN_BRIDGE_HOME: temporaryHome },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const chunks = [];
  child.stdout.on('data', (chunk) => chunks.push(chunk));
  child.stdin.end(encodeNativeMessage({ id: 'integration', action: 'status' }));

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout aguardando host nativo')), 5000);
    child.stdout.on('data', () => {
      const output = Buffer.concat(chunks);
      if (output.length < 4) return;
      const length = output.readUInt32LE(0);
      if (output.length < 4 + length) return;
      clearTimeout(timeout);
      const response = JSON.parse(output.subarray(4, 4 + length).toString('utf8'));
      try {
        assert.equal(response.id, 'integration');
        assert.equal(response.ok, true);
        assert.equal(response.data.network.destination, '127.0.0.1:9');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        child.kill();
      }
    });
    child.once('error', reject);
  });
  fs.rmSync(temporaryHome, { recursive: true, force: true });
});

test('conecta, cria reserva e libera usando a API VirtualHere', { skip: process.platform === 'win32' }, async () => {
  const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jurius-bridge-flow-'));
  const fakeState = path.join(temporaryHome, 'fake-state');
  const fakeVirtualHere = path.join(temporaryHome, 'fake-vh.cjs');
  fs.writeFileSync(fakeVirtualHere, `#!/usr/bin/env node
const fs = require('node:fs');
const command = process.argv[process.argv.indexOf('-t') + 1] || '';
const used = fs.existsSync(${JSON.stringify(fakeState)});
if (command === 'LIST') {
  process.stdout.write('Hub (127.0.0.1:__PORT__)\\n --> GD Burti Token (fake.114)' + (used ? ' (In-use by you)' : '') + '\\n');
} else if (command.startsWith('USE,')) {
  fs.writeFileSync(${JSON.stringify(fakeState)}, 'used');
  process.stdout.write('OK\\n');
} else if (command.startsWith('STOP USING,')) {
  fs.rmSync(${JSON.stringify(fakeState)}, { force: true });
  process.stdout.write('OK\\n');
} else {
  process.stdout.write('OK\\n');
}
`);
  fs.chmodSync(fakeVirtualHere, 0o700);

  const port = 27575;
  const script = fs.readFileSync(fakeVirtualHere, 'utf8').replace('__PORT__', String(port));
  fs.writeFileSync(fakeVirtualHere, script, { mode: 0o700 });
  fs.writeFileSync(path.join(temporaryHome, 'config.json'), JSON.stringify({
    serverHost: '127.0.0.1',
    serverPort: port,
    connectTimeoutMs: 500,
    leaseSeconds: 60,
    virtualHerePath: fakeVirtualHere,
  }));

  const previousHome = process.env.JURIUS_TOKEN_BRIDGE_HOME;
  const previousWatchdog = process.env.JURIUS_TOKEN_BRIDGE_DISABLE_WATCHDOG;
  const previousNetwork = process.env.JURIUS_TOKEN_BRIDGE_TEST_NETWORK_ONLINE;
  process.env.JURIUS_TOKEN_BRIDGE_HOME = temporaryHome;
  process.env.JURIUS_TOKEN_BRIDGE_DISABLE_WATCHDOG = '1';
  process.env.JURIUS_TOKEN_BRIDGE_TEST_NETWORK_ONLINE = '1';
  try {
    const connected = await connectToken();
    assert.equal(connected.token.connectedHere, true);
    assert.ok(connected.lease.remainingSeconds > 0);
    assert.equal(fs.existsSync(fakeState), true);

    const disconnected = await disconnectToken();
    assert.equal(disconnected.token.connectedHere, false);
    assert.equal(fs.existsSync(fakeState), false);
  } finally {
    if (previousHome == null) delete process.env.JURIUS_TOKEN_BRIDGE_HOME;
    else process.env.JURIUS_TOKEN_BRIDGE_HOME = previousHome;
    if (previousWatchdog == null) delete process.env.JURIUS_TOKEN_BRIDGE_DISABLE_WATCHDOG;
    else process.env.JURIUS_TOKEN_BRIDGE_DISABLE_WATCHDOG = previousWatchdog;
    if (previousNetwork == null) delete process.env.JURIUS_TOKEN_BRIDGE_TEST_NETWORK_ONLINE;
    else process.env.JURIUS_TOKEN_BRIDGE_TEST_NETWORK_ONLINE = previousNetwork;
    fs.rmSync(temporaryHome, { recursive: true, force: true });
  }
});
