'use strict';
var express = require('express'),
    path = require('path'),
    app = new express();

app.use('/test-cases', express.static(path.join(__dirname, '..', 'test-cases')));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '..', 'build')));

var fs = require('fs');
app.get('/test-cases/all', function(req, res) {
    var cases = fs.readdir(path.join(__dirname, '..', 'test-cases'), function(err, list) {
        if (err) {
            console.error('Could not read test case dir:', err);
            return res.serverError(err);
        }
        list = list.filter(test => test.indexOf('.') !== 0);

        res.json(list);
    });
});

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.listen('3000');

console.log('Navigate to http://localhost:3000 in a browser to view the test cases');
