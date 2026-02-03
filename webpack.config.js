const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const isDevelopment = process.env.NODE_ENV !== 'production';
const envPath = path.resolve(__dirname, '.env');
const dotenvOptions = {
  systemvars: true,
  silent: true,
};

if (fs.existsSync(envPath)) {
  dotenvOptions.path = envPath;
}

module.exports = {
  entry: './electron-app/src/renderer/index.jsx',
  
  mode: isDevelopment ? 'development' : 'production',
  
  devtool: isDevelopment ? 'source-map' : false,
  
  target: 'electron-renderer',
  
  node: {
    __dirname: false,
    __filename: false,
    global: false
  },
  
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'electron-app/src/renderer'),
      '@components': path.resolve(__dirname, 'electron-app/src/renderer/components'),
      '@modules': path.resolve(__dirname, 'electron-app/src/renderer/modules'),
      '@services': path.resolve(__dirname, 'electron-app/src/renderer/services'),
      '@utils': path.resolve(__dirname, 'electron-app/src/renderer/utils'),
      '@store': path.resolve(__dirname, 'electron-app/src/renderer/store'),
    }
  },
  
  output: {
    path: path.resolve(__dirname, 'electron-app/output'),
    filename: 'renderer.js',
    // Con file:// (Electron production) serve path relativo; '/' darebbe ERR_FILE_NOT_FOUND
    publicPath: './'
  },
  
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './electron-app/public/index.html',
      filename: 'index.html',
      inject: true,
      publicPath: './'  // Forza script src="./renderer.js" per caricamento da file://
    }),
    new Dotenv(dotenvOptions)
  ],
  
  
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    compress: true,
    static: {
      directory: path.join(__dirname, 'electron-app/public'),
    },
  }
};

