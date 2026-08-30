#!/bin/sh
set -eu

for relative in \
  "Google/Chrome/NativeMessagingHosts" \
  "Microsoft Edge/NativeMessagingHosts" \
  "Chromium/NativeMessagingHosts" \
  "BraveSoftware/Brave-Browser/NativeMessagingHosts"
do
  rm -f "$HOME/Library/Application Support/$relative/br.com.jurius.token_bridge.json"
done

echo "Manifestos removidos. Os dados permanecem em ~/Library/Application Support/Jurius Token Bridge"

