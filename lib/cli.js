
var migrate = require('./migrate'),
    nopt = require('nopt'),
    pkg = require('../package'),
    colors = require('colors');

var options = {
    help: {type: Boolean, description: 'Show this usage information'},
    version: {type: Boolean, description: 'Show version information'},
    up: {type: Boolean, default: true, description: 'Set migration direction to up'},
    down: {type: Boolean, description: 'Set migration direction to down'},
    limit: {type: Number, default: 0, description: 'Limit number of migrations to run'},
    timeout: {type: Number, description: 'Set timeout in seconds'},
    template: {type: String, description: 'Set path to migration template'},
    env: {type: String, description: 'Set environment name (defaults to NODE_ENV or "development" if missing)'},
    coffee: {type: Boolean, description: 'Set klei-migrate to coffee-script mode'},
    one: {alias: 'limit', value: '1'},
    u: {alias: 'up'},
    d: {alias: 'down'},
    l: {alias: 'limit'},
    t: {alias: 'timeout'},
    e: {alias: 'env'},
    h: {alias: 'help'},
    v: {alias: 'version'}
  },
  commands = {
    run: "Run migrations",
    create: "Create a new migration (optional name as [arguments])",
    dry: "List what is able to migrate (according to direction and limit)",
    "post-checkout": "Rewinds migrations from prev. branch and forwards migrations from current branch (use as git post-checkout hook)",
    sync: "Rewind migrations from fromBranch and forward current branch migrations (fromBranch as [arguments])"
  },
  aliases = {
    status: "dry",
    new: "create"
  },
  commandsToFunctions = {
    "post-checkout": "postCheckout"
  };

exports.migrate = migrate;

/**
 * Initializer for the klei-migrate cli
 */
exports.init = function (args) {
  var noptions = getOptionsForNopt(options);
  var parsed = nopt(noptions.full, noptions.short, args, args ? 0 : 2),
      argv = parsed.argv.remain || [];

  try {
    this.command(argv.shift());
  } catch (e) {
    this.help();
    console.error('\n' + e.message.red + '\n');
    process.exit(1);
  }
  this._showVersion = parsed.version;
  this._showHelp = parsed.help || this.command() === 'help';

  migrate.args(argv);

  migrate.limit(parsed.limit);

  migrate.coffee(!!parsed.coffee);

  migrate.env(parsed.env);

  migrate.templatePath(parsed.template);

  migrate.timeout(parsed.timeout * 1000);

  migrate.direction(parsed.up || !parsed.down ? 'up' : 'down');

  return this;
};

/**
 * Set reporter
 *
 * @param {Function} reporter
 */
exports.reporter = function (reporter) {
  this.reporter = reporter(this.migrate);
  return this;
};

/**
 * Execute current klei-migrate command
 */
exports.exec = function (cb) {
  if (this._showVersion) {
    this.version();
    process.exit();
  } else if (this._showHelp) {
    this.help();
    process.exit();
  }

  return migrate[commandsToFunctions[this.command()] || this.command()](cb);
};

/**
 * Print usage/help information
 */
exports.help = function () {
  console.log();
  console.log('Usage: ' + pkg.name + ' <command> [options] [arguments]\n');
  console.log('Where <command> is one of:');
  function getAliases (command) {
    return Object.keys(aliases).filter(function (alias) {
      return aliases[alias] === command;
    });
  }
  Object.keys(commands).forEach(function (command) {
    var description = commands[command];
    console.log(pad('  ' + [command].concat(getAliases(command)).join(', '), 17).green + '  ' + description.grey);
  });
  console.log();
  console.log('Available options:');
  function getShortoptions (option) {
    return Object.keys(options).filter(function (opt) {
      return options[opt].alias === option && typeof options[opt].value === 'undefined';
    });
  }
  Object.keys(options).forEach(function (option) {
    var opt = options[option];
    if (opt.alias) {
      if (typeof opt.value !== 'undefined') {
        console.log(pad('  -' + (option.length > 1 ? '-' : '') + option, 17).green + ('  Alias for: --' + opt.alias + ' ' + opt.value).grey);
      }
      return;
    }
    console.log(pad('  ' + ['--' + option].concat(getShortoptions(option)).join(', -'), 17).green + '  ' + opt.description.grey);
  });
  console.log();
};

/**
 * Print version information
 */
exports.version = function () {
  console.log(pkg.version);
};

/**
 * Getter/Setter for cli command
 *
 * @param {String} newCommand
 * @returns {String|Object}
 */
exports.command = function (newCommand) {
  if (newCommand) {
    if (aliases[newCommand]) {
      newCommand = aliases[newCommand];
    }
    if (!commands[newCommand]) {
      throw new Error('Unknown command: "' + newCommand + '"');
    }
    this._newCommand = newCommand;
    return this;
  }
  return this._newCommand = this._newCommand || 'help';
};

/**
 * Set printer/output handler
 *
 * @param {Function} newPrinter
 */
exports.printer = function (newPrinter) {
  if (newPrinter) {
    this._printer = newPrinter;
    return this;
  }
  return this._printer = this._printer || function () { /* noop */ };
};

/**
 * Log message to printer
 *
 * @param {String} msg
 */
exports.log = function (msg) {
  this.printer()(msg);
  return this;
};

/**
 * Log info messages
 *
 * @param {String} msg
 */
exports.info = function (msg) {
  return this.log(msg.yellow);
};

/**
 * Log debug messages
 *
 * @param {String} msg
 */
exports.debug = function (msg) {
  return this.log(msg.grey);
};

/**
 * Log successful messages
 *
 * @param {String} msg
 */
exports.success = function (msg) {
  return this.log(msg.green);
};

/**
 * Log bad messages
 *
 * @param {String} msg
 */
exports.bad = function (msg) {
  return this.log(msg.red);
};

/**
 * Log errors
 *
 * @param {Error} err
 * @param {String} heading
 */
exports.error = function (err, heading) {
  if (heading) {
    this.log(heading.bold.red);
  }
  if (err instanceof Error) {
    this.log(err.stack.red);
  } else {
    this.log(err.toString().red);
  }
  return this;
};

function getOptionsForNopt () {
  var result = {short: {}, full: {}};
  Object.keys(options).forEach(function (key) {
    if (options[key].alias) {
      result['short'][key] = typeof options[key].value !== 'undefined' ? ['--' + options[key].alias, options[key].value] : '--' + options[key].alias;
    } else {
      result['full'][key] = typeof options[key].default !== 'undefined' ? [options[key].type, options[key].default] : options[key].type;
    }
  });
  return result;
}

function pad (text, length) {
  return text + (new Array(length - text.length)).join(' ');
}
