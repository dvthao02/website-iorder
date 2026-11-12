import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type StorageConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  secretAccessKey: string;
};

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Cần đặt ${name} trước khi sử dụng kho tệp.`);
  }

  return value;
}

function getStorageConfig(): StorageConfig {
  return {
    accessKeyId: requiredEnvironmentValue("S3_ACCESS_KEY_ID"),
    bucket: requiredEnvironmentValue("S3_BUCKET"),
    endpoint: requiredEnvironmentValue("S3_ENDPOINT"),
    secretAccessKey: requiredEnvironmentValue("S3_SECRET_ACCESS_KEY"),
  };
}

let client: S3Client | undefined;

function getStorageClient() {
  if (!client) {
    const config = getStorageConfig();
    client = new S3Client({
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      endpoint: config.endpoint,
      forcePathStyle: true,
      region: "us-east-1",
    });
  }

  return client;
}

export async function ensureMediaBucket() {
  const config = getStorageConfig();
  const storageClient = getStorageClient();

  try {
    await storageClient.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;

    if (status !== 404) {
      throw error;
    }

    await storageClient.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
}

export async function hasStoredObject(storageKey: string) {
  const config = getStorageConfig();

  try {
    await getStorageClient().send(new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    return true;
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

export async function putStoredObject({ storageKey, body, mimeType }: { storageKey: string; body: Uint8Array; mimeType: string }) {
  const config = getStorageConfig();
  await getStorageClient().send(new PutObjectCommand({ Bucket: config.bucket, Key: storageKey, Body: body, ContentType: mimeType }));
}

export async function getStoredObject(storageKey: string) {
  const config = getStorageConfig();

  return getStorageClient().send(new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }));
}

export async function removeStoredObject(storageKey: string) {
  const config = getStorageConfig();
  await getStorageClient().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
}

export function mediaPath(storageKey: string) {
  return `/media/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}
