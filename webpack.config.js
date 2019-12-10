const path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin')

const webpack_module_rules = {
  rules: [
    {
      test: /\.s(c|a)ss$/,
      use: [
        'vue-style-loader',
        'css-loader',
        {
          loader: 'sass-loader',
          // Requires sass-loader@^7.0.0
          options: {
            implementation: require('sass'),
            fiber: require('fibers'),
            indentedSyntax: true // optional
          },
          // Requires sass-loader@^8.0.0
          options: {
            implementation: require('sass'),
            sassOptions: {
              fiber: require('fibers'),
              indentedSyntax: true // optional
            },
          },
        },
      ],
    },
    {
      test: /\.vue$/,
      loader: 'vue-loader'
    }
  ],
};

const vuetify_build = {
  target: "electron-renderer",
  module: webpack_module_rules,
  plugins: [
    new VueLoaderPlugin(),
    new VuetifyLoaderPlugin()
  ],
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    }
  },
  devtool: 'eval-source-map'
};

module.exports = [
  {
    ...vuetify_build,
    entry: './views/debug_view.js',
    output: {
      filename: 'debug_view.dist.js',
      path: path.resolve(__dirname, 'views'),
    },
    
  },
  {
    ...vuetify_build,
    entry: './views/main_window.js',
    output: {
      filename: 'main_window.dist.js',
      path: path.resolve(__dirname, 'views'),
    }
  }
]