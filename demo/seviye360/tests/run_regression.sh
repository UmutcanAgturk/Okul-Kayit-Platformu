#!/usr/bin/env bash
# Seviye 360 - standing regression paketi.
# Uygulama dosyasında (seviye360-app.html) HER değişiklikten sonra bu script
# tek komutla çalıştırılmalı. t155 (tüm platform/rol senkron doğrulaması) artık
# paketin daimi bir parçasıdır — ayrı ayrı unutulup atlanmasın diye buraya eklendi.
set -uo pipefail
cd "$(dirname "$0")"

TESTS=(
  t147_unified_platform.js
  t147b_hub_sweep.js
  t147c_web_regression.js
  t148_qa_sweep.js
  t148b_mobile_qa_sweep.js
  t148c_mobile_rbac.js
  t149_a11y.js
  t150_tour.js
  t155_full_sync_verification.js
  t158_error_toasts.js
  t157_seed_presets.js
)

pass=0
fail=0
failed_names=()

for f in "${TESTS[@]}"; do
  echo "=== $f ==="
  if node "$f" > "/tmp/${f%.js}.log" 2>&1; then
    echo "OK"
    pass=$((pass+1))
  else
    echo "FAIL (bkz: /tmp/${f%.js}.log)"
    tail -n 15 "/tmp/${f%.js}.log"
    fail=$((fail+1))
    failed_names+=("$f")
  fi
  echo
done

echo "================================"
echo "TOPLAM: ${#TESTS[@]} | BAŞARILI: $pass | BAŞARISIZ: $fail"
if [ "$fail" -gt 0 ]; then
  echo "Başarısız testler: ${failed_names[*]}"
  exit 1
fi
exit 0
