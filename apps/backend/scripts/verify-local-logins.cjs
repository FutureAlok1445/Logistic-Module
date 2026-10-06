// Local verification only. Passwords and tokens are never printed.
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ quiet: true });
async function run() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local verification is disabled in production");
  const content = fs.readFileSync(
    path.resolve(__dirname, "../../../LOCAL_ACCESS.md"),
    "utf8",
  );
  const admin = content.match(
    /^Email: ([^\r\n]+)\r?\n[\s\S]*?^Password: ([^\r\n]+)/m,
  );
  const accounts = admin
    ? [{ role: "SUPER_ADMIN", email: admin[1], password: admin[2] }]
    : [];
  for (const match of content.matchAll(
    /- ([A-Z_]+): ([^\s]+) \| Password: `([^`]+)`/g,
  )) {
    accounts.push({ role: match[1], email: match[2], password: match[3] });
  }
  if (new Set(accounts.map((a) => a.role)).size !== 5)
    throw new Error("Five role credentials were not available");
  for (const account of accounts) {
    const response = await fetch("http://127.0.0.1:4000/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    });
    if (!response.ok) throw new Error("Local login failed");
    const data = (await response.json()).data;
    if (data.user.role !== account.role) throw new Error("Role mismatch");
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    const logout = await fetch("http://127.0.0.1:4000/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: cookie || "",
        authorization: `Bearer ${data.accessToken}`,
      },
      body: "{}",
    });
    if (!logout.ok) throw new Error("Local logout failed");
    process.stdout.write(`${account.role}: login and logout verified\n`);
  }
}
run().catch(() => {
  process.stderr.write(
    "Local credential verification failed. Check local API and private credential file.\n",
  );
  process.exitCode = 1;
});
