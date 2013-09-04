
var database = require('../json-db');

exports.up = function (next) {
  database.connect(function (err, db) {
    if (err) {
      next(err);
      return;
    }
    db.tables.table1 = [
      {id: 1, prop: 'val1'},
      {id: 2, prop: 'val2'},
      {id: 3, prop: 'val3'}
    ];
    db.save(next);
  });
};

exports.down = function (next) {
  database.connect(function (err, db) {
    if (err) {
      next(err);
      return;
    }
    delete db.tables.table1;
  });
};
