var Promise = require('bluebird');

module.exports = function (file, callback) {
    var content = JSON.parse(file.content);
    var deps = content.files;
    var now = parseInt(Date.now() / 1000, 10);
    var expire = content.expire || 604800;
    var defaultVersion = now - (now % expire);

    if (content.defaultVersionSuffix) {
        defaultVersion += ('' + content.defaultVersionSuffix);
    }

    file.addDependences(deps);

    Promise.reduce(
        file.getDependences(),
        function (file) {
            return file.getVersion()
                .then(function (version) {
                    if (now - version < expire) {
                        version[file.id] = version;
                    }

                    return version;
                });
        },
        {}
    )
        .then(function (version) {
            var config = {version: version};

            config.defaultVersion = parseInt(defaultVersion, 10);
            file.content = 'G.config(' + JSON.stringify(config, null, 4) + ');';

            callback(null, file);
        })
        .caught(callback);
};