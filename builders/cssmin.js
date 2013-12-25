var cssmin = require('cssmin');

module.exports = function (fileInfo, callback) {
    fileInfo.content = cssmin(fileInfo.content);
    callback(null, fileInfo);
};