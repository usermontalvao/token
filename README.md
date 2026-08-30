# Jurius Token Bridge

MVP para disponibilizar um token de certificado digital A3 conectado a um
servidor Linux para computadores autorizados do escritorio.

O projeto **nao extrai certificados**, nao converte o A3 em PFX, nao conhece o
PIN e nao substitui o SafeSign ou o PJeOffice Pro. Ele apenas coordena uma
sessao temporaria do dispositivo USB por meio do VirtualHere, transportada por
uma rota privada do Cloudflare Zero Trust.

## Componentes

```text
Token A3 USB
  -> server/ (VirtualHere Server no Linux)
  -> Cloudflare Tunnel + rota privada /32
  -> VirtualHere Client no computador
  -> companion/ (controle local por Native Messaging)
  -> extension/ (status, conectar, renovar e liberar)
  -> SafeSign -> PJeOffice Pro -> PJe
```

- `server/`: imagem Docker pequena e configuracao do VirtualHere Server.
- `companion/`: host Native Messaging multiplataforma, sem dependencias npm.
- `extension/`: extensao Chrome MV3 de teste, pronta para ser incorporada ao
  Jurius Authenticator existente.
- `docs/`: instalacao do Cloudflare, roteiro de homologacao e integracao.

## Regra de uso

O token so pode pertencer a um computador por vez. Ao conectar, o companion
cria uma reserva de 5 minutos. O usuario pode renovar ou liberar antes; ao
terminar a reserva, um watchdog local envia `STOP USING` ao VirtualHere.

Esse prazo pode ser alterado em `config.json`. A liberacao automatica e uma
proteção contra esquecimento, nao um mecanismo de seguranca para o PIN.

## Inicio rapido

1. No servidor Linux, leia [`server/README.md`](server/README.md).
2. Configure a rota privada conforme [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md).
3. Em cada computador, instale VirtualHere Client, SafeSign e PJeOffice Pro.
4. Instale o companion conforme [`companion/README.md`](companion/README.md).
5. Carregue `extension/` em `chrome://extensions` para o teste isolado.
6. Execute o roteiro [`docs/HOMOLOGACAO.md`](docs/HOMOLOGACAO.md).

## Seguranca do MVP

- nenhuma porta deve ser encaminhada no roteador do escritorio;
- o servidor VirtualHere aceita somente o VID/PID configurado;
- a rota Cloudflare anuncia apenas um IP `/32` dedicado;
- a policy de rede permite somente TCP/7575 para usuarios/dispositivos
  autorizados;
- o Native Messaging aceita somente quatro acoes fechadas;
- nenhum comando de shell, PIN ou segredo e recebido da extensao;
- a interface local nao abre servidor HTTP em `localhost`.

Consulte [`SECURITY.md`](SECURITY.md) antes de colocar o token real no servidor.

