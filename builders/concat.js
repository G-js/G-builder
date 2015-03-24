var File = require('../lib/file.js');

module.exports = function (file, callback) {
    var deps = file.content.replace(/\r/g, '').split('\n');
    file.deps = file.deps.concat(deps);

    Promise.map(
        deps,
        function (file) {
            file = new File(file);

            return file.read();
        }
    )
        .then(function (contents) {
            file.content = contents.join('\n');

            callback(null, file);
        })
        .caught(callback);
};