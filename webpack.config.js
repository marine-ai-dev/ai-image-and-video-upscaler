const path = require('path');
const webpack = require('webpack');



const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');


// The pipeline test page is a development tool: it is only bundled when
// explicitly requested (INCLUDE_TEST_HARNESS=1 npm run serve) and never ships
// in a normal build.
const includeTestHarness = !!process.env.INCLUDE_TEST_HARNESS;

// The public origin of the site. Absolute URLs are required by og:image,
// canonical/hreflang links, robots.txt and sitemap.xml, so this is the single
// place they all take it from. Override with SITE_URL for another domain.
const SITE_URL = (process.env.SITE_URL || 'https://free-ai-video-upscaler-main-production.up.railway.app')
    .replace(/\/+$/, '');

// Fills the %SITE_URL% placeholder in the static SEO files (robots.txt,
// sitemap.xml) while they are copied into dist/.
const withSiteUrl = (content) => content.toString().split('%SITE_URL%').join(SITE_URL);

// One HTML file per language, rendered at build time. Doing the translation
// here rather than in the browser means each URL ships correct metadata and a
// correct <html lang>, with no flash of the wrong language on load.
const LOCALES = {
    en: { file: './src/locales/en.json', ogLocale: 'en_GB' },
    uk: { file: './src/locales/uk.json', ogLocale: 'uk_UA' }
};

// Read the dictionary on every render rather than once at config load, so
// editing a locale file is picked up by the dev server without a restart.
function readDict(file) {
    delete require.cache[require.resolve(file)];
    return require(file);
}

function localePages() {
    return Object.entries(LOCALES).map(([locale, { file, ogLocale }]) => new HtmlWebpackPlugin({
        template: 'src/index.html',
        filename: `${locale}/index.html`,
        chunks: includeTestHarness ? ['main'] : undefined,
        templateParameters: {
            locale,
            ogLocale,
            siteUrl: SITE_URL,
            t: (key) => readDict(file)[key] ?? readDict(LOCALES.en.file)[key] ?? key
        }
    }));
}

module.exports = (env, argv) => {
    // `npm run build` is a production build; the dev server (which webpack-cli
    // flags with WEBPACK_SERVE) stays in development mode unless --mode says
    // otherwise.
    const mode = (argv && argv.mode) || ((env && env.WEBPACK_SERVE) ? 'development' : 'production');
    const isProduction = mode === 'production';

    return {
        entry: includeTestHarness
            ? {
                main: ["./src/index.ts", './src/worker.ts'],
                harness: './src/test-harness/index.ts'
            }
            : [ "./src/index.ts", './src/worker.ts'],
        output: {
            libraryExport: "default",
            path: path.resolve(__dirname, './dist'),
            // Production filenames carry a content hash, so the server can cache
            // them forever and a deploy can never leave a visitor with stale JS.
            // This covers the worker chunk too (new Worker(new URL(...)) in
            // index.ts emits it through chunkFilename). Development keeps stable
            // names: the dev server's HMR cannot use [contenthash].
            filename: isProduction ? "[name].[contenthash:8].js" : (includeTestHarness ? "[name].js" : "main.js"),
            chunkFilename: isProduction ? "[name].[contenthash:8].js" : undefined,
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
                minify: false,
                templateParameters: { siteUrl: SITE_URL }
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
                    { from: "src/img/favicon.ico", to: "favicon.ico" },
                    { from: "src/robots.txt", to: "robots.txt", transform: withSiteUrl },
                    { from: "src/sitemap.xml", to: "sitemap.xml", transform: withSiteUrl },
                    {
                        context: "src/edit-images-app",
                        from: "**/*",
                        to: "edit-images/[path][name][ext]",
                        // Already built and minified by Vite; webpack's
                        // minimizer must not re-parse it (it chokes on it).
                        info: { minimized: true }
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

        mode

    };
};
