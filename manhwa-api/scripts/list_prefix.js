
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const prefix = process.argv[2];
if (!prefix) {
    console.error('Usage: node scripts/list_prefix.js <prefix>');
    process.exit(1);
}

const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION,
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET
    }
});

(async () => {
    try {
        console.log(`Listing objects with prefix: "${prefix}"`);
        const command = new ListObjectsV2Command({
            Bucket: process.env.DO_SPACES_BUCKET,
            Prefix: prefix,
            MaxKeys: 20 // Cap at 20 to avoid spamming
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            console.log(`Found ${response.Contents.length} objects.`);
            response.Contents.forEach(obj => {
                console.log(` - ${obj.Key} (${obj.Size} bytes)`);
            });
        } else {
            console.log('No objects found.');
        }
    } catch (err) {
        console.error('Error listing objects:', err);
    }
})();
