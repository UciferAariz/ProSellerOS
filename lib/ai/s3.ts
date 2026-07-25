/**
 * Amazon S3 artifact storage — generated listings and exported reports.
 * No-ops gracefully (returns null) when S3_BUCKET isn't configured.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config, isS3Configured } from "@/lib/config";

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) client = new S3Client({ region: config.awsRegion });
  return client;
}

/** Store a JSON/text artifact; returns its s3:// URI, or null if S3 is off. */
export async function putArtifact(
  key: string,
  body: string,
  contentType = "application/json",
): Promise<string | null> {
  if (!isS3Configured()) return null;
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `s3://${config.s3Bucket}/${key}`;
}
