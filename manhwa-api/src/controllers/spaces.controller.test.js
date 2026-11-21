process.env.DO_SPACES_ENDPOINT = 'https://spaces.example.test';
process.env.DO_SPACES_BUCKET = 'test-bucket';

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

const { parseSpacesStructure } = require('./spaces.controller');

describe('parseSpacesStructure', () => {
    test('keeps chapters with images.json and drops folders without images', () => {
        const lastModified = new Date('2026-11-20T23:51:00Z');
        const seriesMap = parseSpacesStructure([
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
