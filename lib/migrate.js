
var fs = require('klei-fs'),
    join = require('path').join,
    resolve = require('path').resolve,
    events = require('events')
    ee = new events.EventEmitter();

var fileNameRegex = /^[0-9]{13}_.*\.js$/;

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
 * Getter/Setter for env (current environment)
 *
 * @param {String} newEnv
 * @returns {String|Object}
 */
exports.env = function (newEnv) {
  if (newEnv) {
    this._env = newEnv;
    return this;
  }
  return this._env = this._env || process.env.NODE_ENV || 'development';
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

  ee.emit('create:init');

  ensureExistingMigrationsDir(dir, function (err) {
    if (err) {
      error(err, cb);
      return;
    }
    exports.template(function (err, template) {
      if (err) {
        error(err, cb);
        return;
      }
      ee.emit('create:ready', name, dir);
      fs.writeFile(join(dir, name), template, 'utf8', function (err) {
        if (err) {
          error(err, cb);
        } else {
          ee.emit('create:success', name, dir);
          cb && cb(null, name);
        }
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
  ee.emit('dry:init');

  return this.migratables(function (migratable, migrated) {
    ee.emit('dry:success', migratable, migrated);
    cb && cb(migratable, migrated);
  });
};

/**
 * Perform a real migration
 *
 * @param {Function} cb
 */
exports.run = function (cb) {
  var self = this;

  ee.emit('run:init');

  return this.migratables(function (migratable, migrated, history) {
    ee.emit('run:ready', migratable, migrated);

    if (!migratable.length) {
      cb && cb(null, []);
      return;
    }

    var migratedNow = [];
    function next (err, file) {
      if (err) {
        cb ? cb(err, migratedNow) : ee.emit('error', err);
        return;
      } else if (!file) {
        ee.emit('run:success', migratedNow);
        cb && cb(null, migratedNow);
        return;
      }

      var hasTimedout = false,
          timeoutId = setTimeout(function () {
            hasTimedout = true;
            next(new Error('Timeout of ' + self.timeout() + ' ms exceeded for migration: "' + file + '"'));
          }, self.timeout());

      try {
        ee.emit('run:migrate:before', file);
        var migration = loadMigration(self.directory(), file);
        migration[self.direction()](function (err) {
          if (hasTimedout) {
            return;
          }
          clearTimeout(timeoutId);
          if (!err) {
            migratedNow.push(file);
            ee.emit('run:migrate:after', file);
            saveProgress(history, file, doNext);
          } else {
            ee.emit('run:migrate:fail', err, file);
            doNext(err);
          }
        });
      } catch (e) {
        ee.emit('run:migrate:fail', e, file);
        next(e);
      }
    }

    function doNext (err) {
      next(err, migratable.shift());
    }

    doNext();
  });
};

exports.migratables = function (cb) {
  var self = this,
      dir = this.directory(),
      name = this.args().join(' ');

  fs.readdir(dir, function (err, files) {
    if (err) {
      cb([], {});
      return;
    }
    fs.readJson(join(dir, '.migrated.json'), function (err, history) {
      history = fixHistory(history);

      var migrated = history[self.env()];

      var down = isDown(exports.direction()),
          limit = exports.limit();

      var migratable = files.filter(function (file) {
        if (!fileNameRegex.test(file))
          return false;

        if (down && !migrated[file] || !down && migrated[file])
          return false;

        if (limit === 1 && name && name !== file) {
          return false;
        }

        if (name && down && name > file)
          return false;

        if (name && !down && name < file)
          return false;

        return true;
      });

      migratable.sort();

      if (down) {
        migratable.reverse();
      }

      if (limit) {
        migratable = migratable.slice(0, limit);
      }

      cb(migratable, migrated, history);
    });
  });
  return this;
};

exports.diff = function (cb) {
  var self = this,
      dir = this.directory();

  fs.readdir(dir, function (err, files) {
    if (err) {
      files = [];
    }
    fs.readJson(join(dir, '.migrated.json'), function (err, history) {
      var migrated = Object.keys(fixHistory(history)[self.env()]);

      var diff = [];

      files.forEach(function (file) {
        if (!fileNameRegex.test(file)) {
          return;
        }
        if (migrated.indexOf(file) < 0) {
          diff.push({migration: file, direction: 'up'});
        }
      })

      migrated.forEach(function (migration) {
        if (files.indexOf(migration) < 0) {
          diff.push({migration: migration, direction: 'down'});
        }
      });

      diff.sort(function (a, b) {
        return a.migration > b.migration;
      });

      cb(null, diff);
    });
  });
  return this;
};

exports.postCheckout = function (cb) {
  var fromBranch = this.args()[0],
      self = this;

  return this.diff(function (err, diff) {
    if (err || !diff.length) {
      cb(err, diff);
      return;
    }

    function doSync (done) {
      var migrated = [];
      diff.forEach(function (item) {
        if (item.direction === 'down') {
          self.git().checkout(fromBranch, item.migration, function (err) {
            if (err) {
              error(err, done);
              return;
            }
            self.args([item.migration]).limit(1).direction(item.direction).run(function (err, name) {
              if (err) {
                error(err, done);
                return;
              }
              migrated.push(item);
              self.git().resetHead(item.migration, function (err) {
                if (err) {
                  error(err, done);
                  return;
                }
                fs.unlink(join(self.directory(), item.migration), function (err) {
                  if (err) {
                    error(err, done);
                    return;
                  }
                  if (migrated.length === diff.length) {
                    done(null, migrated);
                  }
                });
              });
            });
          });
        } else {
          self.args([item.migration]).limit(1).direction(item.direction).run(function (err, name) {
            if (err) {
              error(err, done);
              return;
            }
            migrated.push(item);
            if (migrated.length === diff.length) {
              done(null, migrated);
            }
          });
        }
      });
    }

    doSync(function (err, migrated) {
      if (err) {
        error(err, cb);
        return;
      }
      migrated.sort(function (a, b) {
        return a.migration > b.migration;
      });
      cb(err, migrated);
    });
  });
};

/**
 * Set git command runner
 *
 * @param {Object} newGit
 */
exports.git = function (newGit) {
  if (newGit) {
    this._git = newGit;
    return this;
  }
  return this._git = this._git || require('./git');
};

/**
 * Add event listener for event
 *
 * @param {String} event
 * @param {Function} cb Listener
 */
exports.on = function (event, cb) {
  ee.on(event, cb);
  return this;
};

exports.error = function (err, heading) {
  ee.emit('error', err, heading);
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

function saveProgress (history, file, cb) {
  if (isDown(exports.direction())) {
      history[exports.env()][file] && delete history[exports.env()][file];
  } else {
      history[exports.env()][file] = {migrated_at: new Date()};
  }
  fs.writeFile(join(exports.directory(), '.migrated.json'), JSON.stringify(history), 'utf8', function (err) {
      cb(err);
  });
}

function fixHistory (history) {
  var env = exports.env();
  if (history) {
    if (!history[env]) {
      for (var key in history) {
        // Old history format:
        if (history.hasOwnProperty(key) && fileNameRegex.test(key)) {
          var oldHistory = history;
          history = {};
          history[env] = oldHistory;
          return history;
          break;
        }
      }
      history[env] = {};
    }
  } else {
    history = {};
    history[env] = {};
  }
  return history;
}

function isDirection (str) {
  return ~['up', 'down'].indexOf(str);
}

function isDown (str) {
  return str === 'down';
}

function error (err, cb) {
  cb ? cb(err) : ee.emit('error', err);
}
