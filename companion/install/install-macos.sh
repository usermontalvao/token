#!/bin/sh
set -eu

extension_id="${1:-ipapgfacphjdohnonhjkgbcdmojelbjb}"
case "$extension_id" in
  *[!a-p]*|'') echo "ID de extensao invalido: $extension_id" >&2; exit 64 ;;
esac
if [ "${#extension_id}" -ne 32 ]; then
  echo "ID de extensao invalido: $extension_id" >&2
  exit 64
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_file=$(CDPATH= cd -- "$script_dir/../src" && pwd)/native-host.cjs
release_executable="${2:-}"

install_dir="$HOME/Library/Application Support/Jurius Token Bridge"
host_script="$install_dir/native-host.cjs"
launcher="$install_dir/jurius-token-bridge"
config_file="$install_dir/config.json"

mkdir -p "$install_dir"
chmod 700 "$install_dir"
if [ -n "$release_executable" ]; then
  if [ ! -f "$release_executable" ]; then
    echo "Executavel nao encontrado: $release_executable" >&2
    exit 1
  fi
  cp "$release_executable" "$launcher"
  chmod 700 "$launcher"
  codesign --force --sign - "$launcher"
else
  node_path=$(command -v node || true)
  if [ -z "$node_path" ]; then
    echo "Node.js 20+ nao encontrado. Passe o executavel da Release como segundo argumento." >&2
    exit 1
  fi
  cp "$source_file" "$host_script"
  chmod 600 "$host_script"
  {
    printf '#!/bin/sh\n'
    printf 'exec "%s" "%s"\n' "$node_path" "$host_script"
  } > "$launcher"
  chmod 700 "$launcher"
fi

if [ ! -f "$config_file" ]; then
  cp "$script_dir/../config.example.json" "$config_file"
  chmod 600 "$config_file"
fi

manifest=$(printf '{\n  "name": "br.com.jurius.token_bridge",\n  "description": "Jurius Token Bridge",\n  "path": "%s",\n  "type": "stdio",\n  "allowed_origins": ["chrome-extension://%s/"]\n}\n' "$launcher" "$extension_id")

for relative in \
  "Google/Chrome/NativeMessagingHosts" \
  "Microsoft Edge/NativeMessagingHosts" \
  "Chromium/NativeMessagingHosts" \
  "BraveSoftware/Brave-Browser/NativeMessagingHosts"
do
  target="$HOME/Library/Application Support/$relative"
  mkdir -p "$target"
  printf '%s' "$manifest" > "$target/br.com.jurius.token_bridge.json"
  chmod 600 "$target/br.com.jurius.token_bridge.json"
done

echo "Companion instalado em: $install_dir"
echo "Configuracao: $config_file"
echo "Feche e abra o Chrome antes do teste."
