
var database = require('../json-db');

exports.up = function (next) {
  database.connect(function (err, db) {
    // Don't call next...
  });
};

exports.down = function (next) {
  database.connect(function (err, db) {
    next();
  });
};
