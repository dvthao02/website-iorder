function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();

  if (!value) throw new Error(`Can dat ${name} truoc khi chay audit trang thai thiet bi qua HTTP.`);

  return value;
}

const backendUrl = requiredEnvironmentValue("AUDIT_BACKEND_URL").replace(/\/$/, "");
const username = requiredEnvironmentValue("INITIAL_ADMIN_USERNAME");
const password = requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD");

function requireOk(response, expectedStatus, description) {
  if (response.status !== expectedStatus) throw new Error(`${description}: nhan HTTP ${response.status}.`);
}

async function requestJson(path, cookie, method, body) {
  const response = await fetch(`${backendUrl}${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json", cookie } }),
    ...(body === undefined ? { headers: { cookie } } : {}),
    method,
  });
  return { payload: await response.json().catch(() => null), response };
}

async function main() {
  const session = await fetch(`${backendUrl}/api/admin/session`, {
    body: JSON.stringify({ username, password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  requireOk(session, 200, "Dang nhap CMS");

  const cookie = session.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie?.startsWith("iorder_admin_session=")) throw new Error("Dang nhap CMS khong tra session cookie.");

  const suffix = Date.now().toString(36);
  const { payload: groupPayload, response: groupResponse } = await requestJson("/api/admin/equipment", cookie, "POST", {
    id: null,
    kind: "groups",
    values: { coverMediaId: null, description: null, isEnabled: true, name: `Nhom audit ${suffix}`, slug: `nhom-audit-${suffix}`, sortOrder: 0 },
  });
  requireOk(groupResponse, 200, "Tao nhom thiet bi audit");
  if (typeof groupPayload?.id !== "string") throw new Error("Tao nhom thiet bi khong tra ID hop le.");

  const { payload: itemPayload, response: itemResponse } = await requestJson("/api/admin/equipment", cookie, "POST", {
    id: null,
    kind: "items",
    values: {
      canonicalUrl: null,
      coverMediaId: null,
      groupId: groupPayload.id,
      isFeatured: false,
      modelCode: null,
      name: `Thiet bi audit ${suffix}`,
      priceVnd: 0,
      scheduledAt: null,
      seoDescription: null,
      seoTitle: null,
      slug: `thiet-bi-audit-${suffix}`,
      specificationGroups: [],
      sortOrder: 0,
      status: "draft",
      summary: null,
      warrantyMonths: 0,
    },
  });
  requireOk(itemResponse, 200, "Tao thiet bi audit");
  if (typeof itemPayload?.id !== "string" || itemPayload.version !== 1) throw new Error("Tao thiet bi khong tra ID/phien ban mong doi.");

  const id = itemPayload.id;
  const archive = await requestJson(`/api/admin/equipment/${id}`, cookie, "PATCH", { action: "archive", expectedVersion: 1 });
  requireOk(archive.response, 200, "Luu tru thiet bi qua PATCH");
  if (archive.payload?.equipment?.id !== id || archive.payload.equipment.status !== "archived" || archive.payload.equipment.version !== 2) throw new Error("PATCH luu tru tra trang thai hoac phien ban sai.");

  const staleRestore = await requestJson(`/api/admin/equipment/${id}`, cookie, "PATCH", { action: "restore", expectedVersion: 1 });
  requireOk(staleRestore.response, 409, "Tu choi PATCH dung phien ban cu");

  const restore = await requestJson(`/api/admin/equipment/${id}`, cookie, "PATCH", { action: "restore", expectedVersion: 2 });
  requireOk(restore.response, 200, "Khoi phuc thiet bi qua PATCH");
  if (restore.payload?.equipment?.id !== id || restore.payload.equipment.status !== "draft" || restore.payload.equipment.version !== 3) throw new Error("PATCH khoi phuc tra trang thai hoac phien ban sai.");

  const archiveAgain = await requestJson(`/api/admin/equipment/${id}`, cookie, "PATCH", { action: "archive", expectedVersion: 3 });
  requireOk(archiveAgain.response, 200, "Luu tru lai thiet bi qua PATCH");

  const deletion = await requestJson(`/api/admin/equipment/${id}?expectedVersion=4`, cookie, "DELETE");
  requireOk(deletion.response, 200, "Xoa thiet bi da luu tru");
  if (deletion.payload?.deletedId !== id) throw new Error("Xoa thiet bi khong tra dung ID.");

  console.log("Dat: PATCH thiet bi da dang nhap luu tru/khoi phuc dung version, tu choi version cu va xoa sau luu tru.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
