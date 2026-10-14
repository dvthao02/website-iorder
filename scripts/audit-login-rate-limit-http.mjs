function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Can dat ${name} truoc khi chay audit quota dang nhap qua HTTP.`);
  return value;
}

const backendUrl = requiredEnvironmentValue("AUDIT_BACKEND_URL").replace(/\/$/, "");
const username = requiredEnvironmentValue("INITIAL_ADMIN_USERNAME");
const password = requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD");

async function login(inputUsername, inputPassword) {
  return fetch(`${backendUrl}/api/admin/session`, {
    body: JSON.stringify({ username: inputUsername, password: inputPassword }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function assertStatus(response, status, description) {
  if (response.status !== status) throw new Error(`${description}: nhan HTTP ${response.status}, can ${status}.`);
}

async function main() {
  const unknownUsername = `audit-rate-${Date.now().toString(36)}`;
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => login(unknownUsername, "mat-khau-sai")));
  const concurrentStatuses = concurrent.map((response) => response.status);
  if (concurrentStatuses.filter((status) => status === 401).length !== 5 || concurrentStatuses.filter((status) => status === 429).length !== 3) {
    throw new Error(`Quota dong thoi sai: ${concurrentStatuses.join(", ")}.`);
  }
  if (concurrent.filter((response) => response.status === 429).some((response) => !/^\d+$/.test(response.headers.get("retry-after") ?? ""))) {
    throw new Error("Phan hoi quota khong co Retry-After hop le.");
  }

  for (let index = 0; index < 4; index += 1) assertStatus(await login(username, "mat-khau-sai"), 401, "Tu choi mat khau sai truoc nguong");
  assertStatus(await login(username, password), 200, "Dang nhap dung xoa quota");
  for (let index = 0; index < 5; index += 1) assertStatus(await login(username, "mat-khau-sai"), 401, "Tu choi mat khau sai sau reset");
  assertStatus(await login(username, "mat-khau-sai"), 429, "Chan vuot quota dang nhap");

  console.log("Dat: quota dang nhap la nguyen tu khi dong thoi, tra 429/Retry-After va reset sau dang nhap dung.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
