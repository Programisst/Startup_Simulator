#!/bin/bash
# Выкладывает игру на сервер: собирает игру и службу, копирует их и перезапускает службу.
# Запуск: npm run deploy
# Адрес сервера и путь к ключу доступа берутся из файла .env.local (он не попадает на GitHub):
#   DEPLOY_HOST=...   DEPLOY_PORT=...   DEPLOY_KEY=~/.ssh/...
# Ключ к нейросети этот скрипт не трогает: он лежит на сервере отдельно.
set -euo pipefail
cd "$(dirname "$0")/.."

read_setting() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '\r'; }
HOST=$(read_setting DEPLOY_HOST)
PORT=$(read_setting DEPLOY_PORT)
KEY=$(read_setting DEPLOY_KEY)
KEY="${KEY/#\~/$HOME}"
if [ -z "$HOST" ] || [ -z "$PORT" ] || [ -z "$KEY" ]; then
  echo "В .env.local нет строк DEPLOY_HOST, DEPLOY_PORT, DEPLOY_KEY" >&2
  exit 1
fi

npm test
npm run build
npm run server:build

SSH=(ssh -i "$KEY" -p "$PORT" -o BatchMode=yes)
rsync -az --delete -e "${SSH[*]}" dist/ "root@$HOST:/opt/startup-sim/public/"
rsync -az -e "${SSH[*]}" dist-server/server.mjs "root@$HOST:/opt/startup-sim/server.mjs"
"${SSH[@]}" "root@$HOST" 'chown -R root:startupsim /opt/startup-sim/public /opt/startup-sim/server.mjs && chmod -R g+rX,o-rwx /opt/startup-sim/public /opt/startup-sim/server.mjs && systemctl restart startup-sim && sleep 2 && systemctl is-active startup-sim'
echo "Готово: игра обновлена."
