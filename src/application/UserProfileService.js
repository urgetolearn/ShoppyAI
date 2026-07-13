const { ProfilePhotoStorage } = require('../infrastructure/storage/ProfilePhotoStorage');

class UserProfileService {
    constructor({ storage }) {
        this.storage = storage ?? new ProfilePhotoStorage({ uploadDir: null });
    }

    async getProfile(user) {
        return {
            user: {
                id: user?.id,
                name: user?.name,
                email: user?.email,
            },
            profile: user?.profile ?? null,
        };
    }

    async uploadPhotoFromRequest({ user, request }) {
        if (!user?.id) {
            throw new Error('User is required');
        }

        const result = await this.storage.saveUpload({ request, userId: user.id });
        const profile = {
            ...(user.profile ?? {}),
            photo: {
                fileName: result.fileName,
                storedPath: result.storedPath,
                url: result.url,
                mimeType: result.mimeType,
                uploadedAt: result.uploadedAt,
            },
        };

        user.profile = profile;

        return {
            success: true,
            profile,
            photo: profile.photo,
        };
    }
}

module.exports = { UserProfileService };
