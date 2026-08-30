# Servidor Linux

## 1. Identificar o token

Conecte somente o token que sera testado e execute:

```bash
lsusb
lsusb -t
```

Uma linha como `ID 1234:abcd Fabricante Token` significa:

```dotenv
VH_ALLOWED_DEVICES=1234/abcd
```

Nao copie o exemplo ficticio do projeto.

## 2. Criar um IP privado dedicado

O IP nao deve pertencer a uma sub-rede usada em casa, no escritorio ou em outra
VPN. O exemplo do projeto e `10.254.75.75/32`.

```bash
sudo VH_PRIVATE_ADDRESS=10.254.75.75/32 ./scripts/setup-private-ip.sh
```

Torne a interface persistente usando NetworkManager, systemd-networkd ou a
ferramenta de rede da distribuicao. O script e idempotente, mas a interface
dummy desaparece no reboot se nao houver configuracao persistente.

Bloqueie a porta nas interfaces fisicas:

```bash
sudo ./scripts/lock-port.sh
```

Essa regra permite TCP/7575 apenas pelo loopback. Como `cloudflared` esta no
mesmo host, ele alcanca o IP dummy por uma conexao local. O VirtualHere lista
`NetworkInterface` entre configuracoes avancadas; por isso a seguranca nao pode
depender de a edicao trial respeitar essa opcao.

## 3. Subir o VirtualHere

### Portainer/Stack a partir do Git

O arquivo para stack esta na raiz do repositorio: `docker-compose.yml`. No
Portainer, deixe **Compose path** como `docker-compose.yml` e cadastre as
variaveis abaixo no editor da stack, principalmente `VH_ALLOWED_DEVICES`.

A stack inclui um servico one-shot chamado `network-init`. Ele recebe somente
`NET_ADMIN`, cria o IP dummy e aplica a tabela de firewall deste projeto. Depois
encerra com sucesso; o VirtualHere inicia somente depois dele. Portanto, na
implantacao pelo Portainer nao e necessario executar manualmente os dois scripts
de rede por SSH.

O log do `jurius-token-network-init` tambem executa `lsusb`. Com o token
fisicamente conectado, use esse log para descobrir `VID:PID` e informe a
variavel `VH_ALLOWED_DEVICES` no formato `VID/PID`.

Nao use `server/docker-compose.yml` como caminho se o repositorio ainda nao foi
baixado ou se a stack estiver configurada para procurar o arquivo na raiz.

### Terminal dentro da pasta server

```bash
cp .env.example .env
# edite .env e informe o VID/PID verdadeiro
docker compose build --pull
docker compose up -d virtualhere
docker compose logs -f virtualhere
```

A imagem baixa o binario generico diretamente do site oficial do VirtualHere.
A versao trial permite compartilhar um dispositivo; confirme os termos e a
licenca aplicaveis antes do uso definitivo. O build confere o checksum oficial;
para reproducibilidade mais forte, preencha `VH_SHA256` depois de aprovar uma
versao especifica do binario.

O container nao usa `privileged: true`. Ele recebe os device nodes USB,
`SYS_ADMIN` e escrita somente nas arvores USB de `sysfs`, pois o VirtualHere
precisa desanexar e reanexar drivers durante o redirecionamento. Em hosts Ubuntu,
o perfil AppArmor padrao bloqueia essa escrita; por isso somente o servico
`virtualhere` usa `apparmor:unconfined`. Essas permissoes ainda sao elevadas,
embora mais estreitas que `privileged: true`: execute apenas a imagem construida
a partir deste repositorio e mantenha `AllowedDevices` limitado ao token.

O VirtualHere pode registrar que `/sys/module/usbcore/parameters/usbfs_memory_mb`
esta somente para leitura. O servidor continua operacional quando, logo depois,
registra `Listening` e `Found ... [VID:PID]`. Esse ajuste de buffer global e
importante para dispositivos de alto volume, como webcams; ele nao e necessario
para o MVP com o token criptografico e permanece bloqueado por seguranca.

## 4. Cloudflare

O `cloudflared` pode ser o que ja existe no servidor. Se desejar usar o profile:

```bash
docker compose --profile cloudflare up -d
```

O profile exige `CLOUDFLARE_TUNNEL_TOKEN` no `.env`. O token nao deve entrar no
Git. Configure no dashboard uma rota `10.254.75.75/32` apontando para esse
tunnel. Veja `../docs/CLOUDFLARE.md`.

## 5. Confirmar que nao existe exposicao publica

No servidor:

```bash
ss -lntp | grep ':7575'
nft list table inet jurius_token
docker compose ps
```

No roteador, nao deve existir port-forward 7575. De uma maquina sem Cloudflare
One/WARP, o IP dedicado nao deve ser alcancavel. De uma maquina autorizada:

```bash
nc -vz 10.254.75.75 7575
```

## Alternativa recomendada para diagnostico

Se o container nao capturar o token, rode o binario VirtualHere diretamente no
host com o mesmo `config.ini`. Isso elimina cgroup, mount de USB e hotplug como
fontes de erro. Depois de comprovar SafeSign e PJeOffice, retorne ao Docker.
