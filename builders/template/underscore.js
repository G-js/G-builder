module.exports = function (callback) {
    var fileInfo = this.file;
    var content = fileInfo.content;

    content = content.replace(/"/g, '\\"')
                     .replace(/\n/g, "\\n");

    fileInfo.content = 'var _ = require("underscore"); return _.template("' + content + '")';

    callback(null);
};