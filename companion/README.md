# Companion multiplataforma

O companion e o unico componente que pode executar a API local do VirtualHere.
A extensao fala com ele pelo Native Messaging do Chrome; nao existe porta HTTP
local.

## Pre-requisitos em cada computador

1. Cloudflare One Client/WARP matriculado na organizacao.
2. VirtualHere Client para o sistema operacional.
3. Driver/middleware exato do token (SafeSign/TokenAdmin).
4. PJeOffice Pro.
5. Para instalar a partir do codigo-fonte: Node.js 20 ou posterior.

O projeto gera executaveis sem Node.js na pagina de Releases quando o workflow
de release e executado.

Os artefatos macOS recebem assinatura ad-hoc para o MVP. Distribuicao ampla
exigira certificado Apple Developer ID e notarizacao; isso nao e necessario
para o teste controlado em maquinas do escritorio.

## Instalar

macOS a partir do codigo-fonte:

```bash
./install/install-macos.sh
```

macOS com um executavel baixado da Release:

```bash
./install/install-macos.sh ipapgfacphjdohnonhjkgbcdmojelbjb /caminho/jurius-token-bridge-macos
```

Linux usa os mesmos argumentos com `install-linux.sh`. No Windows, execute em
PowerShell:

```powershell
.\install\install-windows.ps1 -HostExecutable .\jurius-token-bridge-windows-x64.exe
```

## Configuracao

Copie `config.example.json` para o diretorio indicado pelo instalador. Os
defaults sao:

- servidor: `10.254.75.75:7575`;
- reserva: 300 segundos;
- nome do token: expressao `GD|Burti|SafeSign|StarSign|Token`.

Se o VirtualHere nao estiver em um caminho conhecido, preencha
`virtualHerePath` com o caminho absoluto do executavel.

## Diagnostico sem Chrome

```bash
node src/native-host.cjs --request status
```

Esse comando deve primeiro mostrar `network.online: true`, depois
`virtualHere.serverOnline: true` e, com o dispositivo disponivel,
`token.present: true`.

## Estados do SafeSign

O companion consegue detectar biblioteca ou processo conhecido, mas nao pode
afirmar que o certificado foi lido sem chamar a biblioteca PKCS#11 ou efetuar
uma operacao. Por seguranca, o campo `certificateVerified` permanece `false` no
MVP. A homologacao real e feita no TokenAdmin e depois no PJeOffice.
