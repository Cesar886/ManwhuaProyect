/*
Script rápido para verificar si una clave existe en el bucket de DigitalOcean Spaces.
Uso: NODE_ENV=production DO_SPACES_ENDPOINT=https://... DO_SPACES_REGION=... \
     DO_SPACES_KEY=... DO_SPACES_SECRET=... DO_SPACES_BUCKET=... node scripts/check_object.js "manhwa/covers/6ed59482-e36b-4326-b22e-a5d74825e128.webp"
*/

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/check_object.js <object-key>');
  process.exit(2);
}

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET
  }
});

const params = {
  Bucket: process.env.DO_SPACES_BUCKET,
  Key: key
};

(async () => {
  try {
    const cmd = new HeadObjectCommand(params);
    const resp = await s3Client.send(cmd);
    console.log('✅ Object exists. Metadata:');
    console.log({
      ContentLength: resp.ContentLength,
      ContentType: resp.ContentType,
      LastModified: resp.LastModified
    });
    process.exit(0);
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.error('❌ Object not found (404)');
      process.exit(1);
    }
    console.error('❌ Error checking object:', err.message || err);
    process.exit(3);
  }
})();
