/**
 * Creates or updates the local demo user (see DEV_TEST_* in .env.local).
 * Usage: npm run seed:test-user
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.env.DEV_TEST_EMAIL ?? "demo@meetmind.test";
const password = process.env.DEV_TEST_PASSWORD ?? "MeetMindDemo123!";
const fullName = process.env.DEV_TEST_FULL_NAME ?? "Demo Tester";
const orgName = process.env.DEV_TEST_ORG_NAME ?? "Demo Company";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  "Content-Type": "application/json",
};

async function listUsers() {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!res.ok) {
    throw new Error(`listUsers failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.users ?? [];
}

async function createUser() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_name: orgName,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`createUser failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function updateUser(id) {
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_name: orgName,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`updateUser failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

try {
  const users = await listUsers();
  const existing = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    await updateUser(existing.id);
    console.log("Updated existing demo user:", email);
  } else {
    await createUser();
    console.log("Created demo user:", email);
  }

  console.log("");
  console.log("Run migrations in Supabase if dashboard shows setup errors.");
  console.log("Sign in at http://localhost:3000/login");
  console.log("  Email:   ", email);
  console.log("  Password:", password);
  console.log("  Name:    ", fullName);
  console.log("  Company: ", orgName);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
