const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const API_URL = process.env.API_URL || 'http://localhost:3376';

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      // The dashboard is served under /admin/ behind nginx.
      publicPath: isProduction ? '/admin/' : '/',
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    devtool: isProduction ? false : 'eval-source-map',
    devServer: {
      port: 8081,
      open: true,
      proxy: [
        {
          context: ['/api'],
          target: API_URL,
          pathRewrite: { '^/api': '' },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: 'index.html' }),
      new webpack.DefinePlugin({ __API_URL__: JSON.stringify('/api') }),
      ...(isProduction ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })] : []),
    ],
    module: {
      rules: [
        { test: /\.ts$/i, loader: 'ts-loader', exclude: /node_modules/ },
        {
          test: /\.css$/i,
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        { test: /\.(png|svg|jpg|gif)$/i, type: 'asset' },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
  };
};
