"use strict";
const webpack = require('webpack');
const path    = require('path');
const fs      = require('fs');

const nodeModules = {};
fs.readdirSync('node_modules')
  .filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
  })
  .forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
  });

module.exports = {
    entry: './src/server.ts',
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'server.js',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
        ],
    },
    target: 'node',
    devServer: {
        contentBase: "./dist",
        host: "140.118.127.157",
        port: 3000,
    },
    externals: nodeModules,
    plugins: [
        new webpack.DefinePlugin({
            BUILD_DATE: JSON.stringify((new Date()).toLocaleString()),
            DEBUG: true
        }),
    ],
}