var Builder = require('../../lib/build');

module.exports = function (grunt) {
    grunt.registerTask('build', function () {
        var done  = this.async();
        var config = grunt.config();
        var builder = new Builder(config);
        var input = [].slice.call(arguments);
        var current = 1;
        var token = grunt.option('token') || Date.now();
        var total;

        config.builder.forEach(function (setting) {
            var stream = builder.registerBuilder(setting[0]);

            setting[1].forEach(function (fn) {
                fn = fn.split('#');

                fn = fn[1] ? builder.builder[fn[0]][fn[1]] : builder.builder[fn[0]];

                stream.pipe(fn);
            });
        });

        builder.on('build', function (file) {
            grunt.log.write('Build:[%d/%d]: %s', current, total, file);
        });

        builder.on('error', function () {
            grunt.log.writeln(' ERR'.red);
        });

        builder.on('success', function () {
            current++;
            grunt.log.writeln(' √'.green);
        });

        builder.on('start', function (files) {
            total = files.length;
            grunt.log.writeln('Start Build: [%d] files...', total);
        });

        builder.build(input, {buildAllFiles: !input.length, buildRelatedFiles: !!input.length}, function (err, report) {
            if (report) {
                grunt.file.write('reports/' + token, JSON.stringify({
                    input: report.input,
                    files: report.files,
                    output: report.output,
                    errors: report.errors
                }, null, 4));

                if (Object.keys(report.errors).length) {
                    Object.keys(report.errors).forEach(function (file) {
                        grunt.log.writeln(file);
                        grunt.log.writelns(report.errors[file]);
                    });
                    done(false);
                } else {
                    done(true);
                }
            } else {
                grunt.log.error(err);
                done(false);
            }
        });

    });
};