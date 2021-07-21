const path = require('path');

module.exports = {
    entry: './src/index.ts',
    target: 'node',
    externalsPresets: { node: true },
    // Workaround for ws module trying to require devDependencies
    externals: ['utf-8-validate', 'bufferutil'],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
};