#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var program = require('commander');
var mkdirp = require('mkdirp');

var pkg = require('../package.json');
var Builder = require('../lib/build.js');

var cwd = process.cwd();
var builder = new Builder();

if (fs.existsSync(cwd + '/Gbuild.js')) {
    var initFn = require(cwd + '/Gbuild.js');
    initFn(builder);
}

program
    .version(pkg.version);

program
    .command('watch')
    .action(function () {
        builder.watch(function (watcher) {
            console.log('watching...');
            watcher.on('all', function (event, file) {
                console.log('%s : %s', event, file.replace(builder.config.src, ''));
            });
        });
    });

program
    .command('index')
    .action(function () {
        builder.getIndex(function (err, index) {
            if (err) {
                console.log(err);
                return process.exit(1);
            }

            console.log(JSON.stringify(index, null, 4));
        });
    });

program
    .command('build [files]')
    .option('-a, --all', 'build all files')
    .option('-R, --relative', 'also build relative files')
    .option('-r, --report <path>', 'path to write report file')
    .action(function (files, config) {
        var total = 0;
        var current = 0;

        files = files ? files.split(',') : [];

        builder.on('start', function (files) {
            total = files.length;
            console.log('Start building: %d files', files.length);
        });

        builder.on('build', function (file) {
            console.log('[%d / %d] %s', ++current, total, file);
        });

        builder.build(
            files,
            {
                buildAllFiles: config.all,
                buildRelatedFiles: config.relative
            },
            function (err, report) {
                var hasError = err || Object.keys(report.errors).length;
                if (err) {
                    console.log(err.message);
                }

                Object.keys(report.errors).forEach(function (file) {
                    console.log('File :%s', file);
                    console.log(report.errors[file].stack);
                });

                if (config.report) {
                    mkdirp(path.dirname(config.report), function (err) {
                        if (err) {
                            throw err;
                        }
                        fs.writeFile(
                            config.report,
                            JSON.stringify({
                                files: report.files,
                                input: report.input,
                                output: report.output,
                                errors: report.errors
                            }, null, 4)
                        );
                    });
                }

                if (hasError) {
                    process.exit(1);
                }
            }
        );
    });

program.parse(process.argv);