
var spawn = require('child_process').spawn;

exports.checkout = function (branch, file, cb) {
  var checkout = spawn('git', ['checkout', branch, file]);

  checkout.stderr.setEncoding('utf8');
  checkout.stdout.setEncoding('utf8');
  var err = '';
  checkout.stderr.on('data', function (data) {
    err += data;
  });
  checkout.on('close', function (code) {
    if (code !== 0) {
      cb(new Error(err || ('`git checkout ' + branch + ' ' + file + '` failed with exit code: ' + code)));
    } else {
      cb();
    }
  });
};

exports.resetHead = function (file, cb) {
  var resethead = spawn('git', ['reset', 'HEAD', file]);

  resethead.stderr.setEncoding('utf8');
  resethead.stdout.setEncoding('utf8');

  var err = '';
  resethead.stderr.on('data', function (data) {
    console.error('ERROR', data);
    err += data;
  });

  resethead.on('close', function (code) {
    if (code !== 0) {
      cb(new Error(err || ('`git reset HEAD ' + file + '` failed with exit code: ' + code)));
    } else {
      cb();
    }
  });
};

exports.branchFromHash = function (hash, cb) {
  var namerev = spawn('git', ['name-rev', '--name-only', hash]);

  namerev.stderr.setEncoding('utf8');
  namerev.stdout.setEncoding('utf8');

  var err = '',
      name = '';
  namerev.stderr.on('data', function (data) {
    err += data;
  });
  namerev.stdout.on('data', function (data) {
    name += data;
  });

  namerev.on('close', function (code) {
    if (code !== 0) {
      cb(new Error(err || ('`git name-rev --name-only ' + hash + '` failed with exit code: ' + code)));
    } else {
      cb(null, name.trim());
    }
  });
};
