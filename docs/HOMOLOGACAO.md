# Roteiro de homologacao

Nao comece por uma assinatura real. Registre versoes do sistema, VirtualHere,
SafeSign e PJeOffice para que o resultado possa ser reproduzido.

## Etapa A — servidor e USB

1. `lsusb` mostra o token e o VID/PID esperado.
2. O container esta healthy/running e o log mostra somente o dispositivo
   permitido.
3. Preferencialmente `ss -lntp` mostra 7575 apenas no IP privado dedicado. Se
   a edicao VirtualHere ignorar `NetworkInterface` e escutar em `0.0.0.0`, a
   tabela `inet jurius_token` deve bloquear a porta em interfaces fisicas.
4. Retirar e recolocar o token faz ele reaparecer sem reiniciar o host.

## Etapa B — VirtualHere sem Cloudflare

Se possivel, coloque um notebook na LAN do escritorio e conecte manualmente ao
IP do servidor. Capture e libere o token tres vezes. Isso valida USB, Docker e
VirtualHere antes de adicionar latencia e roteamento.

## Etapa C — Cloudflare

1. Fora do escritorio e com WARP desligado, 7575 e inacessivel.
2. Com WARP ligado e usuario permitido, TCP/7575 responde.
3. Um usuario fora da policy continua bloqueado.
4. VirtualHere conecta usando `10.254.75.75:7575` adicionado manualmente.

## Etapa D — sistema operacional

1. Clique **Conectar token**.
2. A extensao mostra `Token: Neste PC` e inicia o contador.
3. macOS: verifique Relatorio do Sistema/USB; Windows: Gerenciador de
   Dispositivos; Linux: `lsusb` e o cliente VirtualHere.
4. Clique **Liberar token** e confirme que ele desaparece do cliente.
5. Em outro computador, confirme que a captura agora e permitida.

## Etapa E — SafeSign

1. Abra TokenAdmin/SafeSign.
2. Confirme fabricante, numero de serie e certificado.
3. Nao use tentativas aleatorias de PIN: tokens A3 costumam bloquear apos
   poucas tentativas incorretas.
4. Libere e reconecte o USB; confirme que o middleware se recupera.

## Etapa F — PJeOffice Pro

1. Abra PJeOffice Pro e a configuracao de certificado A3.
2. Confirme a biblioteca PKCS#11 do SafeSign.
3. Confirme que o certificado aparece no assinador.
4. Primeiro faca login em um ambiente PJe autorizado.
5. Depois assine um documento de teste sem valor processual, se o tribunal
   oferecer ambiente de homologacao.
6. Somente entao realize uma operacao real controlada.

## Criterios de aceite

- chave privada nunca aparece como arquivo;
- PIN aparece apenas em UI nativa do middleware/assinador;
- nenhum cliente sem WARP/policy alcanca 7575;
- segundo cliente recebe `Em uso` enquanto o primeiro possui o token;
- liberacao manual e por expiracao devolvem o token;
- login e assinatura concluem sem desconexao do USB.

## Evidencias uteis em caso de falha

- versoes e arquitetura do SO;
- saida do `LIST` do VirtualHere sem dados pessoais desnecessarios;
- logs do container no intervalo da falha;
- Cloudflare Gateway Network logs para destino/porta;
- tela do TokenAdmin e configuracao PKCS#11 do PJeOffice;
- latencia aproximada ate o servidor.

Nunca publique PIN, token de tunnel ou numero completo do certificado.
