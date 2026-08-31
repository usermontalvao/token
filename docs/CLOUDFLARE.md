# Cloudflare Zero Trust: rota privada

Este projeto usa **Client-to-Tunnel/private network**, nao Public Hostname e nao
`cloudflared access tcp`. O VirtualHere recebe uma conexao TCP longa; o
Cloudflare One Client encaminha o IP privado diretamente pela organizacao.

## Servidor

1. Crie ou reutilize um Cloudflare Tunnel no servidor Linux.
2. Confirme que o connector aparece como Healthy.
3. Em **Networks/Networking > Routes**, crie uma rota de Tunnel CIDR:
   `10.254.75.75/32`.
4. Se houver redes sobrepostas, associe a rota a uma Virtual Network dedicada.
5. Nao crie Public Hostname para TCP/7575.

O tunnel faz conexoes de saida para a Cloudflare; nao e necessario abrir 7575
no firewall de borda.

## Clientes

1. Baixe o Cloudflare One Client estavel para Windows ou macOS:
   https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/download/
2. Escolha **Zero Trust security** e use `equipe-jurius` como nome da equipe.
3. Matricule o computador com `pedro@advcuiaba.com` ou outro e-mail previamente
   incluido na policy de Device Enrollment.
4. Use modo **Traffic and DNS**.
5. Em Split Tunnels, inclua `10.254.75.75/32` no WARP. Contas em modo Exclude
   precisam remover esse IP das exclusoes padrao de redes privadas.
6. Confirme em `https://help.teams.cloudflare.com/` que WARP e Gateway Proxy
   estao ativos.

Uma policy de matricula apenas criada, mas nao associada ao aplicativo, causa
`Enrollment request is invalid`. Nao inclua `connection_rules` de RDP nessa
policy.

## Politica minima

Crie uma policy de rede de maior prioridade permitindo:

- identidade/grupo: usuarios do certificado;
- postura: dispositivo gerenciado, se disponivel;
- destino: `10.254.75.75`;
- protocolo: TCP;
- porta: `7575`.

Depois crie uma regra de bloqueio para o mesmo IP destinada aos demais usuarios.
Nao anuncie a sub-rede inteira do escritorio quando so um `/32` e necessario.

## Verificacao

No computador autorizado, com WARP ativo:

```bash
nc -vz 10.254.75.75 7575
```

Com WARP desligado, o teste deve falhar. Se continuar funcionando, existe uma
rota local, VPN paralela ou exposicao que precisa ser investigada.

Documentacao oficial:

- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/cloudflared/connect-cidr/

O manual completo, incluindo os clientes Windows/macOS e os testes da rota,
esta em [`MANUAL-COMPLETO.md`](MANUAL-COMPLETO.md).
