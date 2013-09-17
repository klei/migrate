klei-migrate changelog
========================

## v.0.4

### Hotfix v.0.4.1

* FIX: also setting process.env.NODE_ENV when setting environment

### Release v.0.4.0

* Adding `sync` and `post-checkout` commands for handling branching and migrations

## v.0.3

### Hotfix v.0.3.2

* FIX: fixing bad (Windows) line endings in `klei-migrate` binary

### Hotfix v.0.3.1

* FIX: forgot to bump package version on last release

### Release v.0.3.0

* Makes migration history environment dependent (i.e. your test-db can be at another version than your dev-db)

## v.0.2

### Release v.0.2.0

* Rebuilt from the ground up with unit tests
* `klei-migrate` can now be used as a module
* Improved cli with usage help, colors and many options
* Using events to extract presentation from the `migrate` module

## v.0.1

### Hotfix v.0.1.1

* FIX: adding forgotten `bin` section of `package.json`

### Release v.0.1.0

* First draft version with a dead simple cli
