// jshint esnext: true
'use strict';

var Converter = require('./api-conversions'),
    files = process.argv.slice(2),
    fs = require('fs');

if (!files.length) {
    console.error('Usage: node api-updater.js FILES');
    process.exit(1);
}

console.log('converting:\n' + files.join('\n'));
files.map(file => [file, JSON.parse(fs.readFileSync('./'+file, 'utf8'))])
    .map(info => {  /* [filename, actions] */
        let actions = info[1],
            converter = new Converter();

        console.log(`Updating ${info[0]}`);
        info[1] = actions
            .map(action => converter.convert(action))
            .reduce((prev, curr) => prev.concat(curr));  // flatten

        return info;
    })
    .forEach(info => {
        let filename = info[0];

        console.log('INFO: '+JSON.stringify(info[1]));
        console.log('about to write to "' + filename + '"');
        fs.writeFileSync(filename, JSON.stringify(info[1], null, 2));
        console.log('Updated ' + filename);
    });
