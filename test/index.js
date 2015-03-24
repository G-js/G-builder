var builder = require('./Gbuilder.js');

builder.on('build', function (file) {
    console.log('build', file.id);
});

var a = 'style/susy-2.2.2/susy/output/support/_rem.scss';
var b = 'style/style.scss';

builder.build(function (err, output) {
    if (err) {
        console.error(err.stack || err);
    } else {
        console.log(output);
    }
});