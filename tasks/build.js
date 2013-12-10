var fs = require('fs');
var async = require('async');
var Domain = require('domain');

var Database = require('nedb');
var FileInfoDB = new Database({filename: './data/fileinfo.db', autoload: true});
var AliasDB = new Database({filename: './data/alias.db', autoload: true});

module.exports = function ( grunt ) {
    var src       = grunt.config('src');
    var dest      = grunt.config('dest');
    var taskName  = grunt.option('taskName') || Date.now();
    var builders  = grunt.config.getRaw('builder').map(function (builder) {
        return [builder[0], builder[1](grunt)];
    });

    function getBuilder (filename) {
        var i = 0;
        for (; i < builders.length; i++) {
            if (grunt.file.isMatch(builders[i][0], filename)) {
                return builders[i][1];
            }
        }
    }

    grunt.registerTask('build', function () {
        var done  = this.async();
        var INPUT_FILES = [].slice.call( arguments );

        async.waterfall([getFileList, startBuild], function (err, report) {
            var failCount = Object.keys(report.error).length;

            grunt.file.write('reports/' + report.token, JSON.stringify({
                taskName: report.taskName,
                input: report.input,
                files: report.files,
                output: report.output,
                error: report.error
            }, null, 4));

            if (failCount) {
                grunt.log.writeln('Finish with %d Errors'.red, failCount);
                grunt.log.writeln(JSON.stringify(report.error, null, 4));
                grunt.log.writeln('');
                done(false);
            } else {
                done(true);
            }
        });

        // 整理文件列表
        function getFileList (callback) {
            grunt.log.writeln('Collecting files...');
            if (!INPUT_FILES.length) {
                callback(null, getAllFiles());
            } else {
                getRelatedFiles(
                    INPUT_FILES,
                    function (err, relatedFiles) {
                        var files = INPUT_FILES.concat(relatedFiles);
                        files = files.reduce(
                            function (list, input) {
                                if (grunt.file.isDir(src + input)) {
                                    list = list.concat(
                                        grunt.file
                                            .expand({
                                                filter: function (path) {
                                                    return grunt.file.isFile(path);
                                                }
                                            }, src + input + '/**/*')
                                            .map(function (path) {
                                                return path.replace(src, '');
                                            })
                                        );
                                } else {
                                    list.push(input);
                                }
                                return list;
                            },
                            []
                        );


                        callback(err, files);
                    }
                );
            }
        }

        // 开始编译
        function startBuild (files, callback) {
            grunt.log.writeln('Start Building: %d files', files.length);
            var report = {
                taskName: taskName,
                input: INPUT_FILES.slice(),
                files: files.slice(),
                output: [],
                error: {}
            };

            var totalFileCount = files.length;
            var currentFileCount = 0;

            async.reduce(files, report, function (report, file, next) {
                var domain = Domain.create();
                domain.add(report);
                domain.add(file);
                domain.add(next);

                domain.on('error', function (ex) {
                    report.error[file] = ex.message;
                    grunt.log.writeln('Fatal Error:', file, ex.message);
                    grunt.log.writelns(ex.stack);
                    next(ex, report);
                });

                domain.run(function () {
                    var build = getBuilder(file);

                    grunt.log.writeln('[' + currentFileCount + '/' + totalFileCount + ']Building:', file);
                    build(file, function (buildError, result) {
                        result = result || {};
                        var outputFiles = result.output || [];
                        var children = result.children || [];

                        report.output = report.output.concat(outputFiles);

                        if (buildError) {
                            report.error[file] = buildError;
                            grunt.log.writeln('Build Error:', file, buildError);
                        }

                        FileInfoDB.update({filename: file}, {filename: file, children: children}, {upsert: true}, function (err) {
                            if (err) {
                                return next(err);
                            }

                            async.eachLimit(
                                outputFiles,
                                5,
                                function (output, next) {
                                    FileInfoDB.update(
                                        {filename: output},
                                        {filename: output, mtime: +fs.statSync(dest + output).mtime},
                                        {upsert: true},
                                        function (err) {
                                            next(err);
                                        }
                                    );
                                },
                                function (err) {
                                    if (err) {
                                        return next('Error in update file mtime' + err, report);
                                    }

                                    setImmediate(function () {
                                        currentFileCount ++;
                                        if (buildError && !grunt.option('allow-fail')) {
                                            next(buildError, report);
                                        } else {
                                            next(null, report);
                                        }
                                    });
                                }
                            );
                        });
                    });
                });
            }, function (err, report) {
                callback(err, report);
            });
        }
    });


    function getAllFiles () {
        return grunt.file
            .expand({filter: function (path) {
                return grunt.file.isFile(path);
            }}, src + '**/*')
            .map(function (path) {
                return path.replace(src, '');
            });
    }

    function getRelatedFiles (searchList, callback) {
        var workers = [];
        var ret = [];
        var files = searchList.slice();
        searchList = searchList.slice();

        // 配置发生变化时需要整理别名配置
        if (files.indexOf('config.json')) {
            /**
             *  别名变化规则:
             *   1, 修改: 重新编译包含该别名的合并文件，并更新该别名配置到数据库
             *   2, 增加: 仅存储该别名配置
             *   3, 删除: 重新编译包含该别名的合并文件，并删除数据库该别名配置
             *
             *  整理步骤:
             *   1, 取出所有旧的别名配置
             *   2, 筛选出发生变化或者被删除的别名，如果别名被删除则同时删去数据库中的记录
             *   3, 发生变化或者被删除的别名推进搜索列表
             *   4, 将新的配置更新至数据库
             *   5, 返回
             */

            workers.push(function (workerCallback) {
                var newAlias = grunt.file.readJSON(src + '/config.json').alias;

                AliasDB.find({}, function (err, records) {
                    if (err) {
                        return workerCallback(err);
                    }

                    async.filter(
                        records,
                        function (record, filterCallback) {
                            var isDeleted = !newAlias[record.alias];
                            var isChanged = record.filename !== newAlias[record.alias];
                            var workers = [];

                            if (isDeleted) {
                                workers.push(function (next) {
                                    AliasDB.remove({_id: record._id}, function (err) {
                                        next(err);
                                    });
                                });
                            }

                            async.series(workers, function () {
                                filterCallback(isDeleted || isChanged);
                            });
                        },
                        function (list) {
                            searchList = searchList.concat(list);
                            // 更新所有的配置到数据库
                            async.each(
                                Object.keys(newAlias).map(function (alias) {
                                    return {
                                        alias: alias,
                                        filename: newAlias[alias]
                                    };
                                }),
                                function (map, next) {
                                    AliasDB.update({filename: map.filename}, map, {upsert: true}, next);
                                },
                                function (err) {
                                    workerCallback(err);
                                }
                            );
                        }
                    );
                });
            });
        }

        workers.push(function (workerCallback) {
            async.whilst(
                function () {
                    return !!searchList.length;
                },
                function (callback) {
                    var filename = searchList.shift();

                    FileInfoDB.find({children: filename}, function (err, docs) {
                        if (err) {
                            return callback(err);
                        }
                        docs.forEach(function (doc) {
                            if (searchList.indexOf(doc.filename) === -1 &&
                                files.indexOf(doc.filename) === -1 &&
                                ret.indexOf(doc.filename) === -1
                            ) {
                                ret.push(doc.filename);
                                searchList.push(doc.filename);
                            }
                        });
                        callback(null);
                    });
                },
                function (err) {
                    workerCallback(err);
                }
            );
        });

        async.series(workers, function (err) {
            callback(err, ret);
        });
    }

};