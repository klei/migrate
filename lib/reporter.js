
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
          migratable.forEach(function (file) {
              console.log('  ' + signs[migrate.direction()].yellow + ' ' + file.grey);
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
      toMigrate = migratable.slice();
    })
    .on('run:migrate:after', function (file) {
      toMigrate.shift();
      console.log('  ' + signs.success.green + ' ' + file.grey);
    })
    .on('run:migrate:fail', function (err, file) {
      toMigrate.shift();
      console.log('  ' + signs.fail.red + ' ' + file.red);
      console.log('    ' + err.toString().red);
      toMigrate.forEach(function (left) {
          console.log(('  - ' + left + ' (skipped)').yellow);
      });
    })
    .on('run:ready', function (migratable) {
      if (!migratable.length) {
        console.log('No migrations found, nothing to do...\n'.green);
        process.exit(0);
      }
    })
    .on('run:success', function () {
      console.log('\nEverything went fine!\n'.green);
      process.exit(0);
    });

  migrate
    .on('error', function (err, heading) {
      console.error('');
      if (heading) {
          console.error(heading.bold.red);
      }
      console.error(err.stack.red);
      console.error('');
      process.exit(1);
    });
};
