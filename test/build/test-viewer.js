(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.TestViewer = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*globals AutoRouterReplayer*/
(function(global) {
'use strict';

var TestViewer = function(container) {
    this.container = container;
};

TestViewer.prototype.render = function(actions) {
    var replayer = new AutoRouterReplayer();
    replayer.useWebWorker(false);
    try {
        replayer.test(actions);
    } catch (e) {
        console.error('Action replay failed:', e);
    }
    this._render(replayer.autorouter.graph);
};

TestViewer.prototype._render = function(graph) {
    console.log('rendering graph');
};

global.TestViewer = TestViewer;
})(this);

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJ0ZXN0L3V0aWxzL3Rlc3Qtdmlld2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKmdsb2JhbHMgQXV0b1JvdXRlclJlcGxheWVyKi9cbihmdW5jdGlvbihnbG9iYWwpIHtcbid1c2Ugc3RyaWN0JztcblxudmFyIFRlc3RWaWV3ZXIgPSBmdW5jdGlvbihjb250YWluZXIpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbn07XG5cblRlc3RWaWV3ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKGFjdGlvbnMpIHtcbiAgICB2YXIgcmVwbGF5ZXIgPSBuZXcgQXV0b1JvdXRlclJlcGxheWVyKCk7XG4gICAgcmVwbGF5ZXIudXNlV2ViV29ya2VyKGZhbHNlKTtcbiAgICB0cnkge1xuICAgICAgICByZXBsYXllci50ZXN0KGFjdGlvbnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignQWN0aW9uIHJlcGxheSBmYWlsZWQ6JywgZSk7XG4gICAgfVxuICAgIHRoaXMuX3JlbmRlcihyZXBsYXllci5hdXRvcm91dGVyLmdyYXBoKTtcbn07XG5cblRlc3RWaWV3ZXIucHJvdG90eXBlLl9yZW5kZXIgPSBmdW5jdGlvbihncmFwaCkge1xuICAgIGNvbnNvbGUubG9nKCdyZW5kZXJpbmcgZ3JhcGgnKTtcbn07XG5cbmdsb2JhbC5UZXN0Vmlld2VyID0gVGVzdFZpZXdlcjtcbn0pKHRoaXMpO1xuIl19
