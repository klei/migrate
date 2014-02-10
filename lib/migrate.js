var fs = require('klei-fs'),
    join = require('path').join,
    resolve = require('path').resolve,
    events = require('events'),
    ee = new events.EventEmitter();

exports.getFileNameRegex = function () {
  if (this.coffee()) {
    return /^[0-9]{13}_.*\.coffee$/;
  }
  return /^[0-9]{13}_.*\.js$/;
};

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
    process.env.NODE_ENV = this._env = newEnv;
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
  var path = this.templatePath();
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
  var name = +new Date() + '_' + (this.args().join(' ').replace(/[\s\.]+/g, '_') || 'migration') + '.' + (this.coffee() ? 'coffee' : 'js');

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
 * Getter/Setter for coffee-script mode
 *
 * @param {Boolean} newMode
 */
exports.coffee = function (newMode) {
  if (typeof newMode !== 'undefined') {
    this._coffee = !!newMode;
    return this;
  }
  return !!this._coffee;
};

/**
 * Getter for config file location
 */
exports.config = function () {
  return join(this.cwd(), 'klei-migrate.json');
};

exports.loadConfig = function () {
  if (fs.existsSync(this.config())) {
    var config = require(this.config());
    this.timeout(config.timeout * 1000);
    this.templatePath(config.template);
    this.env(config.env);
    this.directory(config.directory);
    this.coffee(!!config.coffee);
  }
  return this;
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
  var self = this;

  ee.emit('dry:init');

  return this.migratables(function (migratable, history) {
    ee.emit('dry:success', migratable, history[self.env()]);
    cb && cb(migratable, history[self.env()]);
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

  return this.migratables(function (migratable, history) {
    ee.emit('run:ready', migratable, history[self.env()]);

    if (!migratable.length) {
      cb && cb(null, []);
      return;
    }

    doMigrate(migratable, function (err, migrated) {
      if (error(err, cb)) {
        return;
      }
      ee.emit('run:success', migrated);
      cb && cb(null, migrated);
    });
  });
};

/**
 * Gets what is possible to migrate
 *
 * Takes name, limit, env and direction into account
 *
 * @param {Function} cb
 */
exports.migratables = function (cb) {
  var self = this,
      name = this.args().join(' '),
      down = isDown(this.direction()),
      limit = this.limit();

  getHistory(function (history) {
    getMigrationFiles(function (files) {
      var migrated = history[self.env()];

      var toMigrate = files.filter(function (file) {
        if (down && !migrated[file] || !down && migrated[file]) {
          return false;
        }
        if (limit === 1 && name && file !== name) {
          return false;
        }
        if (name && down && name > file) {
          return false;
        }
        if (name && !down && name < file) {
          return false;
        }
        return true;
      })
      .map(function (file) {
        return {migration: file, direction: self.direction()};
      });

      sortMigrations(toMigrate);

      if (limit) {
        toMigrate = toMigrate.slice(0, limit);
      }

      cb(toMigrate, history);
    });
  });
};

/**
 * Gets what should be migrated both up and down
 *
 * Migrations that has been migrated but don't currently exist
 * is regarded a migration that should be migrated down.
 *
 * @param {Function} cb
 */
exports.diff = function (cb) {
  var self = this;

  getMigrationFiles(function (files) {
    getHistory(function (history) {
      var migrated = Object.keys(history[self.env()]);

      var diff = [];

      files.forEach(function (file) {
        if (!self.getFileNameRegex().test(file)) {
          return;
        }
        if (migrated.indexOf(file) < 0) {
          diff.push({migration: file, direction: 'up'});
        }
      });

      migrated.forEach(function (migration) {
        if (files.indexOf(migration) < 0) {
          diff.push({migration: migration, direction: 'down'});
        }
      });

      sortMigrations(diff);

      cb(diff, history);
    });
  });
  return this;
};

/**
 * A function to use as a Git Post Checkout hook
 *
 * Get three arguments from git:
 *   1. from-branch-hash
 *   2. to-branch-hash (current branch)
 *   3. 1=branch checkout, 0=file checkout
 *
 * @param {Function} cb
 */
exports.postCheckout = function (cb) {
  var self = this,
      args = this.args(),
      fromHash = args[0],
      toHash = args[1],
      branchCheckout = args[2] && args[2] !== '0';

  if (args.length < 3) {
    error(new Error('klei-migrate post-checkout requires three parameters!'), cb);
    return;
  }

  ee.emit('post-checkout:init');

  if (!branchCheckout || fromHash === toHash) {
    cb && cb(null, []);
    return this;
  }

  this.git().branchFromHash(fromHash, function (err, branch) {
    if (error(err, cb)) {
      return;
    }

    self.diff(function (diff, history) {
      ee.emit('post-checkout:ready', diff, history[self.env()]);

      if (!diff.length) {
        cb && cb(null, []);
        return;
      }

      doSync(branch, diff, function (err, migrated) {
        if (error(err, cb)) {
          return;
        }
        ee.emit('post-checkout:success', migrated);
        cb && cb(null, migrated);
      });
    });
  });

  return this;
};

/**
 * Syncs current migrations
 *
 * Expects to get a git branch name from arguments,
 * a branch where migrations to migrate down could be found
 *
 * @param {Function} cb
 */
exports.sync = function (cb) {
  var fromBranch = this.args()[0],
      self = this;

  if (!fromBranch) {
    error(new Error('Missing argument `fromBranch`'), cb);
    return;
  }

  ee.emit('sync:init');

  return this.diff(function (diff, history) {
    ee.emit('sync:ready', diff, history[self.env()]);

    if (!diff.length) {
      cb && cb(null, []);
      return;
    }

    doSync(fromBranch, diff, function (err, migrated) {
      if (error(err, cb)) {
        return;
      }
      ee.emit('sync:success', migrated);
      cb && cb(null, migrated);
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

/**
 * Migrate an array of migrations
 *
 * @param {Array} migrations
 * @param {Function} done
 */
function doMigrate (migrations, done) {
  var migratedNow = [];

  function next (err, item) {
    if (err || !item) {
      done(err, migratedNow);
      return;
    }

    doOneMigration(item, function (err) {
      if (!err) {
        migratedNow.push(item);
      }
      next(err, migrations.shift());
    });
  }

  next(null, migrations.shift());
}

/**
 * Syncing provided diff migrations (both up and down)
 *
 * Expects a branch name for where to look for down
 * migration files
 *
 * @param {String} fromBranch
 * @param {Array} diff
 * @param {Function} done
 */
function doSync (fromBranch, diff, done) {
  var git = exports.git(),
      dir = exports.directory(),
      migratedNow = [];

  function next(err, item) {
    if (err || !item) {
      done(err, migratedNow);
      return;
    }

    if (isDown(item.direction)) {
      var file = join(dir, item.migration);
      git.checkout(fromBranch, file, function (err) {
        if (err) {
          next(err);
          return;
        }
        doOneMigration(item, function (err) {
          if (err) {
            next(err);
            return;
          }
          migratedNow.push(item);
          git.resetHead(file, function (err) {
            if (err) {
              next(err);
              return;
            }
            fs.unlink(file, function (err) {
              next(err, diff.shift());
            });
          });
        });
      });
    } else {
      doOneMigration(item, function (err) {
        if (err) {
          next(err);
          return;
        }
        migratedNow.push(item);
        next(null, diff.shift());
      });
    }
  }

  next(null, diff.shift());
}

/**
 * Run one migration
 *
 * @param {Object} item
 * @param {Function} cb
 */
function doOneMigration (item, cb) {
  var timeout = exports.timeout(),
      dir = exports.directory(),
      hasTimedout = false,
      timeoutId = setTimeout(function () {
        hasTimedout = true;
        cb(new Error('Timeout of ' + timeout + ' ms exceeded for migration: "' + item.migration + '"'));
      }, timeout);

  try {
    ee.emit('migrate:before', item);
    var migration = loadMigration(dir, item.migration);
    ee.emit('migrate:init', item, migration);
    migration[item.direction](function (err) {
      if (hasTimedout) {
        return;
      }
      clearTimeout(timeoutId);
      if (!err) {
        ee.emit('migrate:success', item);
        saveProgress(item, function (err) {
          if (err) {
            ee.emit('migrate:save-fail', err, item);
          }
          cb(err);
        });
      } else {
        fail(err);
      }
    });
  } catch (e) {
    fail(e);
  }

  function fail (err) {
    ee.emit('migrate:fail', err, item);
    cb(err);
  }
}

/**
 * Load a migration file
 *
 * @param {String} dir
 * @param {String} file
 */
function loadMigration (dir, file) {
  if (!file) {
    return null;
  }
  if (exports.coffee() && !this.loadedCoffee) {
    // support coffees-script >= 1.7.0
    try {
      require('coffee-script/register');
    }
    // fallback for coffee-script <= 1.6
    catch(e) {
      require('coffee-script');
    }
    this.loadedCoffee = true;
  }
  return require(join(dir, file));
}

/**
 * Save migration progress for a migration
 *
 * @param {Object} item
 * @param {Function} cb
 */
function saveProgress (item, cb) {
  getHistory(function (history) {
    if (isDown(item.direction)) {
        history[exports.env()][item.migration] && delete history[exports.env()][item.migration];
    } else {
        history[exports.env()][item.migration] = {migrated_at: new Date()};
    }
    fs.writeFile(join(exports.directory(), '.migrated.json'), JSON.stringify(history), 'utf8', function (err) {
        cb(err);
    });
  });
}

/**
 * Get migration history
 *
 * @param {Function} cb
 */
function getHistory (cb) {
  fs.readJson(join(exports.directory(), '.migrated.json'), function (err, history) {
    cb(fixHistory(history));
  });
}

/**
 * Get all migration files
 *
 * @param {Function} cb
 */
function getMigrationFiles (cb) {
  fs.readdir(exports.directory(), function (err, files) {
    cb(err ? [] : files.filter(function (file) {
      return exports.getFileNameRegex().test(file);
    }));
  });
}

/**
 * Sort migrations by:
 *  - direction (down before up)
 *  - timestamp DESC if down
 *  - timestamp ASC if up
 *
 * @param {Array} migrations
 */
function sortMigrations (migrations) {
  migrations.sort(function (a, b) {
    if (a.direction !== b.direction) {
      return isDown(a.direction) ? -1 : 1;
    }
    if (isDown(a.direction)) {
      return -(toTimestamp(a) - toTimestamp(b));
    } else {
      return (toTimestamp(a) - toTimestamp(b));
    }
  });
}

/**
 * Migrate the migration history from <=v.0.2 to >v.0.3
 *
 * @param {Object} history
 * @returns {Object} Fixed history
 */
function fixHistory (history) {
  var env = exports.env();
  if (history) {
    if (!history[env]) {
      for (var key in history) {
        // Old history format:
        if (history.hasOwnProperty(key) && exports.getFileNameRegex().test(key)) {
          var oldHistory = history;
          history = {};
          history[env] = oldHistory;
          return history;
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

/**
 * Validates a direction name
 *
 * @param {String} str
 * @returns {Boolean}
 */
function isDirection (str) {
  return ~['up', 'down'].indexOf(str);
}

/**
 * Check if given direction is down
 *
 * @param {String} str
 * @returns {Boolean}
 */
function isDown (str) {
  return str === 'down';
}

/**
 * Error handler
 *
 * If err exists and callback is provided, call the callback with the error
 * If err exists and no callback exists, emit the error
 *
 * @param {Error} err
 * @param {Function} cb
 * @returns {Boolean} True if error was handled
 */
function error (err, cb) {
  if (err) {
    cb ? cb(err) : ee.emit('error', err);
    return true;
  } else {
    return false;
  }
}

/**
 * Convert a migration name to a timestamp
 *
 * @param {Object} item
 * @returns {Number}
 */
function toTimestamp (item) {
  return +item.migration.slice(0, 13);
}
