#!/bin/zsh
set -e
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
url="http://localhost:3241"

if /usr/sbin/lsof -nP -iTCP:3241 -sTCP:LISTEN >/dev/null 2>&1; then
  if /usr/bin/curl -fsS "$url/login" | /usr/bin/grep -q 'sindmaster'; then
    echo "O sistema já está aberto em $url"
    /usr/bin/open "$url/login"
    exit 0
  fi
  echo "A porta 3241 está ocupada por outro serviço. Feche-o antes de iniciar."
  read -r "?Pressione Enter para fechar."
  exit 1
fi

if [[ ! -f .next/BUILD_ID ]]; then
  npm run build
fi

(
  for tentativa in {1..60}; do
    if /usr/bin/curl -fsS "$url/api/saude" >/dev/null 2>&1; then
      /usr/bin/open "$url/login"
      break
    fi
    sleep 1
  done
) &

echo "Acesso: $url/login"
echo "Mantenha este terminal aberto. Para encerrar, pressione Control+C."
exec npm start -- --hostname 127.0.0.1
