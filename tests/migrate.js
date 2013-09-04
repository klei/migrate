
var should = require('chai').should(),
    fs = require('klei-fs'),
    join = require('path').join,
    migrate = null;

function loadMigrate (cb) {
  var cacheName = require.resolve('../.');
  cacheName && delete require.cache[cacheName];
  cacheName = require.resolve('../lib/migrate');
  cacheName && delete require.cache[cacheName];
  migrate = require('../.');
  cb && cb();
}

function removeMigrations (cb) {
  var dir = join(__dirname, 'migrations');
  fs.readdir(dir, function (err, files) {
    if (err) {
      cb();
    } else {
      files.forEach(function (file, i) {
        fs.unlink(join(dir, file), function (err) {
          if (err) {
            cb(err);
          } else if (i === files.length - 1) {
            fs.rmdir(dir, function (err) {
              cb(err);
            });
          }
        });
      });
    }
  });
}

describe('klei-migrate', function () {
  describe('as a module', function () {
    it('should be requireable', function (done) {
      should.not.Throw(loadMigrate);
      done();
    });
  });

  describe('cwd()', function () {
    beforeEach(loadMigrate);

    it('should use process.cwd() by default', function (done) {
      migrate.cwd().should.equal(process.cwd());
      done();
    });

    it('should act as both a getter and a setter (chainable)', function (done) {
      migrate.cwd('tests').cwd().should.equal('tests');
      done();
    });
  });

  describe('template()', function () {
    beforeEach(loadMigrate);

    beforeEach(function (done) {
      migrate.cwd(__dirname);
      done();
    });

    it('should get the current template', function (done) {
      migrate.template(function (err, template) {
        should.not.exist(err);
        fs.readFile(join(__dirname, '..', 'assets', 'migration.tpl.js'), 'utf8', function (err, content) {
          should.not.exist(err);
          template.should.equal(content);
          done();
        });
      });
    });

    it('should throw an error when path is provided but no callback', function (done) {
      should.Throw(function () {
        migrate.template('test');
      });
      done();
    });

    it('should throw an error when no arguments is provided', function (done) {
      should.Throw(function () {
        migrate.template();
      });
      done();
    });

    it('should be able to set a new template', function (done) {
      migrate.template('test.tpl.js', function (err, template) {
        should.not.exist(err);
        template.should.equal('/* test-template */\n');
        done();
      });
    });

    it('should give an error when trying to set a non-existing template', function (done) {
      migrate.template('myNonExistingTemplate.tpl.js', function (err, template) {
        should.exist(err);
        should.not.exist(template);
        done();
      });
    });
  });

  describe('create()', function () {
    beforeEach(loadMigrate);

    beforeEach(function (done) {
      migrate.cwd(__dirname);
      done();
    });

    afterEach(removeMigrations);

    describe('without arguments', function () {
      it('should create <cwd>/migrations/<timestamp>_migration.js', function (done) {
        migrate.create(function (err, name) {
          should.not.exist(err);
          name.should.match(/^[0-9]{13}_migration.js$/);
          fs.exists(join(__dirname, 'migrations', name), function (exists) {
            exists.should.be.true;
            done();
          });
        });
      });
    });

    describe('with arguments', function () {
      it('should create <cwd>/migrations/<timestamp>_<argument_snake_cased>.js', function (done) {
        migrate.create('My Super Migration', function (err, name) {
          should.not.exist(err);
          name.should.match(/^[0-9]{13}_My_Super_Migration.js$/);
          fs.exists(join(__dirname, 'migrations', name), function (exists) {
            exists.should.be.true;
            done();
          });
        });
      });
    });
  });

  describe('direction()', function () {
    beforeEach(loadMigrate);

    it('should default to "up"', function (done) {
      migrate.direction().should.equal('up');
      done();
    });

    it('should be able to set direction to "up"', function (done) {
      migrate.direction('up').direction().should.equal('up');
      done();
    });

    it('should be able to set direction to "down"', function (done) {
      migrate.direction('down').direction().should.equal('down');
      done();
    });

    it('should throw error for unknown direction', function (done) {
      should.Throw(function () {
        migrate.direction('sideways');
      });
      done();
    });
  });

  describe('limit()', function () {
    beforeEach(loadMigrate);

    it('should default to 0', function (done) {
      migrate.limit().should.equal(0);
      done();
    });

    it('should be able to set direction to a integer', function (done) {
      migrate.limit(4).limit().should.equal(4);
      done();
    });

    it('should floor decimal numbers to integers', function (done) {
      migrate.limit(4.34).limit().should.equal(4);
      done();
    });

    it('should set limit to 0 if given something else than a number or a negative number', function (done) {
      migrate.limit('lorem ipsum').limit().should.equal(0);
      migrate.limit({}).limit().should.equal(0);
      migrate.limit([]).limit().should.equal(0);
      migrate.limit(-12).limit().should.equal(0);
      done();
    });
  });

  describe('dry()', function () {
    beforeEach(loadMigrate);

    beforeEach(function (done) {
      migrate.cwd(__dirname);
      done();
    });

    afterEach(removeMigrations);

    it('should give an empty array when there is nothing to migrate', function (done) {
      migrate.dry(function (toMigrate) {
        toMigrate.should.be.empty;
        done();
      });
    });

    it('should give an array with what to migrate up by default', function (done) {
      migrate.create(function (err, name1) {
        migrate.create(function (err, name2) {
          migrate.dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(2);
            toMigrate[0].should.equal(name1);
            toMigrate[1].should.equal(name2);
            done();
          });
        });
      });
    });

    it('should only give the next migration when limited and given no name', function (done) {
      migrate.create(function (err, name1) {
        migrate.create(function (err, name2) {
          migrate.limit(1).dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(1);
            toMigrate[0].should.equal(name1);
            done();
          });
        });
      });
    });

    it('should only give one migration with given name when limited and migratable', function (done) {
      migrate.create(function (err, name1) {
        migrate.create(function (err, name2) {
          migrate.limit(1).dry(name2, function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(1);
            toMigrate[0].should.equal(name2);
            done();
          });
        });
      });
    });

    it('should give an empty array when given non-migratable name and limited', function (done) {
      migrate.create(function (err, name1) {
        migrate.create(function (err, name2) {
          migrate.limit(1).dry('lorem-ipsum', function (toMigrate) {
            toMigrate.should.be.empty;
            done();
          });
        });
      });
    });

    it('should give an array with what to migrate up for given migration name', function (done) {
      migrate.create(function (err, name1) {
        migrate.create(function (err, name2) {
          migrate.dry(name1, function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(1);
            toMigrate[0].should.equal(name1);
            done();
          });
        });
      });
    });

    it('should give an empty array for "down" direction when nothing has been migrated', function (done) {
      migrate.create(function (err, name) {
        migrate.direction('down').dry(function (toMigrate) {
          toMigrate.should.be.empty;
          done();
        });
      });
    });
  });
});
