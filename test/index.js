var Mocha = require('mocha');
var program = require('commander');
var glob = require('glob');
var Promise = require('bluebird');

var mocha = new Mocha({
    timeout: 30000, // 30 s
    bail: true
});
var specs;

program.parse(process.argv);
specs = program.args;

Promise.attempt(function () {
    if (specs.length) {
        return specs.map(function (spec) {
            return 'spec/' + spec + '.js';
        });
    }

    return new Promise(function (resolve, reject) {
        glob('spec/*.js', {cwd: __dirname, nodir: true}, function (err, list) {
            if (err) {
                reject(err);
            } else {
                resolve(list);
            }
        });
    });
})
    .then(function (specs) {
        specs.forEach(function (spec) {
            mocha.addFile(__dirname + '/' + spec);
        });

        mocha.run(function (err) {
            process.exit(err ? 1 : 0);
        });
    })
    .caught(function (err) {
        console.log(err);
        process.exit(1);
    });