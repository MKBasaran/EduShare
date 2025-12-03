const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      "http": false,
      "https": false,
      "crypto": false,
      "stream": false,
      "assert": false,
      "os": false,
      "url": false
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html'
    })
  ],
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'public'),
      },
      {
        directory: path.join(__dirname, 'student_data'),
        publicPath: '/student_data',
      }
    ],
    compress: true,
    port: 3000,
    hot: true,
    open: true
  }
};
