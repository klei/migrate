
/**
 * A replacement for the real git command runner (for tests)
 */

var fs = require('klei-fs'),
    path = require('path');

exports.checkout = function (branch, file, cb) {
  fs.readFile(path.join(__dirname, branch, file), 'utf8', function (err, contents) {
    if (err) {
      console.log(err);
      cb(err);
    } else {
      console.log(file);
      fs.writeFile(path.join(__dirname, 'test-migrations', file), contents, 'utf8', function (err) {
        console.log(err);
        cb(err);
      });
    }
  });
};

exports.resetHead = function (file, cb) {
  cb();
};
