#!/bin/sh
set -eu

server_name="${VH_SERVER_NAME:-Jurius Token Office}"
bind_address="${VH_BIND_ADDRESS:-10.254.75.75}"
tcp_port="${VH_TCP_PORT:-7575}"
allowed_devices="${VH_ALLOWED_DEVICES:-}"
auto_attach="${VH_AUTO_ATTACH_TO_KERNEL:-0}"
claim_ports="${VH_CLAIM_PORTS:-0}"
config_file="/config/config.ini"

case "$tcp_port" in
  ''|*[!0-9]*) echo "VH_TCP_PORT invalida" >&2; exit 64 ;;
esac

if [ "$tcp_port" -lt 1 ] || [ "$tcp_port" -gt 65535 ]; then
  echo "VH_TCP_PORT fora do intervalo" >&2
  exit 64
fi

if [ -z "$allowed_devices" ]; then
  echo "VH_ALLOWED_DEVICES e obrigatorio; recuso compartilhar todo USB do host" >&2
  exit 64
fi

if ! printf '%s' "$allowed_devices" | grep -Eq '^[0-9A-Fa-f]+(/[0-9A-Fa-f*]+)?(,[0-9A-Fa-f]+(/[0-9A-Fa-f*]+)?)*$'; then
  echo "VH_ALLOWED_DEVICES deve usar hexadecimal VID/PID, por exemplo 1234/abcd" >&2
  exit 64
fi

umask 077
{
  printf 'ServerName=%s\n' "$server_name"
  printf 'NetworkInterface=%s\n' "$bind_address"
  printf 'TCPPort=%s\n' "$tcp_port"
  printf 'AllowedDevices=%s\n' "$allowed_devices"
  printf 'AutoAttachToKernel=%s\n' "$auto_attach"
  printf 'ClaimPorts=%s\n' "$claim_ports"
} > "$config_file"

echo "Iniciando VirtualHere em ${bind_address}:${tcp_port}; somente ${allowed_devices}" >&2
cd /config
exec /usr/local/bin/vhusbd -c "$config_file"

