module.exports = function (file, callback) {
    var deps = file.content.replace(/\r/g, '').split('\n');
    file.addDependences(deps);

    file.getDependences()
        .map(function (dep) {
            return dep.read();
        })
        .then(function (contents) {
            file.content = contents.join('\n');
            callback(null, file);
        })
        .caught(callback);
};