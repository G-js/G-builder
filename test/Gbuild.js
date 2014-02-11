var path = require('path');

module.exports = function (Gbuilder) {
    var config = require('./config');

    config.src = path.resolve(__dirname, config.src) + path.sep;
    config.dest = path.resolve(__dirname, config.dest) + path.sep;

    Gbuilder.config = config;

    Gbuilder.registerBuilder('**/config.json')
            .src()
            .pipe(Gbuilder.builder.config)
            .dest();

    Gbuilder.registerBuilder('**/*.less')
            .src()
            .pipe(Gbuilder.builder.less)
            .pipe(Gbuilder.builder.css)
            .dest();

    Gbuilder.registerBuilder('**/*.cmb.js')
            .src()
            .pipe(Gbuilder.builder.amd.combine)
            .dest();

    Gbuilder.registerBuilder('**/*.cmb.css')
            .src()
            .pipe(Gbuilder.builder.css.combine)
            .dest();

    Gbuilder.registerBuilder('**/*.js')
            .src()
            .pipe(Gbuilder.builder.jshint)
            .pipe(Gbuilder.builder.amd)
            .conditionPipe(Gbuilder.config.minify, Gbuilder.builder.uglify)
            .dest();

    Gbuilder.registerBuilder('**/*.css')
            .src()
            .pipe(Gbuilder.builder.css)
            .conditionPipe(Gbuilder.config.minify, Gbuilder.builder.css.minify)
            .dest();

    Gbuilder.registerDefaultBuilder()
            .pipe(Gbuilder.builder.fs.copy);
};