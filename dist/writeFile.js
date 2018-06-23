'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = writeFile;

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var constants = _bluebird2.default.promisifyAll(require('constants')); // eslint-disable-line import/no-commonjs

function writeFile(globalRef, pattern, file) {
  var info = globalRef.info,
      debug = globalRef.debug,
      compilation = globalRef.compilation,
      fileDependencies = globalRef.fileDependencies,
      written = globalRef.written,
      copyUnmodified = globalRef.copyUnmodified;


  return _fsExtra2.default.stat(file.absoluteFrom).then(function (stat) {
    // We don't write empty directories
    if (stat.isDirectory()) {
      return _bluebird2.default.resolve();
    }

    // If this came from a glob, add it to the file watchlist
    if (pattern.fromType === 'glob') {
      fileDependencies.push(file.absoluteFrom);
    }

    info('reading ' + file.absoluteFrom + ' to write to assets');
    return _fsExtra2.default.readFile(file.absoluteFrom).then(function (content) {
      if (pattern.transform) {
        content = pattern.transform(content, file.absoluteFrom);
      }

      var hash = _loaderUtils2.default.getHashDigest(content);

      if (pattern.toType === 'template') {
        info('interpolating template \'' + file.webpackTo + '\' for \'' + file.relativeFrom + '\'');

        // A hack so .dotted files don't get parsed as extensions
        var basename = _path2.default.basename(file.relativeFrom);
        var dotRemoved = false;
        if (basename[0] === '.') {
          dotRemoved = true;
          file.relativeFrom = _path2.default.join(_path2.default.dirname(file.relativeFrom), basename.slice(1));
        }

        // If it doesn't have an extension, remove it from the pattern
        // ie. [name].[ext] or [name][ext] both become [name]
        if (!_path2.default.extname(file.relativeFrom)) {
          file.webpackTo = file.webpackTo.replace(/\.?\[ext\]/g, '');
        }

        // A hack because loaderUtils.interpolateName doesn't
        // find the right path if no directory is defined
        // ie. [path] applied to 'file.txt' would return 'file'
        if (file.relativeFrom.indexOf(_path2.default.sep) < 0) {
          file.relativeFrom = _path2.default.sep + file.relativeFrom;
        }

        file.webpackTo = _loaderUtils2.default.interpolateName({
          resourcePath: file.relativeFrom
        }, file.webpackTo, {
          content: content
        });

        // Add back removed dots
        if (dotRemoved) {
          var newBasename = _path2.default.basename(file.webpackTo);
          file.webpackTo = _path2.default.dirname(file.webpackTo) + '/.' + newBasename;
        }
      }

      if (!copyUnmodified && written[file.absoluteFrom] && written[file.absoluteFrom][hash]) {
        info('skipping \'' + file.webpackTo + '\', because it hasn\'t changed');
        return;
      }

      debug('added ' + hash + ' to written tracking for \'' + file.absoluteFrom + '\'');
      written[file.absoluteFrom] = _defineProperty({}, hash, true);

      if (compilation.assets[file.webpackTo] && !file.force) {
        info('skipping \'' + file.webpackTo + '\', because it already exists');
        return;
      }

      var perms = void 0;
      if (pattern.copyPermissions) {
        debug('saving permissions for \'' + file.absoluteFrom + '\'');

        written[file.absoluteFrom].copyPermissions = pattern.copyPermissions;
        written[file.absoluteFrom].webpackTo = file.webpackTo;

        var constsfrom = _fsExtra2.default.constants || constants;

        perms |= stat.mode & constsfrom.S_IRWXU;
        perms |= stat.mode & constsfrom.S_IRWXG;
        perms |= stat.mode & constsfrom.S_IRWXO;

        written[file.absoluteFrom].perms = perms;
      }

      info('writing \'' + file.webpackTo + '\' to compilation assets from \'' + file.absoluteFrom + '\'');
      compilation.assets[file.webpackTo] = {
        size: function size() {
          return stat.size;
        },
        source: function source() {
          return content;
        }
      };
    });
  });
}