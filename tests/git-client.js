
/**
 * A replacement for the real git command runner (for tests)
 */

var fs = require('klei-fs'),
    path = require('path');

exports.checkout = function (branch, file, cb) {
  fs.readFile(path.join(__dirname, branch, file), 'utf8', function (err, contents) {
    if (err) {
      cb(err);
    } else {
      fs.writeFile(path.join(__dirname, 'test-migrations', file), contents, 'utf8', function (err) {
        cb(err);
      });
    }
  });
};

exports.resetHead = function (file, cb) {
  cb();
};
