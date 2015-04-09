var fs = require('fs');

var cwd = process.cwd();
var builder;

if (fs.existsSync(cwd + '/Gbuilder.js')) {
    builder = require(cwd + '/Gbuilder.js');
} else {
    throw new Error('Gbuilder.js not found');
}

module.exports = function (grunt) {
    grunt.registerTask('build', function () {
        var done  = this.async();
        var input = [].slice.call(arguments);
        var last;
        var now = Date.now();
        builder.on('build', function (file) {
            last = file.id;
            grunt.log.write('.'.green);
        });

        builder.build(input)
            .then(function (report) {
                grunt.log.writeln('\n%d files, %d ms', report.output.length, Date.now() - now);
                done();
            })
            .caught(function (err) {
                grunt.log.error('ERROR'.red, last);

                if (Array.isArray(err)) {
                    err.forEach(function (err) {
                        grunt.log.error('Line: %d\t%s (%s)', err.line, err.reason || err.message, err.code);
                    });
                } else {
                    grunt.log.errorlns(err.stack || err.message || err);
                }

                done(false);
            });
    });
};