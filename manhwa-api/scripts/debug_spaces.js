
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/debug_spaces.js <slug>');
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

const buildPublicUrl = (key) => {
    const endpoint = process.env.DO_SPACES_ENDPOINT.replace('https://', '').replace('http://', '');
    return `https://${process.env.DO_SPACES_BUCKET}.${endpoint}/${key}`;
};

const listAllObjects = async (prefix = '') => {
    const objects = [];
    let continuationToken = null;

    do {
        const command = new ListObjectsV2Command({
            Bucket: process.env.DO_SPACES_BUCKET,
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            objects.push(...response.Contents);
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken);

    return objects;
};

const slugToTitle = (slug) => {
    return slug
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const parseSpacesStructure = (objects) => {
    const seriesMap = new Map();
    const coverPatterns = ['cover', 'portada', 'thumbnail', 'poster'];

    for (const obj of objects) {
        const key = obj.Key;
        const parts = key.split('/');

        if (parts.length < 2) continue;

        const seriesSlug = parts[0];

        if (['avatars', 'comments', 'uploads', 'temp'].includes(seriesSlug)) continue;

        if (!seriesMap.has(seriesSlug)) {
            seriesMap.set(seriesSlug, {
                slug: seriesSlug,
                title: slugToTitle(seriesSlug),
                cover: null,
                chapters: new Map(),
                lastModified: obj.LastModified
            });
        }

        const series = seriesMap.get(seriesSlug);

        if (obj.LastModified > series.lastModified) {
            series.lastModified = obj.LastModified;
        }

        if (parts.length === 2) {
            const fileName = parts[1].toLowerCase();
            if (coverPatterns.some(p => fileName.includes(p)) ||
                (fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i) && !fileName.includes('cap'))) {
                series.cover = buildPublicUrl(key);
            }
            continue;
        }

        const chapterFolder = parts[1];
        const chapterMatch = chapterFolder.match(/^cap[ítulo]*[-_]?(\d+)/i);

        if (chapterMatch) {
            const chapterNumber = parseInt(chapterMatch[1]);

            if (!series.chapters.has(chapterNumber)) {
                series.chapters.set(chapterNumber, {
                    number: chapterNumber,
                    slug: `capitulo-${chapterNumber}`,
                    pages: [],
                    lastModified: obj.LastModified
                });
            }

            const chapter = series.chapters.get(chapterNumber);

            if (parts.length >= 3) {
                const fileName = parts[parts.length - 1];
                const pageMatch = fileName.match(/^(\d+)/);

                if (pageMatch && fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                    chapter.pages.push({
                        number: parseInt(pageMatch[1]),
                        url: buildPublicUrl(key),
                        key: key
                    });
                }
            }
        }
    }
    return seriesMap;
};

(async () => {
    try {
        console.log(`Searching for slug: ${slug}`);
        const objects = await listAllObjects(slug + '/');
        console.log(`Found ${objects.length} objects.`);

        if (objects.length === 0) {
            console.error('❌ Not found in Spaces (empty objects)');
            return;
        }

        const seriesMap = parseSpacesStructure(objects);
        const series = seriesMap.get(slug);

        if (!series) {
            console.error('❌ Found objects but failed to parse series structure.');
            console.log('Sample keys:', objects.slice(0, 5).map(o => o.Key));
            return;
        }

        console.log('✅ Series structure parsed successfully!');
        console.log({
            slug: series.slug,
            title: series.title,
            chaptersCount: series.chapters.size,
            cover: series.cover
        });

        const chapters = Array.from(series.chapters.values());
        if (chapters.length > 0) {
             console.log('First chapter pages:', chapters[0].pages.length);
        }

    } catch (e) {
        console.error('❌ Error:', e);
    }
})();
