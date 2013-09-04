
var fs = require('klei-fs'),
    join = require('path').join,
    resolve = require('path').resolve;

/**
 * Getter/Setter for cwd (current working directory)
 *
 * @param {String} newCwd
 * @returns {String|Object}
 */
exports.cwd = function (newCwd) {
  if (newCwd) {
    this._cwd = newCwd;
    return this;
  }
  return this._cwd = this._cwd || process.cwd();
};

/**
 * Getter/Setter for migration template
 *
 * @param {String} path
 * @param {Function} cb
 */
exports.template = function (path, cb) {
  if (!arguments.length) {
    throw new Error('You must at least provide a callback!');
  }
  if (typeof path === 'string' && (!cb || typeof cb !== 'function')) {
    throw new Error('Missing callback!');
  }
  if (typeof path === 'function') {
    cb = path;
    path = null;
  }
  if (path) {
    path = resolve(this.cwd(), path);
  }
  var newPath = path || this._templatePath || join(__dirname, '..', 'assets', 'migration.tpl.js'),
      self = this;
  fs.exists(newPath, function (exists) {
    if (!exists) {
      cb(new Error('Could not find template: "' + newPath + '"'));
      return;
    }
    self._templatePath = newPath;
    fs.readFile(self._templatePath, 'utf8', function (err, content) {
      cb(err, content);
    });
  });
  return this;
};

/**
 * Create a new migration file
 *
 * Creates a new migration file in <cwd>/migrations
 * with given name snake_cased and from current template
 *
 * @param {String} name
 * @param {Function} cb
 */
exports.create = function (name, cb) {
  if (typeof name === 'function') {
    cb = name;
    name = null;
  }
  name = +new Date + '_' + (name ? name.replace(/[\s\.]+/g, '_') : 'migration') + '.js';

  var dir = join(this.cwd(), 'migrations');
  ensureExistingMigrationsDir(dir, function (err) {
    if (err) {
      cb(err);
      return;
    }
    exports.template(function (err, template) {
      if (err) {
        cb(err);
        return;
      }
      fs.writeFile(join(dir, name), template, 'utf8', function (err) {
        cb(err, name);
      });
    });
  });
  return this;
};

/**
 * Getter/Setter for migration direction
 */
exports.direction = function (newDirection) {
  if (newDirection) {
    if (!isDirection(newDirection)) {
      throw new Error('Unknown direction: "' + newDirection + '"');
    }
    this._direction = newDirection;
    return this;
  }
  return this._direction = this._direction || 'up';
};

/**
 * Getter/Setter for migration count limit
 */
exports.limit = function (newLimit) {
  if (newLimit) {
    this._limit = +newLimit|0;
    if (this._limit < 0) {
      this._limit = 0;
    }
    return this;
  }
  return this._limit || 0;
};

exports.dry = function (name, cb) {
  if (typeof name === 'function') {
    cb = name;
    name = null;
  }
  var dir = join(this.cwd(), 'migrations');
  fs.readdir(dir, function (err, files) {
    if (err) {
      cb([], {});
      return;
    }
    fs.readFile(join(dir, '.migrated.json'), 'utf8', function (err, migrated) {
      if (err || !migrated) {
        migrated = {};
      }

      var down = isDown(exports.direction()),
          limit = exports.limit();

      var migratable = files.filter(function (file) {
        console.log(file, name, limit, migrated[file]);
        return /^[0-9]{13}_.*\.js$/.test(file)
            && (down && migrated[file] && (!name || !limit && name <= file || limit && name == file)
                        || !down && !migrated[file] && (!name || !limit && name >= file || limit && name == file));
      });

      console.log(migratable);

      migratable.sort();

      if (down) {
        migratable.reverse();
      }

      if (limit && migratable.length > 1) {
        migratable = [migratable.shift()];
      }

      cb(migratable, migrated);
    });
  });
  return this;
};

exports.run = function (cb) {
  var self = this;

  return this.dry(function (migratable, migrated) {
    console.log(self.direction(), migratable, migrated);
    function next (err, file) {
      if (err) {
          cb(err);
          return;
      }

      if (!file) {
          cb();
          return;
      }

      var hasTimedout = false,
          timeoutId = setTimeout(function () {
              hasTimedout = true;
              next(new Error('Damn, that\'s slow! Timeout of 30 seconds exceeded...'));
          }, 30000);

      try {
          var migration = loadMigration(join(self.cwd(), 'migrations'), file);
          migration[self.direction()](function (err) {
              if (hasTimedout) {
                  return;
              }
              clearTimeout(timeoutId);
              if (!err) {
                  saveProgress(migrated, file, function (err) {
                    doNext(err);
                  });
              } else {
                doNext(err);
              }
          });
      } catch (e) {
          next(e);
      }
    }

    function doNext (err) {
      next(err, migratable.shift());
    }

    doNext();
  });
}

/**
 * Creates the migrations directory if needed
 *
 * @param {String} dir
 * @param {Function} cb
 * @api Private
 */
function ensureExistingMigrationsDir (dir, cb) {
  fs.exists(dir, function (exists) {
    if (!exists) {
      fs.mkdirp(dir, function (err) {
        cb(err);
      });
    } else {
      cb(null);
    }
  });
}

function loadMigration (dir, file) {
  if (!file) {
    return null;
  }
  return require(join(dir, file));
}

function saveProgress (migrated, file, cb) {
    if (isDown(exports.direction())) {
        migrated[file] && delete migrated[file];
    } else {
        migrated[file] = {migrated_at: new Date()};
    }
    fs.writeFile(join(exports.cwd(), 'migrations', '.migrated.json'), JSON.stringify(migrated), 'utf8', function (err) {
        cb(err);
    });
}

function isDirection (str) {
  return ~['up', 'down'].indexOf(str);
}

function isOneLimitDirection (str) {
  return /^one-(up|down)$/.test(str);
}

function isDown (str) {
  return str === 'down';
}
