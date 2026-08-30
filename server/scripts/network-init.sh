#!/bin/sh
set -eu

interface="${VH_DUMMY_INTERFACE:-jurius-token}"
address="${VH_BIND_ADDRESS:-10.254.75.75}"
prefix="${VH_PRIVATE_PREFIX:-32}"
port="${VH_TCP_PORT:-7575}"
table="jurius_token"

case "$address" in
  ''|*[!0-9.]*) echo "VH_BIND_ADDRESS IPv4 invalido" >&2; exit 64 ;;
esac
case "$prefix" in
  ''|*[!0-9]*) echo "VH_PRIVATE_PREFIX invalido" >&2; exit 64 ;;
esac
case "$port" in
  ''|*[!0-9]*) echo "VH_TCP_PORT invalida" >&2; exit 64 ;;
esac

if ! ip link show "$interface" >/dev/null 2>&1; then
  ip link add "$interface" type dummy
fi
ip address replace "${address}/${prefix}" dev "$interface"
ip link set "$interface" up

# Recria somente a tabela pertencente a este projeto. A regra bloqueia a porta
# VirtualHere em interfaces fisicas e permite a conexao local do cloudflared.
if nft list table inet "$table" >/dev/null 2>&1; then
  nft delete table inet "$table"
fi
nft add table inet "$table"
nft add chain inet "$table" input '{ type filter hook input priority 0; policy accept; }'
nft add rule inet "$table" input iifname lo tcp dport "$port" accept comment 'cloudflared local para VirtualHere'
nft add rule inet "$table" input tcp dport "$port" drop comment 'bloqueia VirtualHere nas interfaces fisicas'

echo "Rede preparada: ${address}/${prefix} em ${interface}"
echo "Firewall preparado: TCP/${port} permitido apenas pelo loopback"
ip -brief address show "$interface"
nft list table inet "$table"

echo "Dispositivos USB visiveis no host:"
lsusb || true
