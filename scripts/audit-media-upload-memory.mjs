function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Can dat ${name} truoc khi chay audit RAM upload media.`);
  return value;
}

const backendUrl = requiredEnvironmentValue("AUDIT_BACKEND_URL").replace(/\/$/, "");
const username = requiredEnvironmentValue("INITIAL_ADMIN_USERNAME");
const password = requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD");
const concurrency = Number.parseInt(process.env.AUDIT_UPLOAD_CONCURRENCY ?? "2", 10);
const sizeMiB = Number.parseInt(process.env.AUDIT_UPLOAD_SIZE_MIB ?? "10", 10);

if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4 || !Number.isSafeInteger(sizeMiB) || sizeMiB < 1 || sizeMiB > 20) {
  throw new Error("AUDIT_UPLOAD_CONCURRENCY phai tu 1 den 4 va AUDIT_UPLOAD_SIZE_MIB phai tu 1 den 20.");
}

function requireOk(response, expectedStatus, description) {
  if (response.status !== expectedStatus) throw new Error(`${description}: nhan HTTP ${response.status}.`);
}

function imageBytes(size) {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return bytes;
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

  const bytes = imageBytes(sizeMiB * 1024 * 1024);
  const uploads = await Promise.all(Array.from({ length: concurrency }, async (_, index) => {
    const form = new FormData();
    form.set("file", new File([bytes], `audit-memory-${index}.png`, { type: "image/png" }));
    const response = await fetch(`${backendUrl}/api/admin/media`, {
      body: form,
      headers: { cookie, origin: backendUrl },
      method: "POST",
    });
    requireOk(response, 201, `Upload media thu ${index + 1}`);
    const payload = await response.json();
    if (typeof payload?.asset?.id !== "string") throw new Error(`Upload media thu ${index + 1} khong tra ID hop le.`);
    return payload.asset.id;
  }));

  const deletions = await Promise.all(uploads.map(async (id) => {
    const response = await fetch(`${backendUrl}/api/admin/media/${id}`, { headers: { cookie }, method: "DELETE" });
    requireOk(response, 200, `Danh dau xoa media ${id}`);
  }));
  void deletions;

  console.log(`Dat: ${concurrency} upload dong thoi, moi upload ${sizeMiB} MiB, da xoa mem tung asset sau khi kiem tra.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
