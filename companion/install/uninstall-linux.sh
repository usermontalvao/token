#!/bin/sh
set -eu

config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
for relative in \
  "google-chrome/NativeMessagingHosts" \
  "chromium/NativeMessagingHosts" \
  "microsoft-edge/NativeMessagingHosts" \
  "BraveSoftware/Brave-Browser/NativeMessagingHosts"
do
  rm -f "$config_home/$relative/br.com.jurius.token_bridge.json"
done

echo "Manifestos removidos. Binario e configuracao foram preservados para recuperacao."

