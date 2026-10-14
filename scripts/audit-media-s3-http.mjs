function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Can dat ${name} truoc khi chay audit media qua HTTP.`);
  }

  return value;
}

const backendUrl = requiredEnvironmentValue("AUDIT_BACKEND_URL").replace(/\/$/, "");
const username = requiredEnvironmentValue("INITIAL_ADMIN_USERNAME");
const password = requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD");
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function requireOk(response, expectedStatus, description) {
  if (response.status !== expectedStatus) {
    throw new Error(`${description}: nhan HTTP ${response.status}.`);
  }
}

async function main() {
  const session = await fetch(`${backendUrl}/api/admin/session`, {
    body: JSON.stringify({ username, password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  requireOk(session, 200, "Dang nhap CMS");

  const cookie = session.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie?.startsWith("iorder_admin_session=")) {
    throw new Error("Dang nhap CMS khong tra session cookie.");
  }

  const list = await fetch(`${backendUrl}/api/admin/media?page=1&pageSize=5&type=all`, {
    headers: { cookie },
  });
  requireOk(list, 200, "Doc thu vien media da xac thuc");

  const form = new FormData();
  form.set("file", new File([pngBytes], "audit-storage.png", { type: "image/png" }));
  const upload = await fetch(`${backendUrl}/api/admin/media`, {
    body: form,
    headers: { cookie, origin: backendUrl },
    method: "POST",
  });
  requireOk(upload, 201, "Tai media len");

  const { asset } = await upload.json();
  if (!asset?.id || !asset.url) {
    throw new Error("Phan hoi upload khong co media hop le.");
  }

  const media = await fetch(`${backendUrl}${asset.url}`);
  requireOk(media, 200, "Doc media qua Backend");
  const retrieved = new Uint8Array(await media.arrayBuffer());

  if (retrieved.length !== pngBytes.length || !retrieved.every((byte, index) => byte === pngBytes[index])) {
    throw new Error("Noi dung media doc qua Backend khong trung khop.");
  }

  const deletion = await fetch(`${backendUrl}/api/admin/media/${asset.id}`, {
    headers: { cookie },
    method: "DELETE",
  });
  requireOk(deletion, 200, "Danh dau xoa media");

  const afterDeletion = await fetch(`${backendUrl}${asset.url}`);
  requireOk(afterDeletion, 404, "An media da danh dau xoa");

  console.log("Dat: dang nhap, upload, doc media qua Backend va danh dau xoa deu hoat dong voi S3.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
