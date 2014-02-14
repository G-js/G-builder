var path = require('path');
var fs = require('fs');
var async = require('async');
var _ = require('underscore');

module.exports = function (callback) {
    var config = this.config;
    var fileInfo = this.file;
    var db = this.db;

    var content = JSON.parse(fileInfo.content);
    var now = Date.now() / 1000;
    var expire = config.expire || 86400 * 7; // default to 1 week;
    var line = now - (now % expire);

    fileInfo.deps = content.mergeConfig ?
                    [content.mergeConfig] :
                    (content.mergeConfigs ? content.mergeConfigs : []);

    processConfig(fileInfo.id, function (err, content) {
        if (err) {
            return callback(err);
        }

        content = JSON.stringify(content, null, 4);

        fileInfo.output[fileInfo.id] = content;
        fileInfo.output[fileInfo.id.replace(/\.json$/, '.js')] = 'G.config(' + content + ');';

        callback(null);
    });

    function processConfig (file, callback) {
        var workers = [];

        workers.push(function (next) {
            fs.readFile(config.src + file, function (err, buffer) {
                var content;
                if (err) {
                    return next(err);
                }
                try {
                    content = JSON.parse(buffer.toString());
                } catch (ex) {
                    return next(err);
                }

                next(null, content);
            });
        });


        // process mergeConfig
        workers.push(function (content, next) {
            if (content.mergeConfig) {
                content.mergeConfigs = [content.mergeConfig];
            }

            if (!content.mergeConfigs || !content.mergeConfigs.length) {
                return next(null, content, {});
            }

            async.map(
                content.mergeConfigs,
                processConfig,
                function (err, configs) {
                    var mergeConfigs;

                    if (err) {
                        return next(err);
                    }

                    mergeConfigs = content.mergeConfigs.reduce(function (merged, name, index) {
                        merged[name] = configs[index];
                        return merged;
                    }, {});

                    next(null, content, mergeConfigs);
                }
            );
        });

        // merge configs
        workers.push(function (content, mergeConfigs, next) {
            mergeConfigs = Object.keys(mergeConfigs).reduce(function (merged, file) {
                var config = mergeConfigs[file];

                Object.keys(config).forEach(function (key) {
                    var val = config[key];

                    if (Array.isArray(val)) {
                        merged[key] = val.concat( merged[key] || [] );
                    } else if (typeof val === 'object') {
                        merged[key] = _.extend({}, (merged[key] || {}), config[key]);
                    } else {
                        merged[key] = val;
                    }
                });
                return merged;
            }, content);

            next(null, mergeConfigs);
        });

        // handle file version
        workers.push(function (config, next) {
            db.find(
                {
                    last_update: { $gt: line },
                    filename: {$regex: new RegExp('^' + path.dirname(fileInfo.id))}
                },
                function (err, docs) {
                    if (err) {
                        return next(err);
                    }

                    config.version = docs.reduce(function (version, doc) {
                        version[doc.filename] = doc.last_update;
                        return version;
                    }, {});

                    next(null, config);
                }
            );
        });

        // remove unnecessary property
        workers.push(function (config, next) {
            delete config.build;
            delete config.mergeConfigs;
            delete config.mergeConfig;

            next(null, config);
        });

        async.waterfall(
            workers,
            callback
        );
    }
};

