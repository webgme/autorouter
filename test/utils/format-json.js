'use strict';

var fs = require('fs'),
    path = require('path'),
    files = process.argv.slice(2);
    
console.log('Formatting ' + files.length + ' files');
files.forEach(filename => {
    var content = require(path.resolve(filename)),
        txt;

    try {
        txt = JSON.stringify(content, null, 2);
        fs.writeFile(path.resolve(filename), txt, err => err && console.error(err));
    } catch (e) {
        console.error('Could not stringify ' + filename + ':', e);
    }
});
