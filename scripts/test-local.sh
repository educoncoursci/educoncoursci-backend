#!/bin/bash

# ============================================================

# scripts/test-local.sh

# Script de test rapide du backend en local

# Usage : chmod +x scripts/test-local.sh && ./scripts/test-local.sh

# ============================================================

BASE=“http://localhost:3000/api”
GREEN=”\033[0;32m”
RED=”\033[0;31m”
YELLOW=”\033[0;33m”
NC=”\033[0m”

echo “”
echo “════════════════════════════════════════”
echo “   🧪 TEST LOCAL EduConcoursCI Backend”
echo “════════════════════════════════════════”
echo “”

# Fonction de test

test_endpoint() {
local label=”$1”
local method=”$2”
local url=”$3”
local data=”$4”
local token=”$5”

if [ -n “$token” ]; then
if [ -n “$data” ]; then
resp=$(curl -s -o /dev/null -w “%{http_code}” -X “$method” “$url”   
-H “Content-Type: application/json”   
-H “Authorization: Bearer $token”   
-d “$data”)
else
resp=$(curl -s -o /dev/null -w “%{http_code}” -X “$method” “$url”   
-H “Authorization: Bearer $token”)
fi
elif [ -n “$data” ]; then
resp=$(curl -s -o /dev/null -w “%{http_code}” -X “$method” “$url”   
-H “Content-Type: application/json”   
-d “$data”)
else
resp=$(curl -s -o /dev/null -w “%{http_code}” “$url”)
fi

if [ “$resp” -ge 200 ] && [ “$resp” -lt 300 ]; then
echo -e “  ${GREEN}✅${NC} $label — HTTP $resp”
return 0
elif [ “$resp” -eq 401 ] || [ “$resp” -eq 403 ]; then
echo -e “  ${YELLOW}🔐${NC} $label — HTTP $resp (auth requis — normal)”
return 0
else
echo -e “  ${RED}❌${NC} $label — HTTP $resp”
return 1
fi
}

# ── 1. Santé du serveur ───────────────────────────────────

echo “📡 Connexion au serveur…”
health=$(curl -s “$BASE/health” 2>/dev/null)
if [ -z “$health” ]; then
echo -e “  ${RED}❌ Serveur inaccessible sur $BASE${NC}”
echo “     → Lance d’abord : npm run dev”
exit 1
fi
echo -e “  ${GREEN}✅ Serveur accessible${NC}”
echo “”

# ── 2. Routes publiques ───────────────────────────────────

echo “🌐 Routes publiques :”
test_endpoint “GET /api/health”        “GET” “$BASE/health”
test_endpoint “GET /api/concours”      “GET” “$BASE/concours”
test_endpoint “GET /api/concours/ouverts” “GET” “$BASE/concours/ouverts”
test_endpoint “GET /api/pdfs”          “GET” “$BASE/pdfs”
test_endpoint “GET /api/videos”        “GET” “$BASE/videos”
test_endpoint “GET /api/qcm”           “GET” “$BASE/qcm”
test_endpoint “GET /api/payment/plans” “GET” “$BASE/payment/plans”
echo “”

# ── 3. Inscription & Connexion ────────────────────────────

echo “👤 Authentification :”
RANDOM_EMAIL=“test_$(date +%s)@educoncoursci.ci”

# Inscription

reg_resp=$(curl -s -X POST “$BASE/auth/register”   
-H “Content-Type: application/json”   
-d “{"nom":"Test User","email":"$RANDOM_EMAIL","password":"Test1234!"}”)

TOKEN=$(echo $reg_resp | grep -o ‘“token”:”[^”]*”’ | cut -d’”’ -f4)

if [ -n “$TOKEN” ]; then
echo -e “  ${GREEN}✅${NC} POST /api/auth/register — OK”
else
echo -e “  ${RED}❌${NC} POST /api/auth/register — Échec”
echo “     Réponse: $reg_resp”
fi

# Connexion avec le compte seed

login_resp=$(curl -s -X POST “$BASE/auth/login”   
-H “Content-Type: application/json”   
-d ‘{“email”:“koffi@test.ci”,“password”:“Test1234!”}’)

SEED_TOKEN=$(echo $login_resp | grep -o ‘“token”:”[^”]*”’ | cut -d’”’ -f4)

if [ -n “$SEED_TOKEN” ]; then
echo -e “  ${GREEN}✅${NC} POST /api/auth/login (compte seed) — OK”
else
echo -e “  ${YELLOW}⚠️${NC}  POST /api/auth/login — Compte seed absent (lance ‘node scripts/seed.js’)”
fi
echo “”

# ── 4. Routes protégées ───────────────────────────────────

if [ -n “$TOKEN” ]; then
echo “🔐 Routes protégées (avec token) :”
test_endpoint “GET /api/auth/me”        “GET”  “$BASE/auth/me”         “” “$TOKEN”
test_endpoint “GET /api/payment/history”“GET”  “$BASE/payment/history” “” “$TOKEN”
test_endpoint “GET /api/qcm/1”          “GET”  “$BASE/qcm/1”           “” “$TOKEN”
echo “”
fi

# ── 5. Routes admin ───────────────────────────────────────

echo “⚙️ Routes admin (401 attendu si non-admin) :”
test_endpoint “GET /api/admin/stats”    “GET” “$BASE/admin/stats”    “” “${TOKEN:-}”
test_endpoint “GET /api/admin/users”    “GET” “$BASE/admin/users”    “” “${TOKEN:-}”
echo “”

# ── Résumé ────────────────────────────────────────────────

echo “════════════════════════════════════════”
echo “✅ Tests terminés !”
echo “”
echo “📋 Prochaines étapes :”
echo “   1. node scripts/seed.js     ← Données de démo”
echo “   2. Ouvrir frontend/index.html dans un navigateur”
echo “   3. Se connecter avec admin@… / (voir .env)”
echo “════════════════════════════════════════”
echo “”