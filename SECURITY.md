# Modelo de seguranca

## Ativos protegidos

- chave privada residente no token A3;
- PIN do token;
- capacidade de solicitar uma assinatura;
- disponibilidade do unico dispositivo fisico.

## Limites do sistema

O VirtualHere transporta operacoes USB. A chave privada permanece no hardware,
mas quem controla um computador autorizado enquanto ele possui o token pode
solicitar operacoes ao dispositivo e exibir a janela de PIN. Por isso, acesso ao
Cloudflare Zero Trust e ao computador local deve ser tratado como acesso ao
token fisico.

## Controles obrigatorios

1. Nunca publique TCP/7575 em DNS publico, Cloudflare Public Hostname, NAT ou
   port-forward.
2. Use Cloudflare One Client em modo de trafego e DNS, enrollment restrito e
   postura de dispositivo quando disponivel.
3. Crie uma regra allow especifica para o IP `/32` e TCP/7575, seguida de block.
4. Configure `VH_ALLOWED_DEVICES` com o VID/PID real. Nao deixe vazio em
   producao.
5. Aplique `server/scripts/lock-port.sh`; nao confie apenas em
   `NetworkInterface`, pois recursos avancados podem depender da licenca.
6. Nao grave o PIN em extensao, companion, variavel de ambiente ou gerenciador
   de automacao.
7. Mantenha bloqueio de tela e criptografia de disco nos clientes.
8. Libere o token imediatamente depois do login ou assinatura.
9. Conserve uma forma de retirar fisicamente o token e reiniciar o servidor.
10. O servico VirtualHere em Docker possui `SYS_ADMIN`, acesso de escrita ao
    `sysfs` USB e fica sem o perfil AppArmor padrao para poder controlar os
    drivers USB. Nao reutilize essa imagem para outros processos e nao monte
    outros caminhos do host nela. Para isolamento mais forte, prefira instalar
    o binario VirtualHere diretamente no host como um servico dedicado.

## Riscos residuais

- perda de conexao no meio de uma assinatura;
- incompatibilidade entre VirtualHere, driver USB e uma versao do SafeSign;
- um cliente autorizado manter o token ocupado;
- comprometimento do endpoint autorizado;
- atualizacao de macOS/Windows, SafeSign ou PJeOffice mudar a compatibilidade.

O watchdog reduz ocupacao acidental, mas nao interrompe instantaneamente um
cliente desligado de forma abrupta. O servidor VirtualHere deve encerrar a
sessao quando a conexao TCP desaparecer.

## Relato de vulnerabilidade

Nao abra issue publica contendo chaves do Cloudflare, logs com dados pessoais,
PIN, numero de serie do certificado ou identificadores internos. Use o canal
privado do escritorio.
