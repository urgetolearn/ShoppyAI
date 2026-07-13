const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class ProfilePhotoStorage {
    constructor({ uploadDir = null } = {}) {
        this.uploadDir = uploadDir ?? path.join(__dirname, '..', '..', '..', 'demo', 'uploads');
    }

    async ensureUploadDir() {
        await fs.mkdir(this.uploadDir, { recursive: true });
    }

    async saveUpload({ request, userId }) {
        await this.ensureUploadDir();

        const contentType = request.headers['content-type'] ?? '';
        if (!contentType.includes('multipart/form-data')) {
            throw new Error('Expected multipart/form-data upload');
        }

        const boundary = getBoundary(contentType);
        if (!boundary) {
            throw new Error('Missing multipart boundary');
        }

        const chunks = [];
        let size = 0;

        return new Promise((resolve, reject) => {
            request.on('data', (chunk) => {
                chunks.push(chunk);
                size += chunk.length;
            });

            request.on('end', async () => {
                try {
                    const body = Buffer.concat(chunks);
                    const parts = splitMultipartBody(body, boundary);
                    const photoPart = parts.find((part) => part.name === 'photo');

                    if (!photoPart?.buffer?.length) {
                        throw new Error('photo is required');
                    }

                    if (!photoPart.contentType.startsWith('image/')) {
                        throw new Error('Only image uploads are supported');
                    }

                    const extension = getExtension(photoPart.contentType) ?? 'jpg';
                    const safeUserId = sanitizeFileSegment(userId);
                    const fileName = `${safeUserId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
                    const storedPath = path.join(this.uploadDir, fileName);
                    await fs.writeFile(storedPath, photoPart.buffer);

                    resolve({
                        fileName,
                        storedPath,
                        url: `/uploads/${fileName}`,
                        mimeType: photoPart.contentType,
                        uploadedAt: new Date().toISOString(),
                    });
                } catch (error) {
                    reject(error);
                }
            });

            request.on('error', reject);
        });
    }
}

function splitMultipartBody(body, boundary) {
    const boundaryMarker = Buffer.from(`--${boundary}`);
    const rawParts = splitBuffer(body, boundaryMarker);
    const parts = [];

    for (const rawPart of rawParts) {
        let part = trimMultipartNewlines(rawPart);

        if (!part.length || part.equals(Buffer.from('--'))) {
            continue;
        }

        if (part.subarray(0, 2).toString('latin1') === '--') {
            continue;
        }

        const headerSeparator = part.indexOf(Buffer.from('\r\n\r\n'));

        if (headerSeparator === -1) {
            continue;
        }

        const headerBlock = part.subarray(0, headerSeparator).toString('latin1');
        const bodyBlock = trimTrailingNewline(part.subarray(headerSeparator + 4));
        const headers = headerBlock.split('\r\n').reduce((accumulator, line) => {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex === -1) {
                return accumulator;
            }

            const key = line.slice(0, separatorIndex).trim().toLowerCase();
            const value = line.slice(separatorIndex + 1).trim();
            accumulator[key] = value;
            return accumulator;
        }, {});

        const contentDisposition = headers['content-disposition'] ?? '';
        const matches = /name="([^"]+)"/.exec(contentDisposition);
        const fieldName = matches?.[1] ?? '';
        const contentType = headers['content-type'] ?? 'application/octet-stream';

        parts.push({ name: fieldName, contentType, buffer: bodyBlock });
    }

    return parts;
}

function getBoundary(contentType) {
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
    return match?.[1] ?? match?.[2]?.trim() ?? null;
}

function splitBuffer(buffer, separator) {
    const parts = [];
    let start = 0;
    let index = buffer.indexOf(separator, start);

    while (index !== -1) {
        parts.push(buffer.subarray(start, index));
        start = index + separator.length;
        index = buffer.indexOf(separator, start);
    }

    parts.push(buffer.subarray(start));
    return parts;
}

function trimMultipartNewlines(buffer) {
    let start = 0;
    let end = buffer.length;

    if (buffer[start] === 13 && buffer[start + 1] === 10) {
        start += 2;
    }

    if (buffer[end - 2] === 13 && buffer[end - 1] === 10) {
        end -= 2;
    }

    return buffer.subarray(start, end);
}

function trimTrailingNewline(buffer) {
    if (buffer[buffer.length - 2] === 13 && buffer[buffer.length - 1] === 10) {
        return buffer.subarray(0, buffer.length - 2);
    }

    return buffer;
}

function getExtension(contentType) {
    if (contentType.includes('jpeg')) {
        return 'jpeg';
    }

    if (contentType.includes('png')) {
        return 'png';
    }

    if (contentType.includes('gif')) {
        return 'gif';
    }

    if (contentType.includes('webp')) {
        return 'webp';
    }

    return null;
}

function sanitizeFileSegment(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'user';
}

module.exports = { ProfilePhotoStorage };
