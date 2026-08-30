#!/bin/sh
set -eu

interface="${VH_DUMMY_INTERFACE:-jurius-token}"
address="${VH_PRIVATE_ADDRESS:-10.254.75.75/32}"

if ! command -v ip >/dev/null 2>&1; then
  echo "O comando ip (iproute2) nao foi encontrado" >&2
  exit 1
fi

if ! ip link show "$interface" >/dev/null 2>&1; then
  ip link add "$interface" type dummy
fi

ip address replace "$address" dev "$interface"
ip link set "$interface" up
ip -brief address show "$interface"

