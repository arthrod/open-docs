#!/bin/sh
# Rebuilds dist/docx-io.js and prints its SRI hash (lib/plate-docx.ts pins both).
set -eu
cd "$(dirname "$0")"
pnpm install --silent
# Node built-ins docx-io's dependencies use: path, events, buffer (browser packages).
./node_modules/.bin/esbuild entry.js --bundle --format=esm --minify --platform=browser --target=es2022 \
  --alias:path=path-browserify --inject:inject.js --define:global=globalThis \
  --external:platejs --external:platejs/static --external:@platejs/docx \
  --outfile=dist/docx-io.js
# Plate stays external and resolves to the SAME esm.sh modules the editor loads
# (editors/plate/deps.ts), so there is one copy of Plate on the page.
Q='?external=react,react-dom\&target=es2022\&deps=platejs@53.5.2'
sed -i.bak \
  -e "s#from\"platejs/static\"#from\"https://esm.sh/platejs@53.5.2/static$Q\"#g" \
  -e "s#from\"platejs\"#from\"https://esm.sh/platejs@53.5.2$Q\"#g" \
  -e "s#from\"@platejs/docx\"#from\"https://esm.sh/@platejs/docx@53.0.0$Q\"#g" \
  dist/docx-io.js
rm dist/docx-io.js.bak
printf 'sha384-%s\n' "$(openssl dgst -sha384 -binary dist/docx-io.js | openssl base64 -A)"
