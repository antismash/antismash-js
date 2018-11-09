const PACKAGE = require('./package.json');
const banner = PACKAGE.name + ', version: ' + PACKAGE.version;

const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './build/index.js',
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'antismash.js',
    libraryTarget: 'var',
    library: 'viewer',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new webpack.BannerPlugin(banner)
  ]
};
