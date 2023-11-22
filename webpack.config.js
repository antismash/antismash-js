const PACKAGE = require('./package.json');

const execSync = require('child_process').execSync;
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

class GitBanner {
  apply(compiler) {
    const envsVarToCheck = ['TEST_VAR', 'TEST_VAR2'] // put your env var list here
    envsVarToCheck.forEach(envVar => {
      if (!!!process.env[envVar]) {
        throw new Error(`Environment variable : ${envVar} is missing`);
      }
    });
  }
 };


function git(args) {
  return execSync(`git ${args}`).toString().trim();
}

function getBanner(dev) {
  let banner = `${PACKAGE.name}, version: `;
  try {
    git("status");
  } catch {
    // no git repo, so do the best one can do
    return banner + `${PACKAGE.version.replace("v", "")} with possible modifications`;
  }
  if (dev) {
    banner += `dev${git("describe --dirty").replace("v", "")} ${git("branch --show-current")}`;
  } else {
    let errors = [];
    if (git("diff-files")) {
      errors.push("Production build cannot have uncommitted modifications.")
    }
    try {
      banner += git("describe --exact-match HEAD").replace("v", "");
    } catch {
      errors.push("A git tag matching current HEAD is required.")
    }
    if (errors.length > 0) {
      for (error of errors) {
        console.error(error);
      }
      throw new Error("production build not possible");
    }
  }
  return `${banner}\nLicense: GNU Affero General Public License v3 or later`;
}

module.exports = (env, argv) => {
  const dev = argv.mode === "development";
  banner = getBanner(dev);
  return {
    entry: './build/index.js',
    resolve: {
      extensions: [ '.tsx', '.ts', '.js' ]
    },
    stats: {
      all: false,
      assets: true,
      errors: true,
    },
    optimization: {
      minimize: !dev,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
        }),
      ],
    },
    output: {
      filename: `antismash${dev ? "_dev" : ""}.js`,
      libraryTarget: 'var',
      library: 'viewer',
      path: path.resolve(__dirname, 'dist')
    },
    plugins: [
      new webpack.BannerPlugin(banner),
    ]
  };
}
