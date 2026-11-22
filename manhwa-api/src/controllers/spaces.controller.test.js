process.env.DO_SPACES_ENDPOINT = 'https://spaces.example.test';
process.env.DO_SPACES_BUCKET = 'test-bucket';
const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';

jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
    ListObjectsV2Command: jest.fn(),
}));
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

const spacesController = require('./spaces.controller');
const { S3Client } = require('@aws-sdk/client-s3');
const { query } = require('../config/database');

if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
} else {
    process.env.NODE_ENV = originalNodeEnv;
}

describe('parseSpacesStructure', () => {
    test('keeps chapters with images.json and drops folders without images', () => {
        const lastModified = new Date('2026-11-20T23:51:00Z');
        const seriesMap = spacesController.parseSpacesStructure([
            { Key: 'serie/cap-0001/images.json', LastModified: lastModified },
            { Key: 'serie/cap-0002/images.json', LastModified: lastModified },
            { Key: 'serie/cap-0003/metadata.txt', LastModified: lastModified },
        ]);
        const chapters = seriesMap.get('serie').chapters;

        expect(chapters.size).toBe(2);
        expect([...chapters.keys()].sort()).toEqual([1, 2]);
        expect(chapters.get(1).hasImagesJson).toBe(true);
        expect(chapters.get(1).pageCount).toBe(0);
    });
});

test('registers Spaces series in the development database without importing chapter rows', async () => {
    const seriesMap = spacesController.parseSpacesStructure([
        { Key: 'serie-local/cap-0001/images.json', LastModified: new Date('2026-11-20T23:51:00Z') },
        { Key: 'serie-local/cap-0002/images.json', LastModified: new Date('2026-11-20T23:51:00Z') },
        { Key: 'sin-capitulos/cover.jpg', LastModified: new Date('2026-11-20T23:51:00Z') },
    ]);
    query.mockResolvedValueOnce({ rows: [{ id: 'local-series-id', slug: 'serie-local' }] });

    const result = await spacesController.syncSeriesToDevelopmentDatabase(seriesMap);

    expect(result).toEqual([{ id: 'local-series-id', slug: 'serie-local' }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (slug) DO UPDATE');
    expect(query.mock.calls[0][0]).not.toContain('INSERT INTO chapters');
    expect(query.mock.calls[0][1]).toEqual([
        ['Serie Local'],
        ['serie-local'],
        [null],
        [2],
    ]);
});

test('does not access Spaces or the database during development preload', async () => {
    query.mockClear();
    await expect(spacesController.preloadCache()).resolves.toBeNull();
    expect(S3Client.mock.results[0].value.send).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
