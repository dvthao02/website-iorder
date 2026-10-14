import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const required = ["S3_ACCESS_KEY_ID", "S3_BUCKET", "S3_ENDPOINT", "S3_SECRET_ACCESS_KEY"];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Can dat ${name} truoc khi chay audit S3.`);
  }
}

const client = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  region: "us-east-1",
});

const persistentKey = process.env.AUDIT_S3_PERSISTENCE_KEY;
const persistentBody = process.env.AUDIT_S3_PERSISTENCE_BODY;
const key = persistentKey ?? `audit/round-trip-${crypto.randomUUID()}.txt`;
const body = persistentBody ?? "iorder storage audit";

async function main() {
  await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));

  if (persistentKey && process.env.AUDIT_S3_PERSISTENCE_MODE === "read") {
    await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    const result = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    const readBody = await result.Body.transformToString();

    if (readBody !== body) {
      throw new Error("Noi dung sau khi khoi dong lai khong trung khop.");
    }

    console.log("Dat: object van doc duoc sau khi khoi dong lai S3.");
    return;
  }

  await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: Buffer.from(body) }));
  await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));

  const result = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  const readBody = await result.Body.transformToString();

  if (readBody !== body) {
    throw new Error("Noi dung doc lai tu S3 khong trung khop.");
  }

  if (persistentKey && process.env.AUDIT_S3_PERSISTENCE_MODE === "write") {
    console.log("Dat: da ghi object de kiem tra sau khi khoi dong lai S3.");
    return;
  }

  await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));

  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    throw new Error("Object van ton tai sau khi xoa.");
  } catch (error) {
    if (error.name !== "NotFound") {
      throw error;
    }
  }

  console.log("Dat: S3 HeadBucket, PutObject, HeadObject, GetObject va DeleteObject deu thanh cong.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
