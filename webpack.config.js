const path = require('path');
const webpack = require('webpack');



const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');


// The pipeline test page is a development tool: it is only bundled when
// explicitly requested (INCLUDE_TEST_HARNESS=1 npm run serve) and never ships
// in a normal build.
const includeTestHarness = !!process.env.INCLUDE_TEST_HARNESS;

module.exports = {
    entry: includeTestHarness
        ? {
            main: ["./src/index.ts", './src/worker.ts'],
            harness: './src/test-harness/index.ts'
        }
        : [ "./src/index.ts", './src/worker.ts'],
    output: {
        libraryExport: "default",
        path: path.resolve(__dirname, './dist'),
        filename: includeTestHarness ? "[name].js" : "main.js"
    },
    module: {

        rules: [
            {
                test: /\.(ts|js)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "babel-loader"
                    },
                    {
                        loader: "ts-loader",
                        options: {
                            allowTsInNodeModules: false
                        }
                    }
                ],
            },

            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader", "postcss-loader"],
            }

        ],

    },

    plugins: [

        new HtmlWebpackPlugin({
            template: 'src/index.html',
            ...(includeTestHarness ? { chunks: ['main'] } : {})
        }),

        ...(includeTestHarness ? [
            new HtmlWebpackPlugin({
                template: 'src/test-harness/index.html',
                filename: 'test-harness.html',
                chunks: ['harness']
            }),
            new CopyWebpackPlugin({
                patterns: [{
                    context: path.resolve(__dirname, 'src/test-media'),
                    from: '**/*',
                    to: 'test-media/[path][name][ext]',
                    globOptions: { dot: true }
                }]
            })
        ] : []),

        new CleanWebpackPlugin({
            cleanStaleWebpackAssets: false
        }),
        new CopyWebpackPlugin( {
            patterns: [
                { from: "src/*.js", to: path.basename('[name].js') },
                { from: "src/img/*.svg", to: path.basename('[name].svg') },
                { from: "src/img/*.png", to: path.basename('[name].png') },
                {
                    context: "src/edit-images-app",
                    from: "**/*",
                    to: "edit-images/[path][name][ext]"
                },

            ]
        })

    ],
    resolve: {
        extensions: [".ts", ".tsx", ".js",  ".css"]
    },

    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 8080,
        allowedHosts: "all",
    },

    mode: 'development'

};
