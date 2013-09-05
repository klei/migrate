klei-migrate
==================

```bash
$ npm install -g klei-migrate
```

## Commands

### New migration:

```bash
$ klei-migrate new Your Migration Name
```

Generates a migration file with name: `<Unix Timestamp>_Your_Migration_Name.js` in `migrations/`.
If no name is provided, like so:

```bash
$ klei-migrate new
```

The generated name will be: `<Unix Timestamp>_migration.js`.

### Run migrations:

```bash
$ klei-migrate run    # runs everything that isn't migrated yet
```

Available params:

* `--up` - If provided forces an up migration (default)
* `--down` - If provided forces a down migration (currently all migrations is migrated down)
* `--status` - Show what is going to be migrated (up or down depending on above flags)

## Stored migration progress

Which migrations that has been run is stored in `migrations/.migrated.json`, so be sure to add it to your `.gitignore`.

**WIP**
