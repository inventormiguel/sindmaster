#!/bin/zsh
set -e
cd -- "${0:A:h}"
projeto="$PWD"
pid=$(/usr/sbin/lsof -nP -tiTCP:3241 -sTCP:LISTEN 2>/dev/null || true)

if [[ -z "$pid" ]]; then
  echo "O servidor local já está parado."
  exit 0
fi

# Só encerra o servidor desta pasta, nunca um processo de outro projeto.
if [[ "$pid" == *$'\n'* ]]; then
  echo "Há vários processos na porta 3241. Nenhum processo foi encerrado."
  exit 1
fi
pasta=$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn | /usr/bin/sed -n 's/^n//p')
comando=$(/bin/ps -p "$pid" -o command=)
if [[ "$pasta" != "$projeto" || "$comando" != *next-server* ]]; then
  echo "A porta 3241 pertence a outro serviço. Nenhum processo foi encerrado."
  exit 1
fi

kill -TERM "$pid"
echo "Servidor local encerrado. Os dados continuam na pasta .data."
