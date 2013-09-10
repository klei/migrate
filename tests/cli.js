
var should = require('chai').should(),
    cli = require('../lib/cli'),
    join = require('path').join;

describe('klei-migrate cli', function () {
  describe('init()', function () {
    it('should set limit to 1 if --one is provided', function (done) {
      cli.init(['--one']).migrate.limit().should.equal(1);
      done();
    });

    it('should set limit to the provided --limit or -l', function (done) {
      cli.init(['--limit', '10']).migrate.limit().should.equal(10);
      cli.init(['-l', '5']).migrate.limit().should.equal(5);
      done();
    });

    it('should set env to the provided --env or -e', function (done) {
      cli.init(['--env', 'test']).migrate.env().should.equal('test');
      cli.init(['-e', 'stage']).migrate.env().should.equal('stage');
      done();
    });

    it('should set timeout to the provided --timeout or -t converted from seconds to ms', function (done) {
      cli.init(['--timeout', '10']).migrate.timeout().should.equal(10000);
      cli.init(['-t', '5']).migrate.timeout().should.equal(5000);
      done();
    });

    it('should set direction to "up" if neither --up nor --down is provided', function (done) {
      cli.init([]).migrate.direction().should.equal('up');
      done();
    });

    it('should set direction to "up" if both --up and --down or -u and -d is provided', function (done) {
      cli.init(['--up', '--down']).migrate.direction().should.equal('up');
      cli.init(['-u', '-d']).migrate.direction().should.equal('up');
      done();
    });

    it('should set direction to "down" only if --down or -d and not --up or -u is provided', function (done) {
      cli.init(['--down']).migrate.direction().should.equal('down');
      cli.init(['-d']).migrate.direction().should.equal('down');
      done();
    });

    it('should set migrate.args() to remaining arguments', function (done) {
      cli.init(['create', 'My', 'Super', 'Migration']).migrate.args().should.eql(['My', 'Super', 'Migration']);
      done();
    });

    it('should set templatePath to --template', function (done) {
      cli.migrate.cwd(__dirname);
      cli.init(['create', '--template', 'table1.tpl', 'My', 'Super', 'Migration']).migrate.templatePath().should.equal(join(__dirname, 'table1.tpl'));
      done();
    });
  });

  describe('command()', function () {
    it('should be set by init()', function (done) {
      cli.init(['run']).command().should.equal('run');
      done();
    });

    it('should throw an error for unknown commands', function (done) {
      should.Throw(function () {
        cli.command('unknown-command');
      });
      done();
    });

    it('should be set to the provided command if it exists', function (done) {
      cli.command('run').command().should.equal('run');
      cli.command('dry').command().should.equal('dry');
      cli.command('create').command().should.equal('create');
      cli.command('sync').command().should.equal('sync');
      cli.command('post-checkout').command().should.equal('post-checkout');
      done();
    });

    it('should be set to "create" if the provided command is "new"', function (done) {
      cli.command('new').command().should.equal('create');
      done();
    });

    it('should be set to "dry" if the provided command is "status"', function (done) {
      cli.command('status').command().should.equal('dry');
      done();
    });
  });

  describe('reporter()', function () {
    it('should run the provided reporter with migrate as parameter', function (done) {
      cli.reporter(function (mig) {
        mig.should.equal(cli.migrate);
        done();
      });
    });
  });
});
