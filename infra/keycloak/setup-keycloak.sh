#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Keycloak setup script for School Booking Platform
#
# Run AFTER docker-compose is up:
#   bash infra/keycloak/setup-keycloak.sh
#
# Idempotent — safe to run multiple times. Configures school_001 realm with:
#   - User Profile:  school_id, teacher_id attributes (unmanaged attrs enabled)
#   - Roles:         SCHOOL_ADMIN, TEACHER
#   - Clients:       node-api (bearer-only), school-portal (public PKCE)
#   - Mappers:       school_id, teacher_id → JWT claims on both clients
#   - Dev users:     school_admin_1, teacher_1
# ═══════════════════════════════════════════════════════════════════════════════
set -e

KC_URL="${KEYCLOAK_URL:-http://localhost:8081}"
REALM="school_001"
NODE_API_SECRET="ZCsewLOJUoRQhYmTnuhupZcLDQmYZrkl"

echo ""
echo "━━━ Configuring Keycloak at $KC_URL ━━━"

# Use Python for all API calls — avoids shell escaping issues with special characters
python3 << PYEOF
import urllib.request, urllib.parse, json, subprocess, sys

KC_URL  = "${KC_URL}"
REALM   = "${REALM}"
NODE_API_SECRET = "${NODE_API_SECRET}"
BASE    = f"{KC_URL}/admin/realms/{REALM}"

RED   = "\033[0;31m"
GREEN = "\033[0;32m"
CYAN  = "\033[0;36m"
WARN  = "\033[1;33m"
NC    = "\033[0m"

def ok(msg):   print(f"{GREEN}✓{NC} {msg}")
def info(msg): print(f"{CYAN}→{NC} {msg}")
def warn(msg): print(f"{WARN}!{NC} {msg}")
def err(msg):  print(f"{RED}✗{NC} {msg}"); sys.exit(1)

# ── Admin token ─────────────────────────────────────────────────────────────
print(f"\n{CYAN}━━━ Getting admin token ━━━{NC}")
data = urllib.parse.urlencode({
    "client_id": "admin-cli", "username": "admin",
    "password": "admin", "grant_type": "password"
}).encode()
try:
    resp = urllib.request.urlopen(
        urllib.request.Request(f"{KC_URL}/realms/master/protocol/openid-connect/token", data=data))
    TOKEN = json.loads(resp.read())["access_token"]
    ok("Admin token obtained")
except Exception as e:
    err(f"Cannot reach Keycloak at {KC_URL} — is docker-compose up? ({e})")

HDR = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def kc_get(path):
    req = urllib.request.Request(f"{BASE}/{path}", headers={"Authorization": f"Bearer {TOKEN}"})
    return json.loads(urllib.request.urlopen(req).read())

def kc_post(path, data, ok_codes=(200,201,204)):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}/{path}", data=body, method="POST", headers=HDR)
    try:
        r = urllib.request.urlopen(req)
        return r.status
    except urllib.error.HTTPError as e:
        if e.code in ok_codes: return e.code
        raise

def kc_put(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}/{path}", data=body, method="PUT", headers=HDR)
    try:
        urllib.request.urlopen(req)
        return "ok"
    except urllib.error.HTTPError as e:
        return f"error {e.code}: {e.read().decode()}"

def exists_in(lst, key, val):
    return any(item.get(key) == val for item in lst)

# ── 1. User Profile: allow school_id / teacher_id attributes ─────────────────
print(f"\n{CYAN}━━━ Configuring user profile ━━━{NC}")
profile = kc_get("users/profile")
existing_attr_names = {a["name"] for a in profile.get("attributes", [])}

added = []
for attr_name, display in [("school_id", "School ID"), ("teacher_id", "Teacher ID")]:
    if attr_name not in existing_attr_names:
        profile.setdefault("attributes", []).append({
            "name": attr_name,
            "displayName": display,
            "validations": {},
            "permissions": {"view": ["admin"], "edit": ["admin"]},
            "multivalued": False
        })
        added.append(attr_name)

# Enable unmanaged attributes so any custom attr set by admin is preserved
profile["unmanagedAttributePolicy"] = "ENABLED"

kc_put("users/profile", profile)
if added:
    ok(f"Registered custom attributes: {', '.join(added)}")
else:
    warn("Custom attributes already registered")

# ── 2. Realm roles ────────────────────────────────────────────────────────────
print(f"\n{CYAN}━━━ Creating realm roles ━━━{NC}")
existing_roles = {r["name"] for r in kc_get("roles")}

for role_name, description in [
    ("SCHOOL_ADMIN", "School administrator — manages events, teachers, QR codes"),
    ("TEACHER",      "Teacher — views and manages own appointment slots"),
]:
    if role_name in existing_roles:
        warn(f"Role '{role_name}' already exists — skipping")
    else:
        kc_post("roles", {"name": role_name, "description": description})
        ok(f"Created role: {role_name}")

# ── 3. node-api client (bearer-only) ──────────────────────────────────────────
print(f"\n{CYAN}━━━ Creating node-api client ━━━{NC}")
existing_clients = kc_get("clients")
node_api_exists = exists_in(existing_clients, "clientId", "node-api")

if node_api_exists:
    warn("Client 'node-api' already exists — skipping creation")
else:
    kc_post("clients", {
        "clientId": "node-api",
        "name": "Node.js API",
        "description": "Backend REST API — validates bearer tokens only",
        "bearerOnly": True,
        "publicClient": False,
        "secret": NODE_API_SECRET,
        "standardFlowEnabled": False,
        "implicitFlowEnabled": False,
        "directAccessGrantsEnabled": False,
        "serviceAccountsEnabled": False,
        "enabled": True,
    })
    ok("Created client: node-api")

node_api_id = next(c["id"] for c in kc_get("clients") if c["clientId"] == "node-api")
ok(f"node-api ID: {node_api_id}")

# Protocol mappers for node-api
info("Configuring protocol mappers for node-api...")
existing_mappers = {m["name"] for m in kc_get(f"clients/{node_api_id}/protocol-mappers/models")}
for attr in ["school_id", "teacher_id"]:
    mapper_name = f"{attr} mapper"
    if mapper_name in existing_mappers:
        warn(f"Mapper '{mapper_name}' already exists — skipping")
        continue
    kc_post(f"clients/{node_api_id}/protocol-mappers/models", {
        "name": mapper_name,
        "protocol": "openid-connect",
        "protocolMapper": "oidc-usermodel-attribute-mapper",
        "consentRequired": False,
        "config": {
            "user.attribute": attr,
            "claim.name": attr,
            "jsonType.label": "String",
            "id.token.claim": "true",
            "access.token.claim": "true",
            "userinfo.token.claim": "true",
            "multivalued": "false",
            "aggregate.attrs": "false",
        }
    })
    ok(f"Added mapper: {mapper_name}")

# ── 4. school-portal client (public, PKCE) ────────────────────────────────────
print(f"\n{CYAN}━━━ Creating school-portal client ━━━{NC}")
portal_exists = exists_in(kc_get("clients"), "clientId", "school-portal")

if portal_exists:
    warn("Client 'school-portal' already exists — skipping creation")
else:
    kc_post("clients", {
        "clientId": "school-portal",
        "name": "School Portal",
        "description": "React web app for school admins and teachers (public PKCE)",
        "publicClient": True,
        "bearerOnly": False,
        "standardFlowEnabled": True,
        "implicitFlowEnabled": False,
        "directAccessGrantsEnabled": True,   # enabled in dev for easier testing
        "serviceAccountsEnabled": False,
        "redirectUris": ["http://localhost:5173/*", "http://localhost:3001/*"],
        "webOrigins": ["http://localhost:5173", "http://localhost:3001"],
        "attributes": {"pkce.code.challenge.method": "S256"},
        "enabled": True,
    })
    ok("Created client: school-portal (public, PKCE S256, direct grant for dev)")

portal_id = next(c["id"] for c in kc_get("clients") if c["clientId"] == "school-portal")
ok(f"school-portal ID: {portal_id}")

# Protocol mappers for school-portal
info("Configuring protocol mappers for school-portal...")
existing_portal_mappers = {m["name"] for m in kc_get(f"clients/{portal_id}/protocol-mappers/models")}
for attr in ["school_id", "teacher_id"]:
    mapper_name = f"{attr} mapper"
    if mapper_name in existing_portal_mappers:
        warn(f"Mapper '{mapper_name}' already exists — skipping")
        continue
    kc_post(f"clients/{portal_id}/protocol-mappers/models", {
        "name": mapper_name,
        "protocol": "openid-connect",
        "protocolMapper": "oidc-usermodel-attribute-mapper",
        "consentRequired": False,
        "config": {
            "user.attribute": attr,
            "claim.name": attr,
            "jsonType.label": "String",
            "id.token.claim": "true",
            "access.token.claim": "true",
            "userinfo.token.claim": "true",
            "multivalued": "false",
            "aggregate.attrs": "false",
        }
    })
    ok(f"Added mapper: {mapper_name}")

# ── 5. Dev test users ──────────────────────────────────────────────────────────
print(f"\n{CYAN}━━━ Creating dev test users ━━━{NC}")

def upsert_user(username, email, first, last, password, attributes):
    """Create or update a user, ensuring attributes and password are set."""
    existing = kc_get(f"users?username={username}")

    if not existing:
        # Create user (without credentials — set password separately)
        kc_post("users", {
            "username": username,
            "email": email,
            "firstName": first,
            "lastName": last,
            "emailVerified": True,
            "enabled": True,
            "attributes": attributes,
        })
        ok(f"Created user: {username} ({email})")
    else:
        warn(f"User '{username}' already exists — updating attributes")
        user = existing[0]
        user["firstName"] = first
        user["lastName"] = last
        user["attributes"] = attributes
        kc_put(f"users/{user['id']}", user)

    # Get the user ID
    uid = kc_get(f"users?username={username}")[0]["id"]

    # Set password via dedicated endpoint (handles special chars correctly)
    req = urllib.request.Request(
        f"{BASE}/users/{uid}/reset-password",
        data=json.dumps({"type": "password", "value": password, "temporary": False}).encode(),
        method="PUT", headers=HDR
    )
    try:
        urllib.request.urlopen(req)
        ok(f"Password set for {username}")
    except urllib.error.HTTPError as e:
        warn(f"Password set failed for {username}: {e.code} {e.read().decode()}")

    return uid

def assign_realm_role(uid, role_name):
    current_roles = {r["name"] for r in kc_get(f"users/{uid}/role-mappings/realm")}
    if role_name in current_roles:
        warn(f"Role {role_name} already assigned — skipping")
        return
    role = kc_get(f"roles/{role_name}")
    kc_post(f"users/{uid}/role-mappings/realm", [role])
    ok(f"Assigned role {role_name}")

admin_uid = upsert_user(
    "school_admin_1", "admin@school001.dev", "School", "Admin",
    "Admin1234!", {"school_id": ["school-001-dev"]}
)
assign_realm_role(admin_uid, "SCHOOL_ADMIN")

teacher_uid = upsert_user(
    "teacher_1", "teacher1@school001.dev", "Teacher", "One",
    "Teacher1234!", {"school_id": ["school-001-dev"], "teacher_id": ["teacher-001-dev"]}
)
assign_realm_role(teacher_uid, "TEACHER")

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"""
{GREEN}═══════════════════════════════════════════════════════{NC}
{GREEN}  Keycloak setup complete!{NC}
{GREEN}═══════════════════════════════════════════════════════{NC}

  Realm:        {CYAN}{REALM}{NC}
  Keycloak UI:  {CYAN}{KC_URL}{NC}  (admin / admin)

  Clients:
    {CYAN}node-api{NC}       bearer-only  secret: {NODE_API_SECRET}
    {CYAN}school-portal{NC}  public PKCE  redirect: localhost:5173

  Roles:     {CYAN}SCHOOL_ADMIN  TEACHER{NC}
  JWT attrs: {CYAN}school_id  teacher_id{NC}

  Dev users:
    {CYAN}school_admin_1{NC} / Admin1234!   → SCHOOL_ADMIN, school_id=school-001-dev
    {CYAN}teacher_1{NC}      / Teacher1234! → TEACHER, school_id=school-001-dev, teacher_id=teacher-001-dev

  Next: bash infra/keycloak/export-realm.sh  (save realm to JSON)
""")
PYEOF
