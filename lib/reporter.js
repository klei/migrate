
/**
 * klei-migrate standard reporter
 *
 * Output format inspired by [Mocha](http://visionmedia.github.io/mocha/)'s spec reporter
 */

var colors = require('colors');

var signs = {
  success: '✓',
  fail: '✖',
  up: '↑',
  down: '↓'
};

if ('win32' == process.platform) {
  signs.success = '\u221A';
  signs.fail = '\u00D7';
  signs.up = '\u2191';
  signs.down = '\u2193';
}

var toMigrate = [];

module.exports = exports = function (migrate) {

  migrate
    .on('create:init', function () {
      console.log('\nCreating migration\n');
    })
    .on('create:success', function (name, dir) {
      console.log('  ' + signs.success.green + ' ' + name.grey);
      console.log('\nMigration created!\n'.green);
      process.exit(0);
    });

  migrate
    .on('dry:init', function (msg) {
      console.log('\nChecking what is migratable\n');
    })
    .on('dry:success', function (migratable, migrated) {
      if (migratable.length) {
          migratable.forEach(function (item) {
              console.log('  ' + signs[item.direction].yellow + ' ' + item.migration.grey);
          });
          console.log('');
      } else {
          console.log('There is nothing to migrate!\n'.green);
      }
      console.log((Object.keys(migrated).length + ' ').green + 'migrations have been migrated\n'.grey);
      process.exit(0);
    });

  migrate
    .on('run:init', function () {
      console.log('\nRunning migrations ' + signs[migrate.direction()].yellow + '\n');
    })
    .on('run:ready', function (migratable) {
      if (!migratable.length) {
        console.log('No migrations found, nothing to do...\n'.green);
        process.exit(0);
      }
      toMigrate = migratable.slice();
    })
    .on('run:success', function () {
      console.log('\nEverything went fine!\n'.green);
      process.exit(0);
    });

  var inSync = false;
  var syncReady = function (migratable) {
    if (!migratable.length) {
      console.log('Already in sync, nothing to do...\n'.green);
      process.exit(0);
    }
    inSync = true;
    toMigrate = migratable.slice();
  };

  var syncSuccess = function () {
    console.log('\nYour branch is now in sync!\n'.green);
    process.exit(0);
  };

  migrate
    .on('post-checkout:init', function () {
      console.log('\nklei-migrate post-checkout hook\n');
    })
    .on('post-checkout:ready', syncReady)
    .on('post-checkout:success', syncSuccess);

  migrate
    .on('sync:init', function () {
      console.log('\nSyncing migrations with branch: ' + migrate.args()[0].yellow + '\n');
    })
    .on('sync:ready', syncReady)
    .on('sync:success', syncSuccess);

  migrate
    .on('migrate:before', function () {
      toMigrate.shift();
    })
    .on('migrate:success', function (item) {
      console.log('  ' + signs.success.green + ' ' + (inSync ? signs[item.direction].yellow + ' ' : '') + item.migration.grey);
    })
    .on('migrate:fail', function (err, item) {
      console.log('  ' + signs.fail.red + ' ' + (inSync ? signs[item.direction].red + ' ' : '') + item.migration.red);
      console.log('    ' + err.toString().red);
      toMigrate.forEach(function (left) {
          console.log(('  - ' + (inSync ? signs[item.direction].yellow + ' ' : '') + left.migration + ' (skipped)').yellow);
      });
    });

  var errorHandler = function (err, heading) {
    console.error('');
    if (heading) {
        console.error(heading.bold.red);
    }
    console.error(err.stack.red);
    console.error('');
    process.exit(1);
  };

  migrate.on('error', errorHandler);

  process.on('uncaughtException', errorHandler);
};
