
var fs = require('klei-fs'),
    join = require('path').join,
    dbFile = join(__dirname, 'db.json');

exports.connect = function (cb) {
  fs.readJson(dbFile, function (err, tables) {
    var db = {
      tables: tables || {},
      save: function (cb) {
        fs.writeFile(dbFile, JSON.stringify(this.tables), 'utf8', function (err) {
          cb(err);
        });
      }
    };
    cb(err, db);
  });
};
