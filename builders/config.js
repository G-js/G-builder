module.exports = function (fileInfo, callback) {
    var config = this.config;
    var content = JSON.parse(fileInfo.content);
    var now = Date.now();
    var expire = config.expire || 86400 * 7 * 1000; // default to 1 week;
    var line = now - (now % expire);

    this.db.find({last_update: {$gt: line}, filename: {$regex: /\.(js|css)$/}}, function (err, docs) {
        if (err) {
            return callback(err);
        }
        content.version = {};
        docs.forEach(function (doc) {
            content.version[doc.filename] = parseInt(doc.last_update / 1000);
        });

        fileInfo.output[fileInfo.id] = JSON.stringify(content);
        fileInfo.output[fileInfo.id.replace(/\.json$/, '.js')] = 'G.config(' + JSON.stringify(content) + ')';

        callback(null, fileInfo);
    });
};