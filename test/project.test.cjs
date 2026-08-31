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

test('VirtualHere recebe somente as permissoes elevadas necessarias ao sysfs USB', () => {
  for (const file of ['docker-compose.yml', 'server/docker-compose.yml']) {
    const compose = read(file);
    assert.match(compose, /cap_add:\s*\n\s*- SYS_ADMIN/);
    assert.match(compose, /\/sys\/bus\/usb:\/sys\/bus\/usb:rw/);
    assert.match(compose, /\/sys\/devices:\/sys\/devices:rw/);
    assert.match(compose, /apparmor:unconfined/);
    assert.doesNotMatch(compose, /privileged\s*:\s*true/);
  }
});

test('firewall bloqueia 7575 fora do loopback', () => {
  const firewall = read('server/scripts/lock-port.sh');
  assert.match(firewall, /iifname lo tcp dport/);
  assert.match(firewall, /tcp dport "\$port" drop/);
  assert.doesNotMatch(firewall, /comment '/);
});

test('stack prepara a rede antes do VirtualHere sem privileged', () => {
  const compose = read('docker-compose.yml');
  assert.match(compose, /network-init:/);
  assert.match(compose, /NET_ADMIN/);
  assert.match(compose, /condition:\s*service_healthy/);
  assert.match(compose, /network-init:[\s\S]*?restart:\s*unless-stopped/);
  assert.doesNotMatch(compose, /privileged\s*:\s*true/);
});

test('guardiao de rede persiste o IP privado entre reinicializacoes', () => {
  const script = read('server/scripts/network-init.sh');
  const dockerfile = read('server/Dockerfile.network-init');
  assert.match(script, /Guardiao da rede ativo/);
  assert.match(script, /trap cleanup INT TERM/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /nft list table inet jurius_token/);
});

test('servidor recusa VID/PID ficticio e IP inexistente', () => {
  const entrypoint = read('server/entrypoint.sh');
  assert.match(entrypoint, /1234\/abcd/);
  assert.match(entrypoint, /ip -o address show/);
  assert.match(entrypoint, /-r stdout/);
});

test('configuracao gratuita nao ativa parametros avancados licenciados', () => {
  const entrypoint = read('server/entrypoint.sh');
  assert.doesNotMatch(entrypoint, /printf 'NetworkInterface=/);
  assert.doesNotMatch(entrypoint, /printf 'TCPPort=/);
  assert.match(entrypoint, /AllowedDevices=/);
});

test('healthcheck verifica o socket sem criar conexao VirtualHere artificial', () => {
  const dockerfile = read('server/Dockerfile');
  assert.match(dockerfile, /ss -H -lnt/);
  assert.doesNotMatch(dockerfile, /nc -z/);
});

test('companion nao abre servidor HTTP local', () => {
  const host = read('companion/src/native-host.cjs');
  assert.doesNotMatch(host, /createServer\s*\(/);
  assert.doesNotMatch(host, /require\(['"]node:http['"]\)/);
  assert.doesNotMatch(host, /child_process\.exec\s*\(/);
});

test('extensao oferece configuracoes, manual e portal do token', () => {
  const popup = read('extension/src/popup.html');
  const manual = read('extension/src/manual.html');
  assert.match(popup, /Configurações e manuais/);
  assert.match(popup, /href="manual\.html"/);
  assert.match(popup, /https:\/\/token\.jurius-api\.com\//);
  assert.match(manual, /pedro@advcuiaba\.com/);
  assert.match(manual, /equipe-jurius/);
  assert.match(manual, /10\.254\.75\.75:7575/);
  assert.match(manual, /Cloudflare One Client/);
  assert.match(manual, /VirtualHere Client/);
  assert.match(manual, /SafeSign/);
  assert.match(manual, /PJeOffice Pro/);
});

test('manual distingue portal HTTPS do transporte USB privado', () => {
  const manual = read('docs/MANUAL-COMPLETO.md');
  assert.match(manual, /pedro@advcuiaba\.com/);
  assert.match(manual, /Não.*Public Hostname|N.o.*Public Hostname/s);
  assert.match(manual, /10\.254\.75\.75\/32/);
  assert.match(manual, /Test-NetConnection/);
  assert.match(manual, /nc -vz 10\.254\.75\.75 7575/);
  assert.match(manual, /https:\/\/token\.jurius-api\.com\//);
  assert.doesNotMatch(manual, /tcp:\/\/token\.jurius-api\.com/);
});
