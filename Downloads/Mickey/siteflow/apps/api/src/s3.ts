import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

export const s3 = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: {
    accessKeyId: env.s3.accessKey,
    secretAccessKey: env.s3.secretKey,
  },
});

export async function presignPut(key: string, contentType: string, ttlSeconds = 300) {
  const cmd = new PutObjectCommand({
    Bucket: env.s3.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: ttlSeconds });
}

export async function presignGet(key: string, ttlSeconds = 300) {
  const cmd = new GetObjectCommand({ Bucket: env.s3.bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: ttlSeconds });
}

/** Rewrite a localhost MinIO URL to the public host so a browser can hit it. */
export function toPublicUrl(presignedUrl: string): string {
  if (env.s3.endpoint === env.s3.publicEndpoint) return presignedUrl;
  return presignedUrl.replace(env.s3.endpoint, env.s3.publicEndpoint);
}
