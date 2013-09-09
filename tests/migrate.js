
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

function removeMigrations (dir, cb) {
  if (typeof dir === 'function') {
    cb = dir;
    dir = 'migrations';
  }
  dir = join(__dirname, dir);
  fs.readdir(dir, function (err, files) {
    if (err) {
      cb();
    } else {
      var removed = 0;
      files.forEach(function (file, i) {
        fs.unlink(join(dir, file), function (err) {
          if (err) {
            cb(err);
          } else if (++removed === files.length) {
            fs.rmdir(dir, function (err) {
              cb(err);
            });
          }
        });
      });
    }
  });
}

function resetJsonDb (cb) {
  fs.writeFile(join(__dirname, 'db.json'), '{}', 'utf8', function (err) {
    cb(err);
  });
}

describe('klei-migrate module', function () {
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

  describe('env()', function () {
    beforeEach(loadMigrate);

    it('should use process.env.NODE_ENV by default', function (done) {
      process.env.NODE_ENV = 'test';
      migrate.env().should.equal('test');
      done();
    });

    it('should be set to "development" when NODE_ENV is missing', function (done) {
      delete process.env.NODE_ENV;
      migrate.env().should.equal('development');
      done();
    });

    it('should act as both a getter and a setter (chainable)', function (done) {
      migrate.env('test').env().should.equal('test');
      done();
    });
  });

  describe('templatePath', function () {
    beforeEach(loadMigrate);

    beforeEach(function (done) {
      migrate.cwd(__dirname);
      done();
    });

    it('should use <klei-migrate-path>/assets/migration.tpl.js by default', function (done) {
      migrate.templatePath().should.equal(join(__dirname, '..', 'assets', 'migration.tpl.js'));
      done();
    });

    it('should set template path resolved from cwd', function (done) {
      migrate.templatePath('table1.tpl').templatePath().should.equal(join(__dirname, 'table1.tpl'));
      done();
    });
  });

  describe('template()', function () {
    beforeEach(loadMigrate);

    beforeEach(function (done) {
      migrate.cwd(__dirname);
      done();
    });

    it('should get the template from current template path', function (done) {
      migrate.template(function (err, template) {
        should.not.exist(err);
        fs.readFile(join(__dirname, '..', 'assets', 'migration.tpl.js'), 'utf8', function (err, content) {
          should.not.exist(err);
          template.should.equal(content);
          done();
        });
      });
    });

    it('should throw an error when no arguments is provided', function (done) {
      should.Throw(function () {
        migrate.template();
      });
      done();
    });

    it('should be able to set a new template', function (done) {
      migrate.templatePath('test.tpl').template(function (err, template) {
        should.not.exist(err);
        template.trim().should.equal('/* test-template */');
        done();
      });
    });

    it('should give an error when trying to set a non-existing template', function (done) {
      migrate.templatePath('myNonExistingTemplate.tpl').template(function (err, template) {
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

    after(function (done) {
      var removed = 0;
      var countDone = function (err) {
        if (++removed === 2) {
          done();
        }
      };
      removeMigrations('migs', countDone);
      removeMigrations('migrations', countDone);
    });

    describe('without arguments', function () {
      it('should create <cwd>/<directory>/<timestamp>_migration.js', function (done) {
        migrate.directory('migs').create(function (err, name) {
          should.not.exist(err);
          name.should.match(/^[0-9]{13}_migration.js$/);
          fs.exists(join(__dirname, 'migs', name), function (exists) {
            exists.should.be.true;
            done();
          });
        });
      });
    });

    describe('with arguments', function () {
      it('should create <cwd>/<directory>/<timestamp>_<argument_snake_cased>.js', function (done) {
        migrate.args(['My', 'Super', 'Migration']).create(function (err, name) {
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

  describe('directory()', function () {
    beforeEach(loadMigrate);

    it('should default to "<cwd>/migrations"', function (done) {
      migrate.cwd(__dirname).directory().should.equal(join(__dirname, 'migrations'));
      done();
    });

    it('should set directory in relation to cwd()', function (done) {
      migrate.cwd(__dirname).directory('whatever').directory().should.equal(join(__dirname, 'whatever'));
      done();
    });

    it('should throw error for a non string value', function (done) {
      should.Throw(function () {
        migrate.directory(['bad']);
      });
      should.Throw(function () {
        migrate.directory(1212323);
      });
      should.Throw(function () {
        migrate.directory({name: 'test'});
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

    it('should be able to set limit to a integer', function (done) {
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

  describe('timeout()', function () {
    beforeEach(loadMigrate);

    it('should default to 30000', function (done) {
      migrate.timeout().should.equal(30000);
      done();
    });

    it('should be able to set timeout to a integer', function (done) {
      migrate.timeout(432).timeout().should.equal(432);
      done();
    });

    it('should floor decimal numbers to integers', function (done) {
      migrate.timeout(1234.34).timeout().should.equal(1234);
      done();
    });

    it('should set timeout to 30000 if given something else than a number or a negative number', function (done) {
      migrate.timeout('lorem ipsum').timeout().should.equal(30000);
      migrate.timeout({}).timeout().should.equal(30000);
      migrate.timeout([]).timeout().should.equal(30000);
      migrate.timeout(-12).timeout().should.equal(30000);
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

    it('should take env into account when checking what to migrate', function (done) {
      migrate.create(function (err, name) {
        should.not.exist(err);
        migrate.run(function (err, migrated) {
          should.not.exist(err);
          migrated.length.should.equal(1);
          migrated[0].should.equal(name);
          migrate.env('test').dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(1);
            toMigrate[0].should.equal(name);
            done();
          });
        });
      });
    });

    it('should give an array with what to migrate up by default', function (done) {
      migrate.create(function (err, name1) {
        should.not.exist(err);
        setTimeout(function () {
        migrate.create(function (err, name2) {
          should.not.exist(err);
          migrate.dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(2);
            toMigrate[0].should.equal(name1);
            toMigrate[1].should.equal(name2);
            done();
          });
        });
        }, 1); // Avoid creating two migrations at the same ms (the test randomly fails otherwise)
      });
    });

    it('should only give the next migration when limited to one and given no name', function (done) {
      migrate.create(function (err, name1) {
        should.not.exist(err);
        setTimeout(function () {
        migrate.create(function (err, name2) {
            should.not.exist(err);
          migrate.limit(1).dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(1);
            toMigrate[0].should.equal(name1);
            done();
          });
        });
        }, 1); // Avoid creating two migrations at the same ms (the test randomly fails otherwise)
      });
    });

    it('should only give the next two migrations when limited to two and given no name', function (done) {
      migrate.create(function (err, name1) {
        should.not.exist(err);
        setTimeout(function () {
        migrate.create(function (err, name2) {
            should.not.exist(err);
          migrate.limit(2).dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(2);
            toMigrate[0].should.equal(name1);
            toMigrate[1].should.equal(name2);
            done();
          });
        });
        }, 1); // Avoid creating two migrations at the same ms (the test randomly fails otherwise)
      });
    });

    it('should only give one migration with given name when limited and migratable', function (done) {
      migrate.create(function (err, name1) {
        should.not.exist(err);
        setTimeout(function () {
        migrate.create(function (err, name2) {
            should.not.exist(err);
          migrate.limit(1).args([name2]).dry(function (toMigrate) {
            toMigrate.should.not.be.empty;
            toMigrate.length.should.equal(1);
            toMigrate[0].should.equal(name2);
            done();
          });
        });
        }, 1); // Avoid creating two migrations at the same ms (the test randomly fails otherwise)
      });
    });

    it('should give an empty array when given non-migratable name and limited', function (done) {
      migrate.create(function (err, name1) {
        should.not.exist(err);
        setTimeout(function () {
        migrate.create(function (err, name2) {
            should.not.exist(err);
          migrate.limit(1).args(['lorem-ipsum']).dry(function (toMigrate) {
            toMigrate.should.be.empty;
            done();
          });
        });
        }, 1); // Avoid creating two migrations at the same ms (the test randomly fails otherwise)
      });
    });

    it('should give an array with what to migrate up for given migration name', function (done) {
      migrate.create(function (err, name1) {
        migrate.create(function (err, name2) {
          migrate.args([name1]).dry(function (toMigrate) {
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

  describe('run()', function () {
    beforeEach(loadMigrate);

    beforeEach(function (done) {
      migrate.cwd(__dirname);
      done();
    });

    afterEach(removeMigrations);

    afterEach(resetJsonDb);

    it('should migrate existing migrations', function (done) {
      migrate.templatePath('table1.tpl').args(['Add table1']).create(function (err, name) {
        should.not.exist(err);
        migrate.run(function (err, migrated) {
          should.not.exist(err);
          migrated.should.not.be.empty;
          migrated[0].should.equal(name);
          fs.readJson(join(__dirname, 'db.json'), function (err, db) {
            should.not.exist(err);
            db.table1.length.should.equal(3);
            done();
          });
        });
      });
    });

    it('should be able to migrate a migration by name', function (done) {
      migrate.templatePath('table1.tpl').args(['Add table1']).create(function (err, name) {
        should.not.exist(err);
        migrate.limit(1).args([name]).run(function (err) {
          should.not.exist(err);
          fs.readJson(join(__dirname, 'db.json'), function (err, db) {
            should.not.exist(err);
            db.table1.length.should.equal(3);
            done();
          });
        });
      });
    });

    it('should not migrate anything if given a non-existing name with limit', function (done) {
      migrate.templatePath('table1.tpl').args(['Add table1']).create(function (err, name) {
        should.not.exist(err);
        migrate.limit(1).args(['1313131313122_My_Non_Existing_Migration_Name.js']).run(function (err) {
          should.not.exist(err);
          fs.readJson(join(__dirname, 'db.json'), function (err, db) {
            should.not.exist(err);
            should.not.exist(db.table1);
            done();
          });
        });
      });
    });

    it('should be able to rollback (i.e. migrate down) migrated migrations', function (done) {
      migrate.templatePath('table1.tpl').args(['Add table1']).create(function (err, name) {
        should.not.exist(err);
        migrate.args([]);
        migrate.run(function (err) {
          should.not.exist(err);
          migrate.direction('down').run(function (err, migrated) {
            should.not.exist(err);
            fs.readJson(join(__dirname, 'db.json'), function (err, db) {
              should.not.exist(err);
              should.not.exist(db.table1);
              done();
            });
          });
        });
      });
    });

    it('should give an error if the migration exceeds set time limit', function (done) {
      migrate.templatePath('timeout.tpl').args(['Take time']).create(function (err, name) {
        should.not.exist(err);
        migrate.timeout(30).run(function (err) {
          should.exist(err);
          err.message.should.equal('Timeout of 30 ms exceeded for migration: "' + name + '"');
          done();
        });
      });
    });
  });
});
