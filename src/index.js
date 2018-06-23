import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import Promise from 'bluebird';
import preProcessPattern from './preProcessPattern';
import processPattern from './processPattern';

const WebpackPluginCopy = (patterns = [], options = {}) => {
  if (!Array.isArray(patterns)) {
    throw new Error('[copy-webpack-plugin] patterns must be an array');
  }

  // Defaults debug level to 'warning'
  options.debug = options.debug || 'warning';

  // Defaults debugging to info if only true is specified
  if (options.debug === true) {
    options.debug = 'info';
  }

  const debugLevels = ['warning', 'info', 'debug'];
  const debugLevelIndex = debugLevels.indexOf(options.debug);

  function log(msg, level) {
    if (level === 0) {
      msg = `WARNING - ${msg}`;
    } else {
      level = level || 1;
    }
    if (level <= debugLevelIndex) {
      console.log(`[copy-webpack-plugin] + ${msg}`); // eslint-disable-line no-console
    }
  }

  function warning(msg) {
    log(msg, 0);
  }

  function info(msg) {
    log(msg, 1);
  }

  function debug(msg) {
    log(msg, 2);
  }

  const apply = (compiler) => {
    const fileDependencies = [];
    const contextDependencies = [];
    const written = {};

    compiler.plugin('emit', (compilation, cb) => {
      debug('starting emit');
      const callback = () => {
        debug('finishing emit');
        cb();
      };

      const globalRef = {
        info,
        debug,
        warning,
        compilation,
        written,
        fileDependencies,
        contextDependencies,
        context: compiler.options.context,
        output: compiler.options.output.path,
        ignore: options.ignore || [],
        copyUnmodified: options.copyUnmodified,
        concurrency: options.concurrency,
      };

      if (globalRef.output === '/' &&
        compiler.options.devServer &&
        compiler.options.devServer.outputPath) {
        globalRef.output = compiler.options.devServer.outputPath;
      }

      // Identify absolute source of each pattern and destination type
      Promise.each(patterns, pattern => preProcessPattern(globalRef, pattern)
        // Every source (from) is assumed to exist here
        .then(pattern => processPattern(globalRef, pattern))) // eslint-disable-line no-shadow
        .catch(err => compilation.errors.push(err))
        .finally(callback);
    });

    compiler.plugin('after-emit', (compilation, cb) => {
      debug('starting after-emit');
      const callback = () => {
        debug('finishing after-emit');
        cb();
      };

      // Add file dependencies if they're not already tracked
      _.forEach(fileDependencies, (file) => {
        if (_.includes(compilation.fileDependencies, file)) {
          debug(`not adding ${file} to change tracking, because it's already tracked`);
        } else {
          debug(`adding ${file} to change tracking`);
          compilation.fileDependencies.add(file);
        }
      });

      // Add context dependencies if they're not already tracked
      _.forEach(contextDependencies, (context) => {
        if (_.includes(compilation.contextDependencies, context)) {
          debug(`not adding ${context} to change tracking, because it's already tracked`);
        } else {
          debug(`adding ${context} to change tracking`);
          compilation.contextDependencies.push(context);
        }
      });

      // Copy permissions for files that requested it
      let output = compiler.options.output.path;
      if (output === '/' &&
        compiler.options.devServer &&
        compiler.options.devServer.outputPath) {
        output = compiler.options.devServer.outputPath;
      }

      _.forEach(written, (value) => {
        if (value.copyPermissions) {
          debug(`restoring permissions to ${value.webpackTo}`);
          const mask = fs.constants.S_IRWXU | fs.constants.S_IRWXG | fs.constants.S_IRWXO;
          fs.chmodSync(path.join(output, value.webpackTo), value.perms & mask);
        }
      });

      callback();
    });
  };

  return {
    apply,
  };
};

WebpackPluginCopy.default = WebpackPluginCopy;
module.exports = WebpackPluginCopy;
