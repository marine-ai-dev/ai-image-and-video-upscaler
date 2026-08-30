const path = require('path');
const webpack = require('webpack');



const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');


// The pipeline test page is a development tool: it is only bundled when
// explicitly requested (INCLUDE_TEST_HARNESS=1 npm run serve) and never ships
// in a normal build.
const includeTestHarness = !!process.env.INCLUDE_TEST_HARNESS;

// One HTML file per language, rendered at build time. Doing the translation
// here rather than in the browser means each URL ships correct metadata and a
// correct <html lang>, with no flash of the wrong language on load.
const LOCALES = {
    en: { dict: require('./src/locales/en.json'), ogLocale: 'en_GB' },
    uk: { dict: require('./src/locales/uk.json'), ogLocale: 'uk_UA' }
};

function localePages() {
    return Object.entries(LOCALES).map(([locale, { dict, ogLocale }]) => new HtmlWebpackPlugin({
        template: 'src/index.html',
        filename: `${locale}/index.html`,
        chunks: includeTestHarness ? ['main'] : undefined,
        templateParameters: {
            locale,
            ogLocale,
            t: (key) => dict[key] ?? LOCALES.en.dict[key] ?? key
        }
    }));
}

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
        filename: includeTestHarness ? "[name].js" : "main.js",
        publicPath: '/'
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

        ...localePages(),

        // Root entry: sends visitors to the language they last chose, or the
        // best match for their browser, without ever rendering the wrong one.
        new HtmlWebpackPlugin({
            template: 'src/redirect.html',
            filename: 'index.html',
            inject: false,
            minify: false
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
                { from: "src/site.webmanifest", to: "site.webmanifest" },
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
