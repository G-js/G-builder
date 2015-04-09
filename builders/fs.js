exports.read = function (file, callback) {
    file.read().nodeify(callback);
};

exports.copy = function (file, callback) {
    file.copy().nodeify(callback);
};

exports.write = function (config) {
    return function (file, callback) {
        file.write(config).nodeify(callback);
    };
};