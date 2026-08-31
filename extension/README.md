# Extensao de teste

Esta e uma interface MV3 isolada para homologar o Token Bridge antes de mexer
na interface maior do Jurius Authenticator.

Ela usa a mesma chave publica/ID da extensao atual:

```text
ipapgfacphjdohnonhjkgbcdmojelbjb
```

Por isso, desative temporariamente a extensao Jurius Authenticator original
antes de carregar esta pasta sem compactacao. Chrome nao executa duas extensoes
com o mesmo ID ao mesmo tempo.

## Carregar

1. Abra `chrome://extensions`.
2. Ative o modo do desenvolvedor.
3. Clique em **Carregar sem compactacao**.
4. Escolha esta pasta `extension/`.

O companion precisa ter sido instalado permitindo exatamente o ID acima.

O icone de engrenagem abre a pagina **Configuracoes e manuais**, empacotada na
propria extensao. Ela contem os passos para Windows e macOS e links oficiais do
Cloudflare One Client, VirtualHere Client, SafeSign e PJeOffice Pro. O popup
tambem oferece o portal HTTPS <https://token.jurius-api.com/> como apoio/status;
esse dominio nao substitui o hub privado `10.254.75.75:7575`.

## Incorporacao posterior

Depois da homologacao, nao sera necessario manter esta extensao separada. O
service worker e o bloco visual podem ser incorporados ao Jurius Authenticator.
Veja `../docs/INTEGRACAO-JURIUS.md`.
