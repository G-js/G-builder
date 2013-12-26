module.exports = function (fileInfo, callback) {
    fileInfo.output['config.js'] = 'G.config(' + fileInfo.content + ')';

    callback(null, fileInfo);
};