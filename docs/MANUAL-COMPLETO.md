# Manual completo — Jurius Token Bridge

Este manual cobre a instalação, a administração, o uso diário e o diagnóstico
do token A3 GD Burti remoto no Windows e no macOS.

## 1. O que a solução faz

```text
GD Burti A3 (USB no escritório)
  -> VirtualHere Server (Linux/Docker)
  -> Cloudflare Tunnel (rota privada /32)
  -> Cloudflare One Client/WARP (computador autorizado)
  -> VirtualHere Client
  -> SafeSign/TokenAdmin
  -> PJeOffice Pro
  -> Chrome/PJe
```

A chave privada continua dentro do token. O projeto não exporta certificado,
não cria PFX e não recebe nem armazena o PIN. O PIN deve ser informado somente
na janela nativa do SafeSign ou do PJeOffice.

Um token físico pode pertencer a **um computador por vez**. Várias pessoas
podem usá-lo em sequência, mas não simultaneamente. Ao concluir uma assinatura,
o usuário deve liberar o token para a próxima pessoa.

## 2. Valores deste ambiente

| Item | Valor |
| --- | --- |
| Equipe/organização Cloudflare | `equipe-jurius` |
| E-mail autorizado no MVP | `pedro@advcuiaba.com` |
| IP privado exclusivo do VirtualHere | `10.254.75.75` |
| Rota anunciada pelo Tunnel | `10.254.75.75/32` |
| Porta VirtualHere | `TCP/7575` |
| Hub informado ao VirtualHere Client | `10.254.75.75:7575` |
| Token permitido | `1059:0019` — StarSign CUT S |
| Reserva padrão | 300 segundos |
| Portal de apoio/status | <https://token.jurius-api.com/> |

O portal `token.jurius-api.com` é um link HTTPS de apoio/status. **Não** crie
um Public Hostname apontando esse domínio para `tcp://10.254.75.75:7575`. O
tráfego USB usa apenas a rota privada WARP.

## 3. Preparação do servidor Linux

### 3.1 Conferir o token físico

Conecte o token no servidor e execute:

```bash
lsusb
```

O resultado esperado contém:

```text
ID 1059:0019 Giesecke & Devrient GmbH StarSign CUT S
```

Se ele não aparecer, troque a porta USB, evite hubs sem alimentação e confirme
se o dispositivo aparece em `dmesg`/`journalctl`.

### 3.2 Implantar a stack no Portainer

1. No Portainer, abra **Stacks > Add stack**.
2. Escolha o repositório Git deste projeto.
3. Use `docker-compose.yml` como **Compose path**. O arquivo fica na raiz.
4. Cadastre `VH_ALLOWED_DEVICES=1059/0019` nas variáveis da stack.
5. Se for usar o `cloudflared` já instalado no host, não ative o profile
   opcional do compose. Se for usar o container opcional, cadastre
   `CLOUDFLARE_TUNNEL_TOKEN` somente no Portainer; nunca no Git.
6. Faça o deploy e aguarde os serviços `jurius-token-network-init` e
   `jurius-token-virtualhere` ficarem saudáveis.

O serviço `network-init` cria o IP dummy `10.254.75.75/32`, aplica o firewall e
permanece ativo para restaurar a configuração após reinicializações.

### 3.3 Conferir os logs

No log do VirtualHere, procure:

```text
Listening ... TCP port 7575
Found Full speed device [1059:0019] ... StarSign CUT S
VirtualHere USB Server is running
```

O aviso de leitura somente de `usbfs_memory_mb` pode ser ignorado para este
token se as três linhas acima aparecerem. Se aparecer `trial has expired`,
recrie a stack com a versão atual do projeto: ela não grava os parâmetros
avançados `NetworkInterface` e `TCPPort` na edição gratuita.

### 3.4 Conferir a proteção da porta

No host:

```bash
ip address show jurius-token
nft list table inet jurius_token
ss -lntp | grep ':7575'
```

A tabela deve aceitar TCP/7575 somente pelo loopback e descartar as demais
interfaces. Não configure port-forward no roteador e não publique a porta no
Docker Compose.

## 4. Configuração administrativa do Cloudflare Zero Trust

### 4.1 Tunnel e rota privada

1. Confirme que o connector `cloudflared` do escritório está **Healthy**.
2. Em **Networks > Routes > CIDR**, crie a rota `10.254.75.75/32`.
3. Selecione o túnel do escritório e a rede virtual `default`.
4. Não crie Public Hostname para essa porta.

Documentação oficial:

- [Conectar uma rota CIDR privada](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/cloudflared/connect-cidr/)
- [Redes privadas via Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/)

### 4.2 Política de matrícula dos dispositivos

Em **Settings > WARP Client > Device enrollment permissions**:

1. Crie uma policy `Allow` chamada `Permitir WARP Jurius`.
2. Em **Include**, escolha `Emails` e informe exatamente
   `pedro@advcuiaba.com`.
3. Associe a policy ao aplicativo de matrícula de dispositivos e salve.
4. Para adicionar outra pessoa, inclua seu e-mail ou, preferencialmente, um
   grupo no provedor de identidade. Não compartilhe a conta de Pedro.

Uma policy criada mas não associada gera `Enrollment request is invalid`.
Campos `connection_rules` de RDP não são necessários para WARP e devem ser
removidos desta policy.

Documentação oficial:

- [Device enrollment](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/device-enrollment/)
- [Instalação manual](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/manual-deployment/)

### 4.3 Split Tunnel

No perfil aplicado aos usuários, configure Split Tunnels em modo **Include** e
inclua somente:

```text
10.254.75.75/32
```

Assim, apenas o tráfego destinado ao token entra no WARP. Navegação, e-mail,
videoconferência e demais conexões continuam usando a Internet normal do
computador. Se a organização optar por modo Exclude, remova esse IP das
exclusões de redes privadas.

Documentação: [Split Tunnels](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/split-tunnels/).

### 4.4 Política de rede recomendada

Crie uma regra de maior prioridade permitindo:

- usuário/grupo autorizado;
- destino `10.254.75.75`;
- protocolo TCP;
- porta de destino `7575`;
- postura de dispositivo gerenciado, se disponível.

Logo abaixo, bloqueie TCP/7575 para o mesmo IP aos demais usuários. A rota
privada limita o caminho; a policy limita quem pode usá-lo.

## 5. Instalação em macOS

### 5.1 Cloudflare One Client/WARP

1. Baixe a versão estável na página oficial do
   [Cloudflare One Client](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/download/).
2. Instale e abra o aplicativo.
3. Escolha **Zero Trust security**.
4. Informe `equipe-jurius` como nome da equipe, sem URL e sem `/warp`.
5. No navegador, autentique-se com `pedro@advcuiaba.com` ou outro e-mail
   previamente liberado.
6. Autorize a abertura do Cloudflare One Client e deixe-o **Connected**.

Teste no Terminal:

```bash
route -n get 10.254.75.75
nc -vz 10.254.75.75 7575
```

A interface da rota deve ser `utun...` e a porta deve responder. Desligue o
WARP e repita: o teste da porta deve falhar.

### 5.2 VirtualHere Client

1. Baixe o cliente universal para Intel/Apple Silicon em
   <https://www.virtualhere.com/usb_client_software>.
2. Abra o aplicativo e aprove as permissões de sistema solicitadas.
3. Clique com o botão direito/control-click em **USB Servers**.
4. Escolha **Specify Hubs** e adicione `10.254.75.75:7575`.
5. Expanda `Jurius Token Office` e confirme `StarSign CUT S`.
6. No teste manual, escolha **Use this device**. Depois do teste, escolha
   **Stop using this device**.

### 5.3 SafeSign e PJeOffice Pro

1. Instale o middleware correto para a versão do macOS e para o token StarSign.
   Consulte o fornecedor do certificado; a página de referência da Certisign é
   <https://suporte.certisign.com.br/duvidas-suporte/downloads/tokens>.
2. Com o USB conectado pelo VirtualHere, abra o SafeSign TokenAdmin e confirme
   que o certificado aparece. Não inicialize nem formate o token.
3. Baixe o PJeOffice Pro correto para **Mac Intel** ou **Apple Silicon** em
   <https://pjeoffice.trf3.jus.br/pjeoffice-pro/docs/userguide.html>.
4. Abra o PJeOffice depois de conectar o token e confirme o certificado nas
   configurações.

### 5.4 Companion e extensão

Na pasta `companion` do projeto:

```bash
./install/install-macos.sh
```

Ou, usando o executável de uma Release:

```bash
./install/install-macos.sh ipapgfacphjdohnonhjkgbcdmojelbjb /caminho/jurius-token-bridge-macos
```

Depois, abra `chrome://extensions`, ative o modo de desenvolvedor, clique em
**Carregar sem compactação** e escolha a pasta `extension`.

## 6. Instalação em Windows

### 6.1 Cloudflare One Client/WARP

1. Baixe a versão estável para Windows em
   <https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/download/>.
2. Execute o instalador como administrador e abra o aplicativo.
3. Escolha **Zero Trust security** e informe `equipe-jurius`.
4. Autentique-se com um e-mail autorizado e confirme **Connected**.

Teste no PowerShell:

```powershell
Test-NetConnection -ComputerName 10.254.75.75 -Port 7575
```

O resultado esperado é `TcpTestSucceeded : True`. Com WARP desligado, deve ser
`False`.

### 6.2 VirtualHere Client

1. Baixe a versão x86_64 ou ARM64 adequada em
   <https://www.virtualhere.com/usb_client_software>.
2. Abra o cliente e aceite a instalação do driver USB se for solicitada.
3. Em **USB Servers > Specify Hubs**, adicione `10.254.75.75:7575`.
4. Confirme `Jurius Token Office > StarSign CUT S`.
5. Para teste manual, clique com o botão direito e escolha **Use this device**.

### 6.3 SafeSign e PJeOffice Pro

1. Instale SafeSign/TokenAdmin para Windows e reinicie se solicitado.
2. Conecte o USB no VirtualHere e confirme o dispositivo também no Gerenciador
   de Dispositivos do Windows.
3. Abra TokenAdmin e confirme o certificado.
4. Baixe o PJeOffice Pro 64 bits (ou a arquitetura aplicável) na
   [página oficial](https://pjeoffice.trf3.jus.br/pjeoffice-pro/docs/userguide.html).
5. Abra o PJeOffice somente depois que o token estiver conectado.

### 6.4 Companion e extensão

Abra PowerShell na pasta `companion`:

```powershell
.\install\install-windows.ps1 -HostExecutable .\jurius-token-bridge-windows-x64.exe
```

Depois carregue a pasta `extension` em `chrome://extensions` durante o MVP.

## 7. Uso diário

1. Ligue o Cloudflare One Client/WARP.
2. Abra VirtualHere Client, SafeSign e PJeOffice Pro.
3. Abra a extensão Jurius e confirme que a rede e o servidor estão online.
4. Clique em **Conectar token**.
5. Aguarde o estado `Token GD Burti: Neste PC`.
6. Entre no PJe, acione a assinatura e digite o PIN somente na janela nativa.
7. Ao terminar, clique em **Liberar token**.

A reserva padrão dura cinco minutos. O usuário pode renová-la durante uma
operação longa; ao expirar, o companion tenta liberar o dispositivo.

## 8. Homologação ponta a ponta

Marque cada item:

- [ ] `lsusb` mostra `1059:0019` no servidor.
- [ ] VirtualHere Server registra `Listening` e `Found ... StarSign CUT S`.
- [ ] O firewall não permite 7575 nas interfaces físicas.
- [ ] A rota Cloudflare anuncia apenas `10.254.75.75/32`.
- [ ] WARP conecta com `equipe-jurius`.
- [ ] TCP/7575 funciona com WARP ligado e falha com WARP desligado.
- [ ] VirtualHere Client mostra o hub e o token.
- [ ] O token pode ser usado e liberado manualmente.
- [ ] SafeSign TokenAdmin mostra o certificado.
- [ ] PJeOffice Pro mostra o certificado.
- [ ] O PJe autentica e assina um documento de homologação.
- [ ] Um segundo computador vê `Em uso` enquanto o primeiro possui o token.
- [ ] O segundo computador consegue conectar após a liberação.
- [ ] Nenhum fluxo solicitou PIN dentro da extensão.

## 9. Diagnóstico

### Enrollment request is invalid

Confirme que a policy de matrícula foi salva **e associada**, contém o e-mail
exato e não possui regras RDP. Exclua o registro local antigo do WARP e repita a
matrícula.

### WARP conectado, mas TCP/7575 falha

Confira, nesta ordem: Split Tunnel incluindo `/32`, rota CIDR ligada ao túnel
correto, connector Healthy, serviço `network-init` Healthy, VirtualHere
Listening e policy de rede. No macOS, a rota deve usar `utun`; no Windows, use
`Test-NetConnection`.

### VirtualHere mostra “trial has expired”

Reimplante a stack com a versão atual. A configuração gratuita deve conter
`AllowedDevices`, mas não `NetworkInterface` nem `TCPPort`. Uma licença do
VirtualHere continua necessária se o uso definitivo exceder os termos da edição
gratuita; consulte <https://www.virtualhere.com/purchase>.

### Token não aparece no VirtualHere

Confirme `lsusb`, variável `VH_ALLOWED_DEVICES=1059/0019`, acesso a `/dev/bus/usb`
e log `Found`. Reconecte fisicamente o token e recrie apenas o container
VirtualHere se necessário.

### Token aparece “Em uso”

O token está anexado a outro computador. Peça que a pessoa clique em **Liberar
token** ou aguarde a reserva expirar. Não reinicie o servidor durante uma
assinatura real.

### SafeSign não mostra o certificado

Confirme primeiro que VirtualHere marca o USB como usado neste computador.
Reabra TokenAdmin. Se necessário, reinstale a versão do middleware compatível
com o sistema e arquitetura. Não faça várias tentativas de PIN: o token pode
bloquear.

### PJeOffice não mostra o certificado

Confirme o certificado no TokenAdmin, encerre e reabra o PJeOffice depois de
conectar o token, confira a biblioteca PKCS#11/SafeSign e então recarregue o
PJe. Instalar Java externo não corrige o PJeOffice Pro, pois ele inclui o
runtime homologado.

## 10. Reversão

Para voltar ao uso físico local:

1. libere o token no VirtualHere;
2. remova-o fisicamente do servidor;
3. conecte-o no computador;
4. mantenha SafeSign e PJeOffice instalados;
5. desligue o WARP se ele não for necessário para outro serviço.

Nenhuma chave ou PFX precisa ser restaurado, pois a chave nunca saiu do token.

## 11. Links principais

- Portal Jurius do token: <https://token.jurius-api.com/>
- Cloudflare One Client para Windows/macOS:
  <https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/download/>
- Matrícula manual WARP:
  <https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/manual-deployment/>
- VirtualHere Client para Windows/macOS:
  <https://www.virtualhere.com/usb_client_software>
- PJeOffice Pro:
  <https://pjeoffice.trf3.jus.br/pjeoffice-pro/docs/userguide.html>
- SafeSign/GD Burti por sistema:
  <https://suporte.certisign.com.br/duvidas-suporte/downloads/tokens>
- Checklist técnico detalhado: [HOMOLOGACAO.md](HOMOLOGACAO.md)
- Segurança: [../SECURITY.md](../SECURITY.md)
