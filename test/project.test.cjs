'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('manifesto pede Native Messaging sem acesso generico a sites', () => {
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert.deepEqual(manifest.permissions, ['nativeMessaging']);
  assert.equal('host_permissions' in manifest, false);
  assert.equal(manifest.manifest_version, 3);
});

test('extensao e instaladores usam o mesmo nome de host', () => {
  const expected = 'br.com.jurius.token_bridge';
  assert.match(read('extension/src/service-worker.js'), new RegExp(expected.replaceAll('.', '\\.')));
  assert.match(read('companion/install/install-macos.sh'), new RegExp(expected.replaceAll('.', '\\.')));
  assert.match(read('companion/install/install-linux.sh'), new RegExp(expected.replaceAll('.', '\\.')));
  assert.match(read('companion/install/install-windows.ps1'), new RegExp(expected.replaceAll('.', '\\.')));
});

test('compose nao publica porta nem concede privileged', () => {
  for (const file of ['docker-compose.yml', 'server/docker-compose.yml']) {
    const compose = read(file);
    assert.doesNotMatch(compose, /^\s*ports\s*:/m);
    assert.doesNotMatch(compose, /privileged\s*:\s*true/);
    assert.match(compose, /network_mode:\s*host/);
    assert.match(compose, /VH_ALLOWED_DEVICES/);
  }
});

test('firewall bloqueia 7575 fora do loopback', () => {
  const firewall = read('server/scripts/lock-port.sh');
  assert.match(firewall, /iifname lo tcp dport/);
  assert.match(firewall, /tcp dport "\$port" drop/);
});

test('companion nao abre servidor HTTP local', () => {
  const host = read('companion/src/native-host.cjs');
  assert.doesNotMatch(host, /createServer\s*\(/);
  assert.doesNotMatch(host, /require\(['"]node:http['"]\)/);
  assert.doesNotMatch(host, /child_process\.exec\s*\(/);
});
