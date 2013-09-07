
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
 * Getter/Setter for templatePath
 *
 * @param {String} newPath
 * @returns {String|Object}
 */
exports.templatePath = function (newPath) {
  if (newPath) {
    this._templatePath = resolve(this.cwd(), newPath);
    return this;
  }
  return this._templatePath = this._templatePath || join(__dirname, '..', 'assets', 'migration.tpl.js');
};

/**
 * Getter/Setter for migration template
 *
 * @param {Function} cb
 */
exports.template = function (cb) {
  if (!cb || typeof cb !== 'function') {
    throw new Error('Missing callback!');
  }
  var self = this,
      path = this.templatePath();
  fs.exists(path, function (exists) {
    if (!exists) {
      cb(new Error('Could not find template: "' + path + '"'));
      return;
    }
    fs.readFile(path, 'utf8', function (err, content) {
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
 * @param {Function} cb
 */
exports.create = function (cb) {
  var name = +new Date + '_' + (this.args().join(' ').replace(/[\s\.]+/g, '_') || 'migration') + '.js';

  var dir = this.directory();
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
 *
 * @param {String} newDirection
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
 * Getter/Setter for migration args, e.g. migration name on creation
 *
 * @param {Array} newArgs
 */
exports.args = function (newArgs) {
  if (newArgs) {
    this._args = newArgs;
    return this;
  }
  return this._args = this._args || [];
};

/**
 * Getter/Setter for migration count limit
 *
 * @param {Number} newLimit
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

/**
 * Getter/Setter for migration timeout limit in ms
 *
 * @param {Number} newTimeout
 */
exports.timeout = function (newTimeout) {
  var defaultTimeout = 30000; // 30 s
  if (newTimeout) {
    this._timeout = +newTimeout|0;
    if (this._timeout < 0) {
      this._timeout = defaultTimeout;
    }
    return this;
  }
  return this._timeout || defaultTimeout;
};

/**
 * Getter/Setter for migrations directory
 *
 * @param {String} newDirectory
 */
exports.directory = function (newDirectory) {
  if (newDirectory) {
    if (typeof newDirectory !== 'string') {
      throw new Error('Bad directory, expected a string but was: ' + (typeof newDirectory));
    }
    this._directory = resolve(this.cwd(), newDirectory);
    return this;
  }
  return this._directory = this._directory || resolve(this.cwd(), 'migrations');
};

/**
 * Perform a dry run, i.e. get what to migrate
 *
 * @param {Function} cb
 */
exports.dry = function (cb) {
  var dir = this.directory(),
      name = this.args().join(' ');
  fs.readdir(dir, function (err, files) {
    if (err) {
      cb([], {});
      return;
    }
    fs.readJson(join(dir, '.migrated.json'), function (err, migrated) {
      if (err || !migrated) {
        migrated = {};
      }

      var down = isDown(exports.direction()),
          limit = exports.limit();

      var migratable = files.filter(function (file) {
        return /^[0-9]{13}_.*\.js$/.test(file)
            && (down && migrated[file] || !down && !migrated[file])
            && (!name || !limit && (down && name <= file || !down && name >= file) || limit && name == file);
      });

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

/**
 * Perform a real migration
 *
 * @param {Function} cb
 */
exports.run = function (cb) {
  var self = this;

  return this.dry(function (migratable, migrated) {
    var migratedNow = [];
    function next (err, file) {
      if (err || !file) {
        cb(err, migratedNow);
        return;
      }

      var hasTimedout = false,
          timeoutId = setTimeout(function () {
            hasTimedout = true;
            next(new Error('Timeout of ' + self.timeout() + ' ms exceeded for migration: "' + file + '"'));
          }, self.timeout());

      try {
        var migration = loadMigration(self.directory(), file);
        migration[self.direction()](function (err) {
          if (hasTimedout) {
            return;
          }
          clearTimeout(timeoutId);
          if (!err) {
            migratedNow.push(file);
            saveProgress(migrated, file, doNext);
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
};

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
  fs.writeFile(join(exports.directory(), '.migrated.json'), JSON.stringify(migrated), 'utf8', function (err) {
      cb(err);
  });
}

function isDirection (str) {
  return ~['up', 'down'].indexOf(str);
}

function isDown (str) {
  return str === 'down';
}
