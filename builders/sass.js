var sass = require('node-sass');
var path = require('path');
var fs = require('fs');
module.exports = function (file, callback) {
    var src = file.builder.config.src;

    sass.render({
        file: file.getAbsolutePath(),
        success: function(result) {
            console.log('success', result.css);
            file.content = result.css;
            callback(null, file);
        },
        error: function(error) {
            console.log(error.message);
            callback(error);
        },
        importer: function(url, prev) {
            var id, ret, items, realName;
            var basename = path.basename(url);

            if (url[0] === '!') {
                url = path.resolve(src, url.replace(/^!/, ''));
            } else {
                url = path.resolve(path.dirname(prev), url);
            }

            id = url.replace(file.builder.config.src, '');
            ret = { file: url };
            if (path.extname(url)) {
                file.addDependences([id]);
                return ret;
            }
            console.log('import', url);

            items = fs.readdirSync(path.dirname(url));
            if (
                items.indexOf((realName = '_' + basename + '.scss')) !== -1 ||
                items.indexOf((realName = '_' + basename + '.sass')) !== -1 ||
                items.indexOf((realName = basename + '.scss')) !== -1 ||
                items.indexOf((realName = basename + '.sass')) !== -1 ||
                items.indexOf((realName = basename)) !== -1
            ) {
                file.addDependences(path.dirname(id) + '/' + realName);
                return ret;
            } else {
                throw new Error('file not found', url);
            }
        },
        outputStyle: 'nested'
    });
};