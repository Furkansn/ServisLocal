import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
    region: process.env.S3_REGION || 'eu-central-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: !!process.env.S3_ENDPOINT, // for S3-compatible services
});

const BUCKET = process.env.S3_BUCKET || '';

/**
 * Upload a file to S3 and return the URL
 */
export async function uploadToS3(
    file: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'photos'
): Promise<string> {
    const ext = fileName.split('.').pop() || 'jpg';
    const key = `${folder}/${uuidv4()}.${ext}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file,
            ContentType: contentType,
        })
    );

    // Return the URL
    if (process.env.S3_ENDPOINT) {
        return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
    }
    return `https://${BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(url: string): Promise<void> {
    // Extract key from URL
    const urlObj = new URL(url);
    const key = urlObj.pathname.startsWith('/')
        ? urlObj.pathname.slice(1)
        : urlObj.pathname;

    // Remove bucket name if present in path
    const actualKey = key.startsWith(`${BUCKET}/`)
        ? key.slice(BUCKET.length + 1)
        : key;

    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: actualKey,
        })
    );
}
