klei-migrate
==================

## Features

* Database independent migrations
* Can be used:
   * programatically as a local node module
   * from command line
   * as a gruntplugin with [grunt-klei-migrate](https://github.com/klei-dev/grunt-klei-migrate) for [Grunt](http://gruntjs.com/)
* Handling different migration versions in different branches with:
   * automatic migration synchronization when used as a post-checkout hook for git
* Environment dependent migration history
   * e.g. have a separate test database with its own migration history
* Write migrations in coffee-script
   * N.B. klei-migrate does not depend on coffee-script itself, your project must have the module installed for it to work

## Installation

To use from command line:

```bash
$ npm install -g klei-migrate
```

To use as a module from within your project:

```bash
$ npm install klei-migrate
```

And then:

```javascript
var migrate = require('klei-migrate');
```

## Commands

### `new` or `create` - Create a new migration file

```bash
$ klei-migrate new [options] Your Migration Name

# or

$ klei-migrate create ...
```

Generates a migration file with name: `<Unix Timestamp>_Your_Migration_Name.js` in `migrations/`.

If no name is provided, like so:

```bash
$ klei-migrate new
```

The generated name will be: `<Unix Timestamp>_migration.js`.

**Options:**

* `--template` - Can be used to set path to the template to use when creating the migration
* `--coffee` - If set the migration file created will have `.coffee` extension instead of `.js`

### `dry` or `status` - Show what is possible to migrate

Shows a list of possible migrations to run.

```bash
$ klei-migrate dry [options] [arguments]
```

**Options:**

* `--up` or `-u` - If provided forces an up migration (default)
* `--down` or `-d` - If provided forces an down migration
* `--limit` or `-l` - Limits number of migrations to run to given number
* `--one` - The same as `--limit 1`
* `--env` or `-e` - Set environment name
* `--coffee` - Activate coffee-script mode

**Arguments:**

* `name` - Any given extra parameters is used to limit the migration list by name
  * If combined with `--one` the migration list is limited to only the provided name, even though it's not the next in line to be run

### `run` - Run migrations

Runs all migrations, according to provided options, and stops when everything is done or when a migration has failed.

```bash
$ klei-migrate run [options] [arguments]
```

**Options:**

* `--up` or `-u` - If provided forces an up migration (default)
* `--down` or `-d` - If provided forces an down migration
* `--limit` or `-l` - Limits number of migrations to run to given number
* `--one` - The same as `--limit 1`
* `--timeout` or `-t` - Limit migration execution timeout (per migration) to given number in seconds
* `--env` or `-e` - Set environment name
* `--coffee` - Makes klei-migrate look for migration files with `.coffee` extension instead of `.js`

**Arguments:**

* `name` - Any given extra parameters is used to limit the migrations to run by name
  * If combined with `--one` only the migration with the given name is run, even though it's not the next in line

### `sync` - Manual sync after switching branch

Reverts all migrations from provided branch that does not exist in current branch,
and migrates all unmigrated migrations in current branch *(used internally for `post-checkout` command, see below)*.

```bash
$ klei-migrate sync [arguments]
```

**Options:**

* `--timeout` or `-t` - Limit migration execution timeout (per migration) to given number in seconds
* `--env` or `-e` - Set environment name
* `--coffee` - Run coffee-script migrations

**Arguments:**

* `fromBranch` - The branch where `klei-migrate` should look for migrations to migrate down

### `post-checkout` - Automatic sync after switching branch (if used as git hook)

**How to use as a git checkout hook:**

Create a file `.git/hooks/post-checkout` with the following contents:

If `klei-migrate` is installed globally:

```bash
#!/usr/bin/env sh
klei-migrate post-checkout "$@"
```

If installed as a local module:

```bash
#!/usr/bin/env sh
node_modules/.bin/klei-migrate post-checkout "$@"
```

Reverts all migrations from provided branch that does not exist in current branch,
and migrates all unmigrated migrations in current branch *(used internally for `post-checkout` command, see below)*.

```bash
$ klei-migrate post-checkout [arguments]
```

**Options:**

* `--timeout` or `-t` - Limit migration execution timeout (per migration) to given number in seconds
* `--env` or `-e` - Set environment name
* `--coffee` - Run coffee-script migrations

**Arguments:**

* `fromRef` - *Set by git* The git hash for the branch where `klei-migrate` should look for migrations to migrate down
* `toRef` - *Set by git* The current branch git hash
* `flag` - *Set by git* Is set to `1` for a branch checkout and `0` on a file checkout

## Stored migration progress/history

Which migrations that has been run is stored in `migrations/.migrated.json`, so be sure to add it to your `.gitignore`.

The `.migrated.json` file takes the current environment name into account, so that you can have e.g. a separate test database with its own migration history.
