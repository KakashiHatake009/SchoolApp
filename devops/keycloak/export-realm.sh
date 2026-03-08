#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Export school_001 realm from running Keycloak to devops/keycloak/school_001-realm.json
#
# Run after setup-keycloak.sh or after manual UI changes you want to persist.
# This file is committed to git and used by Keycloak --import-realm on startup.
#
# Usage:  bash devops/keycloak/export-realm.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -e

KC_URL="${KEYCLOAK_URL:-http://localhost:8081}"
REALM="school_001"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="$SCRIPT_DIR/${REALM}-realm.json"

echo ""
echo "━━━ Exporting realm '$REALM' from $KC_URL ━━━"

python3 << PYEOF
import urllib.request, urllib.parse, json, sys

KC_URL = "${KC_URL}"
REALM  = "${REALM}"
OUTPUT = "${OUTPUT}"

# Get admin token
data = urllib.parse.urlencode({
    "client_id": "admin-cli", "username": "admin",
    "password": "admin", "grant_type": "password"
}).encode()
resp = urllib.request.urlopen(
    urllib.request.Request(f"{KC_URL}/realms/master/protocol/openid-connect/token", data=data))
token = json.loads(resp.read())["access_token"]

# Export realm with users and clients
# export-users=true includes test user definitions
req = urllib.request.Request(
    f"{KC_URL}/admin/realms/{REALM}/partial-export?exportClients=true&exportGroupsAndRoles=true",
    data=b"",
    method="POST",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
)
resp = urllib.request.urlopen(req)
realm_json = json.loads(resp.read())

# Write pretty-printed
with open(OUTPUT, "w") as f:
    json.dump(realm_json, f, indent=2)
    f.write("\n")

print(f"\033[0;32m✓\033[0m Exported to: {OUTPUT}")
print(f"\033[0;36m→\033[0m Clients: {[c['clientId'] for c in realm_json.get('clients', [])]}")
print(f"\033[0;36m→\033[0m Roles:   {[r['name'] for r in realm_json.get('roles', {}).get('realm', [])]}")
PYEOF

echo ""
echo "Commit with: git add devops/keycloak/school_001-realm.json && git commit -m 'chore: update keycloak realm export'"
echo ""
