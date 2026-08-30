#!/bin/sh
set -eu

port="${VH_TCP_PORT:-7575}"
table="jurius_token"

case "$port" in
  ''|*[!0-9]*) echo "VH_TCP_PORT invalida" >&2; exit 64 ;;
esac

if ! command -v nft >/dev/null 2>&1; then
  echo "nftables nao encontrado. Instale nftables ou crie regra equivalente no firewall existente." >&2
  exit 1
fi

# A tabela e exclusiva deste projeto. Recria-la torna o script idempotente e
# nao altera regras de UFW/firewalld em outras tabelas.
if nft list table inet "$table" >/dev/null 2>&1; then
  nft delete table inet "$table"
fi

nft add table inet "$table"
nft add chain inet "$table" input '{ type filter hook input priority 0; policy accept; }'
nft add rule inet "$table" input iifname lo tcp dport "$port" accept comment 'cloudflared local para VirtualHere'
nft add rule inet "$table" input tcp dport "$port" drop comment 'bloqueia VirtualHere nas interfaces fisicas'

nft list table inet "$table"

