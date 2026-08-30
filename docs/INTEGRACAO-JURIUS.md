# Integracao no Jurius Authenticator existente

O MVP usa uma extensao separada apenas para homologacao. Depois do teste, a
incorporacao na extensao `CRMlaw/extension` exige mudancas pequenas.

## Manifest

Adicionar somente:

```json
"permissions": [
  "storage",
  "alarms",
  "activeTab",
  "scripting",
  "nativeMessaging"
]
```

Nao e necessario adicionar host permission, content script ou liberar HTTP em
localhost.

## Service worker

Copiar a funcao `nativeRequest` e as quatro acoes de
`extension/src/service-worker.js` para o roteador ja existente. O popup atual
continua conversando apenas com o service worker.

Recomendacao: exponha as acoes somente depois que `estado()` confirmar uma
sessao valida do CRM. Isso nao substitui a policy Cloudflare, mas mantem a
experiencia alinhada as permissoes existentes.

## Popup

Adicionar um card abaixo do resumo de codigos 2FA com os cinco estados. O card
pode ser carregado sob demanda para nao iniciar o companion toda vez que a
pessoa abre apenas um codigo TOTP.

## Compatibilidade do ID

O host instalado autoriza somente:

```text
chrome-extension://ipapgfacphjdohnonhjkgbcdmojelbjb/
```

Esse e o ID fixado pelo `key` do manifest atual. Se o ID mudar, reinstale o
manifesto Native Messaging com o novo valor.

## Politica de atualizacao

A extensao e o companion devem versionar o protocolo. Durante o MVP, a resposta
inclui `version: 0.1.0`. Evolucoes devem manter as quatro acoes antigas ou
mostrar uma mensagem clara de incompatibilidade.

