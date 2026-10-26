process.env.BETTER_AUTH_SECRET ??= "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
process.env.APP_URL ??= "http://localhost:3000";
process.env.LOCAL_STORAGE_DIR ??= ".data/test-storage";
for (const key of ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "PINGEN_CLIENT_ID", "S3_BUCKET"]) delete process.env[key];
