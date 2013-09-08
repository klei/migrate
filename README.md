klei-migrate
==================

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

**Arguments:**

* `name` - Any given extra parameters is used to limit the migrations to run by name
  * If combined with `--one` only the migration with the given name is run, even though it's not the next in line

## Stored migration progress

Which migrations that has been run is stored in `migrations/.migrated.json`, so be sure to add it to your `.gitignore`.
