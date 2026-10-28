const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
            allowedOrigins: [
                'servislocal.zerosoftech.com',
                '*.zerosoftech.com',
                'localhost:3000',
            ],
        },
    },
};

export default nextConfig;
