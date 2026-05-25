export const env = {
  port: Number(process.env.API_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  jwtIssuer: process.env.JWT_ISSUER ?? 'siteflow-dev',
  corsOrigins: (process.env.API_CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5174')
    .split(',')
    .map((s) => s.trim()),
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'ap-south-1',
    bucket: process.env.S3_BUCKET ?? 'siteflow-evidence',
    accessKey: process.env.S3_ACCESS_KEY ?? 'siteflow',
    secretKey: process.env.S3_SECRET_KEY ?? 'siteflowsecret',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
  geofenceRadiusM: Number(process.env.GEOFENCE_RADIUS_M ?? 150),
  devAuth: (process.env.DEV_AUTH ?? 'true') === 'true', // keep dev login while building
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY ?? '',
    senderId: process.env.MSG91_SENDER_ID ?? 'MICKEY',
    otpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID ?? '',
    waTemplateId: process.env.MSG91_WA_TEMPLATE_ID ?? '',
  },
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
};
