module.exports = function (fileInfo, callback) {
    fileInfo.output[fileInfo.id.replace(/\.json$/, '.js')] = 'G.config(' + fileInfo.content + ')';

    callback(null, fileInfo);
};