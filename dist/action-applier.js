(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AutoRouterActionApplier = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":2}],2:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":3}],3:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],4:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */
'use strict';

var AutoRouter = require('./AutoRouter'),
    assert = require('./AutoRouter.Utils').assert;

var AutoRouterActionApplier = function () {
};

AutoRouterActionApplier.AutoRouter = AutoRouter;

AutoRouterActionApplier.prototype.init = function () {
    this._portSeparator = this._portSeparator || '_x_';
    this.autorouter = new AutoRouter();
    this.debugActionSequence = '[';
    this._clearRecords();
};

AutoRouterActionApplier.prototype._clearRecords = function () {
    this._autorouterBoxes = {};  // Define container that will map obj+subID -> box
    this._autorouterPorts = {};  // Maps boxIds to an array of port ids that have been mapped
    this._autorouterPaths = {};
    this._arPathId2Original = {};
};

/**
 * Replace id stored at the given indices of the array with the item from the dictionary.
 *
 * @param {Dictionary} dictionary
 * @param {Array} array
 * @param {Array<Number>} indices
 * @return {undefined}
 */
AutoRouterActionApplier.prototype._lookupItem = function (dictionary, array, indices) {  // jshint ignore:line
    var index,
        id;

    for (var i = 2; i < arguments.length; i++) {
        index = arguments[i];
        id = array[index];
        array[index] = dictionary[id];
    }
};

// FIXME: Update this method for new api
AutoRouterActionApplier.prototype._fixArgs = function (command, args) {
    var id;
    // Fix args, if needed
    switch (command) {
        case 'move':  // args[0] is id should be the box
            this._lookupItem(this._autorouterBoxes, args, 0);
            args[0] = args[0].box;
            break;

        case 'getPathPoints':
            this._lookupItem(this._autorouterPaths, args, 0);
            break;

        case 'setPathCustomPoints':
            id = args[0].path;
            args[0].path = this._autorouterPaths[id];
            break;

        case 'setBoxRect':
            this._lookupItem(this._autorouterBoxes, args, 0);
            break;

        case 'getBoxRect':
            this._lookupItem(this._autorouterBoxes, args, 0);
            args[0] = args[0].box.id;
            break;

        case 'updatePort':
            this._lookupItem(this._autorouterBoxes, args, 0);
            break;

        case 'setComponent':
            this._lookupItem(this._autorouterBoxes, args, 0, 1);
            break;

        case 'addPath':
            this._fixPortArgs(args[0].src, args[0].dst);
            args.pop();  // Remove the connection id
            break;

        case 'remove':
            var item;

            id = args[0];
            if (this._autorouterBoxes[id]) {
                item = this._autorouterBoxes[id];
            } else if (this._autorouterPaths[id]) {
                item = this._autorouterPaths[id];  // If objId is a connection
            }

            args[0] = item;
            break;

        case 'addBox':
            args.pop();
            break;

        default:
            break;
    }

};

AutoRouterActionApplier.prototype._fixPortArgs = function (port1, port2) { // jshint ignore:line
    var portId,
        portIds,
        arPortId,
        boxId,
        ports;

    for (var i = arguments.length; i--;) {
        ports = arguments[i];
        portIds = Object.keys(ports);
        for (var j = portIds.length; j--;) {
            portId = portIds[j];
            boxId = ports[portId];

            arPortId = this.autorouter.getPortId(portId, this._autorouterBoxes[boxId]);
            ports[portId] = this._autorouterBoxes[boxId].ports[arPortId];
            assert(this._autorouterBoxes[boxId].ports[arPortId], 'AR Port not found!');
        }
    }
};

/**
 * Invoke an AutoRouter method. This allows the action to be logged and bugs replicated.
 *
 * @param {String} command
 * @param {Array} args
 * @return {undefined}
 */
AutoRouterActionApplier.prototype._invokeAutoRouterMethod = function (command, args) {
    try {
        return this._invokeAutoRouterMethodUnsafe(command, args);

    } catch (e) {
        this.logger.error('AutoRouter.' + command + ' failed with error: ' + e);
    }
};

AutoRouterActionApplier.prototype._invokeAutoRouterMethodUnsafe = function (command, args) {
    var result,
        oldArgs = args.slice();

    if (this._recordActions) {
        this._recordAction(command, args.slice());
    }

    // Some arguments are simply ids for easier recording
    this._fixArgs(command, args);

    result = this.autorouter[command].apply(this.autorouter, args);
    this._updateRecords(command, oldArgs, result);
    return result;
};

AutoRouterActionApplier.prototype._updateRecords = function (command, input, result) {
    assert (input instanceof Array);
    var id,
        args = input.slice(),
        i;

    switch (command) {
        case 'addPath':
            id = args.pop();
            this._autorouterPaths[id] = result;
            this._arPathId2Original[result] = id;
            break;

        case 'addBox':
            id = args.pop();
            this._autorouterBoxes[id] = result;

            // Add ports
            this._autorouterPorts[id] = [];
            var ids = Object.keys(result.ports);
            for (i = ids.length; i--;) {
                this._autorouterPorts[id].push(result.ports[ids[i]]);
            }
            break;

        case 'remove':
            id = args[0];
            if (this._autorouterBoxes[id]) {
                i = this._autorouterPorts[id] ? this._autorouterPorts[id].length : 0;
                while (i--) {
                    var portId = id + this._portSeparator + this._autorouterPorts[id][i]; //ID of child port
                    delete this._autorouterBoxes[portId];
                }

                delete this._autorouterBoxes[id];
                delete this._autorouterPorts[id];

            } else if (this._autorouterPaths[id]) {
                var arId = this._autorouterPaths[id];
                delete this._autorouterPaths[id];
                delete this._arPathId2Original[arId];
            }
            break;

        case 'setComponent':
            var len,
                subCompId;

            id = args[0];
            len = id.length + this._portSeparator.length;
            subCompId = args[1].substring(len);

            if (this._autorouterPorts[id].indexOf(subCompId) === -1) {
                this._autorouterPorts[id].push(subCompId);
            }
            break;

        case 'updatePort':
            id = args[1].id;
            break;
    }
};

/**
 * Add the given action to the current sequence of autorouter commands.
 *
 * @param objId
 * @param subCompId
 * @return {undefined}
 */
AutoRouterActionApplier.prototype._recordAction = function (command, args) {

    var action = {action: command, args: args},
        circularFixer = function (key, value) {
            if (value && value.owner) {
                return value.id;
            }

            return value;
        };

    this.debugActionSequence += JSON.stringify(action, circularFixer) + ',';
};

AutoRouterActionApplier.prototype._getActionSequence = function () {
    var index = this.debugActionSequence.lastIndexOf(','),
        result = this.debugActionSequence.substring(0, index) + ']';

    return result;
};

module.exports = AutoRouterActionApplier;

},{"./AutoRouter":18,"./AutoRouter.Utils":17}],5:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterPort = require('./AutoRouter.Port');


var AutoRouterBox = function () {
    this.owner = null;
    this.rect = new ArRect();
    this.atomic = false;
    this.selfPoints = [];
    this.ports = [];
    this.childBoxes = [];//dependent boxes
    this.parent = null;
    this.id = null;

    this.calculateSelfPoints(); //Part of initialization
};

AutoRouterBox.prototype.calculateSelfPoints = function () {
    this.selfPoints = [];
    this.selfPoints.push(new ArPoint(this.rect.getTopLeft()));

    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.ceil));
    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.floor));
    this.selfPoints.push(new ArPoint(this.rect.left, this.rect.floor));
};

AutoRouterBox.prototype.deleteAllPorts = function () {
    for (var i = 0; i < this.ports.length; i++) {
        this.ports[i].destroy();
    }

    this.ports = [];

    this.atomic = false;
};

AutoRouterBox.prototype.hasOwner = function () {
    return this.owner !== null;
};

// TODO: Remove this function
AutoRouterBox.prototype.createPort = function () {
    var port = new AutoRouterPort();
    assert(port !== null, 'ARBox.createPort: port !== null FAILED');

    return port;
};

AutoRouterBox.prototype.hasNoPort = function () {
    return this.ports.length === 0;
};

AutoRouterBox.prototype.isAtomic = function () {
    return this.atomic;
};

AutoRouterBox.prototype.addPort = function (port) {
    assert(port !== null, 'ARBox.addPort: port !== null FAILED');

    port.owner = this;
    this.ports.push(port);

    if (this.owner) {  // Not pointing to the ARGraph
        this.owner._addEdges(port);
    }
};

AutoRouterBox.prototype.deletePort = function (port) {
    assert(port !== null, 'ARBox.deletePort: port !== null FAILED');
    if (port === null) {
        return;
    }

    var index = this.ports.indexOf(port),
        graph = this.owner;

    assert(index !== -1, 'ARBox.deletePort: index !== -1 FAILED');

    graph.deleteEdges(port);
    this.ports.splice(index, 1);

    this.atomic = false;

};

AutoRouterBox.prototype.isRectEmpty = function () {
    return this.rect.isRectEmpty();
};

AutoRouterBox.prototype.setRect = function (r) {
    assert(r instanceof ArRect, 'Invalthis.id arg in ARBox.setRect. Requires ArRect');

    assert(r.getWidth() >= 3 && r.getHeight() >= 3,
        'ARBox.setRect: r.getWidth() >= 3 && r.getHeight() >= 3 FAILED!');

    assert(r.getTopLeft().x >= CONSTANTS.ED_MINCOORD && r.getTopLeft().y >= CONSTANTS.ED_MINCOORD,
        'ARBox.setRect: r.getTopLeft().x >= CONSTANTS.ED_MINCOORD && r.getTopLeft().y >= ' +
        'CONSTANTS.ED_MAXCOORD FAILED!');

    assert(r.getBottomRight().x <= CONSTANTS.ED_MAXCOORD && r.getBottomRight().y <= CONSTANTS.ED_MAXCOORD,
        'ARBox.setRect:  r.getBottomRight().x <= CONSTANTS.ED_MAXCOORD && r.getBottomRight().y <= ' +
        'CONSTANTS.ED_MAXCOORD FAILED!');

    this.rect.assign(r);
    this.calculateSelfPoints();

    if (this.atomic) {
        assert(this.ports.length === 1, 'ARBox.setRect: this.ports.length === 1 FAILED!');
        this.ports[0].setRect(r);
    }
};

AutoRouterBox.prototype.shiftBy = function (offset) {
    this.rect.add(offset);

    var i = this.ports.length;
    while (i--) {
        this.ports[i].shiftBy(offset);
    }

    /*
     This is not necessary; the ARGraph will shift all children
     i = this.childBoxes.length;
     while(i--){
     this.childBoxes[i].shiftBy(offset);
     }
     */
    this.calculateSelfPoints();
};

AutoRouterBox.prototype.resetPortAvailability = function () {
    for (var i = this.ports.length; i--;) {
        this.ports[i].resetAvailableArea();
    }
};

AutoRouterBox.prototype.adjustPortAvailability = function (box) {
    if (!box.hasAncestorWithId(this.id) &&   // Boxes are not dependent on one another
        !this.hasAncestorWithId(box.id)) {

        for (var i = this.ports.length; i--;) {
            this.ports[i].adjustAvailableArea(box.rect);
        }
    }
};

AutoRouterBox.prototype.addChild = function (box) {
    assert(this.childBoxes.indexOf(box) === -1,
        'ARBox.addChild: box already is child of ' + this.id);
    assert(box instanceof AutoRouterBox,
        'Child box must be of type AutoRouterBox');

    this.childBoxes.push(box);
    box.parent = this;
};

AutoRouterBox.prototype.removeChild = function (box) {
    var i = this.childBoxes.indexOf(box);
    assert(i !== -1, 'ARBox.removeChild: box isn\'t child of ' + this.id);
    this.childBoxes.splice(i, 1);
    box.parent = null;
};

AutoRouterBox.prototype.hasAncestorWithId = function (id) {
    var box = this;
    while (box) {
        if (box.id === id) {
            return true;
        }
        box = box.parent;
    }
    return false;
};

AutoRouterBox.prototype.getRootBox = function () {
    var box = this;
    while (box.parent) {
        box = box.parent;
    }
    return box;
};

AutoRouterBox.prototype.isBoxAt = function (point, nearness) {
    return Utils.isPointIn(point, this.rect, nearness);
};

AutoRouterBox.prototype.isBoxClip = function (r) {
    return Utils.isRectClip(this.rect, r);
};

AutoRouterBox.prototype.isBoxIn = function (r) {
    return Utils.isRectIn(this.rect, r);
};

AutoRouterBox.prototype.destroy = function () {
    var i = this.childBoxes.length;

    //notify this.parent of destruction
    //if there is a this.parent, of course
    if (this.parent) {
        this.parent.removeChild(this);
    }

    this.owner = null;
    this.deleteAllPorts();

    while (i--) {
        this.childBoxes[i].destroy();
    }
};

AutoRouterBox.prototype.assertValid = function () {
    for (var p = this.ports.length; p--;) {
        this.ports[p].assertValid();
    }
};

module.exports = AutoRouterBox;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Port":14,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],6:[function(require,module,exports){
/*jshint node: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';
var ArPoint = require('./AutoRouter.Point');

module.exports = {
    EMPTY_POINT: new ArPoint(-100000, -100000),
    ED_MAXCOORD: 100000,
    ED_MINCOORD: -2,//This allows connections to be still be draw when box is pressed against the edge
    ED_SMALLGAP: 15,
    CONNECTIONCUSTOMIZATIONDATAVERSION: 0,
    EMPTYCONNECTIONCUSTOMIZATIONDATAMAGIC: -1,
    DEBUG: false,
    BUFFER: 10,

    EDLS_S: 15,//ED_SMALLGAP
    EDLS_R: 15 + 1, //ED_SMALLGAP+1
    EDLS_D: 100000 + 2,//ED_MAXCOORD - ED_MINCOORD,

    PathEndOnDefault: 0x0000,
    PathEndOnTop: 0x0010,
    PathEndOnRight: 0x0020,
    PathEndOnBottom: 0x0040,
    PathEndOnLeft: 0x0080,
    PathEndMask: (0x0010 | 0x0020 | 0x0040 | 0x0080),
    // (PathEndOnTop | PathEndOnRight | PathEndOnBottom | PathEndOnLeft),

    PathStartOnDefault: 0x0000,
    PathStartOnTop: 0x0100,
    PathStartOnRight: 0x0200,
    PathStartOnBottom: 0x0400,
    PathStartOnLeft: 0x0800,
    PathStartMask: (0x0100 | 0x0200 | 0x0400 | 0x0800),
    // (PathStartOnTop | PathStartOnRight | PathStartOnBottom | PathStartOnLeft),

    PathHighLighted: 0x0002,		// attributes,
    PathFixed: 0x0001,
    PathDefault: 0x0000,

    PathStateConnected: 0x0001,		// states,
    PathStateDefault: 0x0000,

    // Port Connection Variables
    PortEndOnTop: 0x0001,
    PortEndOnRight: 0x0002,
    PortEndOnBottom: 0x0004,
    PortEndOnLeft: 0x0008,
    PortEndOnAll: 0x000F,

    PortStartOnTop: 0x0010,
    PortStartOnRight: 0x0020,
    PortStartOnBottom: 0x0040,
    PortStartOnLeft: 0x0080,
    PortStartOnAll: 0x00F0,

    PortConnectOnAll: 0x00FF,
    PortConnectToCenter: 0x0100,

    PortStartEndHorizontal: 0x00AA,
    PortStartEndVertical: 0x0055,

    PortDefault: 0x00FF,

    // RoutingDirection vars 
    DirNone: -1,
    DirTop: 0,
    DirRight: 1,
    DirBottom: 2,
    DirLeft: 3,
    DirSkew: 4,

    //Path Custom Data
    SimpleEdgeDisplacement: 'EdgeDisplacement',
    CustomPointCustomization: 'PointCustomization'
    //CONNECTIONCUSTOMIZATIONDATAVERSION : null
};

},{"./AutoRouter.Point":12}],7:[function(require,module,exports){
/*globals define*/
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point');

var AutoRouterEdge = function () {
    /*
     In this section every comment refer to the horizontal case, that is, each	edge is
     horizontal.
     */

    /*
     * TODO Update this comment
     *
     Every CAutoRouterEdge belongs to an edge of a CAutoRouterPath, CAutoRouterBox or CAutoRouterPort. This edge is
     Represented by a CAutoRouterPoint with its next point. The variable 'point' will refer
     to this CAutoRouterPoint.

     The coordinates of an edge are 'x1', 'x2' and 'y' where x1/x2 is the x-coordinate
     of the left/right point, and y is the common y-coordinate of the points.

     The edges are ordered according to their y-coordinates. The first edge has
     the least y-coordinate (topmost), and its pointer is in 'orderFirst'.
     We use the 'order' prefix in the variable names to refer to this order.

     We will walk from top to bottom (from the 'orderFirst' along the 'this.orderNext').
     We keep track a 'section' of some edges. If we have an infinite horizontal line,
     then the section consists of those edges that are above the line and not blocked
     by another edge which is closer to the line. Each edge in the section has
     a viewable portion from the line (the not blocked portion). The coordinates
     of this portion are 'this.sectionX1' and 'this.sectionX2'. We have an order of the edges
     belonging to the current section. The 'section_first' refers to the leftmost
     edge in the section, while the 'this.sectionNext' to the next from left to right.

     We say that the CAutoRouterEdge E1 'precede' the CAutoRouterEdge E2 if there is no other CAutoRouterEdge which
     totally	blocks S1 from S2. So a section consists of the preceding edges of an
     infinite edge. We say that E1 is 'adjacent' to E2, if E1 is the nearest edge
     to E2 which precede it. Clearly, every edge has at most one adjacent precedence.

     The edges of any CAutoRouterBox or CAutoRouterPort are fixed. We will continually fix the edges
     of the CAutoRouterPaths. But first we need some definition.

     We call a set of edges as a 'block' if the topmost (first) and bottommost (last)
     edges of it are fixed while the edges between them are not. Furthermore, every
     edge is adjacent to	the next one in the order. Every edge in the block has an
     'index'. The index of the first one (topmost) is 0, of the second is 1, and so on.
     We call the index of the last edge (# of edges - 1) as the index of the entire box.
     The 'depth' of a block is the difference of the y-coordinates of the first and last
     edges of it. The 'goal gap' of the block is the quotient of the depth and index
     of the block. If the difference of the y-coordinates of the adjacent edges in
     the block are all equal to the goal gap, then we say that the block is evenly
     distributed.

     So we search the block which has minimal goal gap. Then if it is not evenly
     distributed, then we shift the not fixed edges to the desired position. It is
     not hard to see	that if the block has minimal goal gap (among the all
     possibilities of blocks), then in this way we do not move any edges into boxes.
     Finally, we set the (inner) edges of the block to be fixed (except the topmost and
     bottommost edges, since they are already fixed). And we again begin the search.
     If every edge is fixed, then we have finished. This is the basic idea. We will
     refine this algorithm.

     The variables related to the blocks are prefixed by 'block'. Note that the
     variables of an edge are refer to that block in which this edge is inner! The
     'block_oldgap' is the goal gap of the block when it was last evenly distributed.

     The variables 'canstart' and 'canend' means that this egde can start and/or end
     a block. The top edge of a box only canend, while a fixed edge of a path can both
     start and end of a block.

     */

    this.owner = null;
    this.startpointPrev = null;
    this.startpoint = null;
    this.endpoint = null;
    this.endpointNext = null;

    this.positionY = 0;
    this.positionX1 = 0;
    this.positionX2 = 0;
    this.bracketClosing = false;
    this.bracketOpening = false;

    this.orderPrev = null;
    this.orderNext = null;

    this.sectionX1 = null;
    this.sectionX2 = null;
    this.sectionNext = null;
    this.sectionDown = null;

    this.edgeFixed = false;
    this.edgeCustomFixed = false;
    this.edgeCanPassed = false;
    this.edgeDirection = null;

    this.blockPrev = null;
    this.blockNext = null;
    this.blockTrace = null;

    this.closestPrev = null;
    this.closestNext = null;

};


AutoRouterEdge.prototype.assign = function (otherEdge) {

    if (otherEdge !== null) {
        this.owner = otherEdge.owner;
        this.setStartPoint(otherEdge.startpoint, false);

        //Only calculateDirection if this.endpoint is not null
        this.setEndPoint(otherEdge.endpoint, otherEdge.endpoint !== null);

        this.startpointPrev = otherEdge.startpointPrev;
        this.endpointNext = otherEdge.endpointNext;

        this.positionY = otherEdge.positionY;
        this.positionX1 = otherEdge.positionX1;
        this.positionX2 = otherEdge.positionX2;
        this.bracketClosing = otherEdge.bracketClosing;
        this.bracketOpening = otherEdge.bracketOpening;

        this.orderNext = otherEdge.orderNext;
        this.orderPrev = otherEdge.orderPrev;

        this.sectionX1 = otherEdge.sectionX1;
        this.sectionX2 = otherEdge.sectionX2;
        this.setSectionNext(otherEdge.getSectionNext(true));
        this.setSectionDown(otherEdge.getSectionDown(true));

        this.edgeFixed = otherEdge.edgeFixed;
        this.edgeCustomFixed = otherEdge.edgeCustomFixed;
        this.setEdgeCanpassed(otherEdge.getEdgeCanpassed());
        this.setDirection(otherEdge.getDirection());

        this.setBlockPrev(otherEdge.getBlockPrev());
        this.setBlockNext(otherEdge.getBlockNext());
        this.setBlockTrace(otherEdge.getBlockTrace());

        this.setClosestPrev(otherEdge.getClosestPrev());
        this.setClosestNext(otherEdge.getClosestNext());

        return this;
    }

    return null;
};

AutoRouterEdge.prototype.equals = function (otherEdge) {
    return this === otherEdge; // This checks if they reference the same object
};

AutoRouterEdge.prototype.getStartPointPrev = function () {
    return this.startpointPrev !== null ? this.startpointPrev || this.startpointPrev : null;
};

AutoRouterEdge.prototype.isStartPointPrevNull = function () {
    return !this.startpointPrev;
};

AutoRouterEdge.prototype.getStartPoint = function () {
    return this.startpoint !== null ?
        (this.startpoint instanceof Array ? new ArPoint(this.startpoint) : new ArPoint(this.startpoint)) :
        CONSTANTS.EMPTY_POINT;  // returning copy of this.startpoint
};

AutoRouterEdge.prototype.isSameStartPoint = function (point) {
    return this.startpoint === point;
};

AutoRouterEdge.prototype.isStartPointNull = function () {
    return this.startpoint === null;
};

AutoRouterEdge.prototype.setStartPoint = function (point, b) {
    this.startpoint = point;

    if (b !== false) {
        this.recalculateDirection();
    }
};

AutoRouterEdge.prototype.setStartPointX = function (_x) {
    this.startpoint.x = _x;
};

AutoRouterEdge.prototype.setStartPointY = function (_y) {
    this.startpoint.y = _y;
};

AutoRouterEdge.prototype.getEndPoint = function () {
    return this.endpoint !== null ?
        (this.endpoint instanceof Array ?
            new ArPoint(this.endpoint) :
            new ArPoint(this.endpoint)) :
        CONSTANTS.EMPTY_POINT;
};

AutoRouterEdge.prototype.isEndPointNull = function () {
    return this.endpoint === null;
};

AutoRouterEdge.prototype.setEndPoint = function (point, b) {
    this.endpoint = point;

    if (b !== false) {
        this.recalculateDirection();
    }
};

AutoRouterEdge.prototype.setStartAndEndPoint = function (startPoint, endPoint) {
    this.setStartPoint(startPoint, false); //wait until setting the this.endpoint to recalculateDirection
    this.setEndPoint(endPoint);
};

AutoRouterEdge.prototype.setEndPointX = function (_x) {
    this.endpoint.x = _x;
};

AutoRouterEdge.prototype.setEndPointY = function (_y) {
    this.endpoint.y = _y;
};

AutoRouterEdge.prototype.isEndPointNextNull = function () {
    return !this.endpointNext;
};

AutoRouterEdge.prototype.getSectionNext = function () {

    return this.sectionNext !== undefined ? this.sectionNext[0] : null;
};

AutoRouterEdge.prototype.getSectionNextPtr = function () {
    if (!this.sectionNext || !this.sectionNext[0]) {
        this.sectionNext = [new AutoRouterEdge()];
    }
    return this.sectionNext;
};

AutoRouterEdge.prototype.setSectionNext = function (nextSection) {
    nextSection = nextSection instanceof Array ? nextSection[0] : nextSection;
    if (this.sectionNext instanceof Array) {
        this.sectionNext[0] = nextSection;
    } else {
        this.sectionNext = [nextSection];
    }
};

AutoRouterEdge.prototype.getSectionDown = function () { //Returns pointer - if not null

    return this.sectionDown !== undefined ? this.sectionDown[0] : null;

};

AutoRouterEdge.prototype.getSectionDownPtr = function () {
    if (!this.sectionDown || !this.sectionDown[0]) {
        this.sectionDown = [new AutoRouterEdge()];
    }
    return this.sectionDown;
};

AutoRouterEdge.prototype.setSectionDown = function (downSection) {
    downSection = downSection instanceof Array ? downSection[0] : downSection;
    if (this.sectionDown instanceof Array) {
        this.sectionDown[0] = downSection;
    } else {
        this.sectionDown = [downSection];
    }
};

AutoRouterEdge.prototype.getEdgeCanpassed = function () {
    return this.edgeCanPassed;
};

AutoRouterEdge.prototype.setEdgeCanpassed = function (ecp) {
    this.edgeCanPassed = ecp;
};

AutoRouterEdge.prototype.getDirection = function () {
    return this.edgeDirection;
};

AutoRouterEdge.prototype.setDirection = function (dir) {
    this.edgeDirection = dir;
};

AutoRouterEdge.prototype.recalculateDirection = function () {
    assert(this.startpoint !== null && this.endpoint !== null,
        'AREdge.recalculateDirection: this.startpoint !== null && this.endpoint !== null FAILED!');
    this.edgeDirection = Utils.getDir(this.endpoint.minus(this.startpoint));
};

AutoRouterEdge.prototype.getBlockPrev = function () {
    return this.blockPrev;
};

AutoRouterEdge.prototype.setBlockPrev = function (prevBlock) {
    this.blockPrev = prevBlock;
};

AutoRouterEdge.prototype.getBlockNext = function () {
    return this.blockNext;
};

AutoRouterEdge.prototype.setBlockNext = function (nextBlock) {
    this.blockNext = nextBlock;
};

AutoRouterEdge.prototype.getBlockTrace = function () {
    return this.blockTrace;
};

AutoRouterEdge.prototype.setBlockTrace = function (traceBlock) {
    this.blockTrace = traceBlock;
};

AutoRouterEdge.prototype.getClosestPrev = function () {
    return this.closestPrev;
};

AutoRouterEdge.prototype.setClosestPrev = function (cp) {
    this.closestPrev = cp;
};

AutoRouterEdge.prototype.getClosestNext = function () {
    return this.closestNext;
};

AutoRouterEdge.prototype.setClosestNext = function (cp) {
    this.closestNext = cp;
};

module.exports = AutoRouterEdge;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Utils":17}],8:[function(require,module,exports){
/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var Logger = require('./AutoRouter.Logger'),
    CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    AutoRouterPath = require('./AutoRouter.Path'),
    AutoRouterPort = require('./AutoRouter.Port'),
    AutoRouterBox = require('./AutoRouter.Box'),
    AutoRouterEdge = require('./AutoRouter.Edge');


    //----------------------AutoRouterEdgeList

var _logger = new Logger('AutoRouter.EdgeList');
var AutoRouterEdgeList = function (b) {
    this.owner = null;

    //--Edges
    this.ishorizontal = b;

    //--Order
    this.orderFirst = null;
    this.orderLast = null;

    //--Section
    this.sectionFirst = null;
    this.sectionBlocker = null;
    this.sectionPtr2Blocked = []; // This is an array to emulate the pointer to a pointer functionality in CPP. 
    // That is, this.sectionPtr2Blocked[0] = this.sectionPtr2Blocked*

    this._initOrder();
    this._initSection();
};

// Public Functions
AutoRouterEdgeList.prototype.contains = function (start, end) {
    var currentEdge = this.orderFirst,
        startpoint,
        endpoint;

    while (currentEdge) {
        startpoint = currentEdge.startpoint;
        endpoint = currentEdge.endpoint;
        if (start.equals(startpoint) && end.equals(endpoint)) {
            return true;
        }
        currentEdge = currentEdge.orderNext;
    }

    return false;
};

AutoRouterEdgeList.prototype.destroy = function () {
    this.checkOrder();
    this.checkSection();
};

AutoRouterEdgeList.prototype.addPathEdges = function (path) {
    assert(path.owner === this.owner,
        'AREdgeList.addEdges: path.owner === owner FAILED!');

    var isPathAutoRouted = path.isAutoRouted(),
        hasCustomEdge = false,
        customizedIndexes = {},
        indexes = [],
        startpoint,
        endpoint,
        dir,
        edge,
        i;

    if (isPathAutoRouted) {
        i = -1;
        while (++i < indexes.length) {
            hasCustomEdge = true;
            customizedIndexes[indexes[i]] = 0;
        }
    } else {
        hasCustomEdge = true;
    }

    var pointList = path.getPointList(),
        ptrsObject = pointList.getTailEdgePtrs(),
        indItr,
        currEdgeIndex = pointList.length - 2,
        goodAngle,
        pos = ptrsObject.pos,
        skipEdge,
        isMoveable,
        isEdgeCustomFixed,
        startPort,
        endPort,
        isStartPortConnectToCenter,
        isEndPortConnectToCenter,
        isPathFixed;

    startpoint = ptrsObject.start;
    endpoint = ptrsObject.end;

    while (pointList.length && pos >= 0) {

        dir = Utils.getDir(endpoint.minus(startpoint));

        skipEdge = dir === CONSTANTS.DirNone ? true : false;
        isMoveable = path.isMoveable();

        if (!isMoveable && dir !== CONSTANTS.DirSkew) {
            goodAngle = Utils.isRightAngle(dir);
            assert(goodAngle,
                'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

            if (!goodAngle) {
                skipEdge = true;
            }

        }

        if (!skipEdge &&
            (Utils.isRightAngle(dir) && Utils.isHorizontal(dir) === this.ishorizontal)) {
            edge = new AutoRouterEdge();
            edge.owner = path;

            edge.setStartAndEndPoint(startpoint, endpoint);
            edge.startpointPrev = pointList.getPointBeforeEdge(pos);
            edge.endpointNext = pointList.getPointAfterEdge(pos);

            if (hasCustomEdge) {
                isEdgeCustomFixed = false;
                if (isPathAutoRouted) {
                    indItr = customizedIndexes.indexOf(currEdgeIndex);
                    isEdgeCustomFixed = (indItr !== customizedIndexes.length - 1);
                } else {
                    isEdgeCustomFixed = true;
                }

                edge.edgeCustomFixed = isEdgeCustomFixed;

            } else {

                edge.edgeCustomFixed = dir === CONSTANTS.DirSkew;
            }

            startPort = path.getStartPort();

            assert(startPort !== null,
                'AREdgeList.addEdges: startPort !== null FAILED!');

            isStartPortConnectToCenter = startPort.isConnectToCenter();
            endPort = path.getEndPort();

            assert(endPort !== null,
                'AREdgeList.addEdges: endPort !== null FAILED!');

            isEndPortConnectToCenter = endPort.isConnectToCenter();
            isPathFixed = path.isFixed() || !path.isAutoRouted();

            edge.edgeFixed = edge.edgeCustomFixed || isPathFixed ||
            (edge.isStartPointPrevNull() && isStartPortConnectToCenter) ||
            (edge.isEndPointNextNull() && isEndPortConnectToCenter);

            if (dir !== CONSTANTS.DirSkew) {
                this._positionLoadY(edge);
                this._positionLoadB(edge);
            } else {
                edge.positionY = 0;
                edge.bracketOpening = false;
                edge.bracketClosing = false;
            }

            this.insert(edge);

        }

        ptrsObject = pointList.getPrevEdgePtrs(pos);
        pos = ptrsObject.pos;
        startpoint = ptrsObject.start;
        endpoint = ptrsObject.end;
        currEdgeIndex--;
    }

    return true;
};

AutoRouterEdgeList.prototype.addPortEdges = function (port) {
    var startpoint,
        endpoint,
        edge,
        selfPoints,
        startpointPrev,
        endpointNext,
        dir,
        i,
        canHaveStartEndPointHorizontal;

    assert(port.owner.owner === this.owner,
        'AREdgeList.addEdges: port.owner === (owner) FAILED!');

    if (port.isConnectToCenter() || port.owner.isAtomic()) {
        return;
    }

    selfPoints = port.selfPoints;

    for (i = 0; i < 4; i++) {

        startpointPrev = selfPoints[(i + 3) % 4];
        startpoint = selfPoints[i];
        endpoint = selfPoints[(i + 1) % 4];
        endpointNext = selfPoints[(i + 2) % 4];
        dir = Utils.getDir(endpoint.minus(startpoint));

        assert(Utils.isRightAngle(dir),
            'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

        canHaveStartEndPointHorizontal = port.canHaveStartEndPointHorizontal(this.ishorizontal);
        if (Utils.isHorizontal(dir) === this.ishorizontal && canHaveStartEndPointHorizontal) {
            edge = new AutoRouterEdge();

            edge.owner = port;
            edge.setStartAndEndPoint(startpoint, endpoint);
            edge.startpointPrev = startpointPrev;
            edge.endpointNext = endpointNext;

            edge.edgeFixed = true;

            this._positionLoadY(edge);
            this._positionLoadB(edge);

            if (edge.bracketClosing) {
                edge.addToPosition(0.999);
            }

            this.insert(edge);
        }
    }
};

AutoRouterEdgeList.prototype.addEdges = function (path) {
    var selfPoints,
        startpoint,
        startpointPrev,
        endpointNext,
        endpoint,
        edge,
        dir,
        i;

    if (path instanceof AutoRouterBox) {
        var box = path;

        assert(box.owner === this.owner,
            'AREdgeList.addEdges: box.owner === (owner) FAILED!');


        selfPoints = box.selfPoints;

        for (i = 0; i < 4; i++) {
            startpointPrev = selfPoints[(i + 3) % 4];
            startpoint = selfPoints[i];
            endpoint = selfPoints[(i + 1) % 4];
            endpointNext = selfPoints[(i + 2) % 4];
            dir = Utils.getDir(endpoint.minus(startpoint));

            assert(Utils.isRightAngle(dir),
                'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

            if (Utils.isHorizontal(dir) === this.ishorizontal) {
                edge = new AutoRouterEdge();

                edge.owner = box;
                edge.setStartAndEndPoint(startpoint, endpoint);
                edge.startpointPrev = startpointPrev;
                edge.endpointNext = endpointNext;

                edge.edgeFixed = true;

                this._positionLoadY(edge);
                this._positionLoadB(edge);

                if (edge.bracketClosing) {
                    edge.addToPosition(0.999);
                }

                this.insert(edge);
            }
        }
    } else if (path) {  // path is an ARGraph
        var graph = path;
        assert(graph === this.owner,
            'AREdgeList.addEdges: graph === this.owner FAILED!');

        selfPoints = graph.selfPoints;

        for (i = 0; i < 4; i++) {

            startpointPrev = selfPoints[(i + 3) % 4];
            startpoint = selfPoints[i];
            endpoint = selfPoints[(i + 1) % 4];
            endpointNext = selfPoints[(i + 2) % 4];
            dir = Utils.getDir(endpoint.minus(startpoint));

            assert(Utils.isRightAngle(dir),
                'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

            if (Utils.isHorizontal(dir) === this.ishorizontal) {
                edge = new AutoRouterEdge();

                edge.owner = graph;
                edge.setStartAndEndPoint(startpoint, endpoint);
                edge.startpointPrev = startpointPrev;
                edge.endpointNext = endpointNext;

                edge.edgeFixed = true;

                this._positionLoadY(edge);
                this.insert(edge);
            }
        }

    }
};

AutoRouterEdgeList.prototype.deleteEdges = function (object) {
    var edge = this.orderFirst,
        next;

    while (edge !== null) {
        if (edge.owner === object) {
            next = edge.orderNext;
            this.remove(edge);
            edge = next;
        } else {
            edge = edge.orderNext;
        }
    }

};

AutoRouterEdgeList.prototype.deleteAllEdges = function () {
    while (this.orderFirst) {
        this.remove(this.orderFirst);
    }
};

AutoRouterEdgeList.prototype.getEdge = function (path, startpoint) {
    var edge = this.orderFirst;
    while (edge !== null) {

        if (edge.isSameStartPoint(startpoint)) {
            break;
        }

        edge = edge.orderNext;
    }

    assert(edge !== null,
        'AREdgeList.getEdge: edge !== null FAILED!');
    return edge;
};

AutoRouterEdgeList.prototype.getEdgeByPointer = function (startpoint) {
    var edge = this.orderFirst;
    while (edge !== null) {
        if (edge.isSameStartPoint(startpoint)) {
            break;
        }

        edge = edge.orderNext;
    }

    assert(edge !== null,
        'AREdgeList.getEdgeByPointer: edge !== null FAILED!');
    return edge;
};

AutoRouterEdgeList.prototype.setEdgeByPointer = function (pEdge, newEdge) {
    assert(newEdge instanceof AutoRouterEdge,
        'AREdgeList.setEdgeByPointer: newEdge instanceof AutoRouterEdge FAILED!');
    var edge = this.sectionFirst;
    while (edge !== null) {
        if (pEdge === edge) {
            break;
        }

        edge = edge.getSectionDown();
    }

    assert(edge !== null,
        'AREdgeList.setEdgeByPointer: edge !== null FAILED!');
    edge = newEdge;
};

AutoRouterEdgeList.prototype.getEdgeAt = function (point, nearness) {
    var edge = this.orderFirst;
    while (edge) {

        if (Utils.isPointNearLine(point, edge.startpoint, edge.endpoint, nearness)) {
            return edge;
        }

        edge = edge.orderNext;
    }

    return null;
};

AutoRouterEdgeList.prototype.dumpEdges = function (msg, logger) {
    var edge = this.orderFirst,
        log = logger || _logger.debug,
        total = 1;

    log(msg);

    while (edge !== null) {
        log('\t' + edge.startpoint.x + ', ' + edge.startpoint.y + '\t\t' + edge.endpoint.x + ', ' +
        edge.endpoint.y + '\t\t\t(' + (edge.edgeFixed ? 'FIXED' : 'MOVEABLE' ) + ')\t\t' +
        (edge.bracketClosing ? 'Bracket Closing' : (edge.bracketOpening ? 'Bracket Opening' : '')));

        edge = edge.orderNext;
        total++;
    }

    log('Total Edges: ' + total);
};

AutoRouterEdgeList.prototype.getEdgeCount = function () {
    var edge = this.orderFirst,
        total = 1;
    while (edge !== null) {
        edge = edge.orderNext;
        total++;
    }
    return total;
};

//--Private Functions
AutoRouterEdgeList.prototype._positionGetRealY = function (edge, y) {
    if (y === undefined) {
        if (this.ishorizontal) {
            assert(edge.startpoint.y === edge.endpoint.y,
                'AREdgeList.position_GetRealY: edge.startpoint.y === edge.endpoint.y FAILED!');
            return edge.startpoint.y;
        }

        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_GetRealY: edge.startpoint.x === edge.endpoint.x FAILED!');
        return edge.startpoint.x;
    } else {

        assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
            'AREdgeList.position_GetRealY: edge !== null && !edge.isStartPointNull() && ' +
            '!edge.isEndPointNull() FAILED!');

        if (this.ishorizontal) {
            assert(edge.startpoint.y === edge.endpoint.y,
                'AREdgeList.position_GetRealY: edge.startpoint.y === edge.endpoint.y FAILED!');
            edge.setStartPointY(y);
            edge.setEndPointY(y);
        } else {
            assert(edge.startpoint.x === edge.endpoint.x,
                'AREdgeList.position_GetRealY: edge.startpoint.x === edge.endpoint.x FAILED');

            edge.setStartPointX(y);
            edge.setEndPointX(y);
        }
    }
};

AutoRouterEdgeList.prototype._positionSetRealY = function (edge, y) {
    if (edge instanceof Array) {
        edge = edge[0];
    }

    assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList.position_SetRealY: edge != null && !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');

    if (this.ishorizontal) {
        assert(edge.startpoint.y === edge.endpoint.y,
            'AREdgeList.position_SetRealY: edge.startpoint.y === edge.endpoint.y FAILED');
        edge.setStartPointY(y);
        edge.setEndPointY(y);
    } else {
        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_SetRealY: edge.startpoint.x === edge.endpoint.x FAILED');
        edge.setStartPointX(y);
        edge.setEndPointX(y);
    }
};

/**
 * Normalize the edge endpoints so x1 < x2
 */
AutoRouterEdgeList.prototype._positionGetRealX = function (edge) {
    assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList.position_GetRealX: edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');
    var x1, x2;

    if (this.ishorizontal) {
        assert(edge.startpoint.y === edge.endpoint.y,
            'AREdgeList.position_GetRealX: edge.startpoint.y === edge.endpoint.y FAILED');

        if (edge.startpoint.x < edge.endpoint.x) {

            x1 = edge.startpoint.x;
            x2 = edge.endpoint.x;
        } else {

            x1 = edge.endpoint.x;
            x2 = edge.startpoint.x;
        }
    } else {
        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_GetRealX: edge.startpoint.x === edge.endpoint.x FAILED');
        if (edge.startpoint.y < edge.endpoint.y) {

            x1 = edge.startpoint.y;
            x2 = edge.endpoint.y;
        } else {

            x1 = edge.endpoint.y;
            x2 = edge.startpoint.y;
        }
    }

    return [x1, x2];
};

AutoRouterEdgeList.prototype._positionGetRealO = function (edge) {
    assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList.position_GetRealO: edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');
    var o1, o2;

    if (this.ishorizontal) {
        assert(edge.startpoint.y === edge.endpoint.y,
            'AREdgeList.position_GetRealO: edge.startpoint.y === edge.endpoint.y FAILED');
        if (edge.startpoint.x < edge.endpoint.x) {

            o1 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.y - edge.startpoint.y;
            o2 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.y - edge.endpoint.y;
        } else {

            o1 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.y - edge.endpoint.y;
            o2 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.y - edge.startpoint.y;
        }
    } else {
        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_GetRealO: edge.startpoint.x === edge.endpoint.x FAILED');
        if (edge.startpoint.y < edge.endpoint.y) {

            o1 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.x - edge.startpoint.x;
            o2 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.x - edge.endpoint.x;
        } else {

            o1 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.x - edge.endpoint.x;
            o2 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.x - edge.startpoint.x;
        }
    }

    return [o1, o2];
};

AutoRouterEdgeList.prototype._positionLoadY = function (edge) {
    assert(edge !== null && edge.orderNext === null && edge.orderPrev === null,
        'AREdgeList.position_LoadY: edge !== null && edge.orderNext === null && edge.orderPrev === null FAILED');

    edge.positionY = this._positionGetRealY(edge);
};

AutoRouterEdgeList.prototype._positionLoadB = function (edge) {
    assert(edge !== null,
        'AREdgeList.position_LoadB: edge !== null FAILED');

    edge.bracketOpening = !edge.edgeFixed && this._bracketIsOpening(edge);
    edge.bracketClosing = !edge.edgeFixed && this._bracketIsClosing(edge);
};

AutoRouterEdgeList.prototype._positionAllStoreY = function () {
    var edge = this.orderFirst;
    while (edge) {
        this._positionSetRealY(edge, edge.positionY);
        edge = edge.orderNext;
    }

};

AutoRouterEdgeList.prototype._positionAllLoadX = function () {
    var edge = this.orderFirst,
        pts;
    while (edge) {
        pts = this._positionGetRealX(edge);
        edge.positionX1 = pts[0];
        edge.positionX2 = pts[1];

        edge = edge.orderNext;
    }
};

AutoRouterEdgeList.prototype._initOrder = function () {
    this.orderFirst = null;
    this.orderLast = null;
};

AutoRouterEdgeList.prototype._checkOrder = function () {
    assert(this.orderFirst === null && this.orderLast === null,
        'AREdgeList.checkOrder: this.orderFirst === null && this.orderLast === null FAILED');
};

//---Order

AutoRouterEdgeList.prototype.insertBefore = function (edge, before) {
    assert(edge !== null && before !== null && edge !== before,
        'AREdgeList.insertBefore: edge !== null && before !== null && edge !== before FAILED');
    assert(edge.orderNext === null && edge.orderPrev === null,
        'AREdgeList.insertBefore: edge.orderNext === null && edge.orderPrev === null FAILED');

    edge.orderPrev = before.orderPrev;
    edge.orderNext = before;

    if (before.orderPrev) {
        assert(before.orderPrev.orderNext === before,
            'AREdgeList.insertBefore: before.orderPrev.orderNext === before FAILED\nbefore.orderPrev.orderNext ' +
            'is ' + before.orderPrev.orderNext + ' and before is ' + before);

        before.orderPrev.orderNext = edge;

        assert(this.orderFirst !== before,
            'AREdgeList.insertBefore: this.orderFirst !== before FAILED');
    } else {

        assert(this.orderFirst === before,
            'AREdgeList.insertBefore: this.orderFirst === before FAILED');
        this.orderFirst = edge;
    }

    before.orderPrev = edge;
};

AutoRouterEdgeList.prototype.insertAfter = function (edge, after) {
    assert(edge !== null && after !== null && !edge.equals(after),
        'AREdgeList.insertAfter:  edge !== null && after !== null && !edge.equals(after) FAILED');
    assert(edge.orderNext === null && edge.orderPrev === null,
        'AREdgeList.insertAfter: edge.orderNext === null && edge.orderPrev === null FAILED ');

    edge.orderNext = after.orderNext;
    edge.orderPrev = after;

    if (after.orderNext) {
        assert(after.orderNext.orderPrev.equals(after),
            'AREdgeList.insertAfter:  after.orderNext.orderPrev.equals(after) FAILED');
        after.orderNext.orderPrev = edge;

        assert(!this.orderLast.equals(after), 'AREdgeList.insertAfter: !orderLast.equals(after) FAILED');
    } else {
        assert(this.orderLast.equals(after), 'AREdgeList.insertAfter: this.orderLast.equals(after) FAILED');
        this.orderLast = edge;
    }

    after.orderNext = edge;
};

AutoRouterEdgeList.prototype.insertLast = function (edge) {
    assert(edge !== null,
        'AREdgeList.insertLast: edge !== null FAILED');
    assert(edge.orderPrev === null && edge.orderNext === null,
        'AREdgeList.insertLast: edge.orderPrev === null && edge.orderNext === null FAILED');

    edge.orderPrev = this.orderLast;

    if (this.orderLast) {
        assert(this.orderLast.orderNext === null,
            'AREdgeList.insertLast: this.orderLast.orderNext === null FAILED');
        assert(this.orderFirst !== null,
            'AREdgeList.insertLast: this.orderFirst != null FAILED');

        this.orderLast.orderNext = edge;
        this.orderLast = edge;
    } else {
        assert(this.orderFirst === null,
            'AREdgeList.insertLast:  this.orderFirst === null FAILED');

        this.orderFirst = edge;
        this.orderLast = edge;
    }
};

AutoRouterEdgeList.prototype.insert = function (edge) {
    assert(edge !== null,
        'AREdgeList.insert:  edge !== null FAILED');
    assert(edge.orderPrev === null && edge.orderNext === null,
        'AREdgeList.insert: edge.orderPrev === null && edge.orderNext === null FAILED');

    var y = edge.positionY;

    assert(CONSTANTS.ED_MINCOORD <= y && y <= CONSTANTS.ED_MAXCOORD,
        'AREdgeList.insert: CONSTANTS.ED_MINCOORD <= y && y <= CONSTANTS.ED_MAXCOORD FAILED (y is ' + y + ')');

    var insert = this.orderFirst;

    while (insert && insert.positionY < y) {
        insert = insert.orderNext;
    }

    if (insert) {
        this.insertBefore(edge, insert);
    } else {
        this.insertLast(edge);
    }
};

AutoRouterEdgeList.prototype.remove = function (edge) {
    assert(edge !== null,
        'AREdgeList.remove:  edge !== null FAILED');

    if (this.orderFirst === edge) {
        this.orderFirst = edge.orderNext;
    }

    if (edge.orderNext) {
        edge.orderNext.orderPrev = edge.orderPrev;
    }

    if (this.orderLast === edge) {
        this.orderLast = edge.orderPrev;
    }

    if (edge.orderPrev) {
        edge.orderPrev.orderNext = edge.orderNext;
    }

    edge.orderNext = null;
    edge.orderPrev = null;
};

//-- Private

AutoRouterEdgeList.prototype._slideButNotPassEdges = function (edge, y) {
    assert(edge !== null, 'AREdgeList.slideButNotPassEdges: edge != null FAILED');
    assert(CONSTANTS.ED_MINCOORD < y && y < CONSTANTS.ED_MAXCOORD,
        'AREdgeList.slideButNotPassEdges: CONSTANTS.ED_MINCOORD < y && y < CONSTANTS.ED_MAXCOORD FAILED');

    var oldy = edge.positionY;
    assert(CONSTANTS.ED_MINCOORD < oldy && oldy < CONSTANTS.ED_MAXCOORD,
        'AREdgeList.slideButNotPassEdges: CONSTANTS.ED_MINCOORD < oldy && oldy < CONSTANTS.ED_MAXCOORD FAILED');

    if (oldy === y) {
        return null;
    }

    var x1 = edge.positionX1,
        x2 = edge.positionX2,
        ret = null,
        insert = edge;

    //If we are trying to slide down

    if (oldy < y) {
        while (insert.orderNext) {
            insert = insert.orderNext;

            if (y < insert.positionY) {
                //Then we won't be shifting past the new edge (insert)
                break;
            }

            //If you can't pass the edge (but want to) and the lines will overlap x values...
            if (!insert.getEdgeCanpassed() && Utils.intersect(x1, x2, insert.positionX1, insert.positionX2)) {
                ret = insert;
                y = insert.positionY;
                break;
            }
        }

        if (edge !== insert && insert.orderPrev !== edge) {
            this.remove(edge);
            this.insertBefore(edge, insert);
        }

    } else { // If we are trying to slide up
        while (insert.orderPrev) {
            insert = insert.orderPrev;

            if (y > insert.positionY) {
                break;
            }

            //If insert cannot be passed and it is in the way of the edge (if the edge were to slide up).
            if (!insert.getEdgeCanpassed() && Utils.intersect(x1, x2, insert.positionX1, insert.positionX2)) {
                ret = insert;
                y = insert.positionY;
                break;
            }
        }

        if (edge !== insert && insert.orderNext !== edge) {
            this.remove(edge);//This is where I believe the error could lie!
            this.insertAfter(edge, insert);
        }

    }

    edge.positionY = y;

    return ret;
};

//------Section

// private

AutoRouterEdgeList.prototype._initSection = function () {
    this.sectionFirst = null;
    this.sectionBlocker = null;
    this.sectionPtr2Blocked = null;
};

AutoRouterEdgeList.prototype.checkSection = function () {
    if (!(this.sectionBlocker === null && this.sectionPtr2Blocked === null)) {
        // This used to be contained in an assert.
        // Generally this fails when the router does not have a clean exit then is asked to reroute.
        this._logger.warn('sectionBlocker and this.sectionPtr2Blocked are not null. ' +
        'Assuming last run did not exit cleanly. Fixing...');
        this.sectionBlocker = null;
        this.sectionPtr2Blocked = null;
    }
};

AutoRouterEdgeList.prototype.sectionReset = function () {
    this.checkSection();

    this.sectionFirst = null;
};

/**
 * Initialize the section data structure.
 *
 * @param blocker
 * @return {undefined}
 */
AutoRouterEdgeList.prototype._sectionBeginScan = function (blocker) {
    this.checkSection();

    this.sectionBlocker = blocker;

    this.sectionBlocker.sectionX1 = this.sectionBlocker.positionX1;
    this.sectionBlocker.sectionX2 = this.sectionBlocker.positionX2;

    this.sectionBlocker.setSectionNext(null);
    this.sectionBlocker.setSectionDown(null);
};

AutoRouterEdgeList.prototype._sectionIsImmediate = function () {
    assert(this.sectionBlocker !== null && this.sectionPtr2Blocked !== null && this.sectionPtr2Blocked !== null,
        'AREdgeList._sectionIsImmediate: this.sectionBlocker != null && this.sectionPtr2Blocked != null ' +
        '&& *sectionPtr2Blocked != null FAILED');

    var sectionBlocked = this.sectionPtr2Blocked[0],
        e = sectionBlocked.getSectionDown(),
        a1 = sectionBlocked.sectionX1,
        a2 = sectionBlocked.sectionX2,
        p1 = sectionBlocked.positionX1,
        p2 = sectionBlocked.positionX2,
        b1 = this.sectionBlocker.sectionX1,
        b2 = this.sectionBlocker.sectionX2;

    if (e !== null) {
        e = (e.startpoint === null || e.sectionX1 === undefined ? null : e);
    }

    assert(b1 <= a2 && a1 <= b2,
        'AREdgeList._sectionIsImmediate: b1 <= a2 && a1 <= b2 FAILED');                     // not case 1 or 6

    // NOTE WE CHANGED THE CONDITIONS (A1<=B1 AND B2<=A2)
    // BECAUSE HERE WE NEED THIS!

    if (a1 <= b1) {
        while (!(e === null || e.startpoint === null) && e.sectionX2 < b1) {
            e = e.getSectionNext();
        }

        if (b2 <= a2) {
            return (e === null || e.startpoint === null) || b2 < e.sectionX1;               // case 3
        }

        return (e === null || e.startpoint === null) && a2 === p2;                          // case 2
    }

    if (b2 <= a2) {
        return a1 === p1 && ((e === null || e.startpoint === null) || b2 < e.sectionX1);    // case 5
    }

    return (e === null || e.startpoint === null) && a1 === p1 && a2 === p2;                 // case 4
};


// The following methods are convenience methods for adjusting the 'section' 
// of an edge.
/**
 * Get either min+1 or a value between min and max. Technically,
 * we are looking for [min, max).
 *
 * @param {Number} min
 * @param {Number} max
 * @return {Number} result
 */
var getLargerEndpoint = function (min, max) {
    var result;
    assert(min < max);

    result = Math.min(min + 1, (min + max) / 2);
    if (result === max) {
        result = min;
    }
    assert(result < max);
    return result;
};

/**
 * Get either max-1 or a value between min and max. Technically,
 * we are looking for (min, max].
 *
 * @param {Number} min
 * @param {Number} max
 * @return {Number} result
 */
var getSmallerEndpoint = function (min, max) {
    var result;
    assert(min < max);

    // If min is so small that 
    // 
    //      (min+max)/2 === min
    //
    // then we will simply use max value for the result
    result = Math.max(max - 1, (min + max) / 2);
    if (result === min) {
        result = max;
    }

    assert(result > min);
    return result;
};

AutoRouterEdgeList.prototype._sectionHasBlockedEdge = function () {
    assert(this.sectionBlocker !== null,
        'AREdgeList._sectionHasBlockedEdge: this.sectionBlocker != null FAILED');

    var newSectionX1,
        newSectionX2,
        e,
        blockerX1 = this.sectionBlocker.sectionX1,
        blockerX2 = this.sectionBlocker.sectionX2;

    assert(blockerX1 <= blockerX2,
        'AREdgeList._sectionHasBlockedEdge: blockerX1 <= blockerX2 FAILED');

    // Setting this.sectionPtr2Blocked
    if (this.sectionPtr2Blocked === null) {  // initialize sectionPtr2Blocked

        this.sectionFirst = this.sectionFirst === null ? [new AutoRouterEdge()] : this.sectionFirst;
        this.sectionPtr2Blocked = this.sectionFirst;
    } else {   // get next sectionPtr2Blocked
        var currentEdge = this.sectionPtr2Blocked[0];

        assert(currentEdge.startpoint !== null,
            'AREdgeList._sectionHasBlockedEdge: currentEdge.startpoint === null');

        var o = null;

        e = currentEdge.getSectionDownPtr()[0];
        newSectionX1 = currentEdge.sectionX1;
        newSectionX2 = currentEdge.sectionX2;

        assert(newSectionX1 <= newSectionX2,
            'AREdgeList._sectionHasBlockedEdge: newSectionX1 <= newSectionX2 FAILED (' + newSectionX1 +
            ' <= ' + newSectionX2 + ')' + '\nedge is ');

        assert(blockerX1 <= newSectionX2 && newSectionX1 <= blockerX2,
            'AREdgeList._sectionHasBlockedEdge: blockerX1 <= newSectionX2 &&  newSectionX1 <= blockerX2 FAILED');
        // not case 1 or 6
        if (newSectionX1 < blockerX1 && blockerX2 < newSectionX2) {                                 // case 3
            this.sectionPtr2Blocked = currentEdge.getSectionDownPtr();

        } else if (blockerX1 <= newSectionX1 && newSectionX2 <= blockerX2) {                        // case 4

            if (e && e.startpoint !== null) {
                while (e.getSectionNext() && e.getSectionNext().startpoint !== null) {
                    e = e.getSectionNext();
                }

                e.setSectionNext(currentEdge.getSectionNext());
                this.sectionPtr2Blocked[0] = currentEdge.getSectionDown();
            } else {

                this.sectionPtr2Blocked[0] = (currentEdge.getSectionNext());

            }
        } else if (blockerX1 <= newSectionX1 && blockerX2 < newSectionX2) {                         // case 5

            assert(newSectionX1 <= blockerX2,
                'AREdgeList._sectionHasBlockedEdge: newSectionX1 <= blockerX2 FAILED');

            // Move newSectionX1 such that blockerX2 < newSectionX1 < newSectionX2
            newSectionX1 = getLargerEndpoint(blockerX2, newSectionX2);

            while ((e && e.startpoint !== null) && e.sectionX1 <= newSectionX1) {
                assert(e.sectionX1 <= e.sectionX2,
                    'AREdgeList._sectionHasBlockedEdge: e.sectionX1 <= e.sectionX2 FAILED');

                if (newSectionX1 <= e.sectionX2) {
                    newSectionX1 = getLargerEndpoint(e.sectionX2, newSectionX2);
                }

                o = e;
                e = e.getSectionNext();
            }

            if (o) {
                // Insert currentEdge to be sectionNext of the given edge in the list 
                // of sectionDown (basically, collapsing currentEdge into the sectionDown 
                // list. The values in the list following currentEdge will then be set to 
                // be sectionDown of the currentEdge.)
                this.sectionPtr2Blocked[0] = currentEdge.getSectionDownPtr()[0];
                o.setSectionNext(currentEdge);
                currentEdge.setSectionDown(e);
            }

            assert(blockerX2 < newSectionX1,
                'AREdgeList._sectionHasBlockedEdge: blockerX2 < newSectionX1 FAILED (' +
                blockerX2 + ' < ' + newSectionX1 + ') ' +
                currentEdge.sectionX2 + ' is ' + newSectionX2 + ')');
            // Shifting the front of the p2b so it no longer overlaps this.sectionBlocker

            currentEdge.sectionX1 = newSectionX1;

            assert(currentEdge.sectionX1 < currentEdge.sectionX2,
                'currentEdge.sectionX1 < currentEdge.sectionX2 (' +
                currentEdge.sectionX1 + ' < ' + currentEdge.sectionX2 + ')');
        } else {                                                                                        // case 2
            assert(newSectionX1 < blockerX1 && blockerX1 <= newSectionX2 && newSectionX2 <= blockerX2,
                'AREdgeList._sectionHasBlockedEdge:  newSectionX1 < blockerX1 && blockerX1 <= newSectionX2 && ' +
                'newSectionX2 <= blockerX2 FAILED');

            this.sectionPtr2Blocked = currentEdge.getSectionDownPtr();

            while (e && e.startpoint !== null) {
                o = e;
                e = e.getSectionNext();

                if (o.sectionX2 + 1 < blockerX1 && (e === null || e.startpoint === null ||
                    o.sectionX2 + 1 < e.sectionX1)) {

                    this.sectionPtr2Blocked = o.getSectionNextPtr();
                }
            }

            if (this.sectionPtr2Blocked[0].startpoint !== null) {
                assert(o !== null,
                    'AREdgeList._sectionHasBlockedEdge: o != null FAILED');
                o.setSectionNext(currentEdge.getSectionNext());

                var larger = blockerX1;

                if (this.sectionPtr2Blocked[0].sectionX1 < blockerX1) {
                    larger = this.sectionPtr2Blocked[0].sectionX1;
                }

                currentEdge.sectionX2 = getSmallerEndpoint(newSectionX1, larger);

                currentEdge.setSectionNext(this.sectionPtr2Blocked[0]);
                this.sectionPtr2Blocked[0] = new AutoRouterEdge(); //This seems odd
                this.sectionPtr2Blocked = null;

            } else {
                currentEdge.sectionX2 = getSmallerEndpoint(newSectionX1, blockerX1);
            }

            assert(currentEdge.sectionX1 < currentEdge.sectionX2,
                'Expected sectionX1 < sectionX2 but ' + currentEdge.sectionX1 +
                ' is not < ' + currentEdge.sectionX2);

            this.sectionPtr2Blocked = currentEdge.getSectionNextPtr();
        }
    }

    assert(this.sectionPtr2Blocked !== null,
        'AREdgeList._sectionHasBlockedEdge: this.sectionPtr2Blocked != null FAILED');
    while (this.sectionPtr2Blocked[0] !== null && this.sectionPtr2Blocked[0].startpoint !== null) {
        newSectionX1 = this.sectionPtr2Blocked[0].sectionX1;
        newSectionX2 = this.sectionPtr2Blocked[0].sectionX2;

        if (newSectionX2 < blockerX1) {                                                 // case 1
            //If this.sectionPtr2Blocked is completely to the left (or above) this.sectionBlocker
            this.sectionPtr2Blocked = this.sectionPtr2Blocked[0].getSectionNextPtr();

            assert(this.sectionPtr2Blocked !== null,
                'AREdgeList._sectionHasBlockedEdge: this.sectionPtr2Blocked != null FAILED');
            continue;
        } else if (blockerX2 < newSectionX1) {                                        // case 6
            //If this.sectionBlocker is completely to the right (or below) this.sectionPtr2Blocked
            break;
        }

        if (newSectionX1 < blockerX1 && blockerX2 < newSectionX2) {                     // case 3
            //If this.sectionPtr2Blocked starts before and ends after this.sectionBlocker
            var x = blockerX1;
            e = this.sectionPtr2Blocked[0].getSectionDown();

            for (; ;) {

                if (e === null || e.startpoint === null || x < e.sectionX1) {
                    return true;
                } else if (x <= e.sectionX2) {
                    x = e.sectionX2 + 1;
                    if (blockerX2 < x) {
                        break;
                    }
                }

                e = e.getSectionNext();
            }

            this.sectionPtr2Blocked = this.sectionPtr2Blocked[0].getSectionDownPtr();
            continue;
        }
        // This leaves the regular partial overlap possibility.
        // They also include this.sectionBlocker starting before and ending after this.sectionPtr2Blocked.

        return true;
    }

    assert(this.sectionBlocker.getSectionNext() === null &&
        (this.sectionBlocker.getSectionDown() === null ||
        this.sectionBlocker.getSectionDown().startpoint === null),
        'AREdgeList._sectionHasBlockedEdge: this.sectionBlocker.getSectionNext() === null &&' +
        'this.sectionBlocker.getSectionDown() === null FAILED');

    this.sectionBlocker.setSectionNext(this.sectionPtr2Blocked[0]);

    // Set anything pointing to this.sectionPtr2Blocked to point to this.sectionBlocker (eg, sectionDown)
    this.sectionPtr2Blocked[0] = this.sectionBlocker;

    this.sectionBlocker = null;
    this.sectionPtr2Blocked = null;

    return false;
};

AutoRouterEdgeList.prototype._sectionGetBlockedEdge = function () {
    assert(this.sectionBlocker !== null && this.sectionPtr2Blocked !== null,
        'AREdgeList.sectionGetBlockedEdge: this.sectionBlocker !== null && ' +
        'this.sectionPtr2Blocked !== null FAILED');

    return this.sectionPtr2Blocked[0];
};

//----Bracket

AutoRouterEdgeList.prototype._bracketIsClosing = function (edge) {
    assert(edge !== null, 'AREdgeList._bracketIsClosing: edge !== null FAILED');
    assert(!edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList._bracketIsClosing: !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');

    var start = edge.startpoint,
        end = edge.endpoint;

    if (edge.isStartPointPrevNull() || edge.isEndPointNextNull()) {
        return false;
    }

    return this.ishorizontal ?
        (edge.startpointPrev.y < start.y && edge.endpointNext.y < end.y ) :
        (edge.startpointPrev.x < start.x && edge.endpointNext.x < end.x );
};

AutoRouterEdgeList.prototype._bracketIsOpening = function (edge) {
    assert(edge !== null, 'AREdgeList._bracketIsOpening: edge !== null FAILED');
    assert(!edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList._bracketIsOpening: !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');

    var start = edge.startpoint || edge.startpoint,
        end = edge.endpoint || edge.endpoint,
        prev,
        next;

    if (edge.isStartPointPrevNull() || edge.isEndPointNextNull()) {
        return false;
    }

    next = edge.endpointNext || edge.endpointNext;
    prev = edge.startpointPrev || edge.startpointPrev;

    return this.ishorizontal ?
        (prev.y > start.y && next.y > end.y ) :
        (prev.x > start.x && next.x > end.x );
};

AutoRouterEdgeList.prototype._bracketShouldBeSwitched = function (edge, next) {
    assert(edge !== null && next !== null,
        'AREdgeList._bracketShouldBeSwitched: edge !== null && next !== null FAILED');

    var ex = this._positionGetRealX(edge),
        ex1 = ex[0],
        ex2 = ex[1],
        eo = this._positionGetRealO(edge),
        eo1 = eo[0],
        eo2 = eo[1],
        nx = this._positionGetRealX(next),
        nx1 = nx[0],
        nx2 = nx[1],
        no = this._positionGetRealO(next),
        no1 = no[0],
        no2 = no[1];

    var c1, c2;

    if ((nx1 < ex1 && ex1 < nx2 && eo1 > 0 ) || (ex1 < nx1 && nx1 < ex2 && no1 < 0)) {
        c1 = +1;
    } else if (ex1 === nx1 && eo1 === 0 && no1 === 0) {
        c1 = 0;
    } else {
        c1 = -9;
    }

    if ((nx1 < ex2 && ex2 < nx2 && eo2 > 0 ) || (ex1 < nx2 && nx2 < ex2 && no2 < 0)) {
        c2 = +1;
    } else if (ex2 === nx2 && eo2 === 0 && no2 === 0) {
        c2 = 0;
    } else {
        c2 = -9;
    }

    return (c1 + c2) > 0;
};

//---Block

AutoRouterEdgeList.prototype._blockGetF = function (d, b, s) {
    var f = d / (b + s), //f is the total distance between edges divided by the total number of edges
        S = CONSTANTS.EDLS_S, //This is 'SMALLGAP'
        R = CONSTANTS.EDLS_R,//This is 'SMALLGAP + 1'
        D = CONSTANTS.EDLS_D; //This is the total distance of the graph

    //If f is greater than the SMALLGAP, then make some checks/edits
    if (b === 0 && R <= f) {
        // If every comparison resulted in an overlap AND SMALLGAP + 1 is less than
        // the distance between each edge (in the given range).
        f += (D - R);
    } else if (S < f && s > 0) {
        f = ((D - S) * d - S * (D - R) * s) / ((D - S) * b + (R - S) * s);
    }

    return f;
};

AutoRouterEdgeList.prototype._blockGetG = function (d, b, s) {
    var g = d / (b + s),
        S = CONSTANTS.EDLS_S,
        R = CONSTANTS.EDLS_R,
        D = CONSTANTS.EDLS_D;

    if (S < g && b > 0) {
        g = ((R - S) * d + S * (D - R) * b) / ((D - S) * b + (R - S) * s);
    }

    return g;
};

AutoRouterEdgeList.prototype._blockPushBackward = function (blocked, blocker) {
    var modified = false;

    assert(blocked !== null && blocker !== null,
        'AREdgeList._blockPushBackward: blocked !== null && blocker !== null FAILED');
    assert(blocked.positionY <= blocker.positionY,
        'AREdgeList._blockPushBackward: blocked.positionY <= blocker.positionY FAILED');
    assert(blocked.getBlockPrev() !== null,
        'AREdgeList._blockPushBackward: blocked.getBlockPrev() !== null FAILED');

    var f = 0,
        g = 0,
        edge = blocked,
        trace = blocker,
        d = trace.positionY - edge.positionY;

    assert(d >= 0,
        'AREdgeList._blockPushBackward: d >= 0 FAILED');

    var s = (edge.bracketOpening || trace.bracketClosing),
        b = 1 - s,
        d2;

    for (; ;) {
        edge.setBlockTrace(trace);
        trace = edge;
        edge = edge.getBlockPrev();

        if (edge === null) {
            break;
        }

        d2 = trace.positionY - edge.positionY;
        assert(d2 >= 0,
            'AREdgeList._blockPushBackward:  d2 >= 0 FAILED');

        if (edge.bracketOpening || trace.bracketClosing) {
            g = this._blockGetG(d, b, s);
            if (d2 <= g) {
                f = this._blockGetF(d, b, s);
                break;
            }
            s++;
        } else {
            f = this._blockGetF(d, b, s);
            if (d2 <= f) {
                g = this._blockGetG(d, b, s);
                break;
            }
            b++;
        }

        d += d2;
    }

    if (b + s > 1) {
        if (edge === null) {
            f = this._blockGetF(d, b, s);
            g = this._blockGetG(d, b, s);
        }

        assert(Utils.floatEquals(d, f * b + g * s),
            'AREdgeList._blockPushBackward: floatEquals(d, f*b + g*s) FAILED');

        edge = trace;
        assert(edge !== null && edge !== blocked,
            'AREdgeList._blockPushBackward: edge !== null && edge !== blocked FAILED');

        var y = edge.positionY;

        do {
            assert(edge !== null && edge.getBlockTrace() !== null,
                'AREdgeList._blockPushBackward: edge !== null && edge.getBlockTrace() !== null FAILED');

            trace = edge.getBlockTrace();

            y += (edge.bracketOpening || trace.bracketClosing) ? g : f;
            y = Utils.roundTrunc(y, 10);  // Fix any floating point errors

            if (y + 0.001 < trace.positionY) {
                modified = true;
                if (this._slideButNotPassEdges(trace, y)) {
                    trace.setBlockPrev(null);
                }
            }

            edge = trace;
        } while (edge !== blocked);

        if (CONSTANTS.DEBUG) {
            //y += (edge.bracketOpening || blocker.bracketClosing) ? g : f;
            assert(Utils.floatEquals(y, blocker.positionY),
                'AREdgeList._blockPushBackward: floatEquals(y, blocker.positionY) FAILED');
        }
    }

    return modified;
};

AutoRouterEdgeList.prototype._blockPushForward = function (blocked, blocker) {
    var modified = false;

    assert(blocked !== null && blocker !== null,
        'AREdgeList._blockPushForward: blocked !== null && blocker !== null FAILED');
    assert(blocked.positionY >= blocker.positionY,
        'AREdgeList._blockPushForward: blocked.positionY >= blocker.positionY FAILED');
    assert(blocked.getBlockNext() !== null,
        'AREdgeList._blockPushForward: blocked.getBlockNext() !== null FAILED');

    var f = 0,
        g = 0,
        edge = blocked,
        trace = blocker,
        d = edge.positionY - trace.positionY;

    assert(d >= 0,
        'AREdgeList._blockPushForward:  d >= 0 FAILED');

    var s = (trace.bracketOpening || edge.bracketClosing),
        b = 1 - s,
        d2;

    for (; ;) {
        edge.setBlockTrace(trace);
        trace = edge;
        edge = edge.getBlockNext();

        if (edge === null) {
            break;
        }

        d2 = edge.positionY - trace.positionY;
        assert(d2 >= 0,
            'AREdgeList._blockPushForward: d2 >= 0 FAILED');

        if (trace.bracketOpening || edge.bracketClosing) {
            g = this._blockGetG(d, b, s);
            if (d2 <= g) {
                f = this._blockGetF(d, b, s);
                break;
            }
            s++;
        } else {
            f = this._blockGetF(d, b, s);
            if (d2 <= f) {
                g = this._blockGetG(d, b, s);
                break;
            }
            b++;
        }

        d += d2;
    }

    if (b + s > 1) { //Looking at more than one edge (or edge/trace comparison) {
        if (edge === null) {
            f = this._blockGetF(d, b, s);
            g = this._blockGetG(d, b, s);
        }

        assert(Utils.floatEquals(d, f * b + g * s),
            'AREdgeList._blockPushForward: floatEquals(d, f*b + g*s) FAILED');

        edge = trace;
        assert(edge !== null && !edge.equals(blocked),
            'AREdgeList._blockPushForward: edge != null && !edge.equals(blocked) FAILED');

        var y = edge.positionY;

        do {
            assert(edge !== null && edge.getBlockTrace() !== null,
                'AREdgeList._blockPushForward: edge !== null && edge.getBlockTrace() !== null FAILED');
            trace = edge.getBlockTrace();

            y -= (trace.bracketOpening || edge.bracketClosing) ? g : f;

            if (trace.positionY < y - 0.001) {
                modified = true;

                if (this._slideButNotPassEdges(trace, y)) {
                    trace.setBlockNext(null);
                }
            }

            edge = trace;
        } while (edge !== blocked);
    }


    return modified;
};

AutoRouterEdgeList.prototype.blockScanForward = function () {
    this._positionAllLoadX();

    var modified = false;

    this.sectionReset();

    var blocker = this.orderFirst,
        blocked,
        bmin,
        smin,
        bMinF,
        sMinF;

    while (blocker) {
        bmin = null; //block min?
        smin = null; //section min?
        bMinF = CONSTANTS.ED_MINCOORD - 1;
        sMinF = CONSTANTS.ED_MINCOORD - 1;

        this._sectionBeginScan(blocker);
        while (this._sectionHasBlockedEdge()) {
            if (this._sectionIsImmediate()) {
                blocked = this._sectionGetBlockedEdge();
                assert(blocked !== null,
                    'AREdgeList._blockPushForward: blocked !== null FAILED');

                if (blocked.getBlockPrev() !== null) {
                    modified = this._blockPushBackward(blocked, blocker) || modified;
                }

                if (!blocker.edgeFixed) {
                    if (blocked.bracketOpening || blocker.bracketClosing) {
                        if (sMinF < blocked.positionY) {
                            sMinF = blocked.positionY;
                            smin = blocked;
                        }
                    } else {
                        if (bMinF < blocked.positionY) {
                            bMinF = blocked.positionY;
                            bmin = blocked;
                        }
                    }
                }
            }

        }

        if (bmin) {
            if (smin) {
                blocker.setClosestPrev(sMinF > bMinF ? smin : bmin);

                bMinF = blocker.positionY - bMinF;
                sMinF = this._blockGetF(blocker.positionY - sMinF, 0, 1);

                blocker.setBlockPrev(sMinF < bMinF ? smin : bmin);
            } else {
                blocker.setBlockPrev(bmin);
                blocker.setClosestPrev(bmin);
            }
        } else {
            blocker.setBlockPrev(smin);
            blocker.setClosestPrev(smin);
        }


        blocker = blocker.orderNext;
    }

    this._positionAllStoreY();

    return modified;
};

AutoRouterEdgeList.prototype.blockScanBackward = function () {
    this._positionAllLoadX();

    var modified = false;

    this.sectionReset();
    var blocker = this.orderLast,
        blocked,
        bmin,
        smin,
        bMinF,
        sMinF;

    while (blocker) {
        bmin = null;
        smin = null;
        bMinF = CONSTANTS.ED_MAXCOORD + 1;
        sMinF = CONSTANTS.ED_MAXCOORD + 1;

        this._sectionBeginScan(blocker);

        while (this._sectionHasBlockedEdge()) {
            if (this._sectionIsImmediate()) {
                blocked = this._sectionGetBlockedEdge();

                assert(blocked !== null,
                    'AREdgeList.blockScanBackward: blocked !== null FAILED');

                if (blocked.getBlockNext() !== null) {
                    modified = this._blockPushForward(blocked, blocker) || modified;
                }

                if (!blocker.edgeFixed) {
                    if (blocker.bracketOpening || blocked.bracketClosing) {
                        if (sMinF > blocked.positionY) {
                            sMinF = blocked.positionY;
                            smin = blocked;
                        }
                    } else {
                        if (bMinF > blocked.positionY) {
                            bMinF = blocked.positionY;
                            bmin = blocked;
                        }
                    }
                }
            }
        }

        if (bmin) {
            if (smin) {
                blocker.setClosestNext(sMinF < bMinF ? smin : bmin);

                bMinF = bMinF - blocker.positionY;
                sMinF = this._blockGetF(sMinF - blocker.positionY, 0, 1);

                blocker.setBlockNext(sMinF < bMinF ? smin : bmin);
            } else {
                blocker.setBlockNext(bmin);
                blocker.setClosestNext(bmin);
            }
        } else {
            blocker.setBlockNext(smin);
            blocker.setClosestNext(smin);
        }

        blocker = blocker.orderPrev;
    }

    this._positionAllStoreY();

    return modified;
};

AutoRouterEdgeList.prototype.blockSwitchWrongs = function () {
    var was = false;

    this._positionAllLoadX();
    var second = this.orderFirst,
        edge,
        next,
        ey,
        ny,
        a;

    while (second !== null) {
        //Check if it references itself
        if (second.getClosestPrev() !== null && second.getClosestPrev().getClosestNext() !== (second) &&
            second.getClosestNext() !== null && second.getClosestNext().getClosestPrev() === (second)) {

            assert(!second.edgeFixed,
                'AREdgeList.blockSwitchWrongs: !second.edgeFixed FAILED');

            edge = second;
            next = edge.getClosestNext();

            while (next !== null && edge === next.getClosestPrev()) {
                assert(edge !== null && !edge.edgeFixed,
                    'AREdgeList.blockSwitchWrongs: edge != null && !edge.edgeFixed FAILED');
                assert(next !== null && !next.edgeFixed,
                    'AREdgeList.blockSwitchWrongs: next != null && !next.edgeFixed FAILED');

                ey = edge.positionY;
                ny = next.positionY;

                assert(ey <= ny,
                    'AREdgeList.blockSwitchWrongs: ey <= ny FAILED');

                if (ey + 1 <= ny && this._bracketShouldBeSwitched(edge, next)) {
                    was = true;

                    assert(!edge.getEdgeCanpassed() && !next.getEdgeCanpassed(),
                        'AREdgeList.blockSwitchWrongs: !edge.getEdgeCanpassed() && ' +
                        '!next.getEdgeCanpassed() FAILED');
                    edge.setEdgeCanpassed(true);
                    next.setEdgeCanpassed(true);

                    a = this._slideButNotPassEdges(edge, (ny + ey) / 2 + 0.001) !== null;
                    a = this._slideButNotPassEdges(next, (ny + ey) / 2 - 0.001) !== null || a;

                    if (a) {
                        edge.setClosestPrev(null);
                        edge.setClosestNext(null);
                        next.setClosestPrev(null);
                        next.setClosestNext(null);

                        edge.setEdgeCanpassed(false);
                        next.setEdgeCanpassed(false);
                        break;
                    }

                    if (edge.getClosestPrev() !== null && edge.getClosestPrev().getClosestNext() === edge) {
                        edge.getClosestPrev().setClosestNext(next);
                    }

                    if (next.getClosestNext() !== null && next.getClosestNext().getClosestPrev() === next) {
                        next.getClosestNext().setClosestPrev(edge);
                    }

                    edge.setClosestNext(next.getClosestNext());
                    next.setClosestNext(edge);
                    next.setClosestPrev(edge.getClosestPrev());
                    edge.setClosestPrev(next);

                    edge.setEdgeCanpassed(false);
                    next.setEdgeCanpassed(false);

                    assert(!this._bracketShouldBeSwitched(next, edge),
                        'AREdgeList.blockSwitchWrongs: !bracketShouldBeSwitched(next, edge) FAILED');

                    if (next.getClosestPrev() !== null && next.getClosestPrev().getClosestNext() === next) {
                        edge = next.getClosestPrev();
                    } else {
                        next = edge.getClosestNext();
                    }
                } else {
                    edge = next;
                    next = next.getClosestNext();
                }
            }
        }

        second = second.orderNext;
    }

    if (was) {
        this._positionAllStoreY();
    }

    return was;
};

AutoRouterEdgeList.prototype.assertValid = function () {
    // Check that all edges have start/end points
    var edge = this.orderFirst;
    while (edge) {
        assert(edge.startpoint.x !== undefined, 'Edge has unrecognized startpoint: ' + edge.startpoint);
        assert(edge.endpoint.x !== undefined, 'Edge has unrecognized endpoint: ' + edge.endpoint);
        edge = edge.orderNext;
    }
};

module.exports = AutoRouterEdgeList;

},{"./AutoRouter.Box":5,"./AutoRouter.Constants":6,"./AutoRouter.Edge":7,"./AutoRouter.Logger":10,"./AutoRouter.Path":11,"./AutoRouter.Port":14,"./AutoRouter.Utils":17}],9:[function(require,module,exports){
/*globals define, WebGMEGlobal*/
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var Logger = require('./AutoRouter.Logger'),  // FIXME
    CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArPointListPath = require('./AutoRouter.PointList'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterPath = require('./AutoRouter.Path'),
    AutoRouterPort = require('./AutoRouter.Port'),
    AutoRouterBox = require('./AutoRouter.Box'),
    AutoRouterEdge = require('./AutoRouter.Edge'),
    AutoRouterEdgeList = require('./AutoRouter.EdgeList');

var _logger = new Logger('AutoRouter.Graph'),
    COUNTER = 1;  // Used for unique ids

var AutoRouterGraph = function () {
    this.completelyConnected = true;  // true if all paths are connected
    this.horizontal = new AutoRouterEdgeList(true);
    this.vertical = new AutoRouterEdgeList(false);
    this.boxes = {};
    this.paths = [];
    this.bufferBoxes = [];
    this.box2bufferBox = {}; // maps boxId to corresponding bufferbox object

    this.horizontal.owner = this;
    this.vertical.owner = this;

    //Initializing selfPoints
    this.selfPoints = [
        new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MINCOORD),
        new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MINCOORD),
        new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MAXCOORD),
        new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MAXCOORD)
    ];

    this._addSelfEdges();
};

//Functions
AutoRouterGraph.prototype._deleteAllBoxes = function () {
    var ids = Object.keys(this.boxes);
    for (var i = ids.length; i--;) {
        this.boxes[ids[i]].destroy();
        delete this.boxes[ids[i]];
    }
    // Clean up the bufferBoxes
    this.bufferBoxes = [];
    this.box2bufferBox = {};
};

AutoRouterGraph.prototype._getBoxAt = function (point, nearness) {
    var ids = Object.keys(this.boxes);
    for (var i = ids.length; i--;) {
        if (this.boxes[ids[i]].isBoxAt(point, nearness)) {
            return this.boxes[ids[i]];
        }
    }

    return null;
};

AutoRouterGraph.prototype._setPortAttr = function (port, attr) {
    this._disconnectPathsFrom(port);
    port.attributes = attr;
};

AutoRouterGraph.prototype._isRectClipBoxes = function (rect) {
    var boxRect;
    var ids = Object.keys(this.boxes);
    for (var i = ids.length; i--;) {
        boxRect = this.boxes[ids[i]].rect;
        if (Utils.isRectClip(rect, boxRect)) {
            return true;
        }
    }
    return false;
};

AutoRouterGraph.prototype._isRectClipBufferBoxes = function (rect) {
    var i = this.bufferBoxes.length,
        c;

    while (i--) {
        c = this.bufferBoxes[i].children.length;

        while (c--) {
            if (Utils.isRectClip(rect, this.bufferBoxes[i].children[c])) {
                return true;
            }
        }
    }

    return false;
};

AutoRouterGraph.prototype._isLineClipBufferBoxes = function (p1, p2) {
    var rect = new ArRect(p1, p2);
    rect.normalizeRect();
    assert(rect.left === rect.right || rect.ceil === rect.floor,
        'ARGraph.this._isLineClipBoxes: rect.left === rect.right || rect.ceil === rect.floor FAILED');

    if (rect.left === rect.right) {
        rect.right++;
    }
    if (rect.ceil === rect.floor) {
        rect.floor++;
    }

    return this._isRectClipBufferBoxes(rect);
};

AutoRouterGraph.prototype._isLineClipBoxes = function (p1, p2) {
    var rect = new ArRect(p1, p2);
    rect.normalizeRect();
    assert(rect.left === rect.right || rect.ceil === rect.floor,
        'ARGraph.isLineClipBoxes: rect.left === rect.right || rect.ceil === rect.floor FAILED');

    if (rect.left === rect.right) {
        rect.right++;
    }
    if (rect.ceil === rect.floor) {
        rect.floor++;
    }

    return this._isRectClipBoxes(rect);
};

AutoRouterGraph.prototype._canBoxAt = function (rect) {
    return !this._isRectClipBoxes.inflatedRect(rect, 1);
};

AutoRouterGraph.prototype._add = function (path) {
    assert(path !== null, 'ARGraph.add: path !== null FAILED');
    assert(!path.hasOwner(), 'ARGraph.add: !path.hasOwner() FAILED');

    path.owner = this;

    this.paths.push(path);

    this.horizontal.addPathEdges(path);
    this.vertical.addPathEdges(path);

    if (CONSTANTS.DEBUG) {
        this._assertValidPath(path);
    }

};

AutoRouterGraph.prototype._deleteAllPaths = function () {
    for (var i = this.paths.length; i--;) {
        this.paths[i].destroy();  // Remove point from start/end port
    }

    this.paths = [];
};

AutoRouterGraph.prototype._hasNoPath = function () {
    return this.paths.length === 0;
};

AutoRouterGraph.prototype._getPathCount = function () {
    return this.paths.length;
};

AutoRouterGraph.prototype._getListEdgeAt = function (point, nearness) {

    var edge = this.horizontal.getEdgeAt(point, nearness);
    if (edge) {
        return edge;
    }

    return this.vertical.getEdgeAt(point, nearness);
};

AutoRouterGraph.prototype._getSurroundRect = function () {
    var rect = new ArRect(0, 0, 0, 0),
        i;

    var ids = Object.keys(this.boxes);
    for (i = ids.length; i--;) {
        rect.unionAssign(this.boxes[ids[i]].rect);
    }

    for (i = this.paths.length; i--;) {
        rect.unionAssign(this.paths[i].getSurroundRect());
    }

    return rect;
};

AutoRouterGraph.prototype._getOutOfBox = function (details) {
    var bufferObject = this.box2bufferBox[details.box.id],
        children = bufferObject.children,
        i = bufferObject.children.length,
        point = details.point,
        dir = details.dir,
        boxRect = new ArRect(details.box.rect);

    boxRect.inflateRect(CONSTANTS.BUFFER); //Create a copy of the buffer box

    assert(Utils.isRightAngle(dir), 'ARGraph.getOutOfBox: Utils.isRightAngle (dir) FAILED');

    while (boxRect.ptInRect(point)) {
        if (Utils.isHorizontal(dir)) {
            point.x = Utils.getRectOuterCoord(boxRect, dir);
        } else {
            point.y = Utils.getRectOuterCoord(boxRect, dir);
        }

        while (i--) {
            if (children[i].ptInRect(point)) {
                boxRect = children[i];
                break;
            }
        }
        i = bufferObject.children.length;
    }

    assert(!boxRect.ptInRect(point), 'ARGraph.getOutOfBox: !boxRect.ptInRect( point) FAILED');
};

AutoRouterGraph.prototype._goToNextBufferBox = function (args) {
    var point = args.point,
        end = args.end,
        dir = args.dir,
        dir2 = args.dir2 === undefined || !Utils.isRightAngle(args.dir2) ? (end instanceof ArPoint ?
            Utils.exGetMajorDir(end.minus(point)) : CONSTANTS.DirNone) : args.dir2,
        stophere = args.end !== undefined ? args.end :
            (dir === 1 || dir === 2 ? CONSTANTS.ED_MAXCOORD : CONSTANTS.ED_MINCOORD );

    if (dir2 === dir) {
        dir2 = Utils.isRightAngle(Utils.exGetMinorDir(end.minus(point))) ?
            Utils.exGetMinorDir(end.minus(point)) : (dir + 1) % 4;
    }

    if (end instanceof ArPoint) {
        stophere = Utils.getPointCoord(stophere, dir);
    }

    assert(Utils.isRightAngle(dir), 'ArGraph.goToNextBufferBox: Utils.isRightAngle (dir) FAILED');
    assert(Utils.getPointCoord(point, dir) !== stophere,
        'ArGraph.goToNextBufferBox: Utils.getPointCoord (point, dir) !== stophere FAILED');

    var boxby = null,
        i = -1,
        boxRect;
    //jscs:disable maximumLineLength
    while (++i < this.bufferBoxes.length) {
        boxRect = this.bufferBoxes[i].box;

        if (!Utils.isPointInDirFrom(point, boxRect, dir) && //Add support for entering the parent box
            Utils.isPointBetweenSides(point, boxRect, dir) &&  // if it will not put the point in a corner (relative to dir2)
            Utils.isCoordInDirFrom(stophere,
                Utils.getChildRectOuterCoordFrom(this.bufferBoxes[i], dir, point).coord, dir)) {
            //Return extreme (parent box) for this comparison
            stophere = Utils.getChildRectOuterCoordFrom(this.bufferBoxes[i], dir, point).coord;
            boxby = this.bufferBoxes[i];
        }
    }
    //jscs:enable maximumLineLength

    if (Utils.isHorizontal(dir)) {
        point.x = stophere;
    } else {
        point.y = stophere;
    }

    return boxby;
};

AutoRouterGraph.prototype._hugChildren = function (bufferObject, point, dir1, dir2, exitCondition) {
    // This method creates a path that enters the parent box and 'hugs' the children boxes
    // (remains within one pixel of them) and follows them out.
    assert((dir1 + dir2) % 2 === 1, 'ARGraph.hugChildren: One and only one direction must be horizontal');
    var children = bufferObject.children,
        parentBox = bufferObject.box,
        initPoint = new ArPoint(point),
        child = this._goToNextBox(point, dir1, (dir1 === 1 || dir1 === 2 ?
            CONSTANTS.ED_MAXCOORD : CONSTANTS.ED_MINCOORD ), children),
        finalPoint,
        dir = dir2,
        nextDir = Utils.nextClockwiseDir(dir1) === dir2 ? Utils.nextClockwiseDir : Utils.prevClockwiseDir,
        points = [new ArPoint(point)],
        hasExit = true,
        nextChild,
        old;

    assert(child !== null, 'ARGraph.hugChildren: child !== null FAILED');
    exitCondition = exitCondition === undefined ? function (pt) {
        return !parentBox.ptInRect(pt);
    } : exitCondition;

    _logger.info('About to hug child boxes to find a path');
    while (hasExit && !exitCondition(point, bufferObject)) {
        old = new ArPoint(point);
        nextChild = this._goToNextBox(point, dir, Utils.getRectOuterCoord(child, dir), children);

        if (!points[points.length - 1].equals(old)) {
            points.push(new ArPoint(old)); //The points array should not contain the most recent point.
        }

        if (nextChild === null) {
            dir = Utils.reverseDir(nextDir(dir));
        } else if (Utils.isCoordInDirFrom(Utils.getRectOuterCoord(nextChild, Utils.reverseDir(nextDir(dir))),
                Utils.getPointCoord(point, Utils.reverseDir(nextDir(dir))), Utils.reverseDir(nextDir(dir)))) {
            dir = nextDir(dir);
            child = nextChild;
        }

        if (finalPoint === undefined) {
            finalPoint = new ArPoint(point);
        } else if (!finalPoint.equals(old)) {
            hasExit = !point.equals(finalPoint);
        }
    }

    if (points[0].equals(initPoint)) {
        points.splice(0, 1);
    }

    if (!hasExit) {
        points = null;
        point.assign(initPoint);
    }

    return points;

};

AutoRouterGraph.prototype._goToNextBox = function (point, dir, stop1, boxList) {
    var stophere = stop1;

    /*
     if (stop2 !== undefined) {
     if (stop2 instanceof Array) {
     boxList = stop2;
     } else {
     stophere = stop1 instanceof ArPoint ?
     chooseInDir.getPointCoord (stop1, dir), Utils.getPointCoord (stop2, dir), Utils.reverseDir (dir)) :
     chooseInDir(stop1, stop2, Utils.reverseDir (dir));
     }

     }else */
    if (stop1 instanceof ArPoint) {
        stophere = Utils.getPointCoord(stophere, dir);
    }

    assert(Utils.isRightAngle(dir), 'ArGraph.goToNextBox: Utils.isRightAngle (dir) FAILED');
    assert(Utils.getPointCoord(point, dir) !== stophere,
        'ArGraph.goToNextBox: Utils.getPointCoord (point, dir) !== stophere FAILED');

    var boxby = null,
        iter = boxList.length,
        boxRect;

    while (iter--) {
        boxRect = boxList[iter];

        if (Utils.isPointInDirFrom(point, boxRect, Utils.reverseDir(dir)) &&
            Utils.isPointBetweenSides(point, boxRect, dir) &&
            Utils.isCoordInDirFrom(stophere, Utils.getRectOuterCoord(boxRect, Utils.reverseDir(dir)), dir)) {
            stophere = Utils.getRectOuterCoord(boxRect, Utils.reverseDir(dir));
            boxby = boxList[iter];
        }
    }

    if (Utils.isHorizontal(dir)) {
        point.x = stophere;
    } else {
        point.y = stophere;
    }

    return boxby;
};

AutoRouterGraph.prototype._getLimitsOfEdge = function (startPt, endPt, min, max) {
    var t,
        start = (new ArPoint(startPt)),
        end = (new ArPoint(endPt)),
        ids = Object.keys(this.boxes),
        i,
        rect;

    if (start.y === end.y) {
        if (start.x > end.x) {
            t = start.x;
            start.x = end.x;
            end.x = t;
        }

        for (i = ids.length; i--;) {
            rect = this.boxes[ids[i]].rect;

            if (start.x < rect.right && rect.left <= end.x) {
                if (rect.floor <= start.y && rect.floor > min) {
                    min = rect.floor;
                }
                if (rect.ceil > start.y && rect.ceil < max) {
                    max = rect.ceil;
                }
            }
        }
    } else {
        assert(start.x === end.x, 'ARGraph.this.getLimitsOfEdge: start.x === end.x FAILED');

        if (start.y > end.y) {
            t = start.y;
            start.y = end.y;
            end.y = t;
        }

        for (i = ids.length; i--;) {
            rect = this.boxes[ids[i]].rect;

            if (start.y < rect.floor && rect.ceil <= end.y) {
                if (rect.right <= start.x && rect.right > min) {
                    min = rect.right;
                }
                if (rect.left > start.x && rect.left < max) {
                    max = rect.left;
                }
            }
        }
    }

    max--;

    return {min: min, max: max};
};

AutoRouterGraph.prototype._connect = function (path) {
    var startport = path.getStartPort(),
        endport = path.getEndPort(),
        startpoint = path.startpoint,
        endpoint = path.endpoint;

    assert(startport.hasPoint(startpoint), 'ARGraph.connect: startport.hasPoint(startpoint) FAILED');
    assert(endport.hasPoint(endpoint), 'ARGraph.connect: endport.hasPoint(endpoint) FAILED');

    var startRoot = startport.owner.getRootBox(),
        endRoot = endport.owner.getRootBox(),
        startId = startRoot.id,
        endId = endRoot.id,
        startdir = startport.portOnWhichEdge(startpoint),
        enddir = endport.portOnWhichEdge(endpoint);

    if (startpoint.equals(endpoint)) {
        Utils.stepOneInDir(startpoint, Utils.nextClockwiseDir(startdir));
    }

    if (!path.isAutoRouted()) {
        path.createCustomPath();
        return this.horizontal.addPathEdges(path) && this.vertical.addPathEdges(path);
    } else if (this.box2bufferBox[startId] === this.box2bufferBox[endId] &&
        startdir === Utils.reverseDir(enddir) && startRoot !== endRoot) {

        return this._connectPointsSharingParentBox(path, startpoint, endpoint, startdir);
    } else {

        return this._connectPathWithPoints(path, startpoint, endpoint);
    }

};

AutoRouterGraph.prototype._connectPathWithPoints = function (path, startpoint, endpoint) {
    assert(startpoint instanceof ArPoint, 'ARGraph.connect: startpoint instanceof ArPoint FAILED');
    assert(path !== null && path.owner === this, 'ARGraph.connect: path !== null && path.owner === self FAILED');
    assert(!path.isConnected(), 'ARGraph.connect: !path.isConnected() FAILED');
    assert(!startpoint.equals(endpoint), 'ARGraph.connect: !startpoint.equals(endpoint) FAILED');

    var startPort = path.getStartPort();
    assert(startPort !== null, 'ARGraph.connect: startPort !== null FAILED');

    var startdir = startPort.portOnWhichEdge(startpoint),
        endPort = path.getEndPort();

    assert(endPort !== null, 'ARGraph.connect: endPort !== null FAILED');
    var enddir = endPort.portOnWhichEdge(endpoint);
    assert(Utils.isRightAngle(startdir) && Utils.isRightAngle(enddir),
        'ARGraph.connect: Utils.isRightAngle (startdir) && Utils.isRightAngle (enddir) FAILED');

    //Find the bufferbox containing startpoint, endpoint
    var start = new ArPoint(startpoint);
    this._getOutOfBox({
        point: start,
        dir: startdir,
        end: endpoint,
        box: startPort.owner
    });
    assert(!start.equals(startpoint), 'ARGraph.connect: !start.equals(startpoint) FAILED');

    var end = new ArPoint(endpoint);
    this._getOutOfBox({
        point: end,
        dir: enddir,
        end: start,
        box: endPort.owner
    });
    assert(!end.equals(endpoint), 'ARGraph.connect: !end.equals(endpoint) FAILED');

    var points,
        isAutoRouted = path.isAutoRouted();
    if (isAutoRouted) {
        points = this._connectPoints(start, end, startdir, enddir);
    }

    path.points = points;
    path.points.unshift(startpoint);
    path.points.push(endpoint);

    if (isAutoRouted) {
        this._simplifyPathCurves(path);
        path.simplifyTrivially();
        this._simplifyPathPoints(path);
        this._centerStairsInPathPoints(path, startdir, enddir);
    }
    path.setState(CONSTANTS.PathStateConnected);

    return this.horizontal.addPathEdges(path) && this.vertical.addPathEdges(path);
};

AutoRouterGraph.prototype._connectPointsSharingParentBox = function (path, startpoint, endpoint, startdir) {
    // Connect points that share a parent box and face each other
    // These will not need the simplification and complicated path finding
    var start = new ArPoint(startpoint),
        dx = endpoint.x - start.x,
        dy = endpoint.y - start.y;

    path.deleteAll();

    path.addTail(startpoint);
    if (dx !== 0 && dy !== 0) {
        if (Utils.isHorizontal(startdir)) {
            start.x += dx / 2;
            path.addTail(new ArPoint(start));
            start.y += dy;
            path.addTail(new ArPoint(start));
        } else {
            start.y += dy / 2;
            path.addTail(new ArPoint(start));
            start.x += dx;
            path.addTail(new ArPoint(start));
        }
    }
    path.addTail(endpoint);

    path.setState(CONSTANTS.PathStateConnected);

    return this.horizontal.addPathEdges(path) && this.vertical.addPathEdges(path);

};

AutoRouterGraph.prototype._connectPoints = function (start, end, hintstartdir, hintenddir, flipped) {
    var ret = new ArPointListPath(),
        thestart = new ArPoint(start),
        bufferObject,
        box,
        rect,
        dir1,
        dir2,
        old,
        oldEnd,
        ret2,
        pts,
        rev,
        i,

    //Exit conditions
    //if there is a straight line to the end point
        findExitToEndpoint = function (pt, bo) {
            return (pt.x === end.x || pt.y === end.y) && !Utils.isLineClipRects(pt, end, bo.children);
        },  //If you pass the endpoint, you need to have a way out.

    //exitCondition is when you get to the dir1 side of the box or when you pass end
        getToDir1Side = function (pt, bo) {
            return Utils.getPointCoord(pt, dir1) === Utils.getRectOuterCoord(bo.box, dir1) ||
                ( Utils.isPointInDirFrom(pt, end, dir1));
        };


    //This is where we create the original path that we will later adjust
    while (!start.equals(end)) {

        dir1 = Utils.exGetMajorDir(end.minus(start));
        dir2 = Utils.exGetMinorDir(end.minus(start));

        assert(dir1 !== CONSTANTS.DirNone, 'ARGraph.connectPoints: dir1 !== CONSTANTS.DirNone FAILED');
        assert(dir1 === Utils.getMajorDir(end.minus(start)),
            'ARGraph.connectPoints: dir1 === Utils.getMajorDir(end.minus(start)) FAILED');
        assert(dir2 === CONSTANTS.DirNone || dir2 === Utils.getMinorDir(end.minus(start)),
            'ARGraph.connectPoints: dir2 === CONSTANTS.DirNone || ' +
            'dir2 === Utils.getMinorDir(end.minus(start)) FAILED');

        if (dir2 === hintstartdir && dir2 !== CONSTANTS.DirNone) {
            // i.e. std::swap(dir1, dir2);
            dir2 = dir1;
            dir1 = hintstartdir;
        }

        ret.push(new ArPoint(start));

        old = new ArPoint(start);

        bufferObject = this._goToNextBufferBox({
            point: start,
            dir: dir1,
            dir2: dir2,
            end: end
        });  // Modified goToNextBox (that allows entering parent buffer boxes here
        box = bufferObject === null ? null : bufferObject.box;

        //If goToNextBox does not modify start
        if (start.equals(old)) {

            assert(box !== null, 'ARGraph.connectPoints: box !== null FAILED');
            rect = box instanceof ArRect ? box : box.rect;

            if (dir2 === CONSTANTS.DirNone) {
                dir2 = Utils.nextClockwiseDir(dir1);
            }

            assert(dir1 !== dir2 && dir1 !== CONSTANTS.DirNone && dir2 !== CONSTANTS.DirNone,
                'ARGraph.connectPoints: dir1 !== dir2 && dir1 !== CONSTANTS.DirNone && dir2 !== ' +
                'CONSTANTS.DirNone FAILED');
            if (bufferObject.box.ptInRect(end) && !bufferObject.box.ptInRect(start) && flipped) {
                //Unfortunately, if parentboxes are a pixel apart, start/end can get stuck and not cross the border
                //separating them.... This is a nudge to get them to cross it.
                if (Utils.isHorizontal(dir1)) {
                    start.x = end.x;
                } else {
                    start.y = end.y;
                }
            } else if (bufferObject.box.ptInRect(end)) {
                if (!flipped) {
                    _logger.info('Could not find path from',start,'to', end,'. Flipping start and end points');
                    oldEnd = new ArPoint(end);

                    ret2 = this._connectPoints(end, start, hintenddir, dir1, true);
                    i = ret2.length - 1;

                    while (i-- > 1) {
                        ret.push(ret2[i]);
                    }

                    assert(start.equals(end), 'ArGraph.connectPoints: start.equals(end) FAILED');
                    old = CONSTANTS.EMPTY_POINT;
                    start = end = oldEnd;
                } else {  //If we have flipped and both points are in the same bufferbox
                    // We will hugchildren until we can connect both points.
                    // If we can't, force it
                    pts = this._hugChildren(bufferObject, start, dir1, dir2, findExitToEndpoint);
                    if (pts !== null) {  // There is a path from start -> end
                        if (pts.length) {  // Add new points to the current list 
                            ret = ret.concat(pts);
                        }
                        ret.push(new ArPoint(start));
                        start.assign(end);  // These should not be skew! FIXME

                    } else { //Force to the endpoint
                        assert(Utils.isRightAngle(dir1), 'ARGraph.connectPoints: Utils.isRightAngle (dir1) FAILED');

                        if (Utils.isHorizontal(dir1)) {
                            start.x = end.x;
                        } else {
                            start.y = end.y;
                        }

                        ret.push(new ArPoint(start));

                        if (!Utils.isHorizontal(dir1)) {
                            start.x = end.x;
                        } else {
                            start.y = end.y;
                        }

                        ret.push(new ArPoint(start));

                        assert(start.equals(end));  // We are forcing out so these should be the same now

                    }
                    assert(!start.equals(old));
                }
            } else if (Utils.isPointInDirFrom(end, rect, dir2)) {

                assert(!Utils.isPointInDirFrom(start, rect, dir2),
                    'ARGraph.connectPoints: !Utils.isPointInDirFrom(start, rect, dir2) FAILED');
                box = this._goToNextBufferBox({
                    point: start,
                    dir: dir2,
                    dir2: dir1,
                    end: end
                });

                // this assert fails if two boxes are adjacent, and a connection wants to go between
                //assert(Utils.isPointInDirFrom(start, rect, dir2),
                // 'ARGraph.connectPoints: Utils.isPointInDirFrom(start, rect, dir2) FAILED');
                // This is not the best check with parent boxes
                if (start.equals(old)) { //Then we are in a corner
                    if (box.children.length > 1) {
                        pts = this._hugChildren(box, start, dir2, dir1, getToDir1Side);
                    } else {
                        pts = this._hugChildren(bufferObject, start, dir1, dir2);
                    }
                    if (pts !== null) {

                        //Add new points to the current list 
                        ret = ret.concat(pts);

                    } else { //Go through the blocking box
                        assert(Utils.isRightAngle(dir1), 'ARGraph.getOutOfBox: Utils.isRightAngle (dir1) FAILED');

                        if (Utils.isHorizontal(dir1)) {
                            start.x = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        } else {
                            start.y = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        }
                    }
                }
            } else {
                assert(Utils.isPointBetweenSides(end, rect, dir1),
                    'ARGraph.connectPoints: Utils.isPointBetweenSides(end, rect, dir1) FAILED');
                assert(!Utils.isPointIn(end, rect), 'ARGraph.connectPoints: !Utils.isPointIn(end, rect) FAILED');

                rev = 0;

                if (Utils.reverseDir(dir2) === hintenddir &&
                    Utils.getChildRectOuterCoordFrom(bufferObject, Utils.reverseDir(dir2), start) ===
                    Utils.getRectOuterCoord(rect, Utils.reverseDir(dir2))) { //And if point can exit that way
                    rev = 1;
                } else if (dir2 !== hintenddir) {
                    if (Utils.isPointBetweenSides(thestart, rect, dir1)) {
                        if (Utils.isPointInDirFrom(rect.getTopLeft().plus(rect.getBottomRight()),
                                start.plus(end), dir2)) {
                            rev = 1;
                        }
                    } else if (Utils.isPointInDirFrom(start, thestart, dir2)) {
                        rev = 1;
                    }
                }

                if (rev) {
                    dir2 = Utils.reverseDir(dir2);
                }

                //If the box in the way has one child
                if (bufferObject.children.length === 1) {
                    if (Utils.isHorizontal(dir2)) {
                        start.x = Utils.getRectOuterCoord(rect, dir2);
                    } else {
                        start.y = Utils.getRectOuterCoord(rect, dir2);
                    }

                    assert(!start.equals(old), 'ARGraph.connectPoints: !start.equals(old) FAILED');
                    ret.push(new ArPoint(start));
                    old.assign(start);

                    if (Utils.isHorizontal(dir1)) {
                        start.x = Utils.getRectOuterCoord(rect, dir1);
                    } else {
                        start.y = Utils.getRectOuterCoord(rect, dir1);
                    }

                    assert(Utils.isPointInDirFrom(end, start, dir1),
                        'ARGraph.connectPoints: Utils.isPointInDirFrom(end, start, dir1) FAILED');
                    if (Utils.getPointCoord(start, dir1) !== Utils.getPointCoord(end, dir1)) {
                        this._goToNextBufferBox({
                            point: start,
                            dir: dir1,
                            end: end
                        });
                    }

                } else { //If the box has multiple children
                    pts = this._hugChildren(bufferObject, start, dir1, dir2, getToDir1Side);
                    if (pts !== null) {

                        //Add new points to the current list 
                        ret = ret.concat(pts);

                    } else { //Go through the blocking box
                        assert(Utils.isRightAngle(dir1), 'ARGraph.getOutOfBox: Utils.isRightAngle (dir1) FAILED');

                        if (Utils.isHorizontal(dir1)) {
                            start.x = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        } else {
                            start.y = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        }
                    }
                }
            }

            assert(!start.equals(old), 'ARGraph.connectPoints: !start.equals(old) FAILED');
        }

    }

    ret.push(end);

    if (CONSTANTS.DEBUG) {
        ret.assertValid();  // Check that all edges are horizontal are vertical
    }

    return ret;
};

AutoRouterGraph.prototype._disconnectAll = function () {
    for (var i = this.paths.length; i--;) {
        this.disconnect(this.paths[i]);
    }
};

AutoRouterGraph.prototype.disconnect = function (path) {
    if (path.isConnected()) {
        this.deleteEdges(path);
    }

    path.deleteAll();
    this.completelyConnected = false;
};

AutoRouterGraph.prototype._disconnectPathsClipping = function (rect) {
    for (var i = this.paths.length; i--;) {
        if (this.paths[i].isPathClip(rect)) {
            this.disconnect(this.paths[i]);
        }
    }
};

AutoRouterGraph.prototype._disconnectPathsFrom = function (obj) {
    var iter = this.paths.length,
        path,
        startport,
        endport;

    if (obj instanceof AutoRouterBox) {
        var box = obj,
            startbox,
            endbox;
        while (iter--) {
            path = this.paths[iter];

            assert(path.startports !== null, 'ARGraph.disconnectPathsFrom: startport !== null FAILED');
            assert(path.startports.length > 0, 'ARGraph.disconnectPathsFrom: Path has no startports');
            assert(path.endports !== null, 'ARGraph.disconnectPathsFrom: endport !== null FAILED');
            assert(path.endports.length > 0, 'ARGraph.disconnectPathsFrom: Path has no endports');

            // Can simply select any start/end port to check the owner
            startbox = path.startports[0].owner;
            endbox = path.endports[0].owner;

            assert(startbox !== null, 'ARGraph.disconnectPathsFrom: startbox !== null FAILED');
            assert(endbox !== null, 'ARGraph.disconnectPathsFrom: endbox !== null FAILED');

            if ((startbox === box || endbox === box)) {
                this.disconnect(path);
            }

        }
    } else {  // Assuming 'box' is a port

        var port = obj;
        while (iter--) {
            path = this.paths[iter];
            startport = path.getStartPort();
            endport = path.getEndPort();

            if ((startport === port || endport === port)) {
                this.disconnect(path);
            }

        }
    }
};

AutoRouterGraph.prototype._addSelfEdges = function () {
    this.horizontal.addEdges(this);
    this.vertical.addEdges(this);
};

AutoRouterGraph.prototype._addEdges = function (obj) {
    assert(!(obj instanceof AutoRouterPath), 'No Paths should be here!');
    if (obj instanceof AutoRouterPort) {
        this.horizontal.addPortEdges(obj);
        this.vertical.addPortEdges(obj);
    } else {
        this.horizontal.addEdges(obj);
        this.vertical.addEdges(obj);
    }
};

AutoRouterGraph.prototype.deleteEdges = function (object) {
    this.horizontal.deleteEdges(object);
    this.vertical.deleteEdges(object);
};

AutoRouterGraph.prototype._addAllEdges = function () {
    assert(this.horizontal.isEmpty() && this.vertical.isEmpty(),
        'ARGraph.addAllEdges: horizontal.isEmpty() && vertical.isEmpty() FAILED');

    var ids = Object.keys(this.boxes),
        i;

    for (i = ids.length; i--;) {
        this._addBoxAndPortEdges(this.boxes[ids[i]]);
    }

    for (i = this.paths.length; i--;) {
        this.horizontal.addPathEdges(this.paths[i]);
        this.vertical.addPathEdges(this.paths[i]);
    }
};

AutoRouterGraph.prototype._deleteAllEdges = function () {
    this.horizontal.deleteAllEdges();
    this.vertical.deleteAllEdges();
};

AutoRouterGraph.prototype._addBoxAndPortEdges = function (box) {
    assert(box !== null, 'ARGraph.addBoxAndPortEdges: box !== null FAILED');

    this._addEdges(box);

    for (var i = box.ports.length; i--;) {
        this._addEdges(box.ports[i]);
    }

    // Add to bufferboxes
    this._addToBufferBoxes(box);
    this._updateBoxPortAvailability(box);
};

AutoRouterGraph.prototype._deleteBoxAndPortEdges = function (box) {
    assert(box !== null, 'ARGraph.deleteBoxAndPortEdges: box !== null FAILED');

    this.deleteEdges(box);

    for (var i = box.ports.length; i--;) {
        this.deleteEdges(box.ports[i]);
    }

    this._removeFromBufferBoxes(box);
};

AutoRouterGraph.prototype._getEdgeList = function (ishorizontal) {
    return ishorizontal ? this.horizontal : this.vertical;
};

AutoRouterGraph.prototype._candeleteTwoEdgesAt = function (path, points, pos) {
    if (CONSTANTS.DEBUG) {
        assert(path.owner === this, 'ARGraph.candeleteTwoEdgesAt: path.owner === this FAILED');
        path.assertValid();
        assert(path.isConnected(), 'ARGraph.candeleteTwoEdgesAt: path.isConnected() FAILED');
        points.AssertValidPos(pos);
    }

    if (pos + 2 >= points.length || pos < 1) {
        return false;
    }

    var pointpos = pos,
        point = points[pos++],
        npointpos = pos,
        npoint = points[pos++],
        nnpointpos = pos;

    pos = pointpos;
    pos--;
    var ppointpos = pos;

    var ppoint = points[pos--],
        pppointpos = pos;

    if (npoint.equals(point)) {
        return false; // direction of zero-length edges can't be determined, so don't delete them
    }

    assert(pppointpos < points.length && ppointpos < points.length && pointpos < points.length &&
        npointpos < points.length && nnpointpos < points.length,
        'ARGraph.candeleteTwoEdgesAt: pppointpos < points.length && ppointpos < points.length &&' +
        'pointpos < points.length && npointpos < points.length && nnpointpos < points.length FAILED');

    var dir = Utils.getDir(npoint.minus(point));

    assert(Utils.isRightAngle(dir), 'ARGraph.candeleteTwoEdgesAt: Utils.isRightAngle (dir) FAILED');
    var ishorizontal = Utils.isHorizontal(dir);

    var newpoint = new ArPoint();

    if (ishorizontal) {
        newpoint.x = Utils.getPointCoord(npoint, ishorizontal);
        newpoint.y = Utils.getPointCoord(ppoint, !ishorizontal);
    } else {
        newpoint.y = Utils.getPointCoord(npoint, ishorizontal);
        newpoint.x = Utils.getPointCoord(ppoint, !ishorizontal);
    }

    assert(Utils.getDir(newpoint.minus(ppoint)) === dir,
        'ARGraph.candeleteTwoEdgesAt: Utils.getDir (newpoint.minus(ppoint)) === dir FAILED');

    if (this._isLineClipBoxes(newpoint, npoint)) {
        return false;
    }
    if (this._isLineClipBoxes(newpoint, ppoint)) {
        return false;
    }

    return true;
};

AutoRouterGraph.prototype._deleteTwoEdgesAt = function (path, points, pos) {
    if (CONSTANTS.DEBUG) {
        assert(path.owner === this, 'ARGraph.deleteTwoEdgesAt: path.owner === this FAILED');
        path.assertValid();
        assert(path.isConnected(), 'ARGraph.deleteTwoEdgesAt: path.isConnected() FAILED');
        points.AssertValidPos(pos);
    }

    var pointpos = pos, //Getting the next, and next-next, points
        point = points[pos++],
        npointpos = pos,
        npoint = points[pos++],
        nnpointpos = pos,
        nnpoint = points[pos++],
        nnnpointpos = pos;

    pos = pointpos;
    pos--;

    var ppointpos = pos, //Getting the prev, prev-prev points
        ppoint = points[pos--],
        pppointpos = pos,
        pppoint = points[pos--];

    assert(pppointpos < points.length && ppointpos < points.length && pointpos < points.length &&
    npointpos < points.length && nnpointpos < points.length,
        'ARGraph.deleteTwoEdgesAt: pppointpos < points.length && ppointpos < points.length && pointpos < ' +
        'points.length && npointpos < points.length && nnpointpos < points.length FAILED');
    assert(pppoint !== null && ppoint !== null && point !== null && npoint !== null && nnpoint !== null,
        'ARGraph.deleteTwoEdgesAt: pppoint !== null && ppoint !== null && point !== null && npoint !== null &&' +
        ' nnpoint !== null FAILED');

    var dir = Utils.getDir(npoint.minus(point));

    assert(Utils.isRightAngle(dir), 'ARGraph.deleteTwoEdgesAt: Utils.isRightAngle (dir) FAILED');
    var ishorizontal = Utils.isHorizontal(dir);

    var newpoint = new ArPoint();
    if (ishorizontal) {
        newpoint.x = Utils.getPointCoord(npoint, ishorizontal);
        newpoint.y = Utils.getPointCoord(ppoint, !ishorizontal);
    } else {
        newpoint.x = Utils.getPointCoord(ppoint, !ishorizontal);
        newpoint.y = Utils.getPointCoord(npoint, ishorizontal);
    }

    assert(Utils.getDir(newpoint.minus(ppoint)) === dir,
        'ARGraph.deleteTwoEdgesAt: Utils.getDir (newpoint.minus(ppoint)) === dir FAILED');

    assert(!this._isLineClipBoxes(newpoint, npoint),
        'ARGraph.deleteTwoEdgesAt: !isLineClipBoxes(newpoint, npoint) FAILED');
    assert(!this._isLineClipBoxes(newpoint, ppoint),
        'ARGraph.deleteTwoEdgesAt: !isLineClipBoxes(newpoint, ppoint) FAILED');

    var hlist = this._getEdgeList(ishorizontal),
        vlist = this._getEdgeList(!ishorizontal);

    var ppedge = hlist.getEdgeByPointer(pppoint),
        pedge = vlist.getEdgeByPointer(ppoint),
        nedge = hlist.getEdgeByPointer(point),
        nnedge = vlist.getEdgeByPointer(npoint);

    assert(ppedge !== null && pedge !== null && nedge !== null && nnedge !== null,
        'ARGraph.deleteTwoEdgesAt:  ppedge !== null && pedge !== null && nedge !== null && nnedge !== null FAILED');

    vlist.remove(pedge);
    hlist.remove(nedge);

    points.splice(ppointpos, 3, newpoint);
    ppedge.endpointNext = nnpoint;
    ppedge.endpoint = newpoint;

    nnedge.startpoint = newpoint;
    nnedge.startpointPrev = pppoint;

    if (nnnpointpos < points.length) {
        var nnnedge = hlist.getEdgeByPointer(nnpoint, (nnnpointpos));
        assert(nnnedge !== null,
            'ARGraph.deleteTwoEdgesAt: nnnedge !== null FAILED');
        assert(nnnedge.startpointPrev.equals(npoint) && nnnedge.startpoint.equals(nnpoint),
            'ARGraph.deleteTwoEdgesAt: nnnedge.startpointPrev.equals(npoint)' +
            '&& nnnedge.startpoint.equals(nnpoint) FAILED');
        nnnedge.startpointPrev = ppoint;
    }

    if (nnpoint.equals(newpoint)) {
        this._deleteSamePointsAt(path, points, ppointpos);
    }

};

AutoRouterGraph.prototype._deleteSamePointsAt = function (path, points, pos) {
    if (CONSTANTS.DEBUG) {
        assert(path.owner === this, 'ARGraph.deleteSamePointsAt: path.owner === this FAILED');
        path.assertValid();
        assert(path.isConnected(), 'ARGraph.deleteSamePointsAt: path.isConnected() FAILED');
        points.AssertValidPos(pos);
    }

    var pointpos = pos,
        point = points[pos++],
        npointpos = pos,
        npoint = points[pos++],
        nnpointpos = pos,
        nnpoint = points[pos++],
        nnnpointpos = pos;

    pos = pointpos;
    pos--;

    var ppointpos = pos,
        ppoint = points[pos--],
        pppointpos = pos,
        pppoint = pos === points.length ? null : points[pos--];

    assert(ppointpos < points.length && pointpos < points.length && npointpos < points.length &&
    nnpointpos < points.length);
    assert(ppoint !== null && point !== null && npoint !== null && nnpoint !== null,
        'ARGraph.deleteSamePointsAt: ppoint !== null && point !== null && npoint !== null && ' +
        'nnpoint !== null FAILED');
    assert(point.equals(npoint) && !point.equals(ppoint),
        'ARGraph.deleteSamePointsAt: point.equals(npoint) && !point.equals(ppoint) FAILED');

    var dir = Utils.getDir(point.minus(ppoint));
    assert(Utils.isRightAngle(dir), 'ARGraph.deleteSamePointsAt: Utils.isRightAngle (dir) FAILED');

    var ishorizontal = Utils.isHorizontal(dir),
        hlist = this._getEdgeList(ishorizontal),
        vlist = this._getEdgeList(!ishorizontal),

        pedge = hlist.getEdgeByPointer(ppoint, point),
        nedge = vlist.getEdgeByPointer(point, npoint),
        nnedge = hlist.getEdgeByPointer(npoint, nnpoint);

    assert(pedge !== null && nedge !== null && nnedge !== null, 'ARGraph.deleteSamePointsAt: pedge !== null ' +
    '&& nedge !== null && nnedge !== null FAILED');

    vlist.remove(pedge);
    hlist.remove(nedge);

    points.splice(pointpos, 2);

    if (pppointpos < points.length) {
        var ppedge = vlist.getEdgeByPointer(pppoint, ppoint);
        assert(ppedge !== null && ppedge.endpoint.equals(ppoint) && ppedge.endpointNext.equals(point),
            'ARGraph.deleteSamePointsAt: ppedge !== null && ppedge.endpoint.equals(ppoint) && ' +
            'ppedge.endpointNext.equals(point) FAILED');
        ppedge.endpointNext = nnpoint;
    }

    assert(nnedge.startpoint.equals(npoint) && nnedge.startpointPrev.equals(point),
        'ARGraph.deleteSamePointsAt: nnedge.startpoint.equals(npoint) && nnedge.startpointPrev.equals(point)' +
        ' FAILED');
    nnedge.setStartPoint(ppoint);
    nnedge.startpointPrev = pppoint;

    if (nnnpointpos < points.length) {
        var nnnedge = vlist.getEdgeByPointer(nnpoint, (nnnpointpos)); //&*
        assert(nnnedge !== null && nnnedge.startpointPrev.equals(npoint) && nnnedge.startpoint.equals(nnpoint),
            'ARGraph.deleteSamePointsAt: nnnedge !== null && nnnedge.startpointPrev.equals(npoint) && ' +
            'nnnedge.startpoint.equals(nnpoint) FAILED');
        nnnedge.startpointPrev = ppoint;
    }

    if (CONSTANTS.DEBUG_DEEP) {
        path.assertValid();
    }
};

AutoRouterGraph.prototype._simplifyPaths = function () {
    var modified = false,
        path,
        pointList,
        pointpos;

    for (var i = this.paths.length; i--;) {
        path = this.paths[i];

        if (path.isAutoRouted()) {
            pointList = path.getPointList();
            pointpos = 0;

            modified = this._fixShortPaths(path) || modified;

            while (pointpos < pointList.length) {
                if (this._candeleteTwoEdgesAt(path, pointList, pointpos)) {
                    this._deleteTwoEdgesAt(path, pointList, pointpos);
                    modified = true;
                    break;
                }
                pointpos++;
            }
        }
    }

    return modified;
};

AutoRouterGraph.prototype._centerStairsInPathPoints = function (path, hintstartdir, hintenddir) {
    assert(path !== null, 'ARGraph.centerStairsInPathPoints: path !== null FAILED');
    assert(!path.isConnected(), 'ARGraph.centerStairsInPathPoints: !path.isConnected() FAILED');

    var pointList = path.getPointList();
    assert(pointList.length >= 2, 'ARGraph.centerStairsInPathPoints: pointList.length >= 2 FAILED');

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }

    var p1,
        p2,
        p3,
        p4,

        p1p = pointList.length,
        p2p = pointList.length,
        p3p = pointList.length,
        p4p = pointList.length,

        d12 = CONSTANTS.DirNone,
        d23 = CONSTANTS.DirNone,
        d34 = CONSTANTS.DirNone,

        outOfBoxStartPoint = path.getOutOfBoxStartPoint(hintstartdir),
        outOfBoxEndPoint = path.getOutOfBoxEndPoint(hintenddir),

        pos = 0;
    assert(pos < pointList.length, 'ARGraph.centerStairsInPathPoints pos < pointList.length FAILED');

    p1p = pos;
    p1 = (pointList[pos++]);

    var np2,
        np3,
        h,
        p4x,
        p3x,
        p1x,
        tmp,
        t,
        m;


    while (pos < pointList.length) {
        p4p = p3p;
        p3p = p2p;
        p2p = p1p;
        p1p = pos;

        p4 = p3;
        p3 = p2;
        p2 = p1;
        p1 = (pointList[pos++]);

        d34 = d23;
        d23 = d12;

        if (p2p < pointList.length) {
            d12 = Utils.getDir(p2.minus(p1));
            if (CONSTANTS.DEBUG) {
                assert(Utils.isRightAngle(d12), 'ARGraph.centerStairsInPathPoints: ' +
                'Utils.isRightAngle (d12) FAILED');
                if (p3p !== pointList.end()) {
                    assert(Utils.areInRightAngle(d12, d23), 'ARGraph.centerStairsInPathPoints: ' +
                    'Utils.areInRightAngle (d12, d23) FAILED');
                }
            }
        }

        if (p4p < pointList.length && d12 === d34) {
            assert(p1p < pointList.length && p2p < pointList.length && p3p < pointList.length &&
            p4p < pointList.length, 'ARGraph.centerStairsInPathPoints: p1p < pointList.length && ' +
            'p2p < pointList.length && p3p < pointList.length && p4p < pointList.length FAILED');

            np2 = new ArPoint(p2);
            np3 = new ArPoint(p3);
            h = Utils.isHorizontal(d12);

            p4x = Utils.getPointCoord(p4, h);
            p3x = Utils.getPointCoord(p3, h);
            p1x = Utils.getPointCoord(p1, h);

            // p1x will represent the larger x value in this 'step' situation
            if (p1x < p4x) {
                t = p1x;
                p1x = p4x;
                p4x = t;
            }

            if (p4x < p3x && p3x < p1x) {
                m = Math.round((p4x + p1x) / 2);
                if (h) {
                    np2.x = m;
                    np3.x = m;
                } else {
                    np2.y = m;
                    np3.y = m;
                }

                tmp = this._getLimitsOfEdge(np2, np3, p4x, p1x);
                p4x = tmp.min;
                p1x = tmp.max;

                m = Math.round((p4x + p1x) / 2);

                if (h) {
                    np2.x = m;
                    np3.x = m;
                } else {
                    np2.y = m;
                    np3.y = m;
                }

                if (!this._isLineClipBoxes(np2, np3) && !this._isLineClipBoxes(p1p === pointList.length ?
                        outOfBoxEndPoint : p1, np2) && !this._isLineClipBoxes(p4p === 0 ?
                        outOfBoxStartPoint : p4, np3)) {
                    p2 = np2;
                    p3 = np3;
                    pointList.splice(p2p, 1, p2);
                    pointList.splice(p3p, 1, p3);
                }
            }
        }
    }

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }
};

/**
 * Make sure if a straight line is possible, create a straight line for
 * the path.
 *
 * @param {AutoRouterPath} path
 */
AutoRouterGraph.prototype._fixShortPaths = function (path) {

    var modified = false,
        startport = path.getStartPort(),
        endport = path.getEndPort(),
        len = path.getPointList().length;

    if (len === 4) {
        var points = path.getPointList(),
            startpoint = points[0],
            endpoint = points[len - 1],
            startDir = startport.portOnWhichEdge(startpoint),
            endDir = endport.portOnWhichEdge(endpoint),
            tstStart,
            tstEnd;

        if (startDir === Utils.reverseDir(endDir)) {
            var isHorizontal = Utils.isHorizontal(startDir),
                newStart = new ArPoint(startpoint),
                newEnd = new ArPoint(endpoint),
                startRect = startport.rect,
                endRect = endport.rect,
                minOverlap,
                maxOverlap;

            if (isHorizontal) {
                minOverlap = Math.min(startRect.floor, endRect.floor);
                maxOverlap = Math.max(startRect.ceil, endRect.ceil);

                var newY = (minOverlap + maxOverlap) / 2;
                newStart.y = newY;
                newEnd.y = newY;

                tstStart = new ArPoint(Utils.getRectOuterCoord(startport.owner.rect, startDir), newStart.y);
                tstEnd = new ArPoint(Utils.getRectOuterCoord(endport.owner.rect, endDir), newEnd.y);

            } else {
                minOverlap = Math.min(startRect.right, endRect.right);
                maxOverlap = Math.max(startRect.left, endRect.left);

                var newX = (minOverlap + maxOverlap) / 2;
                newStart.x = newX;
                newEnd.x = newX;

                tstStart = new ArPoint(newStart.x, Utils.getRectOuterCoord(startport.owner.rect, startDir));
                tstEnd = new ArPoint(newEnd.x, Utils.getRectOuterCoord(endport.owner.rect, endDir));
            }

            var validPointLocation = startRect.ptInRect(newStart) && !startRect.onCorner(newStart) &&
                endRect.ptInRect(newEnd) && !endRect.onCorner(newEnd);

            if (validPointLocation && !this._isLineClipBoxes(tstStart, tstEnd)) {
                var hlist = this._getEdgeList(isHorizontal),
                    vlist = this._getEdgeList(!isHorizontal),
                    edge = hlist.getEdgeByPointer(startpoint),
                    edge2 = vlist.getEdgeByPointer(points[1]),
                    edge3 = hlist.getEdgeByPointer(points[2]);

                vlist.remove(edge2);
                hlist.remove(edge3);
                hlist.remove(edge);

                // The values of startpoint is changed but we don't change the startpoint of the edge
                startpoint.assign(newStart);
                // to maintain the reference that the port has to the startpoint
                endpoint.assign(newEnd);
                edge.setEndPoint(endpoint);

                edge.startpointPrev = null;
                edge.endpointNext = null;

                edge.positionY = Utils.getPointCoord(newStart, Utils.nextClockwiseDir(startDir));
                hlist.insert(edge);

                points.splice(1, 2);
                modified = true;
            }
        }
    }

    return modified;
};

/**
 * Remove unnecessary curves inserted into the path from the
 * tracing the edges of overlapping boxes. (hug children)
 *
 * @param {AutoRouterPath} path
 */
AutoRouterGraph.prototype._simplifyPathCurves = function (path) {
    // Incidently, this will also contain the functionality of simplifyTrivially
    var pointList = path.getPointList(),
        p1,
        p2,
        i = 0,
        j;

    // I will be taking the first point and checking to see if it can create a straight line
    // that does not Utils.intersect  any other boxes on the graph from the test point to the other point.
    // The 'other point' will be the end of the path iterating back til the two points before the 
    // current.
    while (i < pointList.length - 3) {
        p1 = pointList[i];
        j = pointList.length;

        while (j-- > 0) {
            p2 = pointList[j];
            if (Utils.isRightAngle(Utils.getDir(p1.minus(p2))) && !this._isLineClipBoxes(p1, p2) ||
                p1.equals(p2)) {
                pointList.splice(i + 1, j - i - 1); // Remove all points between i, j
                break;
            }
        }
        ++i;
    }
};

/* The following shape in a path
 * _______
 *       |       ___
 *       |      |
 *       |______|
 *
 * will be replaced with 
 * _______
 *       |______
 *
 * if possible.
 */
/**
 * Replace 5 points for 3 where possible. This will replace 'u'-like shapes
 * with 'z' like shapes.
 *
 * @param path
 * @return {undefined}
 */
AutoRouterGraph.prototype._simplifyPathPoints = function (path) {
    assert(path !== null, 'ARGraph.simplifyPathPoints: path !== null FAILED');
    assert(!path.isConnected(), 'ARGraph.simplifyPathPoints: !path.isConnected() FAILED');

    var pointList = path.getPointList();
    assert(pointList.length >= 2, 'ARGraph.simplifyPathPoints: pointList.length >= 2 FAILED');

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }

    var p1,
        p2,
        p3,
        p4,
        p5,

        p1p = pointList.length,
        p2p = pointList.length,
        p3p = pointList.length,
        p4p = pointList.length,
        p5p = pointList.length,

        pos = 0,

        np3,
        d,
        h;

    assert(pos < pointList.length, 'ARGraph.simplifyPathPoints: pos < pointList.length FAILED');

    p1p = pos;
    p1 = pointList[pos++];

    while (pos < pointList.length) {
        p5p = p4p;
        p4p = p3p;
        p3p = p2p;
        p2p = p1p;
        p1p = pos;

        p5 = p4;
        p4 = p3;
        p3 = p2;
        p2 = p1;
        p1 = pointList[pos++];

        if (p5p < pointList.length) {
            assert(p1p < pointList.length && p2p < pointList.length && p3p < pointList.length &&
                p4p < pointList.length && p5p < pointList.length,
                'ARGraph.simplifyPathPoints: p1p < pointList.length && p2p < pointList.length && ' +
                'p3p < pointList.length && p4p < pointList.length && p5p < pointList.length FAILED');

            assert(!p1.equals(p2) && !p2.equals(p3) && !p3.equals(p4) && !p4.equals(p5),
                'ARGraph.simplifyPathPoints: !p1.equals(p2) && !p2.equals(p3) && !p3.equals(p4) && ' +
                '!p4.equals(p5) FAILED');

            d = Utils.getDir(p2.minus(p1));
            assert(Utils.isRightAngle(d), 'ARGraph.simplifyPathPoints: Utils.isRightAngle (d) FAILED');
            h = Utils.isHorizontal(d);

            np3 = new ArPoint();
            if (h) {
                np3.x = Utils.getPointCoord(p5, h);
                np3.y = Utils.getPointCoord(p1, !h);
            } else {
                np3.x = Utils.getPointCoord(p1, !h);
                np3.y = Utils.getPointCoord(p5, h);
            }

            if (!this._isLineClipBoxes(p2, np3) && !this._isLineClipBoxes(np3, p4)) {
                pointList.splice(p2p, 1);
                pointList.splice(p3p, 1);
                pointList.splice(p4p, 1);

                if (!np3.equals(p1) && !np3.equals(p5)) {
                    pointList.splice(p4p, 0, np3);
                }

                p1p = pointList.length;
                p2p = pointList.length;
                p3p = pointList.length;
                p4p = pointList.length;

                pos = 0;
            }
        }
    }

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }
};

AutoRouterGraph.prototype._connectAllDisconnectedPaths = function () {
    var i,
        len = this.paths.length,
        success = false,
        giveup = false,
        path;

    while (!success && !giveup) {
        success = true;
        i = len;
        while (i-- && success) {
            path = this.paths[i];

            if (!path.isConnected()) {
                success = this._connect(path);

                if (!success) {
                    // Something is messed up, probably an existing edge customization results in a zero length edge
                    // In that case we try to delete any customization for this path to recover from the problem
                    if (path.areTherePathCustomizations()) {
                        path.removePathCustomizations();
                    } else {
                        giveup = true;
                    }
                }
            }
        }
        if (!success && !giveup) {
            this._disconnectAll();	// There was an error, delete halfway results to be able to start a new pass
        }
    }
    this.completelyConnected = true;
};

AutoRouterGraph.prototype._updateBoxPortAvailability = function (inputBox) {
    var bufferbox,
        siblings,
        skipBoxes = {},
        box,
        id;

    bufferbox = this.box2bufferBox[inputBox.id];
    assert(bufferbox, 'Bufferbox not found for ' + inputBox.id);
    siblings = bufferbox.children;
    // Ignore overlap from ancestor boxes in the box trees
    box = inputBox;
    do {
        skipBoxes[box.id] = true;
        box = box.parent;
    } while (box);

    for (var i = siblings.length; i--;) {
        id = siblings[i].id;
        if (skipBoxes[id]) {  // Skip boxes on the box tree
            continue;
        }

        if (inputBox.rect.touching(siblings[i])) {
            inputBox.adjustPortAvailability(this.boxes[siblings[i].id]);
            this.boxes[siblings[i].id].adjustPortAvailability(inputBox);
        }
    }
};

AutoRouterGraph.prototype._addToBufferBoxes = function (inputBox) {
    var box = {rect: new ArRect(inputBox.rect), id: inputBox.id},
        overlapBoxesIndices = [],
        bufferBox,
        children = [],
        parentBox,
        ids = [inputBox.id],
        child,
        i,
        j;

    box.rect.inflateRect(CONSTANTS.BUFFER);
    assert(!this.box2bufferBox[inputBox.id],
        'Can\'t add box to 2 bufferboxes');

    // For every buffer box touching the input box
    // Record the buffer boxes with children touching 
    // the input box
    for (i = this.bufferBoxes.length; i--;) {
        if (!box.rect.touching(this.bufferBoxes[i].box)) {
            continue;
        }

        j = this.bufferBoxes[i].children.length;
        while (j--) {
            child = this.bufferBoxes[i].children[j];
            if (box.rect.touching(child)) {
                inputBox.adjustPortAvailability(this.boxes[child.id]);
                this.boxes[child.id].adjustPortAvailability(inputBox);

                if (overlapBoxesIndices.indexOf(i) === -1) {
                    overlapBoxesIndices.push(i);
                }
            }

        }
    }

    parentBox = new ArRect(box.rect);
    // If overlapped other boxes, create the new bufferbox parent rect
    if (overlapBoxesIndices.length !== 0) {

        for (i = 0; i < overlapBoxesIndices.length; i++) {
            assert(overlapBoxesIndices[i] < this.bufferBoxes.length,
                'ArGraph.addToBufferBoxes: overlapBoxes index out of bounds. (' +
                overlapBoxesIndices[i] + ' < ' + this.bufferBoxes.length + ')');

            bufferBox = this.bufferBoxes.splice(overlapBoxesIndices[i], 1)[0];

            for (j = bufferBox.children.length; j--;) {
                children.push(bufferBox.children[j]);
                ids.push(bufferBox.children[j].id);  // Store the ids of the children that need to be adjusted
            }

            parentBox.unionAssign(bufferBox.box);
        }
    }

    box.rect.id = inputBox.id;
    children.push(box.rect);

    this.bufferBoxes.push({box: parentBox, children: children});

    for (i = ids.length; i--;) {
        this.box2bufferBox[ids[i]] = this.bufferBoxes[this.bufferBoxes.length - 1];
    }
};

AutoRouterGraph.prototype._removeFromBufferBoxes = function (box) {
    // Get the children of the parentBox (not including the box to remove)
    // Create bufferboxes from these children
    var bufferBox = this.box2bufferBox[box.id],
        i = this.bufferBoxes.indexOf(bufferBox),
        children = bufferBox.children,
        groups = [],
        add = false,
        parentBox,
        child,
        group,
        ids,
        id,
        j,
        g;

    assert(i !== -1, 'ARGraph.removeFromBufferBoxes: Can\'t find the correct bufferbox.');

    // Remove record of removed box
    this.bufferBoxes.splice(i, 1);
    this.box2bufferBox[box.id] = undefined;

    //Create groups of overlap from children
    i = children.length;
    while (i--) {
        g = groups.length;
        child = children[i];
        group = [child];
        add = false;

        this.boxes[child.id].resetPortAvailability();  // Reset box's ports availableAreas

        if (child.id === box.id) {
            continue;
        }

        while (g--) {
            j = groups[g].length;

            while (j--) {
                if (groups[g][j].touching(child)) {
                    id = groups[g][j].id;
                    this.boxes[child.id].adjustPortAvailability(this.boxes[id]);
                    this.boxes[id].adjustPortAvailability(this.boxes[child.id]);
                    add = true;
                }
            }

            if (add) {
                // group will accumulate all things overlapping the child
                group = group.concat(groups.splice(g, 1)[0]);
            }
        }

        groups.push(group);  // Add group to groups
    }

    i = groups.length;
    while (i--) {
        j = groups[i].length;
        parentBox = new ArRect(groups[i][0]);
        ids = [];

        while (j--) {
            parentBox.unionAssign(groups[i][j]);
            ids.push(groups[i][j].id);
        }

        this.bufferBoxes.push({box: parentBox, children: groups[i]});

        j = ids.length;
        while (j--) {
            this.box2bufferBox[ids[j]] = this.bufferBoxes[this.bufferBoxes.length - 1];
        }
    }

};

//Public Functions

AutoRouterGraph.prototype.setBuffer = function (newBuffer) {
    CONSTANTS.BUFFER = newBuffer;
};

AutoRouterGraph.prototype.calculateSelfPoints = function () {
    this.selfPoints = [];
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MINCOORD));
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MINCOORD));
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MAXCOORD));
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MAXCOORD));
};

AutoRouterGraph.prototype.createBox = function () {
    var box = new AutoRouterBox();
    assert(box !== null, 'ARGraph.createBox: box !== null FAILED');

    return box;
};

AutoRouterGraph.prototype.addBox = function (box) {
    assert(box !== null,
        'ARGraph.addBox: box !== null FAILED');
    assert(box instanceof AutoRouterBox,
        'ARGraph.addBox: box instanceof AutoRouterBox FAILED');

    var rect = box.rect;

    this._disconnectPathsClipping(rect);

    box.owner = this;
    var boxId = (COUNTER++).toString();
    while (boxId.length < 6) {
        boxId = '0' + boxId;
    }
    boxId = 'BOX_' + boxId;
    box.id = boxId;

    this.boxes[boxId] = box;

    this._addBoxAndPortEdges(box);

    // add children of the box
    var children = box.childBoxes,
        i = children.length;
    while (i--) {
        this.addBox(children[i]);
    }
};

AutoRouterGraph.prototype.deleteBox = function (box) {
    assert(box !== null, 'ARGraph.deleteBox: box !== null FAILED');

    if (box.hasOwner()) {
        var parent = box.parent,
            children = box.childBoxes,
            i = children.length;

        // notify the parent of the deletion
        if (parent) {
            parent.removeChild(box);
        }

        // remove children
        while (i--) {
            this.deleteBox(children[i]);
        }

        this._deleteBoxAndPortEdges(box);
        box.owner = null;
        assert(this.boxes[box.id] !== undefined, 'ARGraph.remove: Box does not exist');

        delete this.boxes[box.id];
    }

    box.destroy();
    box = null;
};

AutoRouterGraph.prototype.shiftBoxBy = function (box, offset) {
    assert(box !== null, 'ARGraph.shiftBoxBy: box !== null FAILED');
    assert(!!this.boxes[box.id], 'ARGraph.shiftBoxBy: Box does not exist!');

    var rect = this.box2bufferBox[box.id].box,
        children = box.childBoxes;

    this._disconnectPathsClipping(rect); // redraw all paths clipping parent box.
    this._disconnectPathsFrom(box);

    this._deleteBoxAndPortEdges(box);

    box.shiftBy(offset);
    this._addBoxAndPortEdges(box);

    rect = box.rect;
    this._disconnectPathsClipping(rect);

    for (var i = children.length; i--;) {
        this.shiftBoxBy(children[i], offset);
    }
};

AutoRouterGraph.prototype.setBoxRect = function (box, rect) {
    if (box === null) {
        return;
    }

    this._deleteBoxAndPortEdges(box);
    box.setRect(rect);
    this._addBoxAndPortEdges(box);

    this._disconnectPathsClipping(rect);
};

AutoRouterGraph.prototype.routeSync = function () {
    var state = {finished: false};

    this._connectAllDisconnectedPaths();

    while (!state.finished) {
        state = this._optimize(state);
    }

};

AutoRouterGraph.prototype.routeAsync = function (options) {
    var self = this,
        updateFn = options.update || Utils.nop,
        firstFn = options.first || Utils.nop,
        callbackFn = options.callback || Utils.nop,
        time = options.time || 5,
        optimizeFn = function (state) {
            _logger.info('Async optimization cycle started');

            // If a path has been disconnected, start the routing over
            if (!self.completelyConnected) {
                _logger.info('Async optimization interrupted');
                return setTimeout(startRouting, time);
            }

            updateFn(self.paths);
            if (state.finished) {
                _logger.info('Async routing finished');
                return callbackFn(self.paths);
            } else {
                state = self._optimize(state);
                return setTimeout(optimizeFn, time, state);
            }
        },
        startRouting = function () {
            _logger.info('Async routing started');
            var state = {finished: false};
            self._connectAllDisconnectedPaths();

            // Start the optimization
            setTimeout(optimizeFn, time, state);
        };

    _logger.info('Async routing triggered');
    // Connect all disconnected paths with a straight line
    var disconnected = this._quickConnectDisconnectedPaths();
    firstFn(disconnected);

    this._disconnectTempPaths(disconnected);

    setTimeout(startRouting, time);
};

/**
 * Connect all disconnected paths in a quick way while a better layout is
 * being calculated.
 *
 * @return {Array<Path>} disconnected paths
 */
AutoRouterGraph.prototype._quickConnectDisconnectedPaths = function () {
    var path,
        disconnected = [];
    for (var i = this.paths.length; i--;) {
        path = this.paths[i];
        if (!path.isConnected()) {
            path.calculateStartEndPorts();
            path.points = new ArPointListPath(path.startpoint, path.endpoint);
            disconnected.push(path);
        }
    }
    return disconnected;
};

AutoRouterGraph.prototype._disconnectTempPaths = function (paths) {
    for (var i = paths.length; i--;) {
        paths[i].points = new ArPointListPath();
    }
};

/**
 * Performs one set of optimizations.
 *
 * @param {Number} count This stores the max number of optimizations allowed
 * @param {Number} last This stores the last optimization type made
 *
 * @return {Object} Current count, last values
 */
AutoRouterGraph.prototype._optimize = function (options) {
    var maxOperations = options.maxOperations || 100,
        last = options.last || 0,
        dm = options.dm || 10,		// max # of distribution op
        d = options.d || 0,
        getState = function (finished) {
            return {
                finished: finished || !maxOperations,
                maxOperations: maxOperations,
                last: last,
                dm: dm,
                d: d
            };
        };

    if (maxOperations > 0) {

        if (last === 1) {
            return getState(true);
        }

        maxOperations--;
        if (this._simplifyPaths()) {
            last = 1;
        }
    }

    if (maxOperations > 0) {
        if (last === 2) {
            return getState(true);
        }

        maxOperations--;
        if (this.horizontal.blockScanBackward()) {

            do {
                maxOperations--;
            } while (maxOperations > 0 && this.horizontal.blockScanBackward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 2;
        }
    }

    if (maxOperations > 0) {
        if (last === 3) {
            return getState(true);
        }

        maxOperations--;
        if (this.horizontal.blockScanForward()) {

            do {
                maxOperations--;
            } while (maxOperations > 0 && this.horizontal.blockScanForward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 3;
        }
    }

    if (maxOperations > 0) {
        if (last === 4) {
            return getState(true);
        }

        maxOperations--;
        if (this.vertical.blockScanBackward()) {
            do {
                maxOperations--;
            } while (maxOperations > 0 && this.vertical.blockScanBackward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 4;
        }
    }

    if (maxOperations > 0) {
        if (last === 5) {
            return getState(true);
        }

        maxOperations--;
        if (this.vertical.blockScanForward()) {

            do {
                maxOperations--;
            } while (maxOperations > 0 && this.vertical.blockScanForward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 5;
        }
    }

    if (maxOperations > 0) {
        if (last === 6) {
            return getState(true);
        }

        maxOperations--;
        if (this.horizontal.blockSwitchWrongs()) {
            last = 6;
        }
    }

    if (maxOperations > 0) {
        if (last === 7) {
            return getState(true);
        }

        maxOperations--;
        if (this.vertical.blockSwitchWrongs()) {
            last = 7;
        }
    }

    if (last === 0) {
        return getState(true);
    }

    return getState(false);
};

AutoRouterGraph.prototype.deletePath = function (path) {
    assert(path !== null, 'ARGraph.deletePath: path !== null FAILED');

    if (path.hasOwner()) {
        assert(path.owner === this, 'ARGraph.deletePath: path.owner === this FAILED');

        this.deleteEdges(path);
        path.owner = null;
        var index = this.paths.indexOf(path);

        assert(index > -1, 'ARGraph.remove: Path does not exist');
        this.paths.splice(index, 1);
    }

    path.destroy();
};

AutoRouterGraph.prototype.clear = function (addBackSelfEdges) {
    this._deleteAllPaths();
    this._deleteAllBoxes();
    this._deleteAllEdges();
    if (addBackSelfEdges) {
        this._addSelfEdges();
    }
};

AutoRouterGraph.prototype.addPath = function (isAutoRouted, startports, endports) {
    var path = new AutoRouterPath();

    path.setAutoRouting(isAutoRouted);
    path.setStartEndPorts(startports, endports);
    this._add(path);

    return path;
};

AutoRouterGraph.prototype.isEdgeFixed = function (path, startpoint, endpoint) {
    var d = Utils.getDir(endpoint.minus(startpoint)),
        h = Utils.isHorizontal(d),

        elist = this._getEdgeList(h),

        edge = elist.getEdge(path, startpoint, endpoint);
    if (edge !== null) {
        return edge.getEdgeFixed() && !edge.getEdgeCustomFixed();
    }

    assert(false, 'ARGraph.isEdgeFixed: FAILED');
    return true;
};

AutoRouterGraph.prototype.destroy = function () {
    this.deleteAll(false);

    this.horizontal.SetOwner(null);
    this.vertical.SetOwner(null);
};

AutoRouterGraph.prototype.assertValid = function () {
    var ids = Object.keys(this.boxes),
        i;

    for (i = this.boxes.length; i--;) {
        this.assertValidBox(this.boxes[ids[i]]);
    }

    for (i = this.paths.length; i--;) {
        this._assertValidPath(this.paths[i]);
    }

    this.horizontal.assertValid();
    this.vertical.assertValid();
};

AutoRouterGraph.prototype.assertValidBox = function (box) {
    box.assertValid();
    assert(box.owner === this,
        'ARGraph.assertValidBox: box.owner === this FAILED');
    assert(this.boxes[box.id] !== undefined,
        'ARGraph.assertValidBox: this.boxes[box.id] !== undefined FAILED');

    // Verify that the box (and port) edges are on the graph
    assert(this._containsRectEdges(box.rect),
        'Graph does not contain edges for box ' + box.id);

};

AutoRouterGraph.prototype._containsRectEdges = function (rect) {
    var topLeft = rect.getTopLeft(),
        bottomRight = rect.getBottomRight(),
        points = [],
        result = true,
        len,
        start,
        end;

    points.push(topLeft);
    points.push(new ArPoint(bottomRight.x, topLeft.y));  // top right
    points.push(bottomRight);
    points.push(new ArPoint(topLeft.x, bottomRight.y));  // bottom left

    len = points.length;
    for (var i = 0; i < len; i++) {
        start = points[i];
        end = points[(i + 1) % len];
        result = result && this._containsEdge(start, end);
    }

    return result;
};

/**
 * This checks for an edge with the given start/end points. This will only
 * work for fixed edges such as boxes or ports.
 *
 * @param start
 * @param end
 * @return {undefined}
 */
AutoRouterGraph.prototype._containsEdge = function (start, end) {
    var dir;

    dir = Utils.getDir(start.minus(end));
    assert(Utils.isRightAngle(dir),
        'Edge is invalid: ' + Utils.stringify(start) + ' and ' + Utils.stringify(end));

    if (Utils.isHorizontal(dir)) {
        return this.horizontal.contains(start, end) || this.horizontal.contains(end, start);
    } else {
        return this.vertical.contains(start, end) || this.vertical.contains(end, start);
    }
};

AutoRouterGraph.prototype._assertValidPath = function (path) {
    assert(path.owner === this,
        'ARGraph.assertValidBox: box.owner === this FAILED');
    path.assertValid();
};

AutoRouterGraph.prototype.dumpPaths = function (pos, c) {
    _logger.debug('Paths dump pos ' + pos + ', c ' + c);

    for (var i = 0; i < this.paths.length; i++) {
        _logger.debug(i + '. Path: ');
        this.paths[i].getPointList().dumpPoints('DumpPaths');
    }

};

AutoRouterGraph.prototype.dumpEdgeLists = function () {
    this.horizontal.dumpEdges('Horizontal edges:');
    this.vertical.dumpEdges('Vertical edges:');
};

module.exports = AutoRouterGraph;

},{"./AutoRouter.Box":5,"./AutoRouter.Constants":6,"./AutoRouter.Edge":7,"./AutoRouter.EdgeList":8,"./AutoRouter.Logger":10,"./AutoRouter.Path":11,"./AutoRouter.Point":12,"./AutoRouter.PointList":13,"./AutoRouter.Port":14,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],10:[function(require,module,exports){
'use strict';
var debug = require('debug'),
    LEVELS = ['warn', 'debug', 'info'];

var Logger = function(name){
    for (var i = LEVELS.length; i--;) {
        this[LEVELS[i]] = debug(name + ':' + LEVELS[i]);
    }
};

module.exports = Logger;

},{"debug":1}],11:[function(require,module,exports){
/*globals define*/
/*jshint browser: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    ArPointListPath = require('./AutoRouter.PointList');

// AutoRouterPath
var AutoRouterPath = function () {
    this.id = 'None';
    this.owner = null;
    this.startpoint = null;
    this.endpoint = null;
    this.startports = null;
    this.endports = null;
    this.startport = null;
    this.endport = null;
    this.attributes = CONSTANTS.PathDefault;
    this.state = CONSTANTS.PathStateDefault;
    this.isAutoRoutingOn = true;
    this.customPathData = [];
    this.customizationType = 'Points';
    this.pathDataToDelete = [];
    this.points = new ArPointListPath();
};


//----Points

AutoRouterPath.prototype.hasOwner = function () {
    return this.owner !== null;
};

AutoRouterPath.prototype.setStartEndPorts = function (start, end) {
    this.startports = start;
    this.endports = end;
    this.calculateStartEndPorts();
};

AutoRouterPath.prototype.clearPorts = function () {
    // remove the start/endpoints from the given ports
    if (this.startpoint) {
        this.startport.removePoint(this.startpoint);
        this.startpoint = null;
    }
    if (this.endpoint) {
        this.endport.removePoint(this.endpoint);
        this.endpoint = null;
    }
    this.startport = null;
    this.endport = null;
};

AutoRouterPath.prototype.getStartPort = function () {
    assert(this.startports.length, 
        'ARPort.getStartPort: Can\'t retrieve start port. from '+this.id);

    if (!this.startport) {
        this.calculateStartPorts();
    }
    return this.startport;
};

AutoRouterPath.prototype.getEndPort = function () {
    assert(this.endports.length, 
        'ARPort.getEndPort: Can\'t retrieve end port from '+this.id);
    if (!this.endport) {
        this.calculateEndPorts();
    }
    return this.endport;
};

/**
 * Remove port from start/end port lists.
 *
 * @param port
 * @return {undefined}
 */
AutoRouterPath.prototype.removePort = function (port) {
    var removed = Utils.removeFromArrays(port, this.startports, this.endports);
    assert(removed, 'Port was not removed from path start/end ports');

    // If no more start/end ports, remove the path
    // assert(this.startports.length && this.endports.length, 'Removed all start/endports of path ' + this.id);
    this.owner.disconnect(this);
};

AutoRouterPath.prototype.calculateStartEndPorts = function () {
    return {src: this.calculateStartPorts(), dst: this.calculateEndPorts()};
};

AutoRouterPath.prototype.calculateStartPorts = function () {
    var srcPorts = [],
        tgt,
        i;

    assert(this.startports.length > 0, 'ArPath.calculateStartEndPorts: this.startports cannot be empty!');

    //Remove this.startpoint
    if (this.startport && this.startport.hasPoint(this.startpoint)) {
        this.startport.removePoint(this.startpoint);
    }

    //Get available ports
    for (i = this.startports.length; i--;) {
        assert(this.startports[i].owner,
            'ARPath.calculateStartEndPorts: port ' + this.startports[i].id + ' has invalid this.owner!');
        if (this.startports[i].isAvailable()) {
            srcPorts.push(this.startports[i]);
        }
    }

    if (srcPorts.length === 0) {
        srcPorts = this.startports;
    }

    //Preventing same start/endport
    if (this.endport && srcPorts.length > 1) {
        i = srcPorts.length;
        while (i--) {
            if (srcPorts[i] === this.endport) {
                srcPorts.splice(i, 1);
            }
        }
    }


    // Getting target
    if (this.isAutoRouted()) {
        var accumulatePortCenters = function (prev, current) {
            var center = current.rect.getCenter();
            prev.x += center.x;
            prev.y += center.y;
            return prev;
        };
        tgt = this.endports.reduce(accumulatePortCenters, new ArPoint(0, 0));

        tgt.x /= this.endports.length;
        tgt.y /= this.endports.length;
    } else {
        tgt = this.customPathData[0];
    }
    // Get the optimal port to the target
    this.startport = Utils.getOptimalPorts(srcPorts, tgt);

    // Create a this.startpoint at the port
    var startdir = this.getStartDir(),
        startportHasLimited = false,
        startportCanHave = true;

    if (startdir !== CONSTANTS.DirNone) {
        startportHasLimited = this.startport.hasLimitedDirs();
        startportCanHave = this.startport.canHaveStartEndPointOn(startdir, true);
    }
    if (startdir === CONSTANTS.DirNone ||							// recalc startdir if empty
        startportHasLimited && !startportCanHave) {		// or is limited and userpref is invalid
        startdir = this.startport.getStartEndDirTo(tgt, true);
    }

    this.startpoint = this.startport.createStartEndPointTo(tgt, startdir);
    this.startpoint.owner = this;
    return this.startport;
};

AutoRouterPath.prototype.calculateEndPorts = function () {
    var dstPorts = [],
        tgt,
        i = this.endports.length;

    assert(this.endports.length > 0, 'ArPath.calculateStartEndPorts: this.endports cannot be empty!');

    //Remove old this.endpoint
    if (this.endport && this.endport.hasPoint(this.endpoint)) {
        this.endport.removePoint(this.endpoint);
    }

    //Get available ports
    while (i--) {
        assert(this.endports[i].owner, 'ARPath.calculateStartEndPorts: this.endport has invalid this.owner!');
        if (this.endports[i].isAvailable()) {
            dstPorts.push(this.endports[i]);
        }
    }

    if (dstPorts.length === 0) {
        dstPorts = this.endports;
    }

    //Preventing same start/this.endport
    if (this.startport && dstPorts.length > 1) {
        i = dstPorts.length;
        while (i--) {
            if (dstPorts[i] === this.startport) {
                dstPorts.splice(i, 1);
            }
        }
    }

    //Getting target
    if (this.isAutoRouted()) {

        var accumulatePortCenters = function (prev, current) {
            var center = current.rect.getCenter();
            prev.x += center.x;
            prev.y += center.y;
            return prev;
        };
        tgt = this.startports.reduce(accumulatePortCenters, new ArPoint(0, 0));

        tgt.x /= this.startports.length;
        tgt.y /= this.startports.length;

    } else {
        tgt = this.customPathData[this.customPathData.length - 1];
    }

    //Get the optimal port to the target
    this.endport = Utils.getOptimalPorts(dstPorts, tgt);

    //Create this.endpoint at the port
    var enddir = this.getEndDir(),
        startdir = this.getStartDir(),
        endportHasLimited = false,
        endportCanHave = true;

    if (enddir !== CONSTANTS.DirNone) {
        endportHasLimited = this.endport.hasLimitedDirs();
        endportCanHave = this.endport.canHaveStartEndPointOn(enddir, false);
    }
    if (enddir === CONSTANTS.DirNone ||                         // like above
        endportHasLimited && !endportCanHave) {
        enddir = this.endport.getStartEndDirTo(tgt, false, this.startport === this.endport ?
            startdir : CONSTANTS.DirNone);
    }

    this.endpoint = this.endport.createStartEndPointTo(tgt, enddir);
    this.endpoint.owner = this;
    return this.endport;
};

AutoRouterPath.prototype.isConnected = function () {
    return (this.state & CONSTANTS.PathStateConnected) !== 0;
};

AutoRouterPath.prototype.addTail = function (pt) {
    assert(!this.isConnected(),
        'ARPath.addTail: !this.isConnected() FAILED');
    this.points.push(pt);
};

AutoRouterPath.prototype.deleteAll = function () {
    this.points = new ArPointListPath();
    this.state = CONSTANTS.PathStateDefault;
    this.clearPorts();
};

AutoRouterPath.prototype.getStartBox = function () {
    var port = this.startport || this.startports[0];
    return port.owner.getRootBox();
};

AutoRouterPath.prototype.getEndBox = function () {
    var port = this.endport || this.endports[0];
    return port.owner.getRootBox();
};

AutoRouterPath.prototype.getOutOfBoxStartPoint = function (hintDir) {
    var startBoxRect = this.getStartBox();

    assert(hintDir !== CONSTANTS.DirSkew, 'ARPath.getOutOfBoxStartPoint: hintDir !== CONSTANTS.DirSkew FAILED');
    assert(this.points.length >= 2, 'ARPath.getOutOfBoxStartPoint: this.points.length >= 2 FAILED');

    var pos = 0,
        p = new ArPoint(this.points[pos++]),
        d = Utils.getDir(this.points[pos].minus(p));

    if (d === CONSTANTS.DirSkew) {
        d = hintDir;
    }
    assert(Utils.isRightAngle(d), 'ARPath.getOutOfBoxStartPoint: Utils.isRightAngle (d) FAILED');

    if (Utils.isHorizontal(d)) {
        p.x = Utils.getRectOuterCoord(startBoxRect, d);
    } else {
        p.y = Utils.getRectOuterCoord(startBoxRect, d);
    }

    //assert(Utils.getDir (this.points[pos].minus(p)) === Utils.reverseDir ( d ) ||
    // Utils.getDir (this.points[pos].minus(p)) === d, 'Utils.getDir (this.points[pos].minus(p)) ===
    // Utils.reverseDir ( d ) || Utils.getDir (this.points[pos].minus(p)) === d FAILED');

    return p;
};

AutoRouterPath.prototype.getOutOfBoxEndPoint = function (hintDir) {
    var endBoxRect = this.getEndBox();

    assert(hintDir !== CONSTANTS.DirSkew, 'ARPath.getOutOfBoxEndPoint: hintDir !== CONSTANTS.DirSkew FAILED');
    assert(this.points.length >= 2, 'ARPath.getOutOfBoxEndPoint: this.points.length >= 2 FAILED');

    var pos = this.points.length - 1,
        p = new ArPoint(this.points[pos--]),
        d = Utils.getDir(this.points[pos].minus(p));

    if (d === CONSTANTS.DirSkew) {
        d = hintDir;
    }
    assert(Utils.isRightAngle(d), 'ARPath.getOutOfBoxEndPoint: Utils.isRightAngle (d) FAILED');

    if (Utils.isHorizontal(d)) {
        p.x = Utils.getRectOuterCoord(endBoxRect, d);
    } else {
        p.y = Utils.getRectOuterCoord(endBoxRect, d);
    }

    //assert(Utils.getDir (this.points[pos].minus(p)) === Utils.reverseDir ( d ) ||
    // Utils.getDir (this.points[pos].minus(p)) === d, 'ARPath.getOutOfBoxEndPoint: Utils.getDir
    // (this.points[pos].minus(p)) === d || Utils.getDir (this.points[pos].minus(p)) === d FAILED');

    return p;
};

AutoRouterPath.prototype.simplifyTrivially = function () {
    assert(!this.isConnected(), 'ARPath.simplifyTrivially: !isConnected() FAILED');

    if (this.points.length <= 2) {
        return;
    }

    var pos = 0,
        pos1 = pos;

    assert(pos1 !== this.points.length, 'ARPath.simplifyTrivially: pos1 !== this.points.length FAILED');
    var p1 = this.points[pos++],
        pos2 = pos;

    assert(pos2 !== this.points.length, 'ARPath.simplifyTrivially: pos2 !== this.points.length FAILED');
    var p2 = this.points[pos++],
        dir12 = Utils.getDir(p2.minus(p1)),
        pos3 = pos;

    assert(pos3 !== this.points.length, 'ARPath.simplifyTrivially: pos3 !== this.points.length FAILED');
    var p3 = this.points[pos++],
        dir23 = Utils.getDir(p3.minus(p2));

    for (; ;) {
        if (dir12 === CONSTANTS.DirNone || dir23 === CONSTANTS.DirNone ||
            (dir12 !== CONSTANTS.DirSkew && dir23 !== CONSTANTS.DirSkew &&
            (dir12 === dir23 || dir12 === Utils.reverseDir(dir23)) )) {
            this.points.splice(pos2, 1);
            pos--;
            pos3--;
            dir12 = Utils.getDir(p3.minus(p1));
        } else {
            pos1 = pos2;
            p1 = p2;
            dir12 = dir23;
        }

        if (pos === this.points.length) {
            return;
        }

        pos2 = pos3;
        p2 = p3;

        pos3 = pos;
        p3 = this.points[pos++];

        dir23 = Utils.getDir(p3.minus(p2));
    }

    if (CONSTANTS.DEBUG) {
        this.assertValidPoints();
    }
};

AutoRouterPath.prototype.getPointList = function () {
    return this.points;
};

AutoRouterPath.prototype.isPathClip = function (r, isStartOrEndRect) {
    var tmp = this.points.getTailEdge(),
        a = tmp.start,
        b = tmp.end,
        pos = tmp.pos,
        i = 0,
        numEdges = this.points.length - 1;

    while (pos >= 0) {
        if (isStartOrEndRect && ( i === 0 || i === numEdges - 1 )) {
            if (Utils.isPointIn(a, r, 1) &&
                Utils.isPointIn(b, r, 1)) {
                return true;
            }
        } else if (Utils.isLineClipRect(a, b, r)) {
            return true;
        }

        tmp = this.points.getPrevEdge(pos, a, b);
        a = tmp.start;
        b = tmp.end;
        pos = tmp.pos;
        i++;
    }

    return false;
};

AutoRouterPath.prototype.isFixed = function () {
    return ((this.attributes & CONSTANTS.PathFixed) !== 0);
};

AutoRouterPath.prototype.isMoveable = function () {
    return ((this.attributes & CONSTANTS.PathFixed) === 0);
};

AutoRouterPath.prototype.setState = function (s) {
    assert(this.owner !== null, 'ARPath.setState: this.owner !== null FAILED');

    this.state = s;
    if (CONSTANTS.DEBUG) {
        this.assertValid();
    }
};

AutoRouterPath.prototype.getEndDir = function () {
    var a = this.attributes & CONSTANTS.PathEndMask;
    return a & CONSTANTS.PathEndOnTop ? CONSTANTS.DirTop :
        a & CONSTANTS.PathEndOnRight ? CONSTANTS.DirRight :
            a & CONSTANTS.PathEndOnBottom ? CONSTANTS.DirBottom :
                a & CONSTANTS.PathEndOnLeft ? CONSTANTS.DirLeft : CONSTANTS.DirNone;
};

AutoRouterPath.prototype.getStartDir = function () {
    var a = this.attributes & CONSTANTS.PathStartMask;
    return a & CONSTANTS.PathStartOnTop ? CONSTANTS.DirTop :
        a & CONSTANTS.PathStartOnRight ? CONSTANTS.DirRight :
            a & CONSTANTS.PathStartOnBottom ? CONSTANTS.DirBottom :
                a & CONSTANTS.PathStartOnLeft ? CONSTANTS.DirLeft : CONSTANTS.DirNone;
};

AutoRouterPath.prototype.setEndDir = function (pathEnd) {
    this.attributes = (this.attributes & ~CONSTANTS.PathEndMask) + pathEnd;
};

AutoRouterPath.prototype.setStartDir = function (pathStart) {
    this.attributes = (this.attributes & ~CONSTANTS.PathStartMask) + pathStart;
};

/**
 * Set the custom points of the path and determine start/end points/ports.
 *
 * @param {Array<ArPoint>} points
 * @return {undefined}
 */
AutoRouterPath.prototype.setCustomPathPoints = function (points) {
    this.customPathData = points;

    // Find the start/endports
    this.calculateStartEndPorts();

    this.points = new ArPointListPath().concat(points);

    // Add the start/end points to the list
    this.points.unshift(this.startpoint);
    this.points.push(this.endpoint);

    // Set as connected
    this.setState(CONSTANTS.PathStateConnected);
};

AutoRouterPath.prototype.createCustomPath = function () {
    this.points.shift();
    this.points.pop();

    this.points.unshift(this.startpoint);
    this.points.push(this.endpoint);

    this.setState(CONSTANTS.PathStateConnected);
};

AutoRouterPath.prototype.removePathCustomizations = function () {
    this.customPathData = [];
};

AutoRouterPath.prototype.areTherePathCustomizations = function () {
    return this.customPathData.length !== 0;
};

AutoRouterPath.prototype.isAutoRouted = function () {
    return this.isAutoRoutingOn;
};

AutoRouterPath.prototype.setAutoRouting = function (arState) {
    this.isAutoRoutingOn = arState;
};

AutoRouterPath.prototype.destroy = function () {
    if (this.isConnected()) {
        this.startport.removePoint(this.startpoint);
        this.endport.removePoint(this.endpoint);
    }
};

AutoRouterPath.prototype.assertValid = function () {
    var i;

    assert(this.startports.length > 0, 'Path has no startports!');
    assert(this.endports.length > 0, 'Path has no endports!');

    for (i = this.startports.length; i--;) {
        this.startports[i].assertValid();
    }

    for (i = this.endports.length; i--;) {
        this.endports[i].assertValid();
    }

    if (this.isAutoRouted()) {
        if (this.isConnected()) {
            assert(this.points.length !== 0,
                'ARPath.assertValid: this.points.length !== 0 FAILED');
            var points = this.getPointList();
            points.assertValid();
        }
    }

    // If it has a startpoint, must also have a startport
    if (this.startpoint) {
        assert(this.startport, 'Path has a startpoint without a startport');
    }
    if (this.endpoint) {
        assert(this.endport, 'Path has a endpoint without a endport');
    }

    assert(this.owner, 'Path does not have owner!');
};

AutoRouterPath.prototype.assertValidPoints = function () {
};

module.exports = AutoRouterPath;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.PointList":13,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],12:[function(require,module,exports){
/*globals define*/
/*jshint browser: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var ArSize = require('./AutoRouter.Size');

var ArPoint = function (x, y) {
    // Multiple Constructors
    if (x === undefined) {
        x = 0;
        y = 0;
    } else if (y === undefined) {
        y = x.y;
        x = x.x;
    }

    this.x = x;
    this.y = y;
};

/**
 * Check if the points have the same coordinates.
 *
 * @param {ArPoint} otherPoint
 * @return {Boolean}
 */
ArPoint.prototype.equals = function (otherPoint) {
    return this.x === otherPoint.x && this.y === otherPoint.y;
};

ArPoint.prototype.shift = function (otherObject) { //equivalent to +=
    this.x += otherObject.dx;
    this.y += otherObject.dy;

    return this;
};

ArPoint.prototype.add = function (otherObject) { //equivalent to +=
    if (otherObject instanceof ArSize) {
        this.x += otherObject.cx;
        this.y += otherObject.cy;
    } else if (otherObject instanceof ArPoint) {
        this.x += otherObject.x;
        this.y += otherObject.y;
    }
};

ArPoint.prototype.subtract = function (otherObject) { //equivalent to +=
    if (otherObject instanceof ArSize) {
        this.x -= otherObject.cx;
        this.y -= otherObject.cy;
    } else if (otherObject instanceof ArPoint) {
        this.x -= otherObject.x;
        this.y -= otherObject.y;
    }
};

ArPoint.prototype.plus = function (otherObject) { //equivalent to +
    var objectCopy = null;

    if (otherObject instanceof ArSize) {
        objectCopy = new ArPoint(this);
        objectCopy.add(otherObject);

    } else if (otherObject instanceof ArPoint) {
        objectCopy = new ArPoint(otherObject);
        objectCopy.x += this.x;
        objectCopy.y += this.y;
    }
    return objectCopy || undefined;
};

ArPoint.prototype.minus = function (otherObject) {
    var objectCopy = new ArPoint(otherObject);

    if (otherObject.cx !== undefined && otherObject.cy !== undefined) {
        objectCopy.subtract(this);

    } else if (otherObject.x !== undefined && otherObject.y !== undefined) {
        objectCopy = new ArSize();
        objectCopy.cx = this.x - otherObject.x;
        objectCopy.cy = this.y - otherObject.y;

    }
    return objectCopy;
};

ArPoint.prototype.assign = function (otherPoint) {
    this.x = otherPoint.x;
    this.y = otherPoint.y;

    return this;
};

ArPoint.prototype.toString = function () {
    return '(' + this.x + ', ' + this.y + ')';
};

module.exports = ArPoint;

},{"./AutoRouter.Size":16}],13:[function(require,module,exports){
/*jshint node: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var Logger = require('./AutoRouter.Logger'),  // FIXME
    CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    _logger = new Logger('AutoRouter.PointList');

var ArPointListPath = function () {
    for (var i = arguments.length; i--;) {
        this.unshift(arguments[i]);
    }
};

ArPointListPath.prototype = [];

// Wrapper Functions
ArPointListPath.prototype.concat = function (list) {
    var newPoints = new ArPointListPath(),
        i;

    for (i = 0; i < this.length; i++) {
        newPoints.push(this[i]);
    }

    for (i = 0; i < list.length; i++) {
        newPoints.push(list[i]);
    }
    return newPoints;
};

// Functions

ArPointListPath.prototype.end = function () {
    return this[this.length - 1];
};

ArPointListPath.prototype.getTailEdge = function () {
    if (this.length < 2) {
        return this.length;
    }

    var pos = this.length - 1,
        end = this[pos--],
        start = this[pos];

    return {'pos': pos, 'start': start, 'end': end};
};

ArPointListPath.prototype.getPrevEdge = function (pos, start, end) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    end = this[pos--];
    if (pos !== this.length) {
        start = this[pos];
    }

    return {'pos': pos, 'start': start, 'end': end};
};

ArPointListPath.prototype.getEdge = function (pos, start, end) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    start = this[pos++];
    assert(pos < this.length, 'ArPointListPath.getEdge: pos < this.length FAILED');

    end = this[pos];
};

ArPointListPath.prototype.getTailEdgePtrs = function () {
    var pos = this.length,
        start,
        end;

    if (this.length < 2) {
        return {'pos': pos};
    }

    assert(--pos < this.length, 'ArPointListPath.getTailEdgePtrs: --pos < this.length FAILED');

    end = this[pos--];
    assert(pos < this.length, 'ArPointListPath.getTailEdgePtrs: pos < this.length FAILED');

    start = this[pos];

    return {'pos': pos, 'start': start, 'end': end};
};

ArPointListPath.prototype.getPrevEdgePtrs = function (pos) {
    var start,
        end;

    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    end = this[pos];

    if (pos-- > 0) {
        start = this[pos];
    }

    return {pos: pos, start: start, end: end};
};

ArPointListPath.prototype.getStartPoint = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    return this[pos];
};

ArPointListPath.prototype.getEndPoint = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    pos++;
    assert(pos < this.length,
        'ArPointListPath.getEndPoint: pos < this.length FAILED');

    return this[pos];
};

ArPointListPath.prototype.getPointBeforeEdge = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    pos--;
    if (pos === this.length) {
        return null;
    }

    return this[pos];
};

ArPointListPath.prototype.getPointAfterEdge = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    pos++;
    assert(pos < this.length,
        'ArPointListPath.getPointAfterEdge: pos < this.length FAILED');

    pos++;
    if (pos === this.length) {
        return null;
    }

    return this[pos];
};

ArPointListPath.prototype.assertValid = function (msg) {
    // Check to make sure each point makes a horizontal/vertical line with it's neighbors
    msg = msg || '';
    for (var i = this.length - 1; i > 0; i--) {
        assert(!!this[i].minus, 'Bad value at position ' + i + ' (' + Utils.stringify(this[i]) + ')');
        assert(!!this[i - 1].minus, 'Bad value at position ' + (i - 1) + ' (' + Utils.stringify(this[i - 1]) + ')');

        assert(Utils.isRightAngle(Utils.getDir(this[i - 1].minus(this[i]))),
            msg + '\n\tArPointListPath contains skew edge:\n' + Utils.stringify(this));
    }
};

ArPointListPath.prototype.assertValidPos = function (pos) {
    assert(pos < this.length, 'ArPointListPath.assertValidPos: pos < this.length FAILED');
};

ArPointListPath.prototype.dumpPoints = function (msg) {
    msg += ', points dump begin:\n';
    var pos = 0,
        i = 0,
        p;
    while (pos < this.length) {
        p = this[pos++];
        msg += i + '.: (' + p.x + ', ' + p.y + ')\n';
        i++;
    }
    msg += 'points dump end.';
    _logger.debug(msg);
    return msg;
};

module.exports = ArPointListPath;


},{"./AutoRouter.Constants":6,"./AutoRouter.Logger":10,"./AutoRouter.Utils":17}],14:[function(require,module,exports){
/*jshint node: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArSize = require('./AutoRouter.Size'),
    ArRect = require('./AutoRouter.Rect');

var AutoRouterPort = function () {
    this.id = null;
    this.owner = null;
    this.limitedDirections = true;
    this.rect = new ArRect();
    this.attributes = CONSTANTS.PortDefault;

    // For this.points on CONSTANTS.DirTop, CONSTANTS.DirLeft, CONSTANTS.DirRight, etc
    this.points = [[], [], [], []];
    this.selfPoints = [];
    this.availableArea = [];  // availableAreas keeps track of visible (not overlapped) portions of the port

    this.calculateSelfPoints();
};

AutoRouterPort.prototype.calculateSelfPoints = function () {
    this.selfPoints = [];
    this.selfPoints.push(new ArPoint(this.rect.getTopLeft()));

    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.ceil));
    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.floor));
    this.selfPoints.push(new ArPoint(this.rect.left, this.rect.floor));
    this.resetAvailableArea();
};

AutoRouterPort.prototype.hasOwner = function () {
    return this.owner !== null;
};

AutoRouterPort.prototype.isRectEmpty = function () {
    return this.rect.isRectEmpty();
};

AutoRouterPort.prototype.getCenter = function () {
    return this.rect.getCenterPoint();
};

AutoRouterPort.prototype.setRect = function (r) {
    assert(r.getWidth() >= 3 && r.getHeight() >= 3,
        'ARPort.setRect: r.getWidth() >= 3 && r.getHeight() >= 3 FAILED!');

    this.rect.assign(r);
    this.calculateSelfPoints();
    this.resetAvailableArea();
};

AutoRouterPort.prototype.shiftBy = function (offset) {
    assert(!this.rect.isRectEmpty(), 'ARPort.shiftBy: !this.rect.isRectEmpty() FAILED!');

    this.rect.add(offset);

    this.calculateSelfPoints();
    // Shift points
    this.shiftPoints(offset);
};

AutoRouterPort.prototype.isConnectToCenter = function () {
    return (this.attributes & CONSTANTS.PortConnectToCenter) !== 0;
};

AutoRouterPort.prototype.hasLimitedDirs = function () {
    return this.limitedDirections;
};

AutoRouterPort.prototype.setLimitedDirs = function (ltd) {
    this.limitedDirections = ltd;
};

AutoRouterPort.prototype.portOnWhichEdge = function (point) {
    return Utils.onWhichEdge(this.rect, point);
};

AutoRouterPort.prototype.canHaveStartEndPointOn = function (dir, isStart) {
    assert(0 <= dir && dir <= 3, 'ARPort.canHaveStartEndPointOn: 0 <= dir && dir <= 3 FAILED!');

    if (isStart) {
        dir += 4;
    }

    return ((this.attributes & (1 << dir)) !== 0);
};

AutoRouterPort.prototype.canHaveStartEndPoint = function (isStart) {
    return ((this.attributes & (isStart ? CONSTANTS.PortStartOnAll : CONSTANTS.PortEndOnAll)) !== 0);
};

AutoRouterPort.prototype.canHaveStartEndPointHorizontal = function (isHorizontal) {
    return ((this.attributes &
    (isHorizontal ? CONSTANTS.PortStartEndHorizontal : CONSTANTS.PortStartEndVertical)) !== 0);
};

AutoRouterPort.prototype.getStartEndDirTo = function (point, isStart, notthis) {
    assert(!this.rect.isRectEmpty(), 'ARPort.getStartEndDirTo: !this.rect.isRectEmpty() FAILED!');

    notthis = notthis ? notthis : CONSTANTS.DirNone; // if notthis is undefined, set it to CONSTANTS.DirNone (-1)

    var offset = point.minus(this.rect.getCenterPoint()),
        dir1 = Utils.getMajorDir(offset);

    if (dir1 !== notthis && this.canHaveStartEndPointOn(dir1, isStart)) {
        return dir1;
    }

    var dir2 = Utils.getMinorDir(offset);

    if (dir2 !== notthis && this.canHaveStartEndPointOn(dir2, isStart)) {
        return dir2;
    }

    var dir3 = Utils.reverseDir(dir2);

    if (dir3 !== notthis && this.canHaveStartEndPointOn(dir3, isStart)) {
        return dir3;
    }

    var dir4 = Utils.reverseDir(dir1);

    if (dir4 !== notthis && this.canHaveStartEndPointOn(dir4, isStart)) {
        return dir4;
    }

    if (this.canHaveStartEndPointOn(dir1, isStart)) {
        return dir1;
    }

    if (this.canHaveStartEndPointOn(dir2, isStart)) {
        return dir2;
    }

    if (this.canHaveStartEndPointOn(dir3, isStart)) {
        return dir3;
    }

    if (this.canHaveStartEndPointOn(dir4, isStart)) {
        return dir4;
    }

    return CONSTANTS.DirTop;
};

AutoRouterPort.prototype.roundToHalfGrid = function (left, right) {
    var btwn = (left + right) / 2;
    assert(btwn < Math.max(left, right) && btwn > Math.min(left, right),
        'roundToHalfGrid: btwn variable not between left, right values. Perhaps box/connectionArea is too small?');
    return btwn;
};

AutoRouterPort.prototype.createStartEndPointTo = function (point, dir) {
    // calculate pathAngle
    var dx = point.x - this.getCenter().x,
        dy = point.y - this.getCenter().y,
        pathAngle = Math.atan2(-dy, dx),
        k = 0,
        maxX = this.rect.right,
        maxY = this.rect.floor,
        minX = this.rect.left,
        minY = this.rect.ceil,
        resultPoint,
        smallerPt = new ArPoint(minX, minY),  // The this.points that the resultPoint is centered between
        largerPt = new ArPoint(maxX, maxY);

    // Find the smaller and larger points
    // As the points cannot be on the corner of an edge (ambiguous direction), 
    // we will shift the min, max in one pixel
    if (Utils.isHorizontal(dir)) {  // shift x coordinates
        minX++;
        maxX--;
    } else { // shift y coordinates
        minY++;
        maxY--;
    }

    // Adjust angle based on part of port to which it is connecting
    switch (dir) {

        case CONSTANTS.DirTop:
            pathAngle = 2 * Math.PI - (pathAngle + Math.PI / 2);
            largerPt.y = this.rect.ceil;
            break;

        case CONSTANTS.DirRight:
            pathAngle = 2 * Math.PI - pathAngle;
            smallerPt.x = this.rect.right;
            break;

        case CONSTANTS.DirBottom:
            pathAngle -= Math.PI / 2;
            smallerPt.y = this.rect.floor;
            break;

        case CONSTANTS.DirLeft:
            largerPt.x = this.rect.left;
            break;
    }

    if (pathAngle < 0) {
        pathAngle += 2 * Math.PI;
    }

    pathAngle *= 180 / Math.PI;  // Using degrees for easier debugging

    // Finding this.points ordering
    while (k < this.points[dir].length && pathAngle > this.points[dir][k].pathAngle) {
        k++;
    }

    if (this.points[dir].length) {
        if (k === 0) {
            largerPt = new ArPoint(this.points[dir][k]);

        } else if (k !== this.points[dir].length) {
            smallerPt = new ArPoint(this.points[dir][k - 1]);
            largerPt = new ArPoint(this.points[dir][k]);

        } else {
            smallerPt = new ArPoint(this.points[dir][k - 1]);

        }
    }

    resultPoint = new ArPoint((largerPt.x + smallerPt.x) / 2, (largerPt.y + smallerPt.y) / 2);
    resultPoint.pathAngle = pathAngle;

    // Move the point over to an 'this.availableArea' if appropriate
    var i = this.availableArea.length,
        closestArea = 0,
        distance = Infinity,
        start,
        end;

    // Find distance from each this.availableArea and store closest index
    while (i--) {
        start = this.availableArea[i][0];
        end = this.availableArea[i][1];

        if (Utils.isOnEdge(start, end, resultPoint)) {
            closestArea = -1;
            break;
        } else if (Utils.distanceFromLine(resultPoint, start, end) < distance) {
            closestArea = i;
            distance = Utils.distanceFromLine(resultPoint, start, end);
        }
    }

    if (closestArea !== -1 && this.isAvailable()) { // resultPoint needs to be moved to the closest available area
        var dir2 = Utils.getDir(this.availableArea[closestArea][0].minus(resultPoint));

        assert(Utils.isRightAngle(dir2),
            'AutoRouterPort.createStartEndPointTo: Utils.isRightAngle(dir2) FAILED');

        if (dir2 === CONSTANTS.DirLeft || dir2 === CONSTANTS.DirTop) { // Then resultPoint must be moved up
            largerPt = this.availableArea[closestArea][1];
        } else { // Then resultPoint must be moved down
            smallerPt = this.availableArea[closestArea][0];
        }

        resultPoint = new ArPoint((largerPt.x + smallerPt.x) / 2, (largerPt.y + smallerPt.y) / 2);
    }

    this.points[dir].splice(k, 0, resultPoint);

    assert(Utils.isRightAngle(this.portOnWhichEdge(resultPoint)),
        'AutoRouterPort.createStartEndPointTo: Utils.isRightAngle(this.portOnWhichEdge(resultPoint)) FAILED');

    return resultPoint;
};

AutoRouterPort.prototype.removePoint = function (pt) {
    var removed;

    removed = Utils.removeFromArrays.apply(null, [pt].concat(this.points));
};

AutoRouterPort.prototype.hasPoint = function (pt) {
    var i = 0,
        k;

    while (i < 4) { //Check all sides for the point
        k = this.points[i].indexOf(pt);

        if (k > -1) { //If the point is on this side of the port
            return true;
        }
        i++;
    }

    return false;
};

AutoRouterPort.prototype.shiftPoints = function (shift) {
    for (var s = this.points.length; s--;) {
        for (var i = this.points[s].length; i--;) {
            // Shift this point
            this.points[s][i].add(shift);
        }
    }
};

AutoRouterPort.prototype.getPointCount = function () {
    var i = 0,
        count = 0;

    while (i < 4) { // Check all sides for the point
        count += this.points[i++].length;
    }

    return count;
};

AutoRouterPort.prototype.resetAvailableArea = function () {
    this.availableArea = [];

    if (this.canHaveStartEndPointOn(CONSTANTS.DirTop)) {
        this.availableArea.push([this.rect.getTopLeft(), new ArPoint(this.rect.right, this.rect.ceil)]);
    }

    if (this.canHaveStartEndPointOn(CONSTANTS.DirRight)) {
        this.availableArea.push([new ArPoint(this.rect.right, this.rect.ceil), this.rect.getBottomRight()]);
    }

    if (this.canHaveStartEndPointOn(CONSTANTS.DirBottom)) {
        this.availableArea.push([new ArPoint(this.rect.left, this.rect.floor), this.rect.getBottomRight()]);
    }

    if (this.canHaveStartEndPointOn(CONSTANTS.DirLeft)) {
        this.availableArea.push([this.rect.getTopLeft(), new ArPoint(this.rect.left, this.rect.floor)]);
    }

};

AutoRouterPort.prototype.adjustAvailableArea = function (r) {
    //For all lines specified in availableAreas, check if the line Utils.intersect s the rectangle
    //If it does, remove the part of the line that Utils.intersect s the rectangle
    if (!this.rect.touching(r)) {
        return;
    }

    var i = this.availableArea.length,
        intersection,
        line;

    while (i--) {

        if (Utils.isLineClipRect(this.availableArea[i][0], this.availableArea[i][1], r)) {
            line = this.availableArea.splice(i, 1)[0];
            intersection = Utils.getLineClipRectIntersect(line[0], line[1], r);

            if (!intersection[0].equals(line[0])) {
                this.availableArea.push([line[0], intersection[0]]);
            }

            if (!intersection[1].equals(line[1])) {
                this.availableArea.push([intersection[1], line[1]]);
            }
        }
    }
};

AutoRouterPort.prototype.getTotalAvailableArea = function () {
    var i = this.availableArea.length,
        length = new ArSize();

    while (i--) {
        length.add(this.availableArea[i][1].minus(this.availableArea[i][0]));
    }

    assert(length.cx === 0 || length.cy === 0,
        'ARPort.getTotalAvailableArea: length[0] === 0 || length[1] === 0 FAILED');
    return length.cx || length.cy;
};

AutoRouterPort.prototype.isAvailable = function () {
    return this.availableArea.length > 0;
};

AutoRouterPort.prototype.assertValid = function () {
    // Check that all points are on a side of the port
    var point;

    assert(this.owner, 'Port ' + this.id + ' does not have valid owner!');
    for (var s = this.points.length; s--;) {
        for (var i = this.points[s].length; i--;) {
            point = this.points[s][i];
            assert(Utils.isRightAngle(this.portOnWhichEdge(point)),
                'AutoRouterPort.createStartEndPointTo: Utils.isRightAngle(this.portOnWhichEdge(resultPoint))' +
                ' FAILED');
        }
    }
};

AutoRouterPort.prototype.destroy = function () {
    // Remove all points
    this.owner = null;

    // Remove all points and self from all paths
    var point,
        path;

    for (var i = this.points.length; i--;) {
        for (var j = this.points[i].length; j--;) {
            point = this.points[i][j];
            path = point.owner;
            assert(path, 'start/end point does not have an owner!');
            path.removePort(this);
        }
    }

    this.points = [[], [], [], []];

};

module.exports = AutoRouterPort;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Rect":15,"./AutoRouter.Size":16,"./AutoRouter.Utils":17}],15:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var debug = require('debug'),
    ArPoint = require('./AutoRouter.Point'),
    ArSize = require('./AutoRouter.Size'),
    Logger = require('./AutoRouter.Logger'),
    _logger = new Logger('AutoRouter.Rect');

var ArRect = function (Left, Ceil, Right, Floor) {
    if (Left === undefined) { //No arguments
        Left = 0;
        Ceil = 0;
        Right = 0;
        Floor = 0;

    } else if (Ceil === undefined && Left instanceof ArRect) { // One argument
        // Left is an ArRect
        Ceil = Left.ceil;
        Right = Left.right;
        Floor = Left.floor;
        Left = Left.left;

    } else if (Right === undefined && Left instanceof ArPoint) { // Two arguments
        // Creating ArRect with ArPoint and either another ArPoint or ArSize
        if (Ceil instanceof ArSize) {
            Right = Left.x + Ceil.cx;
            Floor = Left.y + Ceil.cy;
            Ceil = Left.y;
            Left = Left.x;

        } else if (Left instanceof ArPoint && Ceil instanceof ArPoint) {
            Right = Math.round(Ceil.x);
            Floor = Math.round(Ceil.y);
            Ceil = Math.round(Left.y);
            Left = Math.round(Left.x);
        } else {
            throw new Error('Invalid ArRect Constructor');
        }

    } else if (Floor === undefined) { // Invalid
        throw new Error('Invalid ArRect Constructor');
    }

    this.left = Math.round(Left);
    this.ceil = Math.round(Ceil);
    this.floor = Math.round(Floor);
    this.right = Math.round(Right);
};

ArRect.prototype.getCenter = function () {
    return {'x': (this.left + this.right) / 2, 'y': (this.ceil + this.floor) / 2};
};

ArRect.prototype.getWidth = function () {
    return (this.right - this.left);
};

ArRect.prototype.getHeight = function () {
    return (this.floor - this.ceil);
};

ArRect.prototype.getSize = function () {
    return new ArSize(this.getWidth(), this.getHeight());
};

ArRect.prototype.getTopLeft = function () {
    return new ArPoint(this.left, this.ceil);
};

ArRect.prototype.getBottomRight = function () {
    return new ArPoint(this.right, this.floor);
};

ArRect.prototype.getCenterPoint = function () {
    return new ArPoint(this.left + this.getWidth() / 2, this.ceil + this.getHeight() / 2);
};

ArRect.prototype.isRectEmpty = function () {
    if ((this.left >= this.right) && (this.ceil >= this.floor)) {
        return true;
    }

    return false;
};


ArRect.prototype.isRectNull = function () {
    if (this.left === 0 &&
        this.right === 0 &&
        this.ceil === 0 &&
        this.floor === 0) {
        return true;
    }

    return false;
};

ArRect.prototype.ptInRect = function (pt) {
    if (pt instanceof Array) {
        pt = pt[0];
    }

    if (pt.x >= this.left &&
        pt.x <= this.right &&
        pt.y >= this.ceil &&
        pt.y <= this.floor) {
        return true;
    }

    return false;
};

ArRect.prototype.setRect = function (nLeft, nCeil, nRight, nFloor) {
    if (nCeil === undefined && nLeft instanceof ArRect) { //
        this.assign(nLeft);

    } else if (nRight === undefined || nFloor === undefined) { //invalid
        _logger.debug('Invalid args for [ArRect].setRect');

    } else {
        this.left = nLeft;
        this.ceil = nCeil;
        this.right = nRight;
        this.floor = nFloor;
    }

};

ArRect.prototype.setRectEmpty = function () {

    this.ceil = 0;
    this.right = 0;
    this.floor = 0;
    this.left = 0;
};

ArRect.prototype.inflateRect = function (x, y) {
    if (x !== undefined && x.cx !== undefined && x.cy !== undefined) {
        y = x.cy;
        x = x.cx;
    } else if (y === undefined) {
        y = x;
    }

    this.left -= x;
    this.right += x;
    this.ceil -= y;
    this.floor += y;
};

ArRect.prototype.deflateRect = function (x, y) {
    if (x !== undefined && x.cx !== undefined && x.cy !== undefined) {
        y = x.cy;
        x = x.cx;
    }

    this.left += x;
    this.right -= x;
    this.ceil += y;
    this.floor -= y;
};

ArRect.prototype.normalizeRect = function () {
    var temp;

    if (this.left > this.right) {
        temp = this.left;
        this.left = this.right;
        this.right = temp;
    }

    if (this.ceil > this.floor) {
        temp = this.ceil;
        this.ceil = this.floor;
        this.floor = temp;
    }
};

ArRect.prototype.assign = function (rect) {

    this.ceil = rect.ceil;
    this.right = rect.right;
    this.floor = rect.floor;
    this.left = rect.left;
};

ArRect.prototype.equals = function (rect) {
    if (this.left === rect.left &&
        this.right === rect.right &&
        this.ceil === rect.ceil &&
        this.floor === rect.floor) {
        return true;
    }

    return false;

};

ArRect.prototype.add = function (ArObject) {
    var dx,
        dy;
    if (ArObject instanceof ArPoint) {
        dx = ArObject.x;
        dy = ArObject.y;

    } else if (ArObject.cx !== undefined && ArObject.cy !== undefined) {
        dx = ArObject.cx;
        dy = ArObject.cy;

    } else {
        _logger.debug('Invalid arg for [ArRect].add method');
    }

    this.left += dx;
    this.right += dx;
    this.ceil += dy;
    this.floor += dy;
};

ArRect.prototype.subtract = function (ArObject) {
    if (ArObject instanceof ArPoint) {
        this.deflateRect(ArObject.x, ArObject.y);

    } else if (ArObject instanceof ArSize) {
        this.deflateRect(ArObject);

    } else if (ArObject instanceof ArRect) {
        this.left += ArObject.left;
        this.right -= ArObject.right;
        this.ceil += ArObject.ceil;
        this.floor -= ArObject.floor;

    } else {
        _logger.debug('Invalid arg for [ArRect].subtract method');
    }
};

ArRect.prototype.plus = function (ArObject) {
    var resObject = new ArRect(this);
    resObject.add(ArObject);

    return resObject;
};

ArRect.prototype.minus = function (ArObject) {
    var resObject = new ArRect(this);
    resObject.subtract(ArObject);

    return resObject;
};

ArRect.prototype.unionAssign = function (rect) {
    if (rect.isRectEmpty()) {
        return;
    }
    if (this.isRectEmpty()) {
        this.assign(rect);
        return;
    }

    //Take the outermost dimension
    this.left = Math.min(this.left, rect.left);
    this.right = Math.max(this.right, rect.right);
    this.ceil = Math.min(this.ceil, rect.ceil);
    this.floor = Math.max(this.floor, rect.floor);

};

ArRect.prototype.union = function (rect) {
    var resRect = new ArRect(this);
    resRect.unionAssign(rect);

    return resRect;
};

ArRect.prototype.intersectAssign = function (rect1, rect2) {
    rect2 = rect2 ? rect2 : this;
    //Sets this rect to the intersection rect
    this.left = Math.max(rect1.left, rect2.left);
    this.right = Math.min(rect1.right, rect2.right);
    this.ceil = Math.max(rect1.ceil, rect2.ceil);
    this.floor = Math.min(rect1.floor, rect2.floor);

    if (this.left >= this.right || this.ceil >= this.floor) {
        this.setRectEmpty();
        return false;
    }

    return true;
};

ArRect.prototype.intersect = function (rect) {
    var resRect = new ArRect(this);

    resRect.intersectAssign(rect);
    return resRect;
};

ArRect.prototype.touching = function (rect) {
    //One pixel is added to the minimums so, if they are not deemed to be touching
    //there is guaranteed to be at lease a one pixel path between them
    return Math.max(rect.left, this.left) <= Math.min(rect.right, this.right) + 1 &&
        Math.max(rect.ceil, this.ceil) <= Math.min(rect.floor, this.floor) + 1;
};

/**
 * Returns true if the given point is on one of the corners of the rectangle.
 *
 * @param point
 * @return {undefined}
 */
ArRect.prototype.onCorner = function (point) {
    var onHorizontalSide,
        onVerticalSide;

    onHorizontalSide = point.x === this.left || point.x === this.right;
    onVerticalSide = point.y === this.ceil || point.y === this.floor;

    return onHorizontalSide && onVerticalSide;
};

ArRect.prototype.toString = function () {
    return this.getTopLeft().toString() + ' ' + this.getBottomRight().toString();
};

module.exports = ArRect;

},{"./AutoRouter.Logger":10,"./AutoRouter.Point":12,"./AutoRouter.Size":16,"debug":1}],16:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var ArSize = function (x, y) {
    //Multiple Constructors
    if (x === undefined) { //No arguments were passed to constructor
        x = 0;
        y = 0;
    } else if (y === undefined) { //One argument passed to constructor
        y = x.cy;
        x = x.cx;
    }

    this.cx = x;
    this.cy = y;
};

ArSize.prototype.equals = function (otherSize) {
    if (this.cx === otherSize.cx && this.cy === otherSize.cy) {
        return true;
    }

    return false;
};

ArSize.prototype.add = function (otherSize) { //equivalent to +=
    if (otherSize.cx || otherSize.cy) {
        this.cx += otherSize.cx;
        this.cy += otherSize.cy;
    }
    if (otherSize.x || otherSize.y) {
        this.cx += otherSize.x;
        this.cy += otherSize.y;
    }
};

ArSize.prototype.getArray = function () {
    var res = [];
    res.push(this.cx);
    res.push(this.cy);
    return res;
};

module.exports = ArSize;

},{}],17:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */


'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    assert = require('./AutoRouter.Utils').assert,
    ArRect = require('./AutoRouter.Rect'),
    ArPoint = require('./AutoRouter.Point');

var _getOptimalPorts = function (ports, tgt) {
    //I will get the dx, dy that to the src/dst target and then I will calculate
    // a priority value that will rate the ports as candidates for the 
    //given path
    var srcC = new ArPoint(), //src center
        vector,
        port, //result
        maxP = -Infinity,
        maxArea = 0,
        sPoint,
        i;

    //Get the center points of the src,dst ports
    for (i = 0; i < ports.length; i++) {
        sPoint = ports[i].rect.getCenter();
        srcC.x += sPoint.x;
        srcC.y += sPoint.y;

        //adjust maxArea
        if (maxArea < ports[i].getTotalAvailableArea()) {
            maxArea = ports[i].getTotalAvailableArea();
        }

    }

    //Get the average center point of src
    srcC.x = srcC.x / ports.length;
    srcC.y = srcC.y / ports.length;

    //Get the directions
    vector = (tgt.minus(srcC).getArray());

    //Create priority function
    function createPriority(port, center) {
        var priority = 0,
        //point = [  center.x - port.rect.getCenter().x, center.y - port.rect.getCenter().y],
            point = [port.rect.getCenter().x - center.x, port.rect.getCenter().y - center.y],
            lineCount = (port.getPointCount() || 1),
            //If there is a problem with maxArea, just ignore density
            density = (port.getTotalAvailableArea() / lineCount) / maxArea || 1,
            major = Math.abs(vector[0]) > Math.abs(vector[1]) ? 0 : 1,
            minor = (major + 1) % 2;

        if (point[major] > 0 === vector[major] > 0 && (point[major] === 0) === (vector[major] === 0)) {
            //handling the === 0 error
            //If they have the same parity, assign the priority to maximize that is > 1
            priority = (Math.abs(vector[major]) / Math.abs(vector[major] - point[major])) * 25;
        }

        if (point[minor] > 0 === vector[minor] > 0 && (point[minor] === 0) === (vector[minor] === 0)) {
            //handling the === 0 error
            //If they have the same parity, assign the priority to maximize that is < 1
            priority += vector[minor] !== point[minor] ?
            (Math.abs(vector[minor]) / Math.abs(vector[minor] - point[minor])) * 1 : 0;
        }

        //Adjust priority based on the density of the lines...
        priority *= density;

        return priority;
    }

    //Create priority values for each port.
    var priority;
    for (i = 0; i < ports.length; i++) {
        priority = createPriority(ports[i], srcC) || 0;
        if (priority >= maxP) {
            port = ports[i];
            maxP = priority;
        }
    }

    assert(port.owner, 'ARGraph.getOptimalPorts: port has invalid owner');

    return port;
};

var _getPointCoord = function (point, horDir) {
    if (horDir === true || _isHorizontal(horDir)) {
        return point.x;
    } else {
        return point.y;
    }
};

var _inflatedRect = function (rect, a) {
    var r = rect;
    r.inflateRect(a, a);
    return r;
};

var _isPointNear = function (p1, p2, nearness) {
    return p2.x - nearness <= p1.x && p1.x <= p2.x + nearness &&
        p2.y - nearness <= p1.y && p1.y <= p2.y + nearness;
};

var _isPointIn = function (point, rect, nearness) {
    var tmpR = new ArRect(rect);
    tmpR.inflateRect(nearness, nearness);
    return tmpR.ptInRect(point) === true;
};

var _isRectIn = function (r1, r2) {
    return r2.left <= r1.left && r1.right <= r2.right &&
        r2.ceil <= r1.ceil && r1.floor <= r2.floor;
};

var _isRectClip = function (r1, r2) {
    var rect = new ArRect();
    return rect.intersectAssign(r1, r2) === true;
};

var _distanceFromHLine = function (p, x1, x2, y) {
    assert(x1 <= x2, 'ArHelper.distanceFromHLine: x1 <= x2 FAILED');

    return Math.max(Math.abs(p.y - y), Math.max(x1 - p.x, p.x - x2));
};

var _distanceFromVLine = function (p, y1, y2, x) {
    assert(y1 <= y2, 'ArHelper.distanceFromVLine: y1 <= y2 FAILED');

    return Math.max(Math.abs(p.x - x), Math.max(y1 - p.y, p.y - y2));
};

var _distanceFromLine = function (pt, start, end) {
    var dir = _getDir(end.minus(start));

    if (_isHorizontal(dir)) {
        return _distanceFromVLine(pt, start.y, end.y, start.x);
    } else {
        return _distanceFromHLine(pt, start.x, end.x, start.y);
    }
};

var _isOnEdge = function (start, end, pt) {
    if (start.x === end.x) {			// vertical edge, horizontal move
        if (end.x === pt.x && pt.y <= Math.max(end.y, start.y) && pt.y >= Math.min(end.y, start.y)) {
            return true;
        }
    } else if (start.y === end.y) {	// horizontal line, vertical move
        if (start.y === pt.y && pt.x <= Math.max(end.x, start.x) && pt.x >= Math.min(end.x, start.x)) {
            return true;
        }
    }

    return false;
};

var _isPointNearLine = function (point, start, end, nearness) {
    assert(0 <= nearness, 'ArHelper.isPointNearLine: 0 <= nearness FAILED');

    // begin Zolmol
    // the routing may create edges that have start==end
    // thus confusing this algorithm
    if (end.x === start.x && end.y === start.y) {
        return false;
    }
    // end Zolmol

    var point2 = point;

    point2.subtract(start);

    var end2 = end;
    end2.subtract(start);

    var x = end2.x,
        y = end2.y,
        u = point2.x,
        v = point2.y,
        xuyv = x * u + y * v,
        x2y2 = x * x + y * y;

    if (xuyv < 0 || xuyv > x2y2) {
        return false;
    }

    var expr1 = (x * v - y * u);
    expr1 *= expr1;
    var expr2 = nearness * nearness * x2y2;

    return expr1 <= expr2;
};

var _isLineMeetHLine = function (start, end, x1, x2, y) {
    assert(x1 <= x2, 'ArHelper.isLineMeetHLine: x1 <= x2 FAILED');
    if (start instanceof Array) {//Converting from 'pointer'
        start = start[0];
    }
    if (end instanceof Array) {
        end = end[0];
    }

    if (!((start.y <= y && y <= end.y) || (end.y <= y && y <= start.y ))) {
        return false;
    }

    var end2 = new ArPoint(end);
    end2.subtract(start);
    x1 -= start.x;
    x2 -= start.x;
    y -= start.y;

    if (end2.y === 0) {
        return y === 0 && (( x1 <= 0 && 0 <= x2 ) || (x1 <= end2.x && end2.x <= x2));
    }

    var x = ((end2.x) / end2.y) * y;
    return x1 <= x && x <= x2;
};

var _isLineMeetVLine = function (start, end, y1, y2, x) {
    assert(y1 <= y2, 'ArHelper.isLineMeetVLine: y1 <= y2  FAILED');
    if (start instanceof Array) {//Converting from 'pointer'
        start = start[0];
    }
    if (end instanceof Array) {
        end = end[0];
    }

    if (!((start.x <= x && x <= end.x) || (end.x <= x && x <= start.x ))) {
        return false;
    }

    var end2 = new ArPoint(end);
    end2.subtract(start);
    y1 -= start.y;
    y2 -= start.y;
    x -= start.x;

    if (end2.x === 0) {
        return x === 0 && (( y1 <= 0 && 0 <= y2 ) || (y1 <= end2.y && end2.y <= y2));
    }

    var y = ((end2.y) / end2.x) * x;
    return y1 <= y && y <= y2;
};

var _isLineClipRects = function (start, end, rects) {
    var i = rects.length;
    while (i--) {
        if (_isLineClipRect(start, end, rects[i])) {
            return true;
        }
    }
    return false;
};

var _isLineClipRect = function (start, end, rect) {
    if (rect.ptInRect(start) || rect.ptInRect(end)) {
        return true;
    }

    return _isLineMeetHLine(start, end, rect.left, rect.right, rect.ceil) ||
        _isLineMeetHLine(start, end, rect.left, rect.right, rect.floor) ||
        _isLineMeetVLine(start, end, rect.ceil, rect.floor, rect.left) ||
        _isLineMeetVLine(start, end, rect.ceil, rect.floor, rect.right);
};

var _getLineClipRectIntersect = function (start, end, rect) {
    //return the endpoints of the intersection line
    var dir = _getDir(end.minus(start)),
        endpoints = [new ArPoint(start), new ArPoint(end)];

    if (!_isLineClipRect(start, end, rect)) {
        return null;
    }

    assert(_isRightAngle(dir), 'ArHelper.getLineClipRectIntersect: _isRightAngle(dir) FAILED');

    //Make sure we are working left to right or top down
    if (dir === CONSTANTS.DirLeft || dir === CONSTANTS.DirTop) {
        dir = _reverseDir(dir);
        endpoints.push(endpoints.splice(0, 1)[0]); //Swap point 0 and point 1
    }

    if (_isPointInDirFrom(endpoints[0], rect.getTopLeft(), _reverseDir(dir))) {
        endpoints[0].assign(rect.getTopLeft());
    }

    if (_isPointInDirFrom(endpoints[1], rect.getBottomRight(), dir)) {
        endpoints[1].assign(rect.getBottomRight());
    }

    if (_isHorizontal(dir)) {
        endpoints[0].y = start.y;
        endpoints[1].y = end.y;
    } else {
        endpoints[0].x = start.x;
        endpoints[1].x = end.x;
    }

    return endpoints;

};

var _intersect = function (a1, a2, b1, b2) {
    return Math.min(a1, a2) <= Math.max(b1, b2) && Math.min(b1, b2) <= Math.max(a1, a2);
};

// --------------------------- RoutingDirection

var _isHorizontal = function (dir) {
    return dir === CONSTANTS.DirRight || dir === CONSTANTS.DirLeft;
};

var _isVertical = function (dir) {
    return dir === CONSTANTS.DirTop || dir === CONSTANTS.DirBottom;
};

var _isRightAngle = function (dir) {
    return CONSTANTS.DirTop <= dir && dir <= CONSTANTS.DirLeft;
};

var _areInRightAngle = function (dir1, dir2) {
    assert(_isRightAngle(dir1) && _isRightAngle(dir2),
        'ArHelper.areInRightAngle: _isRightAngle(dir1) && _isRightAngle(dir2) FAILED');
    return _isHorizontal(dir1) === _isVertical(dir2);
};

var _nextClockwiseDir = function (dir) {
    if (_isRightAngle(dir)) {
        return ((dir + 1) % 4);
    }

    return dir;
};

var _prevClockwiseDir = function (dir) {
    if (_isRightAngle(dir)) {
        return ((dir + 3) % 4);
    }

    return dir;
};

var _reverseDir = function (dir) {
    if (_isRightAngle(dir)) {
        return ((dir + 2) % 4);
    }

    return dir;
};

var _stepOneInDir = function (point, dir) {
    assert(_isRightAngle(dir), 'ArHelper.stepOnInDir: _isRightAngle(dir) FAILED');

    switch (dir) {
        case CONSTANTS.DirTop:
            point.y--;
            break;

        case CONSTANTS.DirRight:
            point.x++;
            break;

        case CONSTANTS.DirBottom:
            point.y++;
            break;

        case CONSTANTS.DirLeft:
            point.x--;
            break;
    }

};

var _getChildRectOuterCoordFrom = function (bufferObject, inDir, point) { //Point travels inDir until hits child box
    var children = bufferObject.children,
        i = -1,
        box = null,
        res = _getRectOuterCoord(bufferObject.box, inDir);

    assert(_isRightAngle(inDir), 'getChildRectOuterCoordFrom: _isRightAngle(inDir) FAILED');
    //The next assert fails if the point is in the opposite direction of the rectangle that it is checking.
    // e.g. The point is checking when it will hit the box from the right but the point is on the left
    assert(!_isPointInDirFrom(point, bufferObject.box, inDir),
        'getChildRectOuterCoordFrom: !isPointInDirFrom(point, bufferObject.box.rect, (inDir)) FAILED');

    while (++i < children.length) {

        if (_isPointInDirFrom(point, children[i], _reverseDir(inDir)) &&
            _isPointBetweenSides(point, children[i], inDir) &&
            _isCoordInDirFrom(res, _getRectOuterCoord(children[i], _reverseDir(inDir)), (inDir))) {

            res = _getRectOuterCoord(children[i], _reverseDir(inDir));
            box = children[i];
        }
    }

    return {'box': box, 'coord': res};
};

var _getRectOuterCoord = function (rect, dir) {
    assert(_isRightAngle(dir), 'Utils.getRectOuterCoord: isRightAngle(dir) FAILED');
    var t = rect.ceil - 1,
        r = rect.right + 1,
        b = rect.floor + 1,
        l = rect.left - 1;

    switch (dir) {
        case CONSTANTS.DirTop:
            return t;

        case CONSTANTS.DirRight:
            return r;

        case CONSTANTS.DirBottom:
            return b;
    }

    return l;
};

//	Indexes:
//				 04
//				1  5
//				3  7
//				 26

var getDirTableIndex = function (offset) {
    return (offset.cx >= 0) * 4 + (offset.cy >= 0) * 2 + (Math.abs(offset.cx) >= Math.abs(offset.cy));
};

var majorDirTable =
    [
        CONSTANTS.DirTop,
        CONSTANTS.DirLeft,
        CONSTANTS.DirBottom,
        CONSTANTS.DirLeft,
        CONSTANTS.DirTop,
        CONSTANTS.DirRight,
        CONSTANTS.DirBottom,
        CONSTANTS.DirRight
    ];

var _getMajorDir = function (offset) {
    return majorDirTable[getDirTableIndex(offset)];
};

var minorDirTable =
    [
        CONSTANTS.DirLeft,
        CONSTANTS.DirTop,
        CONSTANTS.DirLeft,
        CONSTANTS.DirBottom,
        CONSTANTS.DirRight,
        CONSTANTS.DirTop,
        CONSTANTS.DirRight,
        CONSTANTS.DirBottom
    ];

var _getMinorDir = function (offset) {
    return minorDirTable[getDirTableIndex(offset)];
};

//	FG123
//	E   4
//	D 0 5
//	C   6
//  BA987


var _exGetDirTableIndex = function (offset) {
    //This required a variable assignment; otherwise this function
    //returned undefined...
    var res =
        offset.cx > 0 ?
            (
                offset.cy > 0 ?
                    (
                        offset.cx > offset.cy ?
                            (
                                6
                            ) :
                            (offset.cx < offset.cy ?
                                (
                                    8
                                ) :
                                (
                                    7
                                ))
                    ) :
                    (offset.cy < 0 ?
                        (
                            offset.cx > -offset.cy ?
                                (
                                    4
                                ) :
                                (offset.cx < -offset.cy ?
                                    (
                                        2
                                    ) :
                                    (
                                        3
                                    ))
                        ) :
                        (
                            5
                        ))
            ) :
            (offset.cx < 0 ?
                (
                    offset.cy > 0 ?
                        (
                            -offset.cx > offset.cy ?
                                (
                                    12
                                ) :
                                (-offset.cx < offset.cy ?
                                    (
                                        10
                                    ) :
                                    (
                                        11
                                    ))
                        ) :
                        (offset.cy < 0 ?
                            (
                                offset.cx < offset.cy ?
                                    (
                                        14
                                    ) :
                                    (offset.cx > offset.cy ?
                                        (
                                            16
                                        ) :
                                        (
                                            15
                                        ))
                            ) :
                            (
                                13
                            ))
                ) :
                (
                    offset.cy > 0 ?
                        (
                            9
                        ) :
                        (offset.cy < 0 ?
                            (
                                1
                            ) :
                            (
                                0
                            ))
                ));

    return res;
};
var exMajorDirTable =
    [
        CONSTANTS.DirNone,
        CONSTANTS.DirTop,
        CONSTANTS.DirTop,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirTop
    ];

var _exGetMajorDir = function (offset) {
    return exMajorDirTable[_exGetDirTableIndex(offset)];
};

var exMinorDirTable =
    [
        CONSTANTS.DirNone,
        CONSTANTS.DirNone,
        CONSTANTS.DirRight,
        CONSTANTS.DirTop,
        CONSTANTS.DirTop,
        CONSTANTS.DirNone,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirRight,
        CONSTANTS.DirNone,
        CONSTANTS.DirLeft,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirNone,
        CONSTANTS.DirTop,
        CONSTANTS.DirTop,
        CONSTANTS.DirLeft
    ];

var _exGetMinorDir = function (offset) {
    return exMinorDirTable[_exGetDirTableIndex(offset)];
};

var _getDir = function (offset, nodir) {
    if (offset.cx === 0) {
        if (offset.cy === 0) {
            return nodir;
        }

        if (offset.cy < 0) {
            return CONSTANTS.DirTop;
        }

        return CONSTANTS.DirBottom;
    }

    if (offset.cy === 0) {
        if (offset.cx > 0) {
            return CONSTANTS.DirRight;
        }

        return CONSTANTS.DirLeft;
    }

    return CONSTANTS.DirSkew;
};

var _isPointInDirFromChildren = function (point, fromParent, dir) {
    var children = fromParent.children,
        i = 0;

    assert(_isRightAngle(dir), 'isPointInDirFromChildren: _isRightAngle(dir) FAILED');

    while (i < children.length) {
        if (_isPointInDirFrom(point, children[i].rect, dir)) {
            return true;
        }
        ++i;
    }

    return false;
};

var _isPointInDirFrom = function (point, from, dir) {
    if (from instanceof ArRect) {
        var rect = from;
        assert(_isRightAngle(dir), 'ArHelper.isPointInDirFrom: _isRightAngle(dir) FAILED');

        switch (dir) {
            case CONSTANTS.DirTop:
                return point.y < rect.ceil;

            case CONSTANTS.DirRight:
                return point.x >= rect.right;

            case CONSTANTS.DirBottom:
                return point.y >= rect.floor;

            case CONSTANTS.DirLeft:
                return point.x < rect.left;
        }

        return false;

    } else {
        assert(_isRightAngle(dir), 'ArHelper.isPointInDirFrom: _isRightAngle(dir) FAILED');

        switch (dir) {
            case CONSTANTS.DirTop:
                return point.y <= from.y;

            case CONSTANTS.DirRight:
                return point.x >= from.x;

            case CONSTANTS.DirBottom:
                return point.y >= from.y;

            case CONSTANTS.DirLeft:
                return point.x <= from.x;
        }

        return false;

    }
};

var _isPointBetweenSides = function (point, rect, ishorizontal) {
    if (ishorizontal === true || _isHorizontal(ishorizontal)) {
        return rect.ceil <= point.y && point.y < rect.floor;
    }

    return rect.left <= point.x && point.x < rect.right;
};

var _isCoordInDirFrom = function (coord, from, dir) {
    assert(_isRightAngle(dir), 'ArHelper.isCoordInDirFrom: _isRightAngle(dir) FAILED');
    if (from instanceof ArPoint) {
        from = _getPointCoord(from, dir);
    }

    if (dir === CONSTANTS.DirTop || dir === CONSTANTS.DirLeft) {
        return coord <= from;
    }

    return coord >= from;
};

// This next method only supports unambiguous orientations. That is, the point
// cannot be in a corner of the rectangle.
// NOTE: the right and floor used to be - 1. 
var _onWhichEdge = function (rect, point) {
    if (point.y === rect.ceil && rect.left < point.x && point.x < rect.right) {
        return CONSTANTS.DirTop;
    }

    if (point.y === rect.floor && rect.left < point.x && point.x < rect.right) {
        return CONSTANTS.DirBottom;
    }

    if (point.x === rect.left && rect.ceil < point.y && point.y < rect.floor) {
        return CONSTANTS.DirLeft;
    }

    if (point.x === rect.right && rect.ceil < point.y && point.y < rect.floor) {
        return CONSTANTS.DirRight;
    }

    return CONSTANTS.DirNone;
};
// --------------------------- CArFindNearestLine

var ArFindNearestLine = function (pt) {
    this.point = pt;
    this.dist1 = Infinity;
    this.dist2 = Infinity;
};

ArFindNearestLine.prototype.hLine = function (x1, x2, y) {
    assert(x1 <= x2, 'ArFindNearestLine.hLine: x1 <= x2  FAILED');

    var d1 = _distanceFromHLine(this.point, x1, x2, y),
        d2 = Math.abs(this.point.y - y);

    if (d1 < this.dist1 || (d1 === this.dist1 && d2 < this.dist2)) {
        this.dist1 = d1;
        this.dist2 = d2;
        return true;
    }

    return false;
};

ArFindNearestLine.prototype.vLine = function (y1, y2, x) {
    assert(y1 <= y2, 'ArFindNearestLine.hLine: y1 <= y2 FAILED');

    var d1 = _distanceFromVLine(this.point, y1, y2, x),
        d2 = Math.abs(this.point.x - x);

    if (d1 < this.dist1 || (d1 === this.dist1 && d2 < this.dist2)) {
        this.dist1 = d1;
        this.dist2 = d2;
        return true;
    }

    return false;
};

ArFindNearestLine.prototype.was = function () {
    return this.dist1 < Infinity && this.dist2 < Infinity;
};

// Convenience Functions
var removeFromArrays = function (value) {
    var index,
        removed = false,
        array;

    for (var i = arguments.length - 1; i > 0; i--) {
        array = arguments[i];
        index = array.indexOf(value);
        if (index !== -1) {
            array.splice(index, 1);
            removed = true;
        }
    }

    return removed;
};

var stringify = function (value) {
    return JSON.stringify(value, function (key, value) {
        if (key === 'owner' && value) {
            return value.id || typeof value;
        }
        return value;
    });
};

/**
 * Round the number to the given decimal places. Truncate following digits.
 *
 * @param {Number} value
 * @param {Number} places
 * @return {Number} result
 */
var roundTrunc = function (value, places) {
    value = +value;
    var scale = Math.pow(10, +places),
        fn = 'floor';

    if (value < 0) {
        fn = 'ceil';
    }

    return Math[fn](value * scale) / scale;
};

//Float equals
var floatEquals = function (a, b) {
    return ((a - 0.1) < b) && (b < (a + 0.1));
};

/**
 * Convert an object with increasing integer keys to an array.
 * Using method from http://jsperf.com/arguments-performance/6
 *
 * @param {Object} obj
 * @return {Array}
 */
var toArray = function (obj) {
    var result = new Array(obj.length||0),
        i = 0;
    while (obj[i] !== undefined) {
        result[i] = obj[i++];
    }
    return result;
};

var pick = function(keys, obj) {
    var res = {};
    for (var i = keys.length; i--;) {
        res[keys[i]] = obj[keys[i]];
    }
    return res;
};

var nop = function() {
    // nop
};

var assert = function(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assert failed');
    }
};

module.exports = {
    onWhichEdge: _onWhichEdge,
    isCoordInDirFrom: _isCoordInDirFrom,
    isPointBetweenSides: _isPointBetweenSides,
    isPointInDirFrom: _isPointInDirFrom,
    isPointInDirFromChildren: _isPointInDirFromChildren,
    isPointIn: _isPointIn,
    isPointNear: _isPointNear,
    getDir: _getDir,
    exGetMinorDir: _exGetMinorDir,
    exGetMajorDir: _exGetMajorDir,
    exGetDirTableIndex: _exGetDirTableIndex,
    getMinorDir: _getMinorDir,
    getMajorDir: _getMajorDir,
    getRectOuterCoord: _getRectOuterCoord,
    getChildRectOuterCoordFrom: _getChildRectOuterCoordFrom,
    stepOneInDir: _stepOneInDir,
    reverseDir: _reverseDir,
    prevClockwiseDir: _prevClockwiseDir,
    nextClockwiseDir: _nextClockwiseDir,
    areInRightAngle: _areInRightAngle,
    isRightAngle: _isRightAngle,
    isHorizontal: _isHorizontal,
    intersect: _intersect,
    getLineClipRectIntersect: _getLineClipRectIntersect,
    isLineClipRect: _isLineClipRect,
    isLineClipRects: _isLineClipRects,
    isPointNearLine: _isPointNearLine,
    isOnEdge: _isOnEdge,
    distanceFromLine: _distanceFromLine,
    isRectClip: _isRectClip,
    isRectIn: _isRectIn,
    inflatedRect: _inflatedRect,
    getPointCoord: _getPointCoord,
    getOptimalPorts: _getOptimalPorts,
    ArFindNearestLine: ArFindNearestLine,

    removeFromArrays: removeFromArrays,
    stringify: stringify,
    floatEquals: floatEquals,
    roundTrunc: roundTrunc,
    toArray: toArray,
    nop: nop,
    assert: assert,
    pick: pick 
};

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],18:[function(require,module,exports){
/*globals define*/
/*jshint browser: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    utils = require('./AutoRouter.Utils'),
    assert = utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterGraph = require('./AutoRouter.Graph'),
    AutoRouterPort = require('./AutoRouter.Port');

var AutoRouter = function () {
    // internal to external ids
    this._boxIds = {};
    this._portIds = {};
    this._pathIds = {};

    this._pathsToUpdateOnDeletion = {};  // portIds => paths
    this._pathsToUpdateOnAddition = {};  // boxIds => paths
    this._pathSrc = {};
    this._pathDst = {};

    this._graph = new AutoRouterGraph();
};

/* * * * * * * Public API * * * * * * */

AutoRouter.prototype.clear = function () {
    this._graph.clear(true);
    this._boxIds = {};
    this._portIds = {};
    this._pathIds = {};

    this._pathsToUpdateOnDeletion = {};  // portIds => paths
    this._pathsToUpdateOnAddition = {};  // boxIds => paths
    this._pathSrc = {};
    this._pathDst = {};
};

AutoRouter.prototype.setBox = function(id, rect) {
    var box;
    if (rect === null) {  // Remove the box
        return this._removeBox(id);
    }

    if (!this._boxIds[id]) {
        box = this._createBox(rect);
        // Update records
        this._boxIds[id] = box.id;
        this._portIds[id] = {};
    } else {
        this._updateBox(id, rect);
    }
};

AutoRouter.prototype.setDependentBox = function(parentId, childId) {
    var parent = this._box(parentId),
        child = this._box(childId);

    assert(parent && child, 'Could not find parent or child');
    parent.addChild(child);
};

AutoRouter.prototype.setPort = function(boxId, portId, area) {
    if (area === null) {
        return this._removePort(boxId, portId);
    }

    assert(this._box(boxId), 'Box "' + boxId + '" does not exist');
    if (!this._portIds[boxId] || !this._portIds[boxId][portId]) {
        this._createPort(boxId, portId, area);
        assert(this._port(boxId, portId), 'Port not added!');
    } else {
        this._updatePort(boxId, portId, area);
    }
};

AutoRouter.prototype.setPath = function(id, srcId, dstId) {
    if (srcId === null) {
        return this._removePath(id);
    }

    if (!this._pathIds[id]) {
        this._createPath(id, srcId, dstId);
    } else {
        this._updatePath(id, srcId, dstId);
    }
};

AutoRouter.prototype.setCustomRouting = function(id, points) {
    var path = this._path(id);

    if (path === undefined) {
        throw 'AutoRouter: Need to have an AutoRouterPath type to set custom path points';
    }

    if (points === null) {
        path.setAutoRouting(true);
    } else {
        this._setCustomPath(path, points);
    }
};

AutoRouter.prototype.routeSync = function () {
    this._graph.routeSync();
};

AutoRouter.prototype.routeAsync = function (options) {
    this._graph.routeAsync(options);
};

AutoRouter.prototype.box = function (id) {
    var pBox = this._box(id),  // private box
        rect;

    if (!pBox) {
        return null;
    }

    rect = pBox.rect;
    return {
        id: id,
        x: rect.left,
        width: rect.right - rect.left,
        y: rect.ceil,
        height: rect.floor - rect.ceil
    };
};

AutoRouter.prototype.port = function (boxId, id) {
    var container = this._port(boxId, id),
        rect;

    if (!container) {
        return null;
    }

    rect = container.ports[0].rect;

    return {
        id: id,
        x: rect.left,
        width: rect.right - rect.left,
        y: rect.ceil,
        height: rect.floor - rect.ceil
    };
};

AutoRouter.prototype.path = function (id) {
    var path = this._path(id);
    return {  // TODO: Consider adding src, dst
        id: id,
        points: path.points.map(function(pt) {
            return [pt.x, pt.y];
        })
    };
};

AutoRouter.prototype.boxes = function () {
    return Object.keys(this._boxIds);
};

AutoRouter.prototype.ports = function (boxId) {
    return Object.keys(this._portIds[boxId]);
};

AutoRouter.prototype.paths = function () {
    return Object.keys(this._pathIds);
};

/* * * * * * * Private API * * * * * * */

// Getters

AutoRouter.prototype._box = function (id) {
    var pId = this._boxIds[id];
    return this._graph.boxes[pId] || null;
};

AutoRouter.prototype._port = function (boxId, id) {
    assert(boxId !== undefined && id !== undefined, 'Missing ' + (boxId ? 'boxId' : 'id'));
    return this._portIds[boxId][id];
};

AutoRouter.prototype._path = function (id) {
    var pId = this._pathIds[id];
    for (var i = this._graph.paths.length; i--;) {
        if (this._graph.paths[i].id === pId) {
            return this._graph.paths[i];
        }
    }
    return null;
};

// Boxes

AutoRouter.prototype._createBox = function (params) {
    var x1 = params.x1,
        x2 = params.x2,
        y1 = params.y1,
        y2 = params.y2,
        box = this._graph.createBox(),
        rect = new ArRect(x1, y1, x2, y2);

    assert(!isNaN(x1 + x2 + y1 + y2), 'Missing size info for box');

    this._setValidRectSize(rect);
    box.setRect(rect);

    // Add the box to the graph
    this._graph.addBox(box);
    // Record keeping is not done in this function bc this function
    // is reused for the port containers
    return box;
};

AutoRouter.prototype._updateBox = function (id, params) {  // public id
    var box = this._box(id),
        rect = box.rect,
        newWidth = params.x2 - params.x1,
        newHeight = params.y2 - params.y1,
        dx,
        dy,
        newRect;

    // Shift
    if (newHeight === rect.getHeight() && newWidth === rect.getWidth()) {
        dx = params.x1 - rect.left;
        dy = params.y1 - rect.ceil;
        this._graph.shiftBoxBy(box, {cx: dx, cy: dy});
    } else {
        newRect = new ArRect(params.x1, params.y1, params.x2, params.y2);
        this._graph.setBoxRect(box, newRect);
    }

};

AutoRouter.prototype._removeBox = function (id) {  // public id
    var box = this._box(id),
        ports = Object.keys(this._portIds[id]);

    // Remove all ports
    for (var i = ports.length; i--;) {
        this._removePort(id, ports[i]);
    }

    this._graph.deleteBox(box);
    delete this._boxIds[id];
    delete this._portIds[id];
    delete this._pathsToUpdateOnAddition[id];
};

// Paths

AutoRouter.prototype._createPath = function (id, srcId, dstId) {  // public id
    var srcPorts = this._getPortsFor(srcId),
        dstPorts = this._getPortsFor(dstId),
        ports = srcPorts.concat(dstPorts),
        path;

    assert(srcPorts, 'Missing srcPorts (' + srcPorts + ')');
    assert(dstPorts, 'Missing dstPorts (' + dstPorts + ')');

    path = this._graph.addPath(true, srcPorts, dstPorts);
    path.id = id;
    this._pathIds[id] = path.id;

    // Update the updates dictionaries
    for (var i = ports.length; i--;) {
        if (!this._pathsToUpdateOnDeletion[ports[i].id]) {
            this._pathsToUpdateOnDeletion[ports[i].id] = [];
        }
        this._pathsToUpdateOnDeletion[ports[i].id].push(path);
    }

    if (typeof srcId === 'string') {
        if (!this._pathsToUpdateOnAddition[srcId]) {
            this._pathsToUpdateOnAddition[srcId] = [];
        }
        this._pathsToUpdateOnAddition[srcId].push(path);
    }
    if (typeof dstId === 'string') {
        if (!this._pathsToUpdateOnAddition[dstId]) {
            this._pathsToUpdateOnAddition[dstId] = [];
        }
        this._pathsToUpdateOnAddition[dstId].push(path);
    }
    this._pathSrc[id] = srcId;
    this._pathDst[id] = dstId;
};

AutoRouter.prototype._getPortsFor = function (boxId) {
    if (boxId instanceof Array) {  // list of ports -> not a boxId
        // FIXME: These ports would also need to be resolved!
        return boxId;
    } else {  // boxId is a box id -> get the ports
        var portIds = Object.keys(this._portIds[boxId]),
            ports = [];

        for (var i = portIds.length; i--;) {
            assert(this._portIds[boxId][portIds[i]].ports.length === 1);
            ports.push(this._portIds[boxId][portIds[i]].ports[0]);
        }
        assert(ports, 'no ports found (' + ports + ')');
        for (var i = ports.length; i--;) {
            assert (ports[i].owner, 'Invalid owner');
        }
        return ports;
    }
};

AutoRouter.prototype._updatePath = function (id, srcId, dstId) {  // public id
    this._removePath(id);
    this._createPath(id, srcId, dstId);
};

AutoRouter.prototype._removePath = function (id) {  // public id
    var path = this._path(id);
    this._graph.deletePath(path);
    delete this._pathIds[id];
    delete this._pathSrc[id];
    delete this._pathDst[id];
};

AutoRouter.prototype._setCustomPath = function (path, points) {  // public id
    // Convert points to array of ArPoints
    points = points.map(function (point) {
        return new ArPoint(point[0], point[1]);
    });

    path.setCustomPathPoints(points);
    path.setAutoRouting(false);
};

// Ports

AutoRouter.prototype._createPort = function (boxId, portId, area) {  // area: [[x1, y1], [x2, y2]]
    var box = this._box(boxId),
        container,
        cRect = new ArRect(),
        port = new AutoRouterPort(),
        rect = this._createRectFromArea(area),
        attr;

    // Create the port
    attr = this._getPortAttributes(box.rect, area);
    port.id = boxId + '/|\\' + portId;
    port.setLimitedDirs(false);
    port.attributes = attr;
    this._setValidRectSize(rect);
    port.setRect(rect);

    // Create a container rect
    cRect.assign(rect);
    cRect.inflateRect(1);
    container = this._createBox({
        x1: cRect.left,
        y1: cRect.ceil,
        x2: cRect.right,
        y2: cRect.floor
    });

    box.addChild(container);
    container.addPort(port);
    this._portIds[boxId][portId] = container;

    // Update paths as needed
    var paths = this._pathsToUpdateOnAddition[boxId] || [],
        start,
        end;

    for (var i = paths.length; i--;) {
        // Get the new ports
        start = this._getPortsFor(this._pathSrc[paths[i].id]);
        end = this._getPortsFor(this._pathDst[paths[i].id]);

        // Disconnect and update path
        this._graph.disconnect(paths[i]);
        paths[i].setStartEndPorts(start, end);
    }
};

AutoRouter.prototype._createRectFromArea = function (area) {
    var rect = new ArRect(area.x1, area.y1, area.x2, area.y2);
    this._setValidRectSize(rect);
    return rect;
};

AutoRouter.prototype._getPortAttributes = function (rect, area) {
    var attr = 0,
        x1 = area.x1,
        x2 = area.x2,
        y1 = area.y1,
        y2 = area.y2,
        horizontal = y1 === y2;

    if (horizontal) {
        if (Math.abs(y1 - rect.ceil) < Math.abs(y1 - rect.floor)) {  // Closer to the top
            attr = CONSTANTS.PortStartOnTop + CONSTANTS.PortEndOnTop;
        } else {  // Closer to the top (horizontal)
            attr = CONSTANTS.PortStartOnBottom + CONSTANTS.PortEndOnBottom;
        }

    } else {
        if (Math.abs(x1 - rect.left) < Math.abs(x1 - rect.right)) {  // Closer to the left
            attr = CONSTANTS.PortStartOnLeft + CONSTANTS.PortEndOnLeft;
        } else {  // Closer to the right (vertical)
            attr = CONSTANTS.PortStartOnRight + CONSTANTS.PortEndOnRight;
        }
    }

    return attr;
};

AutoRouter.prototype._updatePort = function (boxId, portId, area) {
    var box = this._box(boxId),
        container = this._port(boxId, portId),
        cRect = container.rect,
        port = container.ports[0],
        rect = this._createRectFromArea(area),
        attr;

    // Update the port's rect
    attr = this._getPortAttributes(box.rect, area);
    port.setLimitedDirs(false);
    port.attributes = attr;
    this._setValidRectSize(rect);
    port.setRect(rect);

    cRect.assign(port.rect);
    cRect.inflateRect(1);
    container.setRect(cRect);
};

AutoRouter.prototype._removePort = function (boxId, portId) {
    var container = this._port(boxId, portId),
        port = container.ports[0],
        paths = this._pathsToUpdateOnDeletion[port.id] || [],
        start,
        end;

    this._graph.deleteBox(container);

    // Update paths
    delete this._pathsToUpdateOnDeletion[port.id];
    for (var i = paths.length; i--;) {
        start = paths[i].startports;
        end = paths[i].endports;
        utils.removeFromArrays(port, start, end);
        paths[i].setStartEndPorts(start, end);
    }
    delete this._portIds[boxId][portId];
};

// Shared utilities

AutoRouter.prototype._setValidRectSize = function (rect) {
    // Make sure the rect is at least 3x3
    var height = rect.getHeight(),
        width = rect.getWidth(),
        dx = Math.max((3 - width) / 2, 0),
        dy = Math.max((3 - height) / 2, 0);

    rect.inflateRect(dx, dy);
    return rect;
};

module.exports = AutoRouter;

},{"./AutoRouter.Constants":6,"./AutoRouter.Graph":9,"./AutoRouter.Point":12,"./AutoRouter.Port":14,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGVidWcvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9ub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJzcmMvQXV0b1JvdXRlci5BY3Rpb25BcHBsaWVyLmpzIiwic3JjL0F1dG9Sb3V0ZXIuQm94LmpzIiwic3JjL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzLmpzIiwic3JjL0F1dG9Sb3V0ZXIuRWRnZS5qcyIsInNyYy9BdXRvUm91dGVyLkVkZ2VMaXN0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuR3JhcGguanMiLCJzcmMvQXV0b1JvdXRlci5Mb2dnZXIuanMiLCJzcmMvQXV0b1JvdXRlci5QYXRoLmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9pbnQuanMiLCJzcmMvQXV0b1JvdXRlci5Qb2ludExpc3QuanMiLCJzcmMvQXV0b1JvdXRlci5Qb3J0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUmVjdC5qcyIsInNyYy9BdXRvUm91dGVyLlNpemUuanMiLCJzcmMvQXV0b1JvdXRlci5VdGlscy5qcyIsInNyYy9BdXRvUm91dGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeGlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5leHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lXG4gICAgICAgICAgICAgICAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgID8gY2hyb21lLnN0b3JhZ2UubG9jYWxcbiAgICAgICAgICAgICAgICAgIDogbG9jYWxzdG9yYWdlKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSAnJyArIHN0cjtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDAwMCkgcmV0dXJuO1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2hycyc6XG4gICAgY2FzZSAnaHInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbWlucyc6XG4gICAgY2FzZSAnbWluJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3NlY3MnOlxuICAgIGNhc2UgJ3NlYyc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICBjYXNlICdtaWxsaXNlY29uZCc6XG4gICAgY2FzZSAnbXNlY3MnOlxuICAgIGNhc2UgJ21zZWMnOlxuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXV0b1JvdXRlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlcicpLFxuICAgIGFzc2VydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLmFzc2VydDtcblxudmFyIEF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyID0gZnVuY3Rpb24gKCkge1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIuQXV0b1JvdXRlciA9IEF1dG9Sb3V0ZXI7XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3BvcnRTZXBhcmF0b3IgPSB0aGlzLl9wb3J0U2VwYXJhdG9yIHx8ICdfeF8nO1xuICAgIHRoaXMuYXV0b3JvdXRlciA9IG5ldyBBdXRvUm91dGVyKCk7XG4gICAgdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlID0gJ1snO1xuICAgIHRoaXMuX2NsZWFyUmVjb3JkcygpO1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9jbGVhclJlY29yZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fYXV0b3JvdXRlckJveGVzID0ge307ICAvLyBEZWZpbmUgY29udGFpbmVyIHRoYXQgd2lsbCBtYXAgb2JqK3N1YklEIC0+IGJveFxuICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0cyA9IHt9OyAgLy8gTWFwcyBib3hJZHMgdG8gYW4gYXJyYXkgb2YgcG9ydCBpZHMgdGhhdCBoYXZlIGJlZW4gbWFwcGVkXG4gICAgdGhpcy5fYXV0b3JvdXRlclBhdGhzID0ge307XG4gICAgdGhpcy5fYXJQYXRoSWQyT3JpZ2luYWwgPSB7fTtcbn07XG5cbi8qKlxuICogUmVwbGFjZSBpZCBzdG9yZWQgYXQgdGhlIGdpdmVuIGluZGljZXMgb2YgdGhlIGFycmF5IHdpdGggdGhlIGl0ZW0gZnJvbSB0aGUgZGljdGlvbmFyeS5cbiAqXG4gKiBAcGFyYW0ge0RpY3Rpb25hcnl9IGRpY3Rpb25hcnlcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5XG4gKiBAcGFyYW0ge0FycmF5PE51bWJlcj59IGluZGljZXNcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9sb29rdXBJdGVtID0gZnVuY3Rpb24gKGRpY3Rpb25hcnksIGFycmF5LCBpbmRpY2VzKSB7ICAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICB2YXIgaW5kZXgsXG4gICAgICAgIGlkO1xuXG4gICAgZm9yICh2YXIgaSA9IDI7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5kZXggPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGlkID0gYXJyYXlbaW5kZXhdO1xuICAgICAgICBhcnJheVtpbmRleF0gPSBkaWN0aW9uYXJ5W2lkXTtcbiAgICB9XG59O1xuXG4vLyBGSVhNRTogVXBkYXRlIHRoaXMgbWV0aG9kIGZvciBuZXcgYXBpXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ZpeEFyZ3MgPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuICAgIHZhciBpZDtcbiAgICAvLyBGaXggYXJncywgaWYgbmVlZGVkXG4gICAgc3dpdGNoIChjb21tYW5kKSB7XG4gICAgICAgIGNhc2UgJ21vdmUnOiAgLy8gYXJnc1swXSBpcyBpZCBzaG91bGQgYmUgdGhlIGJveFxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYXJnc1swXSA9IGFyZ3NbMF0uYm94O1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnZ2V0UGF0aFBvaW50cyc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJQYXRocywgYXJncywgMCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdzZXRQYXRoQ3VzdG9tUG9pbnRzJzpcbiAgICAgICAgICAgIGlkID0gYXJnc1swXS5wYXRoO1xuICAgICAgICAgICAgYXJnc1swXS5wYXRoID0gdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldEJveFJlY3QnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnZ2V0Qm94UmVjdCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBhcmdzWzBdID0gYXJnc1swXS5ib3guaWQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1cGRhdGVQb3J0JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldENvbXBvbmVudCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCwgMSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdhZGRQYXRoJzpcbiAgICAgICAgICAgIHRoaXMuX2ZpeFBvcnRBcmdzKGFyZ3NbMF0uc3JjLCBhcmdzWzBdLmRzdCk7XG4gICAgICAgICAgICBhcmdzLnBvcCgpOyAgLy8gUmVtb3ZlIHRoZSBjb25uZWN0aW9uIGlkXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdyZW1vdmUnOlxuICAgICAgICAgICAgdmFyIGl0ZW07XG5cbiAgICAgICAgICAgIGlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF0pIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTsgIC8vIElmIG9iaklkIGlzIGEgY29ubmVjdGlvblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhcmdzWzBdID0gaXRlbTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2FkZEJveCc6XG4gICAgICAgICAgICBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9maXhQb3J0QXJncyA9IGZ1bmN0aW9uIChwb3J0MSwgcG9ydDIpIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgdmFyIHBvcnRJZCxcbiAgICAgICAgcG9ydElkcyxcbiAgICAgICAgYXJQb3J0SWQsXG4gICAgICAgIGJveElkLFxuICAgICAgICBwb3J0cztcblxuICAgIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBvcnRzID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBwb3J0SWRzID0gT2JqZWN0LmtleXMocG9ydHMpO1xuICAgICAgICBmb3IgKHZhciBqID0gcG9ydElkcy5sZW5ndGg7IGotLTspIHtcbiAgICAgICAgICAgIHBvcnRJZCA9IHBvcnRJZHNbal07XG4gICAgICAgICAgICBib3hJZCA9IHBvcnRzW3BvcnRJZF07XG5cbiAgICAgICAgICAgIGFyUG9ydElkID0gdGhpcy5hdXRvcm91dGVyLmdldFBvcnRJZChwb3J0SWQsIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0pO1xuICAgICAgICAgICAgcG9ydHNbcG9ydElkXSA9IHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0ucG9ydHNbYXJQb3J0SWRdO1xuICAgICAgICAgICAgYXNzZXJ0KHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0ucG9ydHNbYXJQb3J0SWRdLCAnQVIgUG9ydCBub3QgZm91bmQhJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIEludm9rZSBhbiBBdXRvUm91dGVyIG1ldGhvZC4gVGhpcyBhbGxvd3MgdGhlIGFjdGlvbiB0byBiZSBsb2dnZWQgYW5kIGJ1Z3MgcmVwbGljYXRlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gY29tbWFuZFxuICogQHBhcmFtIHtBcnJheX0gYXJnc1xuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ludm9rZUF1dG9Sb3V0ZXJNZXRob2QgPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnZva2VBdXRvUm91dGVyTWV0aG9kVW5zYWZlKGNvbW1hbmQsIGFyZ3MpO1xuXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcignQXV0b1JvdXRlci4nICsgY29tbWFuZCArICcgZmFpbGVkIHdpdGggZXJyb3I6ICcgKyBlKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ludm9rZUF1dG9Sb3V0ZXJNZXRob2RVbnNhZmUgPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuICAgIHZhciByZXN1bHQsXG4gICAgICAgIG9sZEFyZ3MgPSBhcmdzLnNsaWNlKCk7XG5cbiAgICBpZiAodGhpcy5fcmVjb3JkQWN0aW9ucykge1xuICAgICAgICB0aGlzLl9yZWNvcmRBY3Rpb24oY29tbWFuZCwgYXJncy5zbGljZSgpKTtcbiAgICB9XG5cbiAgICAvLyBTb21lIGFyZ3VtZW50cyBhcmUgc2ltcGx5IGlkcyBmb3IgZWFzaWVyIHJlY29yZGluZ1xuICAgIHRoaXMuX2ZpeEFyZ3MoY29tbWFuZCwgYXJncyk7XG5cbiAgICByZXN1bHQgPSB0aGlzLmF1dG9yb3V0ZXJbY29tbWFuZF0uYXBwbHkodGhpcy5hdXRvcm91dGVyLCBhcmdzKTtcbiAgICB0aGlzLl91cGRhdGVSZWNvcmRzKGNvbW1hbmQsIG9sZEFyZ3MsIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fdXBkYXRlUmVjb3JkcyA9IGZ1bmN0aW9uIChjb21tYW5kLCBpbnB1dCwgcmVzdWx0KSB7XG4gICAgYXNzZXJ0IChpbnB1dCBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICB2YXIgaWQsXG4gICAgICAgIGFyZ3MgPSBpbnB1dC5zbGljZSgpLFxuICAgICAgICBpO1xuXG4gICAgc3dpdGNoIChjb21tYW5kKSB7XG4gICAgICAgIGNhc2UgJ2FkZFBhdGgnOlxuICAgICAgICAgICAgaWQgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXSA9IHJlc3VsdDtcbiAgICAgICAgICAgIHRoaXMuX2FyUGF0aElkMk9yaWdpbmFsW3Jlc3VsdF0gPSBpZDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2FkZEJveCc6XG4gICAgICAgICAgICBpZCA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdID0gcmVzdWx0O1xuXG4gICAgICAgICAgICAvLyBBZGQgcG9ydHNcbiAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0gPSBbXTtcbiAgICAgICAgICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyhyZXN1bHQucG9ydHMpO1xuICAgICAgICAgICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0ucHVzaChyZXN1bHQucG9ydHNbaWRzW2ldXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdyZW1vdmUnOlxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF0pIHtcbiAgICAgICAgICAgICAgICBpID0gdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXSA/IHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0ubGVuZ3RoIDogMDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwb3J0SWQgPSBpZCArIHRoaXMuX3BvcnRTZXBhcmF0b3IgKyB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdW2ldOyAvL0lEIG9mIGNoaWxkIHBvcnRcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1twb3J0SWRdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF0pIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJJZCA9IHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2FyUGF0aElkMk9yaWdpbmFsW2FySWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0Q29tcG9uZW50JzpcbiAgICAgICAgICAgIHZhciBsZW4sXG4gICAgICAgICAgICAgICAgc3ViQ29tcElkO1xuXG4gICAgICAgICAgICBpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBsZW4gPSBpZC5sZW5ndGggKyB0aGlzLl9wb3J0U2VwYXJhdG9yLmxlbmd0aDtcbiAgICAgICAgICAgIHN1YkNvbXBJZCA9IGFyZ3NbMV0uc3Vic3RyaW5nKGxlbik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdLmluZGV4T2Yoc3ViQ29tcElkKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdLnB1c2goc3ViQ29tcElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3VwZGF0ZVBvcnQnOlxuICAgICAgICAgICAgaWQgPSBhcmdzWzFdLmlkO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiBBZGQgdGhlIGdpdmVuIGFjdGlvbiB0byB0aGUgY3VycmVudCBzZXF1ZW5jZSBvZiBhdXRvcm91dGVyIGNvbW1hbmRzLlxuICpcbiAqIEBwYXJhbSBvYmpJZFxuICogQHBhcmFtIHN1YkNvbXBJZFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX3JlY29yZEFjdGlvbiA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG5cbiAgICB2YXIgYWN0aW9uID0ge2FjdGlvbjogY29tbWFuZCwgYXJnczogYXJnc30sXG4gICAgICAgIGNpcmN1bGFyRml4ZXIgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLm93bmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG5cbiAgICB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2UgKz0gSlNPTi5zdHJpbmdpZnkoYWN0aW9uLCBjaXJjdWxhckZpeGVyKSArICcsJztcbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fZ2V0QWN0aW9uU2VxdWVuY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlLmxhc3RJbmRleE9mKCcsJyksXG4gICAgICAgIHJlc3VsdCA9IHRoaXMuZGVidWdBY3Rpb25TZXF1ZW5jZS5zdWJzdHJpbmcoMCwgaW5kZXgpICsgJ10nO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckFjdGlvbkFwcGxpZXI7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0Jyk7XG5cblxudmFyIEF1dG9Sb3V0ZXJCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5yZWN0ID0gbmV3IEFyUmVjdCgpO1xuICAgIHRoaXMuYXRvbWljID0gZmFsc2U7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5wb3J0cyA9IFtdO1xuICAgIHRoaXMuY2hpbGRCb3hlcyA9IFtdOy8vZGVwZW5kZW50IGJveGVzXG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xuICAgIHRoaXMuaWQgPSBudWxsO1xuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7IC8vUGFydCBvZiBpbml0aWFsaXphdGlvblxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuY2FsY3VsYXRlU2VsZlBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpKSk7XG5cbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5jZWlsKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuZmxvb3IpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKSk7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5kZWxldGVBbGxQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5wb3J0c1tpXS5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgdGhpcy5wb3J0cyA9IFtdO1xuXG4gICAgdGhpcy5hdG9taWMgPSBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmhhc093bmVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLm93bmVyICE9PSBudWxsO1xufTtcblxuLy8gVE9ETzogUmVtb3ZlIHRoaXMgZnVuY3Rpb25cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmNyZWF0ZVBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBvcnQgPSBuZXcgQXV0b1JvdXRlclBvcnQoKTtcbiAgICBhc3NlcnQocG9ydCAhPT0gbnVsbCwgJ0FSQm94LmNyZWF0ZVBvcnQ6IHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcG9ydDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmhhc05vUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wb3J0cy5sZW5ndGggPT09IDA7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc0F0b21pYyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdG9taWM7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hZGRQb3J0ID0gZnVuY3Rpb24gKHBvcnQpIHtcbiAgICBhc3NlcnQocG9ydCAhPT0gbnVsbCwgJ0FSQm94LmFkZFBvcnQ6IHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBwb3J0Lm93bmVyID0gdGhpcztcbiAgICB0aGlzLnBvcnRzLnB1c2gocG9ydCk7XG5cbiAgICBpZiAodGhpcy5vd25lcikgeyAgLy8gTm90IHBvaW50aW5nIHRvIHRoZSBBUkdyYXBoXG4gICAgICAgIHRoaXMub3duZXIuX2FkZEVkZ2VzKHBvcnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmRlbGV0ZVBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIGFzc2VydChwb3J0ICE9PSBudWxsLCAnQVJCb3guZGVsZXRlUG9ydDogcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBpZiAocG9ydCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gdGhpcy5wb3J0cy5pbmRleE9mKHBvcnQpLFxuICAgICAgICBncmFwaCA9IHRoaXMub3duZXI7XG5cbiAgICBhc3NlcnQoaW5kZXggIT09IC0xLCAnQVJCb3guZGVsZXRlUG9ydDogaW5kZXggIT09IC0xIEZBSUxFRCcpO1xuXG4gICAgZ3JhcGguZGVsZXRlRWRnZXMocG9ydCk7XG4gICAgdGhpcy5wb3J0cy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgdGhpcy5hdG9taWMgPSBmYWxzZTtcblxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVjdC5pc1JlY3RFbXB0eSgpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgYXNzZXJ0KHIgaW5zdGFuY2VvZiBBclJlY3QsICdJbnZhbHRoaXMuaWQgYXJnIGluIEFSQm94LnNldFJlY3QuIFJlcXVpcmVzIEFyUmVjdCcpO1xuXG4gICAgYXNzZXJ0KHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyxcbiAgICAgICAgJ0FSQm94LnNldFJlY3Q6IHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyBGQUlMRUQhJyk7XG5cbiAgICBhc3NlcnQoci5nZXRUb3BMZWZ0KCkueCA+PSBDT05TVEFOVFMuRURfTUlOQ09PUkQgJiYgci5nZXRUb3BMZWZ0KCkueSA+PSBDT05TVEFOVFMuRURfTUlOQ09PUkQsXG4gICAgICAgICdBUkJveC5zZXRSZWN0OiByLmdldFRvcExlZnQoKS54ID49IENPTlNUQU5UUy5FRF9NSU5DT09SRCAmJiByLmdldFRvcExlZnQoKS55ID49ICcgK1xuICAgICAgICAnQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCEnKTtcblxuICAgIGFzc2VydChyLmdldEJvdHRvbVJpZ2h0KCkueCA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQgJiYgci5nZXRCb3R0b21SaWdodCgpLnkgPD0gQ09OU1RBTlRTLkVEX01BWENPT1JELFxuICAgICAgICAnQVJCb3guc2V0UmVjdDogIHIuZ2V0Qm90dG9tUmlnaHQoKS54IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCAmJiByLmdldEJvdHRvbVJpZ2h0KCkueSA8PSAnICtcbiAgICAgICAgJ0NPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQhJyk7XG5cbiAgICB0aGlzLnJlY3QuYXNzaWduKHIpO1xuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xuXG4gICAgaWYgKHRoaXMuYXRvbWljKSB7XG4gICAgICAgIGFzc2VydCh0aGlzLnBvcnRzLmxlbmd0aCA9PT0gMSwgJ0FSQm94LnNldFJlY3Q6IHRoaXMucG9ydHMubGVuZ3RoID09PSAxIEZBSUxFRCEnKTtcbiAgICAgICAgdGhpcy5wb3J0c1swXS5zZXRSZWN0KHIpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnNoaWZ0QnkgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgdGhpcy5yZWN0LmFkZChvZmZzZXQpO1xuXG4gICAgdmFyIGkgPSB0aGlzLnBvcnRzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMucG9ydHNbaV0uc2hpZnRCeShvZmZzZXQpO1xuICAgIH1cblxuICAgIC8qXG4gICAgIFRoaXMgaXMgbm90IG5lY2Vzc2FyeTsgdGhlIEFSR3JhcGggd2lsbCBzaGlmdCBhbGwgY2hpbGRyZW5cbiAgICAgaSA9IHRoaXMuY2hpbGRCb3hlcy5sZW5ndGg7XG4gICAgIHdoaWxlKGktLSl7XG4gICAgIHRoaXMuY2hpbGRCb3hlc1tpXS5zaGlmdEJ5KG9mZnNldCk7XG4gICAgIH1cbiAgICAgKi9cbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnJlc2V0UG9ydEF2YWlsYWJpbGl0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5wb3J0c1tpXS5yZXNldEF2YWlsYWJsZUFyZWEoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5ID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGlmICghYm94Lmhhc0FuY2VzdG9yV2l0aElkKHRoaXMuaWQpICYmICAgLy8gQm94ZXMgYXJlIG5vdCBkZXBlbmRlbnQgb24gb25lIGFub3RoZXJcbiAgICAgICAgIXRoaXMuaGFzQW5jZXN0b3JXaXRoSWQoYm94LmlkKSkge1xuXG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgdGhpcy5wb3J0c1tpXS5hZGp1c3RBdmFpbGFibGVBcmVhKGJveC5yZWN0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFkZENoaWxkID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydCh0aGlzLmNoaWxkQm94ZXMuaW5kZXhPZihib3gpID09PSAtMSxcbiAgICAgICAgJ0FSQm94LmFkZENoaWxkOiBib3ggYWxyZWFkeSBpcyBjaGlsZCBvZiAnICsgdGhpcy5pZCk7XG4gICAgYXNzZXJ0KGJveCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gsXG4gICAgICAgICdDaGlsZCBib3ggbXVzdCBiZSBvZiB0eXBlIEF1dG9Sb3V0ZXJCb3gnKTtcblxuICAgIHRoaXMuY2hpbGRCb3hlcy5wdXNoKGJveCk7XG4gICAgYm94LnBhcmVudCA9IHRoaXM7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICB2YXIgaSA9IHRoaXMuY2hpbGRCb3hlcy5pbmRleE9mKGJveCk7XG4gICAgYXNzZXJ0KGkgIT09IC0xLCAnQVJCb3gucmVtb3ZlQ2hpbGQ6IGJveCBpc25cXCd0IGNoaWxkIG9mICcgKyB0aGlzLmlkKTtcbiAgICB0aGlzLmNoaWxkQm94ZXMuc3BsaWNlKGksIDEpO1xuICAgIGJveC5wYXJlbnQgPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaGFzQW5jZXN0b3JXaXRoSWQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgYm94ID0gdGhpcztcbiAgICB3aGlsZSAoYm94KSB7XG4gICAgICAgIGlmIChib3guaWQgPT09IGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBib3ggPSBib3gucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5nZXRSb290Qm94ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBib3ggPSB0aGlzO1xuICAgIHdoaWxlIChib3gucGFyZW50KSB7XG4gICAgICAgIGJveCA9IGJveC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBib3g7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc0JveEF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuICAgIHJldHVybiBVdGlscy5pc1BvaW50SW4ocG9pbnQsIHRoaXMucmVjdCwgbmVhcm5lc3MpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNCb3hDbGlwID0gZnVuY3Rpb24gKHIpIHtcbiAgICByZXR1cm4gVXRpbHMuaXNSZWN0Q2xpcCh0aGlzLnJlY3QsIHIpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNCb3hJbiA9IGZ1bmN0aW9uIChyKSB7XG4gICAgcmV0dXJuIFV0aWxzLmlzUmVjdEluKHRoaXMucmVjdCwgcik7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gdGhpcy5jaGlsZEJveGVzLmxlbmd0aDtcblxuICAgIC8vbm90aWZ5IHRoaXMucGFyZW50IG9mIGRlc3RydWN0aW9uXG4gICAgLy9pZiB0aGVyZSBpcyBhIHRoaXMucGFyZW50LCBvZiBjb3Vyc2VcbiAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5kZWxldGVBbGxQb3J0cygpO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmNoaWxkQm94ZXNbaV0uZGVzdHJveSgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIHAgPSB0aGlzLnBvcnRzLmxlbmd0aDsgcC0tOykge1xuICAgICAgICB0aGlzLnBvcnRzW3BdLmFzc2VydFZhbGlkKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyQm94O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xudmFyIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgRU1QVFlfUE9JTlQ6IG5ldyBBclBvaW50KC0xMDAwMDAsIC0xMDAwMDApLFxuICAgIEVEX01BWENPT1JEOiAxMDAwMDAsXG4gICAgRURfTUlOQ09PUkQ6IC0yLC8vVGhpcyBhbGxvd3MgY29ubmVjdGlvbnMgdG8gYmUgc3RpbGwgYmUgZHJhdyB3aGVuIGJveCBpcyBwcmVzc2VkIGFnYWluc3QgdGhlIGVkZ2VcbiAgICBFRF9TTUFMTEdBUDogMTUsXG4gICAgQ09OTkVDVElPTkNVU1RPTUlaQVRJT05EQVRBVkVSU0lPTjogMCxcbiAgICBFTVBUWUNPTk5FQ1RJT05DVVNUT01JWkFUSU9OREFUQU1BR0lDOiAtMSxcbiAgICBERUJVRzogZmFsc2UsXG4gICAgQlVGRkVSOiAxMCxcblxuICAgIEVETFNfUzogMTUsLy9FRF9TTUFMTEdBUFxuICAgIEVETFNfUjogMTUgKyAxLCAvL0VEX1NNQUxMR0FQKzFcbiAgICBFRExTX0Q6IDEwMDAwMCArIDIsLy9FRF9NQVhDT09SRCAtIEVEX01JTkNPT1JELFxuXG4gICAgUGF0aEVuZE9uRGVmYXVsdDogMHgwMDAwLFxuICAgIFBhdGhFbmRPblRvcDogMHgwMDEwLFxuICAgIFBhdGhFbmRPblJpZ2h0OiAweDAwMjAsXG4gICAgUGF0aEVuZE9uQm90dG9tOiAweDAwNDAsXG4gICAgUGF0aEVuZE9uTGVmdDogMHgwMDgwLFxuICAgIFBhdGhFbmRNYXNrOiAoMHgwMDEwIHwgMHgwMDIwIHwgMHgwMDQwIHwgMHgwMDgwKSxcbiAgICAvLyAoUGF0aEVuZE9uVG9wIHwgUGF0aEVuZE9uUmlnaHQgfCBQYXRoRW5kT25Cb3R0b20gfCBQYXRoRW5kT25MZWZ0KSxcblxuICAgIFBhdGhTdGFydE9uRGVmYXVsdDogMHgwMDAwLFxuICAgIFBhdGhTdGFydE9uVG9wOiAweDAxMDAsXG4gICAgUGF0aFN0YXJ0T25SaWdodDogMHgwMjAwLFxuICAgIFBhdGhTdGFydE9uQm90dG9tOiAweDA0MDAsXG4gICAgUGF0aFN0YXJ0T25MZWZ0OiAweDA4MDAsXG4gICAgUGF0aFN0YXJ0TWFzazogKDB4MDEwMCB8IDB4MDIwMCB8IDB4MDQwMCB8IDB4MDgwMCksXG4gICAgLy8gKFBhdGhTdGFydE9uVG9wIHwgUGF0aFN0YXJ0T25SaWdodCB8IFBhdGhTdGFydE9uQm90dG9tIHwgUGF0aFN0YXJ0T25MZWZ0KSxcblxuICAgIFBhdGhIaWdoTGlnaHRlZDogMHgwMDAyLFx0XHQvLyBhdHRyaWJ1dGVzLFxuICAgIFBhdGhGaXhlZDogMHgwMDAxLFxuICAgIFBhdGhEZWZhdWx0OiAweDAwMDAsXG5cbiAgICBQYXRoU3RhdGVDb25uZWN0ZWQ6IDB4MDAwMSxcdFx0Ly8gc3RhdGVzLFxuICAgIFBhdGhTdGF0ZURlZmF1bHQ6IDB4MDAwMCxcblxuICAgIC8vIFBvcnQgQ29ubmVjdGlvbiBWYXJpYWJsZXNcbiAgICBQb3J0RW5kT25Ub3A6IDB4MDAwMSxcbiAgICBQb3J0RW5kT25SaWdodDogMHgwMDAyLFxuICAgIFBvcnRFbmRPbkJvdHRvbTogMHgwMDA0LFxuICAgIFBvcnRFbmRPbkxlZnQ6IDB4MDAwOCxcbiAgICBQb3J0RW5kT25BbGw6IDB4MDAwRixcblxuICAgIFBvcnRTdGFydE9uVG9wOiAweDAwMTAsXG4gICAgUG9ydFN0YXJ0T25SaWdodDogMHgwMDIwLFxuICAgIFBvcnRTdGFydE9uQm90dG9tOiAweDAwNDAsXG4gICAgUG9ydFN0YXJ0T25MZWZ0OiAweDAwODAsXG4gICAgUG9ydFN0YXJ0T25BbGw6IDB4MDBGMCxcblxuICAgIFBvcnRDb25uZWN0T25BbGw6IDB4MDBGRixcbiAgICBQb3J0Q29ubmVjdFRvQ2VudGVyOiAweDAxMDAsXG5cbiAgICBQb3J0U3RhcnRFbmRIb3Jpem9udGFsOiAweDAwQUEsXG4gICAgUG9ydFN0YXJ0RW5kVmVydGljYWw6IDB4MDA1NSxcblxuICAgIFBvcnREZWZhdWx0OiAweDAwRkYsXG5cbiAgICAvLyBSb3V0aW5nRGlyZWN0aW9uIHZhcnMgXG4gICAgRGlyTm9uZTogLTEsXG4gICAgRGlyVG9wOiAwLFxuICAgIERpclJpZ2h0OiAxLFxuICAgIERpckJvdHRvbTogMixcbiAgICBEaXJMZWZ0OiAzLFxuICAgIERpclNrZXc6IDQsXG5cbiAgICAvL1BhdGggQ3VzdG9tIERhdGFcbiAgICBTaW1wbGVFZGdlRGlzcGxhY2VtZW50OiAnRWRnZURpc3BsYWNlbWVudCcsXG4gICAgQ3VzdG9tUG9pbnRDdXN0b21pemF0aW9uOiAnUG9pbnRDdXN0b21pemF0aW9uJ1xuICAgIC8vQ09OTkVDVElPTkNVU1RPTUlaQVRJT05EQVRBVkVSU0lPTiA6IG51bGxcbn07XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKTtcblxudmFyIEF1dG9Sb3V0ZXJFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIC8qXG4gICAgIEluIHRoaXMgc2VjdGlvbiBldmVyeSBjb21tZW50IHJlZmVyIHRvIHRoZSBob3Jpem9udGFsIGNhc2UsIHRoYXQgaXMsIGVhY2hcdGVkZ2UgaXNcbiAgICAgaG9yaXpvbnRhbC5cbiAgICAgKi9cblxuICAgIC8qXG4gICAgICogVE9ETyBVcGRhdGUgdGhpcyBjb21tZW50XG4gICAgICpcbiAgICAgRXZlcnkgQ0F1dG9Sb3V0ZXJFZGdlIGJlbG9uZ3MgdG8gYW4gZWRnZSBvZiBhIENBdXRvUm91dGVyUGF0aCwgQ0F1dG9Sb3V0ZXJCb3ggb3IgQ0F1dG9Sb3V0ZXJQb3J0LiBUaGlzIGVkZ2UgaXNcbiAgICAgUmVwcmVzZW50ZWQgYnkgYSBDQXV0b1JvdXRlclBvaW50IHdpdGggaXRzIG5leHQgcG9pbnQuIFRoZSB2YXJpYWJsZSAncG9pbnQnIHdpbGwgcmVmZXJcbiAgICAgdG8gdGhpcyBDQXV0b1JvdXRlclBvaW50LlxuXG4gICAgIFRoZSBjb29yZGluYXRlcyBvZiBhbiBlZGdlIGFyZSAneDEnLCAneDInIGFuZCAneScgd2hlcmUgeDEveDIgaXMgdGhlIHgtY29vcmRpbmF0ZVxuICAgICBvZiB0aGUgbGVmdC9yaWdodCBwb2ludCwgYW5kIHkgaXMgdGhlIGNvbW1vbiB5LWNvb3JkaW5hdGUgb2YgdGhlIHBvaW50cy5cblxuICAgICBUaGUgZWRnZXMgYXJlIG9yZGVyZWQgYWNjb3JkaW5nIHRvIHRoZWlyIHktY29vcmRpbmF0ZXMuIFRoZSBmaXJzdCBlZGdlIGhhc1xuICAgICB0aGUgbGVhc3QgeS1jb29yZGluYXRlICh0b3Btb3N0KSwgYW5kIGl0cyBwb2ludGVyIGlzIGluICdvcmRlckZpcnN0Jy5cbiAgICAgV2UgdXNlIHRoZSAnb3JkZXInIHByZWZpeCBpbiB0aGUgdmFyaWFibGUgbmFtZXMgdG8gcmVmZXIgdG8gdGhpcyBvcmRlci5cblxuICAgICBXZSB3aWxsIHdhbGsgZnJvbSB0b3AgdG8gYm90dG9tIChmcm9tIHRoZSAnb3JkZXJGaXJzdCcgYWxvbmcgdGhlICd0aGlzLm9yZGVyTmV4dCcpLlxuICAgICBXZSBrZWVwIHRyYWNrIGEgJ3NlY3Rpb24nIG9mIHNvbWUgZWRnZXMuIElmIHdlIGhhdmUgYW4gaW5maW5pdGUgaG9yaXpvbnRhbCBsaW5lLFxuICAgICB0aGVuIHRoZSBzZWN0aW9uIGNvbnNpc3RzIG9mIHRob3NlIGVkZ2VzIHRoYXQgYXJlIGFib3ZlIHRoZSBsaW5lIGFuZCBub3QgYmxvY2tlZFxuICAgICBieSBhbm90aGVyIGVkZ2Ugd2hpY2ggaXMgY2xvc2VyIHRvIHRoZSBsaW5lLiBFYWNoIGVkZ2UgaW4gdGhlIHNlY3Rpb24gaGFzXG4gICAgIGEgdmlld2FibGUgcG9ydGlvbiBmcm9tIHRoZSBsaW5lICh0aGUgbm90IGJsb2NrZWQgcG9ydGlvbikuIFRoZSBjb29yZGluYXRlc1xuICAgICBvZiB0aGlzIHBvcnRpb24gYXJlICd0aGlzLnNlY3Rpb25YMScgYW5kICd0aGlzLnNlY3Rpb25YMicuIFdlIGhhdmUgYW4gb3JkZXIgb2YgdGhlIGVkZ2VzXG4gICAgIGJlbG9uZ2luZyB0byB0aGUgY3VycmVudCBzZWN0aW9uLiBUaGUgJ3NlY3Rpb25fZmlyc3QnIHJlZmVycyB0byB0aGUgbGVmdG1vc3RcbiAgICAgZWRnZSBpbiB0aGUgc2VjdGlvbiwgd2hpbGUgdGhlICd0aGlzLnNlY3Rpb25OZXh0JyB0byB0aGUgbmV4dCBmcm9tIGxlZnQgdG8gcmlnaHQuXG5cbiAgICAgV2Ugc2F5IHRoYXQgdGhlIENBdXRvUm91dGVyRWRnZSBFMSAncHJlY2VkZScgdGhlIENBdXRvUm91dGVyRWRnZSBFMiBpZiB0aGVyZSBpcyBubyBvdGhlciBDQXV0b1JvdXRlckVkZ2Ugd2hpY2hcbiAgICAgdG90YWxseVx0YmxvY2tzIFMxIGZyb20gUzIuIFNvIGEgc2VjdGlvbiBjb25zaXN0cyBvZiB0aGUgcHJlY2VkaW5nIGVkZ2VzIG9mIGFuXG4gICAgIGluZmluaXRlIGVkZ2UuIFdlIHNheSB0aGF0IEUxIGlzICdhZGphY2VudCcgdG8gRTIsIGlmIEUxIGlzIHRoZSBuZWFyZXN0IGVkZ2VcbiAgICAgdG8gRTIgd2hpY2ggcHJlY2VkZSBpdC4gQ2xlYXJseSwgZXZlcnkgZWRnZSBoYXMgYXQgbW9zdCBvbmUgYWRqYWNlbnQgcHJlY2VkZW5jZS5cblxuICAgICBUaGUgZWRnZXMgb2YgYW55IENBdXRvUm91dGVyQm94IG9yIENBdXRvUm91dGVyUG9ydCBhcmUgZml4ZWQuIFdlIHdpbGwgY29udGludWFsbHkgZml4IHRoZSBlZGdlc1xuICAgICBvZiB0aGUgQ0F1dG9Sb3V0ZXJQYXRocy4gQnV0IGZpcnN0IHdlIG5lZWQgc29tZSBkZWZpbml0aW9uLlxuXG4gICAgIFdlIGNhbGwgYSBzZXQgb2YgZWRnZXMgYXMgYSAnYmxvY2snIGlmIHRoZSB0b3Btb3N0IChmaXJzdCkgYW5kIGJvdHRvbW1vc3QgKGxhc3QpXG4gICAgIGVkZ2VzIG9mIGl0IGFyZSBmaXhlZCB3aGlsZSB0aGUgZWRnZXMgYmV0d2VlbiB0aGVtIGFyZSBub3QuIEZ1cnRoZXJtb3JlLCBldmVyeVxuICAgICBlZGdlIGlzIGFkamFjZW50IHRvXHR0aGUgbmV4dCBvbmUgaW4gdGhlIG9yZGVyLiBFdmVyeSBlZGdlIGluIHRoZSBibG9jayBoYXMgYW5cbiAgICAgJ2luZGV4Jy4gVGhlIGluZGV4IG9mIHRoZSBmaXJzdCBvbmUgKHRvcG1vc3QpIGlzIDAsIG9mIHRoZSBzZWNvbmQgaXMgMSwgYW5kIHNvIG9uLlxuICAgICBXZSBjYWxsIHRoZSBpbmRleCBvZiB0aGUgbGFzdCBlZGdlICgjIG9mIGVkZ2VzIC0gMSkgYXMgdGhlIGluZGV4IG9mIHRoZSBlbnRpcmUgYm94LlxuICAgICBUaGUgJ2RlcHRoJyBvZiBhIGJsb2NrIGlzIHRoZSBkaWZmZXJlbmNlIG9mIHRoZSB5LWNvb3JkaW5hdGVzIG9mIHRoZSBmaXJzdCBhbmQgbGFzdFxuICAgICBlZGdlcyBvZiBpdC4gVGhlICdnb2FsIGdhcCcgb2YgdGhlIGJsb2NrIGlzIHRoZSBxdW90aWVudCBvZiB0aGUgZGVwdGggYW5kIGluZGV4XG4gICAgIG9mIHRoZSBibG9jay4gSWYgdGhlIGRpZmZlcmVuY2Ugb2YgdGhlIHktY29vcmRpbmF0ZXMgb2YgdGhlIGFkamFjZW50IGVkZ2VzIGluXG4gICAgIHRoZSBibG9jayBhcmUgYWxsIGVxdWFsIHRvIHRoZSBnb2FsIGdhcCwgdGhlbiB3ZSBzYXkgdGhhdCB0aGUgYmxvY2sgaXMgZXZlbmx5XG4gICAgIGRpc3RyaWJ1dGVkLlxuXG4gICAgIFNvIHdlIHNlYXJjaCB0aGUgYmxvY2sgd2hpY2ggaGFzIG1pbmltYWwgZ29hbCBnYXAuIFRoZW4gaWYgaXQgaXMgbm90IGV2ZW5seVxuICAgICBkaXN0cmlidXRlZCwgdGhlbiB3ZSBzaGlmdCB0aGUgbm90IGZpeGVkIGVkZ2VzIHRvIHRoZSBkZXNpcmVkIHBvc2l0aW9uLiBJdCBpc1xuICAgICBub3QgaGFyZCB0byBzZWVcdHRoYXQgaWYgdGhlIGJsb2NrIGhhcyBtaW5pbWFsIGdvYWwgZ2FwIChhbW9uZyB0aGUgYWxsXG4gICAgIHBvc3NpYmlsaXRpZXMgb2YgYmxvY2tzKSwgdGhlbiBpbiB0aGlzIHdheSB3ZSBkbyBub3QgbW92ZSBhbnkgZWRnZXMgaW50byBib3hlcy5cbiAgICAgRmluYWxseSwgd2Ugc2V0IHRoZSAoaW5uZXIpIGVkZ2VzIG9mIHRoZSBibG9jayB0byBiZSBmaXhlZCAoZXhjZXB0IHRoZSB0b3Btb3N0IGFuZFxuICAgICBib3R0b21tb3N0IGVkZ2VzLCBzaW5jZSB0aGV5IGFyZSBhbHJlYWR5IGZpeGVkKS4gQW5kIHdlIGFnYWluIGJlZ2luIHRoZSBzZWFyY2guXG4gICAgIElmIGV2ZXJ5IGVkZ2UgaXMgZml4ZWQsIHRoZW4gd2UgaGF2ZSBmaW5pc2hlZC4gVGhpcyBpcyB0aGUgYmFzaWMgaWRlYS4gV2Ugd2lsbFxuICAgICByZWZpbmUgdGhpcyBhbGdvcml0aG0uXG5cbiAgICAgVGhlIHZhcmlhYmxlcyByZWxhdGVkIHRvIHRoZSBibG9ja3MgYXJlIHByZWZpeGVkIGJ5ICdibG9jaycuIE5vdGUgdGhhdCB0aGVcbiAgICAgdmFyaWFibGVzIG9mIGFuIGVkZ2UgYXJlIHJlZmVyIHRvIHRoYXQgYmxvY2sgaW4gd2hpY2ggdGhpcyBlZGdlIGlzIGlubmVyISBUaGVcbiAgICAgJ2Jsb2NrX29sZGdhcCcgaXMgdGhlIGdvYWwgZ2FwIG9mIHRoZSBibG9jayB3aGVuIGl0IHdhcyBsYXN0IGV2ZW5seSBkaXN0cmlidXRlZC5cblxuICAgICBUaGUgdmFyaWFibGVzICdjYW5zdGFydCcgYW5kICdjYW5lbmQnIG1lYW5zIHRoYXQgdGhpcyBlZ2RlIGNhbiBzdGFydCBhbmQvb3IgZW5kXG4gICAgIGEgYmxvY2suIFRoZSB0b3AgZWRnZSBvZiBhIGJveCBvbmx5IGNhbmVuZCwgd2hpbGUgYSBmaXhlZCBlZGdlIG9mIGEgcGF0aCBjYW4gYm90aFxuICAgICBzdGFydCBhbmQgZW5kIG9mIGEgYmxvY2suXG5cbiAgICAgKi9cblxuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb2ludFByZXYgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb2ludE5leHQgPSBudWxsO1xuXG4gICAgdGhpcy5wb3NpdGlvblkgPSAwO1xuICAgIHRoaXMucG9zaXRpb25YMSA9IDA7XG4gICAgdGhpcy5wb3NpdGlvblgyID0gMDtcbiAgICB0aGlzLmJyYWNrZXRDbG9zaW5nID0gZmFsc2U7XG4gICAgdGhpcy5icmFja2V0T3BlbmluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy5vcmRlclByZXYgPSBudWxsO1xuICAgIHRoaXMub3JkZXJOZXh0ID0gbnVsbDtcblxuICAgIHRoaXMuc2VjdGlvblgxID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25YMiA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uTmV4dCA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uRG93biA9IG51bGw7XG5cbiAgICB0aGlzLmVkZ2VGaXhlZCA9IGZhbHNlO1xuICAgIHRoaXMuZWRnZUN1c3RvbUZpeGVkID0gZmFsc2U7XG4gICAgdGhpcy5lZGdlQ2FuUGFzc2VkID0gZmFsc2U7XG4gICAgdGhpcy5lZGdlRGlyZWN0aW9uID0gbnVsbDtcblxuICAgIHRoaXMuYmxvY2tQcmV2ID0gbnVsbDtcbiAgICB0aGlzLmJsb2NrTmV4dCA9IG51bGw7XG4gICAgdGhpcy5ibG9ja1RyYWNlID0gbnVsbDtcblxuICAgIHRoaXMuY2xvc2VzdFByZXYgPSBudWxsO1xuICAgIHRoaXMuY2xvc2VzdE5leHQgPSBudWxsO1xuXG59O1xuXG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAob3RoZXJFZGdlKSB7XG5cbiAgICBpZiAob3RoZXJFZGdlICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMub3duZXIgPSBvdGhlckVkZ2Uub3duZXI7XG4gICAgICAgIHRoaXMuc2V0U3RhcnRQb2ludChvdGhlckVkZ2Uuc3RhcnRwb2ludCwgZmFsc2UpO1xuXG4gICAgICAgIC8vT25seSBjYWxjdWxhdGVEaXJlY3Rpb24gaWYgdGhpcy5lbmRwb2ludCBpcyBub3QgbnVsbFxuICAgICAgICB0aGlzLnNldEVuZFBvaW50KG90aGVyRWRnZS5lbmRwb2ludCwgb3RoZXJFZGdlLmVuZHBvaW50ICE9PSBudWxsKTtcblxuICAgICAgICB0aGlzLnN0YXJ0cG9pbnRQcmV2ID0gb3RoZXJFZGdlLnN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICB0aGlzLmVuZHBvaW50TmV4dCA9IG90aGVyRWRnZS5lbmRwb2ludE5leHQ7XG5cbiAgICAgICAgdGhpcy5wb3NpdGlvblkgPSBvdGhlckVkZ2UucG9zaXRpb25ZO1xuICAgICAgICB0aGlzLnBvc2l0aW9uWDEgPSBvdGhlckVkZ2UucG9zaXRpb25YMTtcbiAgICAgICAgdGhpcy5wb3NpdGlvblgyID0gb3RoZXJFZGdlLnBvc2l0aW9uWDI7XG4gICAgICAgIHRoaXMuYnJhY2tldENsb3NpbmcgPSBvdGhlckVkZ2UuYnJhY2tldENsb3Npbmc7XG4gICAgICAgIHRoaXMuYnJhY2tldE9wZW5pbmcgPSBvdGhlckVkZ2UuYnJhY2tldE9wZW5pbmc7XG5cbiAgICAgICAgdGhpcy5vcmRlck5leHQgPSBvdGhlckVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB0aGlzLm9yZGVyUHJldiA9IG90aGVyRWRnZS5vcmRlclByZXY7XG5cbiAgICAgICAgdGhpcy5zZWN0aW9uWDEgPSBvdGhlckVkZ2Uuc2VjdGlvblgxO1xuICAgICAgICB0aGlzLnNlY3Rpb25YMiA9IG90aGVyRWRnZS5zZWN0aW9uWDI7XG4gICAgICAgIHRoaXMuc2V0U2VjdGlvbk5leHQob3RoZXJFZGdlLmdldFNlY3Rpb25OZXh0KHRydWUpKTtcbiAgICAgICAgdGhpcy5zZXRTZWN0aW9uRG93bihvdGhlckVkZ2UuZ2V0U2VjdGlvbkRvd24odHJ1ZSkpO1xuXG4gICAgICAgIHRoaXMuZWRnZUZpeGVkID0gb3RoZXJFZGdlLmVkZ2VGaXhlZDtcbiAgICAgICAgdGhpcy5lZGdlQ3VzdG9tRml4ZWQgPSBvdGhlckVkZ2UuZWRnZUN1c3RvbUZpeGVkO1xuICAgICAgICB0aGlzLnNldEVkZ2VDYW5wYXNzZWQob3RoZXJFZGdlLmdldEVkZ2VDYW5wYXNzZWQoKSk7XG4gICAgICAgIHRoaXMuc2V0RGlyZWN0aW9uKG90aGVyRWRnZS5nZXREaXJlY3Rpb24oKSk7XG5cbiAgICAgICAgdGhpcy5zZXRCbG9ja1ByZXYob3RoZXJFZGdlLmdldEJsb2NrUHJldigpKTtcbiAgICAgICAgdGhpcy5zZXRCbG9ja05leHQob3RoZXJFZGdlLmdldEJsb2NrTmV4dCgpKTtcbiAgICAgICAgdGhpcy5zZXRCbG9ja1RyYWNlKG90aGVyRWRnZS5nZXRCbG9ja1RyYWNlKCkpO1xuXG4gICAgICAgIHRoaXMuc2V0Q2xvc2VzdFByZXYob3RoZXJFZGdlLmdldENsb3Nlc3RQcmV2KCkpO1xuICAgICAgICB0aGlzLnNldENsb3Nlc3ROZXh0KG90aGVyRWRnZS5nZXRDbG9zZXN0TmV4dCgpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAob3RoZXJFZGdlKSB7XG4gICAgcmV0dXJuIHRoaXMgPT09IG90aGVyRWRnZTsgLy8gVGhpcyBjaGVja3MgaWYgdGhleSByZWZlcmVuY2UgdGhlIHNhbWUgb2JqZWN0XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U3RhcnRQb2ludFByZXYgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludFByZXYgIT09IG51bGwgPyB0aGlzLnN0YXJ0cG9pbnRQcmV2IHx8IHRoaXMuc3RhcnRwb2ludFByZXYgOiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzU3RhcnRQb2ludFByZXZOdWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAhdGhpcy5zdGFydHBvaW50UHJldjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnQgIT09IG51bGwgP1xuICAgICAgICAodGhpcy5zdGFydHBvaW50IGluc3RhbmNlb2YgQXJyYXkgPyBuZXcgQXJQb2ludCh0aGlzLnN0YXJ0cG9pbnQpIDogbmV3IEFyUG9pbnQodGhpcy5zdGFydHBvaW50KSkgOlxuICAgICAgICBDT05TVEFOVFMuRU1QVFlfUE9JTlQ7ICAvLyByZXR1cm5pbmcgY29weSBvZiB0aGlzLnN0YXJ0cG9pbnRcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc1NhbWVTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludCA9PT0gcG9pbnQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNTdGFydFBvaW50TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvaW50ID09PSBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAocG9pbnQsIGIpIHtcbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSBwb2ludDtcblxuICAgIGlmIChiICE9PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlRGlyZWN0aW9uKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0UG9pbnRYID0gZnVuY3Rpb24gKF94KSB7XG4gICAgdGhpcy5zdGFydHBvaW50LnggPSBfeDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydFBvaW50WSA9IGZ1bmN0aW9uIChfeSkge1xuICAgIHRoaXMuc3RhcnRwb2ludC55ID0gX3k7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0RW5kUG9pbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5kcG9pbnQgIT09IG51bGwgP1xuICAgICAgICAodGhpcy5lbmRwb2ludCBpbnN0YW5jZW9mIEFycmF5ID9cbiAgICAgICAgICAgIG5ldyBBclBvaW50KHRoaXMuZW5kcG9pbnQpIDpcbiAgICAgICAgICAgIG5ldyBBclBvaW50KHRoaXMuZW5kcG9pbnQpKSA6XG4gICAgICAgIENPTlNUQU5UUy5FTVBUWV9QT0lOVDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc0VuZFBvaW50TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmRwb2ludCA9PT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFbmRQb2ludCA9IGZ1bmN0aW9uIChwb2ludCwgYikge1xuICAgIHRoaXMuZW5kcG9pbnQgPSBwb2ludDtcblxuICAgIGlmIChiICE9PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlRGlyZWN0aW9uKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0QW5kRW5kUG9pbnQgPSBmdW5jdGlvbiAoc3RhcnRQb2ludCwgZW5kUG9pbnQpIHtcbiAgICB0aGlzLnNldFN0YXJ0UG9pbnQoc3RhcnRQb2ludCwgZmFsc2UpOyAvL3dhaXQgdW50aWwgc2V0dGluZyB0aGUgdGhpcy5lbmRwb2ludCB0byByZWNhbGN1bGF0ZURpcmVjdGlvblxuICAgIHRoaXMuc2V0RW5kUG9pbnQoZW5kUG9pbnQpO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEVuZFBvaW50WCA9IGZ1bmN0aW9uIChfeCkge1xuICAgIHRoaXMuZW5kcG9pbnQueCA9IF94O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEVuZFBvaW50WSA9IGZ1bmN0aW9uIChfeSkge1xuICAgIHRoaXMuZW5kcG9pbnQueSA9IF95O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzRW5kUG9pbnROZXh0TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gIXRoaXMuZW5kcG9pbnROZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25OZXh0ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbk5leHQgIT09IHVuZGVmaW5lZCA/IHRoaXMuc2VjdGlvbk5leHRbMF0gOiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25OZXh0UHRyID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5zZWN0aW9uTmV4dCB8fCAhdGhpcy5zZWN0aW9uTmV4dFswXSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25OZXh0ID0gW25ldyBBdXRvUm91dGVyRWRnZSgpXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbk5leHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U2VjdGlvbk5leHQgPSBmdW5jdGlvbiAobmV4dFNlY3Rpb24pIHtcbiAgICBuZXh0U2VjdGlvbiA9IG5leHRTZWN0aW9uIGluc3RhbmNlb2YgQXJyYXkgPyBuZXh0U2VjdGlvblswXSA6IG5leHRTZWN0aW9uO1xuICAgIGlmICh0aGlzLnNlY3Rpb25OZXh0IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uTmV4dFswXSA9IG5leHRTZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbk5leHQgPSBbbmV4dFNlY3Rpb25dO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uRG93biA9IGZ1bmN0aW9uICgpIHsgLy9SZXR1cm5zIHBvaW50ZXIgLSBpZiBub3QgbnVsbFxuXG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbkRvd24gIT09IHVuZGVmaW5lZCA/IHRoaXMuc2VjdGlvbkRvd25bMF0gOiBudWxsO1xuXG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U2VjdGlvbkRvd25QdHIgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLnNlY3Rpb25Eb3duIHx8ICF0aGlzLnNlY3Rpb25Eb3duWzBdKSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbkRvd24gPSBbbmV3IEF1dG9Sb3V0ZXJFZGdlKCldO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZWN0aW9uRG93bjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTZWN0aW9uRG93biA9IGZ1bmN0aW9uIChkb3duU2VjdGlvbikge1xuICAgIGRvd25TZWN0aW9uID0gZG93blNlY3Rpb24gaW5zdGFuY2VvZiBBcnJheSA/IGRvd25TZWN0aW9uWzBdIDogZG93blNlY3Rpb247XG4gICAgaWYgKHRoaXMuc2VjdGlvbkRvd24gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25Eb3duWzBdID0gZG93blNlY3Rpb247XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uRG93biA9IFtkb3duU2VjdGlvbl07XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEVkZ2VDYW5wYXNzZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZUNhblBhc3NlZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFZGdlQ2FucGFzc2VkID0gZnVuY3Rpb24gKGVjcCkge1xuICAgIHRoaXMuZWRnZUNhblBhc3NlZCA9IGVjcDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXREaXJlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZURpcmVjdGlvbjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXREaXJlY3Rpb24gPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhpcy5lZGdlRGlyZWN0aW9uID0gZGlyO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnJlY2FsY3VsYXRlRGlyZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9pbnQgIT09IG51bGwgJiYgdGhpcy5lbmRwb2ludCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZS5yZWNhbGN1bGF0ZURpcmVjdGlvbjogdGhpcy5zdGFydHBvaW50ICE9PSBudWxsICYmIHRoaXMuZW5kcG9pbnQgIT09IG51bGwgRkFJTEVEIScpO1xuICAgIHRoaXMuZWRnZURpcmVjdGlvbiA9IFV0aWxzLmdldERpcih0aGlzLmVuZHBvaW50Lm1pbnVzKHRoaXMuc3RhcnRwb2ludCkpO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEJsb2NrUHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5ibG9ja1ByZXY7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0QmxvY2tQcmV2ID0gZnVuY3Rpb24gKHByZXZCbG9jaykge1xuICAgIHRoaXMuYmxvY2tQcmV2ID0gcHJldkJsb2NrO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEJsb2NrTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5ibG9ja05leHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0QmxvY2tOZXh0ID0gZnVuY3Rpb24gKG5leHRCbG9jaykge1xuICAgIHRoaXMuYmxvY2tOZXh0ID0gbmV4dEJsb2NrO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEJsb2NrVHJhY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxvY2tUcmFjZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRCbG9ja1RyYWNlID0gZnVuY3Rpb24gKHRyYWNlQmxvY2spIHtcbiAgICB0aGlzLmJsb2NrVHJhY2UgPSB0cmFjZUJsb2NrO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldENsb3Nlc3RQcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNsb3Nlc3RQcmV2O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldENsb3Nlc3RQcmV2ID0gZnVuY3Rpb24gKGNwKSB7XG4gICAgdGhpcy5jbG9zZXN0UHJldiA9IGNwO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldENsb3Nlc3ROZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNsb3Nlc3ROZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldENsb3Nlc3ROZXh0ID0gZnVuY3Rpb24gKGNwKSB7XG4gICAgdGhpcy5jbG9zZXN0TmV4dCA9IGNwO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyRWRnZTtcbiIsIi8qZ2xvYmFscyBkZWZpbmUsIFdlYkdNRUdsb2JhbCovXG4vKmpzaGludCBicm93c2VyOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Mb2dnZXInKSxcbiAgICBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXV0b1JvdXRlclBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUGF0aCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKSxcbiAgICBBdXRvUm91dGVyQm94ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkJveCcpLFxuICAgIEF1dG9Sb3V0ZXJFZGdlID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkVkZ2UnKTtcblxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tQXV0b1JvdXRlckVkZ2VMaXN0XG5cbnZhciBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5FZGdlTGlzdCcpO1xudmFyIEF1dG9Sb3V0ZXJFZGdlTGlzdCA9IGZ1bmN0aW9uIChiKSB7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG5cbiAgICAvLy0tRWRnZXNcbiAgICB0aGlzLmlzaG9yaXpvbnRhbCA9IGI7XG5cbiAgICAvLy0tT3JkZXJcbiAgICB0aGlzLm9yZGVyRmlyc3QgPSBudWxsO1xuICAgIHRoaXMub3JkZXJMYXN0ID0gbnVsbDtcblxuICAgIC8vLS1TZWN0aW9uXG4gICAgdGhpcy5zZWN0aW9uRmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gW107IC8vIFRoaXMgaXMgYW4gYXJyYXkgdG8gZW11bGF0ZSB0aGUgcG9pbnRlciB0byBhIHBvaW50ZXIgZnVuY3Rpb25hbGl0eSBpbiBDUFAuIFxuICAgIC8vIFRoYXQgaXMsIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQqXG5cbiAgICB0aGlzLl9pbml0T3JkZXIoKTtcbiAgICB0aGlzLl9pbml0U2VjdGlvbigpO1xufTtcblxuLy8gUHVibGljIEZ1bmN0aW9uc1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5jb250YWlucyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gICAgdmFyIGN1cnJlbnRFZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBzdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludDtcblxuICAgIHdoaWxlIChjdXJyZW50RWRnZSkge1xuICAgICAgICBzdGFydHBvaW50ID0gY3VycmVudEVkZ2Uuc3RhcnRwb2ludDtcbiAgICAgICAgZW5kcG9pbnQgPSBjdXJyZW50RWRnZS5lbmRwb2ludDtcbiAgICAgICAgaWYgKHN0YXJ0LmVxdWFscyhzdGFydHBvaW50KSAmJiBlbmQuZXF1YWxzKGVuZHBvaW50KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY3VycmVudEVkZ2UgPSBjdXJyZW50RWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY2hlY2tPcmRlcigpO1xuICAgIHRoaXMuY2hlY2tTZWN0aW9uKCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFkZFBhdGhFZGdlcyA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMub3duZXIsXG4gICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBwYXRoLm93bmVyID09PSBvd25lciBGQUlMRUQhJyk7XG5cbiAgICB2YXIgaXNQYXRoQXV0b1JvdXRlZCA9IHBhdGguaXNBdXRvUm91dGVkKCksXG4gICAgICAgIGhhc0N1c3RvbUVkZ2UgPSBmYWxzZSxcbiAgICAgICAgY3VzdG9taXplZEluZGV4ZXMgPSB7fSxcbiAgICAgICAgaW5kZXhlcyA9IFtdLFxuICAgICAgICBzdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludCxcbiAgICAgICAgZGlyLFxuICAgICAgICBlZGdlLFxuICAgICAgICBpO1xuXG4gICAgaWYgKGlzUGF0aEF1dG9Sb3V0ZWQpIHtcbiAgICAgICAgaSA9IC0xO1xuICAgICAgICB3aGlsZSAoKytpIDwgaW5kZXhlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGhhc0N1c3RvbUVkZ2UgPSB0cnVlO1xuICAgICAgICAgICAgY3VzdG9taXplZEluZGV4ZXNbaW5kZXhlc1tpXV0gPSAwO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFzQ3VzdG9tRWRnZSA9IHRydWU7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCksXG4gICAgICAgIHB0cnNPYmplY3QgPSBwb2ludExpc3QuZ2V0VGFpbEVkZ2VQdHJzKCksXG4gICAgICAgIGluZEl0cixcbiAgICAgICAgY3VyckVkZ2VJbmRleCA9IHBvaW50TGlzdC5sZW5ndGggLSAyLFxuICAgICAgICBnb29kQW5nbGUsXG4gICAgICAgIHBvcyA9IHB0cnNPYmplY3QucG9zLFxuICAgICAgICBza2lwRWRnZSxcbiAgICAgICAgaXNNb3ZlYWJsZSxcbiAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQsXG4gICAgICAgIHN0YXJ0UG9ydCxcbiAgICAgICAgZW5kUG9ydCxcbiAgICAgICAgaXNTdGFydFBvcnRDb25uZWN0VG9DZW50ZXIsXG4gICAgICAgIGlzRW5kUG9ydENvbm5lY3RUb0NlbnRlcixcbiAgICAgICAgaXNQYXRoRml4ZWQ7XG5cbiAgICBzdGFydHBvaW50ID0gcHRyc09iamVjdC5zdGFydDtcbiAgICBlbmRwb2ludCA9IHB0cnNPYmplY3QuZW5kO1xuXG4gICAgd2hpbGUgKHBvaW50TGlzdC5sZW5ndGggJiYgcG9zID49IDApIHtcblxuICAgICAgICBkaXIgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpO1xuXG4gICAgICAgIHNraXBFZGdlID0gZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSA/IHRydWUgOiBmYWxzZTtcbiAgICAgICAgaXNNb3ZlYWJsZSA9IHBhdGguaXNNb3ZlYWJsZSgpO1xuXG4gICAgICAgIGlmICghaXNNb3ZlYWJsZSAmJiBkaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgICAgICBnb29kQW5nbGUgPSBVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKTtcbiAgICAgICAgICAgIGFzc2VydChnb29kQW5nbGUsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlmICghZ29vZEFuZ2xlKSB7XG4gICAgICAgICAgICAgICAgc2tpcEVkZ2UgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNraXBFZGdlICYmXG4gICAgICAgICAgICAoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcikgJiYgVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsKSkge1xuICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuICAgICAgICAgICAgZWRnZS5vd25lciA9IHBhdGg7XG5cbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRBbmRFbmRQb2ludChzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcG9pbnRMaXN0LmdldFBvaW50QmVmb3JlRWRnZShwb3MpO1xuICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBwb2ludExpc3QuZ2V0UG9pbnRBZnRlckVkZ2UocG9zKTtcblxuICAgICAgICAgICAgaWYgKGhhc0N1c3RvbUVkZ2UpIHtcbiAgICAgICAgICAgICAgICBpc0VkZ2VDdXN0b21GaXhlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChpc1BhdGhBdXRvUm91dGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZEl0ciA9IGN1c3RvbWl6ZWRJbmRleGVzLmluZGV4T2YoY3VyckVkZ2VJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkID0gKGluZEl0ciAhPT0gY3VzdG9taXplZEluZGV4ZXMubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVkZ2UuZWRnZUN1c3RvbUZpeGVkID0gaXNFZGdlQ3VzdG9tRml4ZWQ7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBlZGdlLmVkZ2VDdXN0b21GaXhlZCA9IGRpciA9PT0gQ09OU1RBTlRTLkRpclNrZXc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN0YXJ0UG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCk7XG5cbiAgICAgICAgICAgIGFzc2VydChzdGFydFBvcnQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IHN0YXJ0UG9ydCAhPT0gbnVsbCBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlzU3RhcnRQb3J0Q29ubmVjdFRvQ2VudGVyID0gc3RhcnRQb3J0LmlzQ29ubmVjdFRvQ2VudGVyKCk7XG4gICAgICAgICAgICBlbmRQb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCk7XG5cbiAgICAgICAgICAgIGFzc2VydChlbmRQb3J0ICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBlbmRQb3J0ICE9PSBudWxsIEZBSUxFRCEnKTtcblxuICAgICAgICAgICAgaXNFbmRQb3J0Q29ubmVjdFRvQ2VudGVyID0gZW5kUG9ydC5pc0Nvbm5lY3RUb0NlbnRlcigpO1xuICAgICAgICAgICAgaXNQYXRoRml4ZWQgPSBwYXRoLmlzRml4ZWQoKSB8fCAhcGF0aC5pc0F1dG9Sb3V0ZWQoKTtcblxuICAgICAgICAgICAgZWRnZS5lZGdlRml4ZWQgPSBlZGdlLmVkZ2VDdXN0b21GaXhlZCB8fCBpc1BhdGhGaXhlZCB8fFxuICAgICAgICAgICAgKGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSAmJiBpc1N0YXJ0UG9ydENvbm5lY3RUb0NlbnRlcikgfHxcbiAgICAgICAgICAgIChlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpICYmIGlzRW5kUG9ydENvbm5lY3RUb0NlbnRlcik7XG5cbiAgICAgICAgICAgIGlmIChkaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRCKGVkZ2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlZGdlLnBvc2l0aW9uWSA9IDA7XG4gICAgICAgICAgICAgICAgZWRnZS5icmFja2V0T3BlbmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGVkZ2UuYnJhY2tldENsb3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB0cnNPYmplY3QgPSBwb2ludExpc3QuZ2V0UHJldkVkZ2VQdHJzKHBvcyk7XG4gICAgICAgIHBvcyA9IHB0cnNPYmplY3QucG9zO1xuICAgICAgICBzdGFydHBvaW50ID0gcHRyc09iamVjdC5zdGFydDtcbiAgICAgICAgZW5kcG9pbnQgPSBwdHJzT2JqZWN0LmVuZDtcbiAgICAgICAgY3VyckVkZ2VJbmRleC0tO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRQb3J0RWRnZXMgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIHZhciBzdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludCxcbiAgICAgICAgZWRnZSxcbiAgICAgICAgc2VsZlBvaW50cyxcbiAgICAgICAgc3RhcnRwb2ludFByZXYsXG4gICAgICAgIGVuZHBvaW50TmV4dCxcbiAgICAgICAgZGlyLFxuICAgICAgICBpLFxuICAgICAgICBjYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWw7XG5cbiAgICBhc3NlcnQocG9ydC5vd25lci5vd25lciA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IHBvcnQub3duZXIgPT09IChvd25lcikgRkFJTEVEIScpO1xuXG4gICAgaWYgKHBvcnQuaXNDb25uZWN0VG9DZW50ZXIoKSB8fCBwb3J0Lm93bmVyLmlzQXRvbWljKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGZQb2ludHMgPSBwb3J0LnNlbGZQb2ludHM7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cbiAgICAgICAgc3RhcnRwb2ludFByZXYgPSBzZWxmUG9pbnRzWyhpICsgMykgJSA0XTtcbiAgICAgICAgc3RhcnRwb2ludCA9IHNlbGZQb2ludHNbaV07XG4gICAgICAgIGVuZHBvaW50ID0gc2VsZlBvaW50c1soaSArIDEpICUgNF07XG4gICAgICAgIGVuZHBvaW50TmV4dCA9IHNlbGZQb2ludHNbKGkgKyAyKSAlIDRdO1xuICAgICAgICBkaXIgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEIScpO1xuXG4gICAgICAgIGNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCA9IHBvcnQuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsKHRoaXMuaXNob3Jpem9udGFsKTtcbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCAmJiBjYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWwpIHtcbiAgICAgICAgICAgIGVkZ2UgPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTtcblxuICAgICAgICAgICAgZWRnZS5vd25lciA9IHBvcnQ7XG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBlbmRwb2ludE5leHQ7XG5cbiAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZEIoZWRnZSk7XG5cbiAgICAgICAgICAgIGlmIChlZGdlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgZWRnZS5hZGRUb1Bvc2l0aW9uKDAuOTk5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFkZEVkZ2VzID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB2YXIgc2VsZlBvaW50cyxcbiAgICAgICAgc3RhcnRwb2ludCxcbiAgICAgICAgc3RhcnRwb2ludFByZXYsXG4gICAgICAgIGVuZHBvaW50TmV4dCxcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIGRpcixcbiAgICAgICAgaTtcblxuICAgIGlmIChwYXRoIGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCkge1xuICAgICAgICB2YXIgYm94ID0gcGF0aDtcblxuICAgICAgICBhc3NlcnQoYm94Lm93bmVyID09PSB0aGlzLm93bmVyLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IGJveC5vd25lciA9PT0gKG93bmVyKSBGQUlMRUQhJyk7XG5cblxuICAgICAgICBzZWxmUG9pbnRzID0gYm94LnNlbGZQb2ludHM7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgc3RhcnRwb2ludFByZXYgPSBzZWxmUG9pbnRzWyhpICsgMykgJSA0XTtcbiAgICAgICAgICAgIHN0YXJ0cG9pbnQgPSBzZWxmUG9pbnRzW2ldO1xuICAgICAgICAgICAgZW5kcG9pbnQgPSBzZWxmUG9pbnRzWyhpICsgMSkgJSA0XTtcbiAgICAgICAgICAgIGVuZHBvaW50TmV4dCA9IHNlbGZQb2ludHNbKGkgKyAyKSAlIDRdO1xuICAgICAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuXG4gICAgICAgICAgICAgICAgZWRnZS5vd25lciA9IGJveDtcbiAgICAgICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBzdGFydHBvaW50UHJldjtcbiAgICAgICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IGVuZHBvaW50TmV4dDtcblxuICAgICAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkQihlZGdlKTtcblxuICAgICAgICAgICAgICAgIGlmIChlZGdlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGVkZ2UuYWRkVG9Qb3NpdGlvbigwLjk5OSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHBhdGgpIHsgIC8vIHBhdGggaXMgYW4gQVJHcmFwaFxuICAgICAgICB2YXIgZ3JhcGggPSBwYXRoO1xuICAgICAgICBhc3NlcnQoZ3JhcGggPT09IHRoaXMub3duZXIsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogZ3JhcGggPT09IHRoaXMub3duZXIgRkFJTEVEIScpO1xuXG4gICAgICAgIHNlbGZQb2ludHMgPSBncmFwaC5zZWxmUG9pbnRzO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcblxuICAgICAgICAgICAgc3RhcnRwb2ludFByZXYgPSBzZWxmUG9pbnRzWyhpICsgMykgJSA0XTtcbiAgICAgICAgICAgIHN0YXJ0cG9pbnQgPSBzZWxmUG9pbnRzW2ldO1xuICAgICAgICAgICAgZW5kcG9pbnQgPSBzZWxmUG9pbnRzWyhpICsgMSkgJSA0XTtcbiAgICAgICAgICAgIGVuZHBvaW50TmV4dCA9IHNlbGZQb2ludHNbKGkgKyAyKSAlIDRdO1xuICAgICAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuXG4gICAgICAgICAgICAgICAgZWRnZS5vd25lciA9IGdyYXBoO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRBbmRFbmRQb2ludChzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gZW5kcG9pbnROZXh0O1xuXG4gICAgICAgICAgICAgICAgZWRnZS5lZGdlRml4ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmluc2VydChlZGdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kZWxldGVFZGdlcyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgbmV4dDtcblxuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChlZGdlLm93bmVyID09PSBvYmplY3QpIHtcbiAgICAgICAgICAgIG5leHQgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVkZ2UpO1xuICAgICAgICAgICAgZWRnZSA9IG5leHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZGVsZXRlQWxsRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKHRoaXMub3JkZXJGaXJzdCkge1xuICAgICAgICB0aGlzLnJlbW92ZSh0aGlzLm9yZGVyRmlyc3QpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZSA9IGZ1bmN0aW9uIChwYXRoLCBzdGFydHBvaW50KSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcblxuICAgICAgICBpZiAoZWRnZS5pc1NhbWVTdGFydFBvaW50KHN0YXJ0cG9pbnQpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuZ2V0RWRnZTogZWRnZSAhPT0gbnVsbCBGQUlMRUQhJyk7XG4gICAgcmV0dXJuIGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2VCeVBvaW50ZXIgPSBmdW5jdGlvbiAoc3RhcnRwb2ludCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChlZGdlLmlzU2FtZVN0YXJ0UG9pbnQoc3RhcnRwb2ludCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5nZXRFZGdlQnlQb2ludGVyOiBlZGdlICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICByZXR1cm4gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuc2V0RWRnZUJ5UG9pbnRlciA9IGZ1bmN0aW9uIChwRWRnZSwgbmV3RWRnZSkge1xuICAgIGFzc2VydChuZXdFZGdlIGluc3RhbmNlb2YgQXV0b1JvdXRlckVkZ2UsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNldEVkZ2VCeVBvaW50ZXI6IG5ld0VkZ2UgaW5zdGFuY2VvZiBBdXRvUm91dGVyRWRnZSBGQUlMRUQhJyk7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLnNlY3Rpb25GaXJzdDtcbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICBpZiAocEVkZ2UgPT09IGVkZ2UpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2UuZ2V0U2VjdGlvbkRvd24oKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2V0RWRnZUJ5UG9pbnRlcjogZWRnZSAhPT0gbnVsbCBGQUlMRUQhJyk7XG4gICAgZWRnZSA9IG5ld0VkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2VBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSkge1xuXG4gICAgICAgIGlmIChVdGlscy5pc1BvaW50TmVhckxpbmUocG9pbnQsIGVkZ2Uuc3RhcnRwb2ludCwgZWRnZS5lbmRwb2ludCwgbmVhcm5lc3MpKSB7XG4gICAgICAgICAgICByZXR1cm4gZWRnZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZHVtcEVkZ2VzID0gZnVuY3Rpb24gKG1zZywgbG9nZ2VyKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIGxvZyA9IGxvZ2dlciB8fCBfbG9nZ2VyLmRlYnVnLFxuICAgICAgICB0b3RhbCA9IDE7XG5cbiAgICBsb2cobXNnKTtcblxuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGxvZygnXFx0JyArIGVkZ2Uuc3RhcnRwb2ludC54ICsgJywgJyArIGVkZ2Uuc3RhcnRwb2ludC55ICsgJ1xcdFxcdCcgKyBlZGdlLmVuZHBvaW50LnggKyAnLCAnICtcbiAgICAgICAgZWRnZS5lbmRwb2ludC55ICsgJ1xcdFxcdFxcdCgnICsgKGVkZ2UuZWRnZUZpeGVkID8gJ0ZJWEVEJyA6ICdNT1ZFQUJMRScgKSArICcpXFx0XFx0JyArXG4gICAgICAgIChlZGdlLmJyYWNrZXRDbG9zaW5nID8gJ0JyYWNrZXQgQ2xvc2luZycgOiAoZWRnZS5icmFja2V0T3BlbmluZyA/ICdCcmFja2V0IE9wZW5pbmcnIDogJycpKSk7XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB0b3RhbCsrO1xuICAgIH1cblxuICAgIGxvZygnVG90YWwgRWRnZXM6ICcgKyB0b3RhbCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2VDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgdG90YWwgPSAxO1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgdG90YWwrKztcbiAgICB9XG4gICAgcmV0dXJuIHRvdGFsO1xufTtcblxuLy8tLVByaXZhdGUgRnVuY3Rpb25zXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkdldFJlYWxZID0gZnVuY3Rpb24gKGVkZ2UsIHkpIHtcbiAgICBpZiAoeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEIScpO1xuICAgICAgICAgICAgcmV0dXJuIGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQhJyk7XG4gICAgICAgIHJldHVybiBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICcgK1xuICAgICAgICAgICAgJyFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEIScpO1xuXG4gICAgICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEIScpO1xuICAgICAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WSh5KTtcbiAgICAgICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnRZKHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRQb2ludFgoeSk7XG4gICAgICAgICAgICBlZGdlLnNldEVuZFBvaW50WCh5KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uU2V0UmVhbFkgPSBmdW5jdGlvbiAoZWRnZSwgeSkge1xuICAgIGlmIChlZGdlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgZWRnZSA9IGVkZ2VbMF07XG4gICAgfVxuXG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX1NldFJlYWxZOiBlZGdlICE9IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG5cbiAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9TZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQnKTtcbiAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WSh5KTtcbiAgICAgICAgZWRnZS5zZXRFbmRQb2ludFkoeSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9TZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcbiAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WCh5KTtcbiAgICAgICAgZWRnZS5zZXRFbmRQb2ludFgoeSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIGVkZ2UgZW5kcG9pbnRzIHNvIHgxIDwgeDJcbiAqL1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25HZXRSZWFsWCA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxYOiBlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuICAgIHZhciB4MSwgeDI7XG5cbiAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWDogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnggPCBlZGdlLmVuZHBvaW50LngpIHtcblxuICAgICAgICAgICAgeDEgPSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgICAgIHgyID0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2UuZW5kcG9pbnQueDtcbiAgICAgICAgICAgIHgyID0gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxYOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCcpO1xuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnkgPCBlZGdlLmVuZHBvaW50LnkpIHtcblxuICAgICAgICAgICAgeDEgPSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgICAgIHgyID0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgICAgIHgyID0gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gW3gxLCB4Ml07XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkdldFJlYWxPID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbE86IGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG4gICAgdmFyIG8xLCBvMjtcblxuICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxPOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCcpO1xuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnggPCBlZGdlLmVuZHBvaW50LngpIHtcblxuICAgICAgICAgICAgbzEgPSBlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgPyAwIDogZWRnZS5zdGFydHBvaW50UHJldi55IC0gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgICAgICBvMiA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueSAtIGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgbzEgPSBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpID8gMCA6IGVkZ2UuZW5kcG9pbnROZXh0LnkgLSBlZGdlLmVuZHBvaW50Lnk7XG4gICAgICAgICAgICBvMiA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnkgLSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbE86IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueSA8IGVkZ2UuZW5kcG9pbnQueSkge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnggLSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC54IC0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueCAtIGVkZ2UuZW5kcG9pbnQueDtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueCAtIGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIFtvMSwgbzJdO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25Mb2FkWSA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0xvYWRZOiBlZGdlICE9PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgZWRnZS5wb3NpdGlvblkgPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxZKGVkZ2UpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25Mb2FkQiA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0xvYWRCOiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgZWRnZS5icmFja2V0T3BlbmluZyA9ICFlZGdlLmVkZ2VGaXhlZCAmJiB0aGlzLl9icmFja2V0SXNPcGVuaW5nKGVkZ2UpO1xuICAgIGVkZ2UuYnJhY2tldENsb3NpbmcgPSAhZWRnZS5lZGdlRml4ZWQgJiYgdGhpcy5fYnJhY2tldElzQ2xvc2luZyhlZGdlKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uQWxsU3RvcmVZID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlKSB7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uU2V0UmVhbFkoZWRnZSwgZWRnZS5wb3NpdGlvblkpO1xuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkFsbExvYWRYID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBwdHM7XG4gICAgd2hpbGUgKGVkZ2UpIHtcbiAgICAgICAgcHRzID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsWChlZGdlKTtcbiAgICAgICAgZWRnZS5wb3NpdGlvblgxID0gcHRzWzBdO1xuICAgICAgICBlZGdlLnBvc2l0aW9uWDIgPSBwdHNbMV07XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2luaXRPcmRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm9yZGVyRmlyc3QgPSBudWxsO1xuICAgIHRoaXMub3JkZXJMYXN0ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2NoZWNrT3JkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCAmJiB0aGlzLm9yZGVyTGFzdCA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuY2hlY2tPcmRlcjogdGhpcy5vcmRlckZpcnN0ID09PSBudWxsICYmIHRoaXMub3JkZXJMYXN0ID09PSBudWxsIEZBSUxFRCcpO1xufTtcblxuLy8tLS1PcmRlclxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydEJlZm9yZSA9IGZ1bmN0aW9uIChlZGdlLCBiZWZvcmUpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBiZWZvcmUgIT09IG51bGwgJiYgZWRnZSAhPT0gYmVmb3JlLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IGVkZ2UgIT09IG51bGwgJiYgYmVmb3JlICE9PSBudWxsICYmIGVkZ2UgIT09IGJlZm9yZSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLm9yZGVyUHJldiA9IGJlZm9yZS5vcmRlclByZXY7XG4gICAgZWRnZS5vcmRlck5leHQgPSBiZWZvcmU7XG5cbiAgICBpZiAoYmVmb3JlLm9yZGVyUHJldikge1xuICAgICAgICBhc3NlcnQoYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgPT09IGJlZm9yZSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgPT09IGJlZm9yZSBGQUlMRURcXG5iZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCAnICtcbiAgICAgICAgICAgICdpcyAnICsgYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgKyAnIGFuZCBiZWZvcmUgaXMgJyArIGJlZm9yZSk7XG5cbiAgICAgICAgYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgPSBlZGdlO1xuXG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgIT09IGJlZm9yZSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogdGhpcy5vcmRlckZpcnN0ICE9PSBiZWZvcmUgRkFJTEVEJyk7XG4gICAgfSBlbHNlIHtcblxuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ID09PSBiZWZvcmUsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IHRoaXMub3JkZXJGaXJzdCA9PT0gYmVmb3JlIEZBSUxFRCcpO1xuICAgICAgICB0aGlzLm9yZGVyRmlyc3QgPSBlZGdlO1xuICAgIH1cblxuICAgIGJlZm9yZS5vcmRlclByZXYgPSBlZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5pbnNlcnRBZnRlciA9IGZ1bmN0aW9uIChlZGdlLCBhZnRlcikge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGFmdGVyICE9PSBudWxsICYmICFlZGdlLmVxdWFscyhhZnRlciksXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiAgZWRnZSAhPT0gbnVsbCAmJiBhZnRlciAhPT0gbnVsbCAmJiAhZWRnZS5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6IGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsIEZBSUxFRCAnKTtcblxuICAgIGVkZ2Uub3JkZXJOZXh0ID0gYWZ0ZXIub3JkZXJOZXh0O1xuICAgIGVkZ2Uub3JkZXJQcmV2ID0gYWZ0ZXI7XG5cbiAgICBpZiAoYWZ0ZXIub3JkZXJOZXh0KSB7XG4gICAgICAgIGFzc2VydChhZnRlci5vcmRlck5leHQub3JkZXJQcmV2LmVxdWFscyhhZnRlciksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogIGFmdGVyLm9yZGVyTmV4dC5vcmRlclByZXYuZXF1YWxzKGFmdGVyKSBGQUlMRUQnKTtcbiAgICAgICAgYWZ0ZXIub3JkZXJOZXh0Lm9yZGVyUHJldiA9IGVkZ2U7XG5cbiAgICAgICAgYXNzZXJ0KCF0aGlzLm9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpLCAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogIW9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpLCAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogdGhpcy5vcmRlckxhc3QuZXF1YWxzKGFmdGVyKSBGQUlMRUQnKTtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlO1xuICAgIH1cblxuICAgIGFmdGVyLm9yZGVyTmV4dCA9IGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydExhc3QgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLm9yZGVyUHJldiA9IHRoaXMub3JkZXJMYXN0O1xuXG4gICAgaWYgKHRoaXMub3JkZXJMYXN0KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyTGFzdC5vcmRlck5leHQgPT09IG51bGwsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiB0aGlzLm9yZGVyTGFzdC5vcmRlck5leHQgPT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgIT09IG51bGwsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiB0aGlzLm9yZGVyRmlyc3QgIT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICB0aGlzLm9yZGVyTGFzdC5vcmRlck5leHQgPSBlZGdlO1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6ICB0aGlzLm9yZGVyRmlyc3QgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgdGhpcy5vcmRlckZpcnN0ID0gZWRnZTtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0ID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0OiAgZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydDogZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgeSA9IGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgYXNzZXJ0KENPTlNUQU5UUy5FRF9NSU5DT09SRCA8PSB5ICYmIHkgPD0gQ09OU1RBTlRTLkVEX01BWENPT1JELFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnQ6IENPTlNUQU5UUy5FRF9NSU5DT09SRCA8PSB5ICYmIHkgPD0gQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCAoeSBpcyAnICsgeSArICcpJyk7XG5cbiAgICB2YXIgaW5zZXJ0ID0gdGhpcy5vcmRlckZpcnN0O1xuXG4gICAgd2hpbGUgKGluc2VydCAmJiBpbnNlcnQucG9zaXRpb25ZIDwgeSkge1xuICAgICAgICBpbnNlcnQgPSBpbnNlcnQub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGlmIChpbnNlcnQpIHtcbiAgICAgICAgdGhpcy5pbnNlcnRCZWZvcmUoZWRnZSwgaW5zZXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmluc2VydExhc3QoZWRnZSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5yZW1vdmU6ICBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMub3JkZXJGaXJzdCA9PT0gZWRnZSkge1xuICAgICAgICB0aGlzLm9yZGVyRmlyc3QgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBpZiAoZWRnZS5vcmRlck5leHQpIHtcbiAgICAgICAgZWRnZS5vcmRlck5leHQub3JkZXJQcmV2ID0gZWRnZS5vcmRlclByZXY7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3JkZXJMYXN0ID09PSBlZGdlKSB7XG4gICAgICAgIHRoaXMub3JkZXJMYXN0ID0gZWRnZS5vcmRlclByZXY7XG4gICAgfVxuXG4gICAgaWYgKGVkZ2Uub3JkZXJQcmV2KSB7XG4gICAgICAgIGVkZ2Uub3JkZXJQcmV2Lm9yZGVyTmV4dCA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGVkZ2Uub3JkZXJOZXh0ID0gbnVsbDtcbiAgICBlZGdlLm9yZGVyUHJldiA9IG51bGw7XG59O1xuXG4vLy0tIFByaXZhdGVcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2xpZGVCdXROb3RQYXNzRWRnZXMgPSBmdW5jdGlvbiAoZWRnZSwgeSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLCAnQVJFZGdlTGlzdC5zbGlkZUJ1dE5vdFBhc3NFZGdlczogZWRnZSAhPSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChDT05TVEFOVFMuRURfTUlOQ09PUkQgPCB5ICYmIHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNsaWRlQnV0Tm90UGFzc0VkZ2VzOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgPCB5ICYmIHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEJyk7XG5cbiAgICB2YXIgb2xkeSA9IGVkZ2UucG9zaXRpb25ZO1xuICAgIGFzc2VydChDT05TVEFOVFMuRURfTUlOQ09PUkQgPCBvbGR5ICYmIG9sZHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNsaWRlQnV0Tm90UGFzc0VkZ2VzOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgPCBvbGR5ICYmIG9sZHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEJyk7XG5cbiAgICBpZiAob2xkeSA9PT0geSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgeDEgPSBlZGdlLnBvc2l0aW9uWDEsXG4gICAgICAgIHgyID0gZWRnZS5wb3NpdGlvblgyLFxuICAgICAgICByZXQgPSBudWxsLFxuICAgICAgICBpbnNlcnQgPSBlZGdlO1xuXG4gICAgLy9JZiB3ZSBhcmUgdHJ5aW5nIHRvIHNsaWRlIGRvd25cblxuICAgIGlmIChvbGR5IDwgeSkge1xuICAgICAgICB3aGlsZSAoaW5zZXJ0Lm9yZGVyTmV4dCkge1xuICAgICAgICAgICAgaW5zZXJ0ID0gaW5zZXJ0Lm9yZGVyTmV4dDtcblxuICAgICAgICAgICAgaWYgKHkgPCBpbnNlcnQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgLy9UaGVuIHdlIHdvbid0IGJlIHNoaWZ0aW5nIHBhc3QgdGhlIG5ldyBlZGdlIChpbnNlcnQpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vSWYgeW91IGNhbid0IHBhc3MgdGhlIGVkZ2UgKGJ1dCB3YW50IHRvKSBhbmQgdGhlIGxpbmVzIHdpbGwgb3ZlcmxhcCB4IHZhbHVlcy4uLlxuICAgICAgICAgICAgaWYgKCFpbnNlcnQuZ2V0RWRnZUNhbnBhc3NlZCgpICYmIFV0aWxzLmludGVyc2VjdCh4MSwgeDIsIGluc2VydC5wb3NpdGlvblgxLCBpbnNlcnQucG9zaXRpb25YMikpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBpbnNlcnQ7XG4gICAgICAgICAgICAgICAgeSA9IGluc2VydC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWRnZSAhPT0gaW5zZXJ0ICYmIGluc2VydC5vcmRlclByZXYgIT09IGVkZ2UpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVkZ2UpO1xuICAgICAgICAgICAgdGhpcy5pbnNlcnRCZWZvcmUoZWRnZSwgaW5zZXJ0KTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIHsgLy8gSWYgd2UgYXJlIHRyeWluZyB0byBzbGlkZSB1cFxuICAgICAgICB3aGlsZSAoaW5zZXJ0Lm9yZGVyUHJldikge1xuICAgICAgICAgICAgaW5zZXJ0ID0gaW5zZXJ0Lm9yZGVyUHJldjtcblxuICAgICAgICAgICAgaWYgKHkgPiBpbnNlcnQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vSWYgaW5zZXJ0IGNhbm5vdCBiZSBwYXNzZWQgYW5kIGl0IGlzIGluIHRoZSB3YXkgb2YgdGhlIGVkZ2UgKGlmIHRoZSBlZGdlIHdlcmUgdG8gc2xpZGUgdXApLlxuICAgICAgICAgICAgaWYgKCFpbnNlcnQuZ2V0RWRnZUNhbnBhc3NlZCgpICYmIFV0aWxzLmludGVyc2VjdCh4MSwgeDIsIGluc2VydC5wb3NpdGlvblgxLCBpbnNlcnQucG9zaXRpb25YMikpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBpbnNlcnQ7XG4gICAgICAgICAgICAgICAgeSA9IGluc2VydC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWRnZSAhPT0gaW5zZXJ0ICYmIGluc2VydC5vcmRlck5leHQgIT09IGVkZ2UpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVkZ2UpOy8vVGhpcyBpcyB3aGVyZSBJIGJlbGlldmUgdGhlIGVycm9yIGNvdWxkIGxpZSFcbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0QWZ0ZXIoZWRnZSwgaW5zZXJ0KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZWRnZS5wb3NpdGlvblkgPSB5O1xuXG4gICAgcmV0dXJuIHJldDtcbn07XG5cbi8vLS0tLS0tU2VjdGlvblxuXG4vLyBwcml2YXRlXG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2luaXRTZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmNoZWNrU2VjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoISh0aGlzLnNlY3Rpb25CbG9ja2VyID09PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID09PSBudWxsKSkge1xuICAgICAgICAvLyBUaGlzIHVzZWQgdG8gYmUgY29udGFpbmVkIGluIGFuIGFzc2VydC5cbiAgICAgICAgLy8gR2VuZXJhbGx5IHRoaXMgZmFpbHMgd2hlbiB0aGUgcm91dGVyIGRvZXMgbm90IGhhdmUgYSBjbGVhbiBleGl0IHRoZW4gaXMgYXNrZWQgdG8gcmVyb3V0ZS5cbiAgICAgICAgdGhpcy5fbG9nZ2VyLndhcm4oJ3NlY3Rpb25CbG9ja2VyIGFuZCB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCBhcmUgbm90IG51bGwuICcgK1xuICAgICAgICAnQXNzdW1pbmcgbGFzdCBydW4gZGlkIG5vdCBleGl0IGNsZWFubHkuIEZpeGluZy4uLicpO1xuICAgICAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBudWxsO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuc2VjdGlvblJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY2hlY2tTZWN0aW9uKCk7XG5cbiAgICB0aGlzLnNlY3Rpb25GaXJzdCA9IG51bGw7XG59O1xuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIHNlY3Rpb24gZGF0YSBzdHJ1Y3R1cmUuXG4gKlxuICogQHBhcmFtIGJsb2NrZXJcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbkJlZ2luU2NhbiA9IGZ1bmN0aW9uIChibG9ja2VyKSB7XG4gICAgdGhpcy5jaGVja1NlY3Rpb24oKTtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBibG9ja2VyO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDEgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnBvc2l0aW9uWDE7XG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDIgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnBvc2l0aW9uWDI7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNldFNlY3Rpb25OZXh0KG51bGwpO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2V0U2VjdGlvbkRvd24obnVsbCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uSXNJbW1lZGlhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSXNJbW1lZGlhdGU6IHRoaXMuc2VjdGlvbkJsb2NrZXIgIT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPSBudWxsICcgK1xuICAgICAgICAnJiYgKnNlY3Rpb25QdHIyQmxvY2tlZCAhPSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIHNlY3Rpb25CbG9ja2VkID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0sXG4gICAgICAgIGUgPSBzZWN0aW9uQmxvY2tlZC5nZXRTZWN0aW9uRG93bigpLFxuICAgICAgICBhMSA9IHNlY3Rpb25CbG9ja2VkLnNlY3Rpb25YMSxcbiAgICAgICAgYTIgPSBzZWN0aW9uQmxvY2tlZC5zZWN0aW9uWDIsXG4gICAgICAgIHAxID0gc2VjdGlvbkJsb2NrZWQucG9zaXRpb25YMSxcbiAgICAgICAgcDIgPSBzZWN0aW9uQmxvY2tlZC5wb3NpdGlvblgyLFxuICAgICAgICBiMSA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgxLFxuICAgICAgICBiMiA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgyO1xuXG4gICAgaWYgKGUgIT09IG51bGwpIHtcbiAgICAgICAgZSA9IChlLnN0YXJ0cG9pbnQgPT09IG51bGwgfHwgZS5zZWN0aW9uWDEgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBlKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoYjEgPD0gYTIgJiYgYTEgPD0gYjIsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSXNJbW1lZGlhdGU6IGIxIDw9IGEyICYmIGExIDw9IGIyIEZBSUxFRCcpOyAgICAgICAgICAgICAgICAgICAgIC8vIG5vdCBjYXNlIDEgb3IgNlxuXG4gICAgLy8gTk9URSBXRSBDSEFOR0VEIFRIRSBDT05ESVRJT05TIChBMTw9QjEgQU5EIEIyPD1BMilcbiAgICAvLyBCRUNBVVNFIEhFUkUgV0UgTkVFRCBUSElTIVxuXG4gICAgaWYgKGExIDw9IGIxKSB7XG4gICAgICAgIHdoaWxlICghKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSAmJiBlLnNlY3Rpb25YMiA8IGIxKSB7XG4gICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGIyIDw9IGEyKSB7XG4gICAgICAgICAgICByZXR1cm4gKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSB8fCBiMiA8IGUuc2VjdGlvblgxOyAgICAgICAgICAgICAgIC8vIGNhc2UgM1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgJiYgYTIgPT09IHAyOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAyXG4gICAgfVxuXG4gICAgaWYgKGIyIDw9IGEyKSB7XG4gICAgICAgIHJldHVybiBhMSA9PT0gcDEgJiYgKChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgfHwgYjIgPCBlLnNlY3Rpb25YMSk7ICAgIC8vIGNhc2UgNVxuICAgIH1cblxuICAgIHJldHVybiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpICYmIGExID09PSBwMSAmJiBhMiA9PT0gcDI7ICAgICAgICAgICAgICAgICAvLyBjYXNlIDRcbn07XG5cblxuLy8gVGhlIGZvbGxvd2luZyBtZXRob2RzIGFyZSBjb252ZW5pZW5jZSBtZXRob2RzIGZvciBhZGp1c3RpbmcgdGhlICdzZWN0aW9uJyBcbi8vIG9mIGFuIGVkZ2UuXG4vKipcbiAqIEdldCBlaXRoZXIgbWluKzEgb3IgYSB2YWx1ZSBiZXR3ZWVuIG1pbiBhbmQgbWF4LiBUZWNobmljYWxseSxcbiAqIHdlIGFyZSBsb29raW5nIGZvciBbbWluLCBtYXgpLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcbiAqIEByZXR1cm4ge051bWJlcn0gcmVzdWx0XG4gKi9cbnZhciBnZXRMYXJnZXJFbmRwb2ludCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgYXNzZXJ0KG1pbiA8IG1heCk7XG5cbiAgICByZXN1bHQgPSBNYXRoLm1pbihtaW4gKyAxLCAobWluICsgbWF4KSAvIDIpO1xuICAgIGlmIChyZXN1bHQgPT09IG1heCkge1xuICAgICAgICByZXN1bHQgPSBtaW47XG4gICAgfVxuICAgIGFzc2VydChyZXN1bHQgPCBtYXgpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIEdldCBlaXRoZXIgbWF4LTEgb3IgYSB2YWx1ZSBiZXR3ZWVuIG1pbiBhbmQgbWF4LiBUZWNobmljYWxseSxcbiAqIHdlIGFyZSBsb29raW5nIGZvciAobWluLCBtYXhdLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcbiAqIEByZXR1cm4ge051bWJlcn0gcmVzdWx0XG4gKi9cbnZhciBnZXRTbWFsbGVyRW5kcG9pbnQgPSBmdW5jdGlvbiAobWluLCBtYXgpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIGFzc2VydChtaW4gPCBtYXgpO1xuXG4gICAgLy8gSWYgbWluIGlzIHNvIHNtYWxsIHRoYXQgXG4gICAgLy8gXG4gICAgLy8gICAgICAobWluK21heCkvMiA9PT0gbWluXG4gICAgLy9cbiAgICAvLyB0aGVuIHdlIHdpbGwgc2ltcGx5IHVzZSBtYXggdmFsdWUgZm9yIHRoZSByZXN1bHRcbiAgICByZXN1bHQgPSBNYXRoLm1heChtYXggLSAxLCAobWluICsgbWF4KSAvIDIpO1xuICAgIGlmIChyZXN1bHQgPT09IG1pbikge1xuICAgICAgICByZXN1bHQgPSBtYXg7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHJlc3VsdCA+IG1pbik7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uQmxvY2tlciAhPSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIG5ld1NlY3Rpb25YMSxcbiAgICAgICAgbmV3U2VjdGlvblgyLFxuICAgICAgICBlLFxuICAgICAgICBibG9ja2VyWDEgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMSxcbiAgICAgICAgYmxvY2tlclgyID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDI7XG5cbiAgICBhc3NlcnQoYmxvY2tlclgxIDw9IGJsb2NrZXJYMixcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogYmxvY2tlclgxIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcblxuICAgIC8vIFNldHRpbmcgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRcbiAgICBpZiAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPT09IG51bGwpIHsgIC8vIGluaXRpYWxpemUgc2VjdGlvblB0cjJCbG9ja2VkXG5cbiAgICAgICAgdGhpcy5zZWN0aW9uRmlyc3QgPSB0aGlzLnNlY3Rpb25GaXJzdCA9PT0gbnVsbCA/IFtuZXcgQXV0b1JvdXRlckVkZ2UoKV0gOiB0aGlzLnNlY3Rpb25GaXJzdDtcbiAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25GaXJzdDtcbiAgICB9IGVsc2UgeyAgIC8vIGdldCBuZXh0IHNlY3Rpb25QdHIyQmxvY2tlZFxuICAgICAgICB2YXIgY3VycmVudEVkZ2UgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXTtcblxuICAgICAgICBhc3NlcnQoY3VycmVudEVkZ2Uuc3RhcnRwb2ludCAhPT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGN1cnJlbnRFZGdlLnN0YXJ0cG9pbnQgPT09IG51bGwnKTtcblxuICAgICAgICB2YXIgbyA9IG51bGw7XG5cbiAgICAgICAgZSA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKClbMF07XG4gICAgICAgIG5ld1NlY3Rpb25YMSA9IGN1cnJlbnRFZGdlLnNlY3Rpb25YMTtcbiAgICAgICAgbmV3U2VjdGlvblgyID0gY3VycmVudEVkZ2Uuc2VjdGlvblgyO1xuXG4gICAgICAgIGFzc2VydChuZXdTZWN0aW9uWDEgPD0gbmV3U2VjdGlvblgyLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogbmV3U2VjdGlvblgxIDw9IG5ld1NlY3Rpb25YMiBGQUlMRUQgKCcgKyBuZXdTZWN0aW9uWDEgK1xuICAgICAgICAgICAgJyA8PSAnICsgbmV3U2VjdGlvblgyICsgJyknICsgJ1xcbmVkZ2UgaXMgJyk7XG5cbiAgICAgICAgYXNzZXJ0KGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDIgJiYgbmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMixcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDIgJiYgIG5ld1NlY3Rpb25YMSA8PSBibG9ja2VyWDIgRkFJTEVEJyk7XG4gICAgICAgIC8vIG5vdCBjYXNlIDEgb3IgNlxuICAgICAgICBpZiAobmV3U2VjdGlvblgxIDwgYmxvY2tlclgxICYmIGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMikgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgM1xuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMSAmJiBuZXdTZWN0aW9uWDIgPD0gYmxvY2tlclgyKSB7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSA0XG5cbiAgICAgICAgICAgIGlmIChlICYmIGUuc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHdoaWxlIChlLmdldFNlY3Rpb25OZXh0KCkgJiYgZS5nZXRTZWN0aW9uTmV4dCgpLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlLnNldFNlY3Rpb25OZXh0KGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0KCkpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd24oKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IChjdXJyZW50RWRnZS5nZXRTZWN0aW9uTmV4dCgpKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDEgJiYgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgyKSB7ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgNVxuXG4gICAgICAgICAgICBhc3NlcnQobmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMixcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAvLyBNb3ZlIG5ld1NlY3Rpb25YMSBzdWNoIHRoYXQgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgxIDwgbmV3U2VjdGlvblgyXG4gICAgICAgICAgICBuZXdTZWN0aW9uWDEgPSBnZXRMYXJnZXJFbmRwb2ludChibG9ja2VyWDIsIG5ld1NlY3Rpb25YMik7XG5cbiAgICAgICAgICAgIHdoaWxlICgoZSAmJiBlLnN0YXJ0cG9pbnQgIT09IG51bGwpICYmIGUuc2VjdGlvblgxIDw9IG5ld1NlY3Rpb25YMSkge1xuICAgICAgICAgICAgICAgIGFzc2VydChlLnNlY3Rpb25YMSA8PSBlLnNlY3Rpb25YMixcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogZS5zZWN0aW9uWDEgPD0gZS5zZWN0aW9uWDIgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3U2VjdGlvblgxIDw9IGUuc2VjdGlvblgyKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1NlY3Rpb25YMSA9IGdldExhcmdlckVuZHBvaW50KGUuc2VjdGlvblgyLCBuZXdTZWN0aW9uWDIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG8gPSBlO1xuICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zZXJ0IGN1cnJlbnRFZGdlIHRvIGJlIHNlY3Rpb25OZXh0IG9mIHRoZSBnaXZlbiBlZGdlIGluIHRoZSBsaXN0IFxuICAgICAgICAgICAgICAgIC8vIG9mIHNlY3Rpb25Eb3duIChiYXNpY2FsbHksIGNvbGxhcHNpbmcgY3VycmVudEVkZ2UgaW50byB0aGUgc2VjdGlvbkRvd24gXG4gICAgICAgICAgICAgICAgLy8gbGlzdC4gVGhlIHZhbHVlcyBpbiB0aGUgbGlzdCBmb2xsb3dpbmcgY3VycmVudEVkZ2Ugd2lsbCB0aGVuIGJlIHNldCB0byBcbiAgICAgICAgICAgICAgICAvLyBiZSBzZWN0aW9uRG93biBvZiB0aGUgY3VycmVudEVkZ2UuKVxuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd25QdHIoKVswXTtcbiAgICAgICAgICAgICAgICBvLnNldFNlY3Rpb25OZXh0KGN1cnJlbnRFZGdlKTtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZXRTZWN0aW9uRG93bihlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEgRkFJTEVEICgnICtcbiAgICAgICAgICAgICAgICBibG9ja2VyWDIgKyAnIDwgJyArIG5ld1NlY3Rpb25YMSArICcpICcgK1xuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiArICcgaXMgJyArIG5ld1NlY3Rpb25YMiArICcpJyk7XG4gICAgICAgICAgICAvLyBTaGlmdGluZyB0aGUgZnJvbnQgb2YgdGhlIHAyYiBzbyBpdCBubyBsb25nZXIgb3ZlcmxhcHMgdGhpcy5zZWN0aW9uQmxvY2tlclxuXG4gICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDEgPSBuZXdTZWN0aW9uWDE7XG5cbiAgICAgICAgICAgIGFzc2VydChjdXJyZW50RWRnZS5zZWN0aW9uWDEgPCBjdXJyZW50RWRnZS5zZWN0aW9uWDIsXG4gICAgICAgICAgICAgICAgJ2N1cnJlbnRFZGdlLnNlY3Rpb25YMSA8IGN1cnJlbnRFZGdlLnNlY3Rpb25YMiAoJyArXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgxICsgJyA8ICcgKyBjdXJyZW50RWRnZS5zZWN0aW9uWDIgKyAnKScpO1xuICAgICAgICB9IGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDJcbiAgICAgICAgICAgIGFzc2VydChuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiBuZXdTZWN0aW9uWDIgPD0gYmxvY2tlclgyLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6ICBuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiAnICtcbiAgICAgICAgICAgICAgICAnbmV3U2VjdGlvblgyIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcblxuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpO1xuXG4gICAgICAgICAgICB3aGlsZSAoZSAmJiBlLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBvID0gZTtcbiAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG8uc2VjdGlvblgyICsgMSA8IGJsb2NrZXJYMSAmJiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwgfHxcbiAgICAgICAgICAgICAgICAgICAgby5zZWN0aW9uWDIgKyAxIDwgZS5zZWN0aW9uWDEpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBvLmdldFNlY3Rpb25OZXh0UHRyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGFzc2VydChvICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBvICE9IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgby5zZXRTZWN0aW9uTmV4dChjdXJyZW50RWRnZS5nZXRTZWN0aW9uTmV4dCgpKTtcblxuICAgICAgICAgICAgICAgIHZhciBsYXJnZXIgPSBibG9ja2VyWDE7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgxIDwgYmxvY2tlclgxKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhcmdlciA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnNlY3Rpb25YMTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDIgPSBnZXRTbWFsbGVyRW5kcG9pbnQobmV3U2VjdGlvblgxLCBsYXJnZXIpO1xuXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2V0U2VjdGlvbk5leHQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7IC8vVGhpcyBzZWVtcyBvZGRcbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgyID0gZ2V0U21hbGxlckVuZHBvaW50KG5ld1NlY3Rpb25YMSwgYmxvY2tlclgxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KGN1cnJlbnRFZGdlLnNlY3Rpb25YMSA8IGN1cnJlbnRFZGdlLnNlY3Rpb25YMixcbiAgICAgICAgICAgICAgICAnRXhwZWN0ZWQgc2VjdGlvblgxIDwgc2VjdGlvblgyIGJ1dCAnICsgY3VycmVudEVkZ2Uuc2VjdGlvblgxICtcbiAgICAgICAgICAgICAgICAnIGlzIG5vdCA8ICcgKyBjdXJyZW50RWRnZS5zZWN0aW9uWDIpO1xuXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0UHRyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgRkFJTEVEJyk7XG4gICAgd2hpbGUgKHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdICE9PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgbmV3U2VjdGlvblgxID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgxO1xuICAgICAgICBuZXdTZWN0aW9uWDIgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDI7XG5cbiAgICAgICAgaWYgKG5ld1NlY3Rpb25YMiA8IGJsb2NrZXJYMSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDFcbiAgICAgICAgICAgIC8vSWYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgaXMgY29tcGxldGVseSB0byB0aGUgbGVmdCAob3IgYWJvdmUpIHRoaXMuc2VjdGlvbkJsb2NrZXJcbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uZ2V0U2VjdGlvbk5leHRQdHIoKTtcblxuICAgICAgICAgICAgYXNzZXJ0KHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIGlmIChibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSA2XG4gICAgICAgICAgICAvL0lmIHRoaXMuc2VjdGlvbkJsb2NrZXIgaXMgY29tcGxldGVseSB0byB0aGUgcmlnaHQgKG9yIGJlbG93KSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3U2VjdGlvblgxIDwgYmxvY2tlclgxICYmIGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMikgeyAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgM1xuICAgICAgICAgICAgLy9JZiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCBzdGFydHMgYmVmb3JlIGFuZCBlbmRzIGFmdGVyIHRoaXMuc2VjdGlvbkJsb2NrZXJcbiAgICAgICAgICAgIHZhciB4ID0gYmxvY2tlclgxO1xuICAgICAgICAgICAgZSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLmdldFNlY3Rpb25Eb3duKCk7XG5cbiAgICAgICAgICAgIGZvciAoOyA7KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwgfHwgeCA8IGUuc2VjdGlvblgxKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoeCA8PSBlLnNlY3Rpb25YMikge1xuICAgICAgICAgICAgICAgICAgICB4ID0gZS5zZWN0aW9uWDIgKyAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2tlclgyIDwgeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLmdldFNlY3Rpb25Eb3duUHRyKCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIGxlYXZlcyB0aGUgcmVndWxhciBwYXJ0aWFsIG92ZXJsYXAgcG9zc2liaWxpdHkuXG4gICAgICAgIC8vIFRoZXkgYWxzbyBpbmNsdWRlIHRoaXMuc2VjdGlvbkJsb2NrZXIgc3RhcnRpbmcgYmVmb3JlIGFuZCBlbmRpbmcgYWZ0ZXIgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQuXG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbk5leHQoKSA9PT0gbnVsbCAmJlxuICAgICAgICAodGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uRG93bigpID09PSBudWxsIHx8XG4gICAgICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbkRvd24oKS5zdGFydHBvaW50ID09PSBudWxsKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uTmV4dCgpID09PSBudWxsICYmJyArXG4gICAgICAgICd0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25Eb3duKCkgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNldFNlY3Rpb25OZXh0KHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdKTtcblxuICAgIC8vIFNldCBhbnl0aGluZyBwb2ludGluZyB0byB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCB0byBwb2ludCB0byB0aGlzLnNlY3Rpb25CbG9ja2VyIChlZywgc2VjdGlvbkRvd24pXG4gICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSB0aGlzLnNlY3Rpb25CbG9ja2VyO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBudWxsO1xuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbkdldEJsb2NrZWRFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25CbG9ja2VyICE9PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5zZWN0aW9uR2V0QmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwgJiYgJyArXG4gICAgICAgICd0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXTtcbn07XG5cbi8vLS0tLUJyYWNrZXRcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYnJhY2tldElzQ2xvc2luZyA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsICdBUkVkZ2VMaXN0Ll9icmFja2V0SXNDbG9zaW5nOiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc0Nsb3Npbmc6ICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0ID0gZWRnZS5zdGFydHBvaW50LFxuICAgICAgICBlbmQgPSBlZGdlLmVuZHBvaW50O1xuXG4gICAgaWYgKGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSB8fCBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pc2hvcml6b250YWwgP1xuICAgICAgICAoZWRnZS5zdGFydHBvaW50UHJldi55IDwgc3RhcnQueSAmJiBlZGdlLmVuZHBvaW50TmV4dC55IDwgZW5kLnkgKSA6XG4gICAgICAgIChlZGdlLnN0YXJ0cG9pbnRQcmV2LnggPCBzdGFydC54ICYmIGVkZ2UuZW5kcG9pbnROZXh0LnggPCBlbmQueCApO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYnJhY2tldElzT3BlbmluZyA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsICdBUkVkZ2VMaXN0Ll9icmFja2V0SXNPcGVuaW5nOiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc09wZW5pbmc6ICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0ID0gZWRnZS5zdGFydHBvaW50IHx8IGVkZ2Uuc3RhcnRwb2ludCxcbiAgICAgICAgZW5kID0gZWRnZS5lbmRwb2ludCB8fCBlZGdlLmVuZHBvaW50LFxuICAgICAgICBwcmV2LFxuICAgICAgICBuZXh0O1xuXG4gICAgaWYgKGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSB8fCBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBuZXh0ID0gZWRnZS5lbmRwb2ludE5leHQgfHwgZWRnZS5lbmRwb2ludE5leHQ7XG4gICAgcHJldiA9IGVkZ2Uuc3RhcnRwb2ludFByZXYgfHwgZWRnZS5zdGFydHBvaW50UHJldjtcblxuICAgIHJldHVybiB0aGlzLmlzaG9yaXpvbnRhbCA/XG4gICAgICAgIChwcmV2LnkgPiBzdGFydC55ICYmIG5leHQueSA+IGVuZC55ICkgOlxuICAgICAgICAocHJldi54ID4gc3RhcnQueCAmJiBuZXh0LnggPiBlbmQueCApO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQgPSBmdW5jdGlvbiAoZWRnZSwgbmV4dCkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIG5leHQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZDogZWRnZSAhPT0gbnVsbCAmJiBuZXh0ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIGV4ID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsWChlZGdlKSxcbiAgICAgICAgZXgxID0gZXhbMF0sXG4gICAgICAgIGV4MiA9IGV4WzFdLFxuICAgICAgICBlbyA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbE8oZWRnZSksXG4gICAgICAgIGVvMSA9IGVvWzBdLFxuICAgICAgICBlbzIgPSBlb1sxXSxcbiAgICAgICAgbnggPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxYKG5leHQpLFxuICAgICAgICBueDEgPSBueFswXSxcbiAgICAgICAgbngyID0gbnhbMV0sXG4gICAgICAgIG5vID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsTyhuZXh0KSxcbiAgICAgICAgbm8xID0gbm9bMF0sXG4gICAgICAgIG5vMiA9IG5vWzFdO1xuXG4gICAgdmFyIGMxLCBjMjtcblxuICAgIGlmICgobngxIDwgZXgxICYmIGV4MSA8IG54MiAmJiBlbzEgPiAwICkgfHwgKGV4MSA8IG54MSAmJiBueDEgPCBleDIgJiYgbm8xIDwgMCkpIHtcbiAgICAgICAgYzEgPSArMTtcbiAgICB9IGVsc2UgaWYgKGV4MSA9PT0gbngxICYmIGVvMSA9PT0gMCAmJiBubzEgPT09IDApIHtcbiAgICAgICAgYzEgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGMxID0gLTk7XG4gICAgfVxuXG4gICAgaWYgKChueDEgPCBleDIgJiYgZXgyIDwgbngyICYmIGVvMiA+IDAgKSB8fCAoZXgxIDwgbngyICYmIG54MiA8IGV4MiAmJiBubzIgPCAwKSkge1xuICAgICAgICBjMiA9ICsxO1xuICAgIH0gZWxzZSBpZiAoZXgyID09PSBueDIgJiYgZW8yID09PSAwICYmIG5vMiA9PT0gMCkge1xuICAgICAgICBjMiA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYzIgPSAtOTtcbiAgICB9XG5cbiAgICByZXR1cm4gKGMxICsgYzIpID4gMDtcbn07XG5cbi8vLS0tQmxvY2tcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tHZXRGID0gZnVuY3Rpb24gKGQsIGIsIHMpIHtcbiAgICB2YXIgZiA9IGQgLyAoYiArIHMpLCAvL2YgaXMgdGhlIHRvdGFsIGRpc3RhbmNlIGJldHdlZW4gZWRnZXMgZGl2aWRlZCBieSB0aGUgdG90YWwgbnVtYmVyIG9mIGVkZ2VzXG4gICAgICAgIFMgPSBDT05TVEFOVFMuRURMU19TLCAvL1RoaXMgaXMgJ1NNQUxMR0FQJ1xuICAgICAgICBSID0gQ09OU1RBTlRTLkVETFNfUiwvL1RoaXMgaXMgJ1NNQUxMR0FQICsgMSdcbiAgICAgICAgRCA9IENPTlNUQU5UUy5FRExTX0Q7IC8vVGhpcyBpcyB0aGUgdG90YWwgZGlzdGFuY2Ugb2YgdGhlIGdyYXBoXG5cbiAgICAvL0lmIGYgaXMgZ3JlYXRlciB0aGFuIHRoZSBTTUFMTEdBUCwgdGhlbiBtYWtlIHNvbWUgY2hlY2tzL2VkaXRzXG4gICAgaWYgKGIgPT09IDAgJiYgUiA8PSBmKSB7XG4gICAgICAgIC8vIElmIGV2ZXJ5IGNvbXBhcmlzb24gcmVzdWx0ZWQgaW4gYW4gb3ZlcmxhcCBBTkQgU01BTExHQVAgKyAxIGlzIGxlc3MgdGhhblxuICAgICAgICAvLyB0aGUgZGlzdGFuY2UgYmV0d2VlbiBlYWNoIGVkZ2UgKGluIHRoZSBnaXZlbiByYW5nZSkuXG4gICAgICAgIGYgKz0gKEQgLSBSKTtcbiAgICB9IGVsc2UgaWYgKFMgPCBmICYmIHMgPiAwKSB7XG4gICAgICAgIGYgPSAoKEQgLSBTKSAqIGQgLSBTICogKEQgLSBSKSAqIHMpIC8gKChEIC0gUykgKiBiICsgKFIgLSBTKSAqIHMpO1xuICAgIH1cblxuICAgIHJldHVybiBmO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tHZXRHID0gZnVuY3Rpb24gKGQsIGIsIHMpIHtcbiAgICB2YXIgZyA9IGQgLyAoYiArIHMpLFxuICAgICAgICBTID0gQ09OU1RBTlRTLkVETFNfUyxcbiAgICAgICAgUiA9IENPTlNUQU5UUy5FRExTX1IsXG4gICAgICAgIEQgPSBDT05TVEFOVFMuRURMU19EO1xuXG4gICAgaWYgKFMgPCBnICYmIGIgPiAwKSB7XG4gICAgICAgIGcgPSAoKFIgLSBTKSAqIGQgKyBTICogKEQgLSBSKSAqIGIpIC8gKChEIC0gUykgKiBiICsgKFIgLSBTKSAqIHMpO1xuICAgIH1cblxuICAgIHJldHVybiBnO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tQdXNoQmFja3dhcmQgPSBmdW5jdGlvbiAoYmxvY2tlZCwgYmxvY2tlcikge1xuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBibG9ja2VkICE9PSBudWxsICYmIGJsb2NrZXIgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJsb2NrZWQucG9zaXRpb25ZIDw9IGJsb2NrZXIucG9zaXRpb25ZLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGJsb2NrZWQucG9zaXRpb25ZIDw9IGJsb2NrZXIucG9zaXRpb25ZIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLmdldEJsb2NrUHJldigpICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGJsb2NrZWQuZ2V0QmxvY2tQcmV2KCkgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZiA9IDAsXG4gICAgICAgIGcgPSAwLFxuICAgICAgICBlZGdlID0gYmxvY2tlZCxcbiAgICAgICAgdHJhY2UgPSBibG9ja2VyLFxuICAgICAgICBkID0gdHJhY2UucG9zaXRpb25ZIC0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICBhc3NlcnQoZCA+PSAwLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGQgPj0gMCBGQUlMRUQnKTtcblxuICAgIHZhciBzID0gKGVkZ2UuYnJhY2tldE9wZW5pbmcgfHwgdHJhY2UuYnJhY2tldENsb3NpbmcpLFxuICAgICAgICBiID0gMSAtIHMsXG4gICAgICAgIGQyO1xuXG4gICAgZm9yICg7IDspIHtcbiAgICAgICAgZWRnZS5zZXRCbG9ja1RyYWNlKHRyYWNlKTtcbiAgICAgICAgdHJhY2UgPSBlZGdlO1xuICAgICAgICBlZGdlID0gZWRnZS5nZXRCbG9ja1ByZXYoKTtcblxuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkMiA9IHRyYWNlLnBvc2l0aW9uWSAtIGVkZ2UucG9zaXRpb25ZO1xuICAgICAgICBhc3NlcnQoZDIgPj0gMCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogIGQyID49IDAgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGVkZ2UuYnJhY2tldE9wZW5pbmcgfHwgdHJhY2UuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZykge1xuICAgICAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGYpIHtcbiAgICAgICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYisrO1xuICAgICAgICB9XG5cbiAgICAgICAgZCArPSBkMjtcbiAgICB9XG5cbiAgICBpZiAoYiArIHMgPiAxKSB7XG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2VydChVdGlscy5mbG9hdEVxdWFscyhkLCBmICogYiArIGcgKiBzKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZmxvYXRFcXVhbHMoZCwgZipiICsgZypzKSBGQUlMRUQnKTtcblxuICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2UgIT09IGJsb2NrZWQsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGVkZ2UgIT09IG51bGwgJiYgZWRnZSAhPT0gYmxvY2tlZCBGQUlMRUQnKTtcblxuICAgICAgICB2YXIgeSA9IGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZWRnZSAhPT0gbnVsbCAmJiBlZGdlLmdldEJsb2NrVHJhY2UoKSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgdHJhY2UgPSBlZGdlLmdldEJsb2NrVHJhY2UoKTtcblxuICAgICAgICAgICAgeSArPSAoZWRnZS5icmFja2V0T3BlbmluZyB8fCB0cmFjZS5icmFja2V0Q2xvc2luZykgPyBnIDogZjtcbiAgICAgICAgICAgIHkgPSBVdGlscy5yb3VuZFRydW5jKHksIDEwKTsgIC8vIEZpeCBhbnkgZmxvYXRpbmcgcG9pbnQgZXJyb3JzXG5cbiAgICAgICAgICAgIGlmICh5ICsgMC4wMDEgPCB0cmFjZS5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKHRyYWNlLCB5KSkge1xuICAgICAgICAgICAgICAgICAgICB0cmFjZS5zZXRCbG9ja1ByZXYobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIH0gd2hpbGUgKGVkZ2UgIT09IGJsb2NrZWQpO1xuXG4gICAgICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgICAgIC8veSArPSAoZWRnZS5icmFja2V0T3BlbmluZyB8fCBibG9ja2VyLmJyYWNrZXRDbG9zaW5nKSA/IGcgOiBmO1xuICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmZsb2F0RXF1YWxzKHksIGJsb2NrZXIucG9zaXRpb25ZKSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGZsb2F0RXF1YWxzKHksIGJsb2NrZXIucG9zaXRpb25ZKSBGQUlMRUQnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2Jsb2NrUHVzaEZvcndhcmQgPSBmdW5jdGlvbiAoYmxvY2tlZCwgYmxvY2tlcikge1xuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5wb3NpdGlvblkgPj0gYmxvY2tlci5wb3NpdGlvblksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBibG9ja2VkLnBvc2l0aW9uWSA+PSBibG9ja2VyLnBvc2l0aW9uWSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5nZXRCbG9ja05leHQoKSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQuZ2V0QmxvY2tOZXh0KCkgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZiA9IDAsXG4gICAgICAgIGcgPSAwLFxuICAgICAgICBlZGdlID0gYmxvY2tlZCxcbiAgICAgICAgdHJhY2UgPSBibG9ja2VyLFxuICAgICAgICBkID0gZWRnZS5wb3NpdGlvblkgLSB0cmFjZS5wb3NpdGlvblk7XG5cbiAgICBhc3NlcnQoZCA+PSAwLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogIGQgPj0gMCBGQUlMRUQnKTtcblxuICAgIHZhciBzID0gKHRyYWNlLmJyYWNrZXRPcGVuaW5nIHx8IGVkZ2UuYnJhY2tldENsb3NpbmcpLFxuICAgICAgICBiID0gMSAtIHMsXG4gICAgICAgIGQyO1xuXG4gICAgZm9yICg7IDspIHtcbiAgICAgICAgZWRnZS5zZXRCbG9ja1RyYWNlKHRyYWNlKTtcbiAgICAgICAgdHJhY2UgPSBlZGdlO1xuICAgICAgICBlZGdlID0gZWRnZS5nZXRCbG9ja05leHQoKTtcblxuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkMiA9IGVkZ2UucG9zaXRpb25ZIC0gdHJhY2UucG9zaXRpb25ZO1xuICAgICAgICBhc3NlcnQoZDIgPj0gMCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBkMiA+PSAwIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmICh0cmFjZS5icmFja2V0T3BlbmluZyB8fCBlZGdlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGcpIHtcbiAgICAgICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgIGlmIChkMiA8PSBmKSB7XG4gICAgICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGQgKz0gZDI7XG4gICAgfVxuXG4gICAgaWYgKGIgKyBzID4gMSkgeyAvL0xvb2tpbmcgYXQgbW9yZSB0aGFuIG9uZSBlZGdlIChvciBlZGdlL3RyYWNlIGNvbXBhcmlzb24pIHtcbiAgICAgICAgaWYgKGVkZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmZsb2F0RXF1YWxzKGQsIGYgKiBiICsgZyAqIHMpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGZsb2F0RXF1YWxzKGQsIGYqYiArIGcqcykgRkFJTEVEJyk7XG5cbiAgICAgICAgZWRnZSA9IHRyYWNlO1xuICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5lcXVhbHMoYmxvY2tlZCksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogZWRnZSAhPSBudWxsICYmICFlZGdlLmVxdWFscyhibG9ja2VkKSBGQUlMRUQnKTtcblxuICAgICAgICB2YXIgeSA9IGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgdHJhY2UgPSBlZGdlLmdldEJsb2NrVHJhY2UoKTtcblxuICAgICAgICAgICAgeSAtPSAodHJhY2UuYnJhY2tldE9wZW5pbmcgfHwgZWRnZS5icmFja2V0Q2xvc2luZykgPyBnIDogZjtcblxuICAgICAgICAgICAgaWYgKHRyYWNlLnBvc2l0aW9uWSA8IHkgLSAwLjAwMSkge1xuICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyh0cmFjZSwgeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhY2Uuc2V0QmxvY2tOZXh0KG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWRnZSA9IHRyYWNlO1xuICAgICAgICB9IHdoaWxlIChlZGdlICE9PSBibG9ja2VkKTtcbiAgICB9XG5cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYmxvY2tTY2FuRm9yd2FyZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wb3NpdGlvbkFsbExvYWRYKCk7XG5cbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZTtcblxuICAgIHRoaXMuc2VjdGlvblJlc2V0KCk7XG5cbiAgICB2YXIgYmxvY2tlciA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgYmxvY2tlZCxcbiAgICAgICAgYm1pbixcbiAgICAgICAgc21pbixcbiAgICAgICAgYk1pbkYsXG4gICAgICAgIHNNaW5GO1xuXG4gICAgd2hpbGUgKGJsb2NrZXIpIHtcbiAgICAgICAgYm1pbiA9IG51bGw7IC8vYmxvY2sgbWluP1xuICAgICAgICBzbWluID0gbnVsbDsgLy9zZWN0aW9uIG1pbj9cbiAgICAgICAgYk1pbkYgPSBDT05TVEFOVFMuRURfTUlOQ09PUkQgLSAxO1xuICAgICAgICBzTWluRiA9IENPTlNUQU5UUy5FRF9NSU5DT09SRCAtIDE7XG5cbiAgICAgICAgdGhpcy5fc2VjdGlvbkJlZ2luU2NhbihibG9ja2VyKTtcbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZSgpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2VjdGlvbklzSW1tZWRpYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBibG9ja2VkID0gdGhpcy5fc2VjdGlvbkdldEJsb2NrZWRFZGdlKCk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBibG9ja2VkICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJsb2NrZWQuZ2V0QmxvY2tQcmV2KCkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0aGlzLl9ibG9ja1B1c2hCYWNrd2FyZChibG9ja2VkLCBibG9ja2VyKSB8fCBtb2RpZmllZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWJsb2NrZXIuZWRnZUZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChibG9ja2VkLmJyYWNrZXRPcGVuaW5nIHx8IGJsb2NrZXIuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzTWluRiA8IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc01pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluRiA8IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYk1pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJtaW4pIHtcbiAgICAgICAgICAgIGlmIChzbWluKSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0UHJldihzTWluRiA+IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuXG4gICAgICAgICAgICAgICAgYk1pbkYgPSBibG9ja2VyLnBvc2l0aW9uWSAtIGJNaW5GO1xuICAgICAgICAgICAgICAgIHNNaW5GID0gdGhpcy5fYmxvY2tHZXRGKGJsb2NrZXIucG9zaXRpb25ZIC0gc01pbkYsIDAsIDEpO1xuXG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja1ByZXYoc01pbkYgPCBiTWluRiA/IHNtaW4gOiBibWluKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja1ByZXYoYm1pbik7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0UHJldihibWluKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tQcmV2KHNtaW4pO1xuICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0UHJldihzbWluKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgYmxvY2tlciA9IGJsb2NrZXIub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIHRoaXMuX3Bvc2l0aW9uQWxsU3RvcmVZKCk7XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmJsb2NrU2NhbkJhY2t3YXJkID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3Bvc2l0aW9uQWxsTG9hZFgoKTtcblxuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zZWN0aW9uUmVzZXQoKTtcbiAgICB2YXIgYmxvY2tlciA9IHRoaXMub3JkZXJMYXN0LFxuICAgICAgICBibG9ja2VkLFxuICAgICAgICBibWluLFxuICAgICAgICBzbWluLFxuICAgICAgICBiTWluRixcbiAgICAgICAgc01pbkY7XG5cbiAgICB3aGlsZSAoYmxvY2tlcikge1xuICAgICAgICBibWluID0gbnVsbDtcbiAgICAgICAgc21pbiA9IG51bGw7XG4gICAgICAgIGJNaW5GID0gQ09OU1RBTlRTLkVEX01BWENPT1JEICsgMTtcbiAgICAgICAgc01pbkYgPSBDT05TVEFOVFMuRURfTUFYQ09PUkQgKyAxO1xuXG4gICAgICAgIHRoaXMuX3NlY3Rpb25CZWdpblNjYW4oYmxvY2tlcik7XG5cbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZSgpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2VjdGlvbklzSW1tZWRpYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBibG9ja2VkID0gdGhpcy5fc2VjdGlvbkdldEJsb2NrZWRFZGdlKCk7XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTY2FuQmFja3dhcmQ6IGJsb2NrZWQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYmxvY2tlZC5nZXRCbG9ja05leHQoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRoaXMuX2Jsb2NrUHVzaEZvcndhcmQoYmxvY2tlZCwgYmxvY2tlcikgfHwgbW9kaWZpZWQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFibG9ja2VyLmVkZ2VGaXhlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2tlci5icmFja2V0T3BlbmluZyB8fCBibG9ja2VkLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc01pbkYgPiBibG9ja2VkLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNNaW5GID0gYmxvY2tlZC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21pbiA9IGJsb2NrZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbkYgPiBibG9ja2VkLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJNaW5GID0gYmxvY2tlZC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm1pbiA9IGJsb2NrZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYm1pbikge1xuICAgICAgICAgICAgaWYgKHNtaW4pIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3ROZXh0KHNNaW5GIDwgYk1pbkYgPyBzbWluIDogYm1pbik7XG5cbiAgICAgICAgICAgICAgICBiTWluRiA9IGJNaW5GIC0gYmxvY2tlci5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgc01pbkYgPSB0aGlzLl9ibG9ja0dldEYoc01pbkYgLSBibG9ja2VyLnBvc2l0aW9uWSwgMCwgMSk7XG5cbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrTmV4dChzTWluRiA8IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrTmV4dChibWluKTtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3ROZXh0KGJtaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja05leHQoc21pbik7XG4gICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3ROZXh0KHNtaW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgYmxvY2tlciA9IGJsb2NrZXIub3JkZXJQcmV2O1xuICAgIH1cblxuICAgIHRoaXMuX3Bvc2l0aW9uQWxsU3RvcmVZKCk7XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmJsb2NrU3dpdGNoV3JvbmdzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB3YXMgPSBmYWxzZTtcblxuICAgIHRoaXMuX3Bvc2l0aW9uQWxsTG9hZFgoKTtcbiAgICB2YXIgc2Vjb25kID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBlZGdlLFxuICAgICAgICBuZXh0LFxuICAgICAgICBleSxcbiAgICAgICAgbnksXG4gICAgICAgIGE7XG5cbiAgICB3aGlsZSAoc2Vjb25kICE9PSBudWxsKSB7XG4gICAgICAgIC8vQ2hlY2sgaWYgaXQgcmVmZXJlbmNlcyBpdHNlbGZcbiAgICAgICAgaWYgKHNlY29uZC5nZXRDbG9zZXN0UHJldigpICE9PSBudWxsICYmIHNlY29uZC5nZXRDbG9zZXN0UHJldigpLmdldENsb3Nlc3ROZXh0KCkgIT09IChzZWNvbmQpICYmXG4gICAgICAgICAgICBzZWNvbmQuZ2V0Q2xvc2VzdE5leHQoKSAhPT0gbnVsbCAmJiBzZWNvbmQuZ2V0Q2xvc2VzdE5leHQoKS5nZXRDbG9zZXN0UHJldigpID09PSAoc2Vjb25kKSkge1xuXG4gICAgICAgICAgICBhc3NlcnQoIXNlY29uZC5lZGdlRml4ZWQsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6ICFzZWNvbmQuZWRnZUZpeGVkIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBlZGdlID0gc2Vjb25kO1xuICAgICAgICAgICAgbmV4dCA9IGVkZ2UuZ2V0Q2xvc2VzdE5leHQoKTtcblxuICAgICAgICAgICAgd2hpbGUgKG5leHQgIT09IG51bGwgJiYgZWRnZSA9PT0gbmV4dC5nZXRDbG9zZXN0UHJldigpKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuZWRnZUZpeGVkLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogZWRnZSAhPSBudWxsICYmICFlZGdlLmVkZ2VGaXhlZCBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQobmV4dCAhPT0gbnVsbCAmJiAhbmV4dC5lZGdlRml4ZWQsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiBuZXh0ICE9IG51bGwgJiYgIW5leHQuZWRnZUZpeGVkIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgZXkgPSBlZGdlLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBueSA9IG5leHQucG9zaXRpb25ZO1xuXG4gICAgICAgICAgICAgICAgYXNzZXJ0KGV5IDw9IG55LFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogZXkgPD0gbnkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXkgKyAxIDw9IG55ICYmIHRoaXMuX2JyYWNrZXRTaG91bGRCZVN3aXRjaGVkKGVkZ2UsIG5leHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFlZGdlLmdldEVkZ2VDYW5wYXNzZWQoKSAmJiAhbmV4dC5nZXRFZGdlQ2FucGFzc2VkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogIWVkZ2UuZ2V0RWRnZUNhbnBhc3NlZCgpICYmICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJyFuZXh0LmdldEVkZ2VDYW5wYXNzZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRFZGdlQ2FucGFzc2VkKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBuZXh0LnNldEVkZ2VDYW5wYXNzZWQodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKGVkZ2UsIChueSArIGV5KSAvIDIgKyAwLjAwMSkgIT09IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyhuZXh0LCAobnkgKyBleSkgLyAyIC0gMC4wMDEpICE9PSBudWxsIHx8IGE7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdFByZXYobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3ROZXh0KG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0UHJldihudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdE5leHQobnVsbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZWRnZS5nZXRDbG9zZXN0UHJldigpICE9PSBudWxsICYmIGVkZ2UuZ2V0Q2xvc2VzdFByZXYoKS5nZXRDbG9zZXN0TmV4dCgpID09PSBlZGdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLmdldENsb3Nlc3RQcmV2KCkuc2V0Q2xvc2VzdE5leHQobmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobmV4dC5nZXRDbG9zZXN0TmV4dCgpICE9PSBudWxsICYmIG5leHQuZ2V0Q2xvc2VzdE5leHQoKS5nZXRDbG9zZXN0UHJldigpID09PSBuZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LmdldENsb3Nlc3ROZXh0KCkuc2V0Q2xvc2VzdFByZXYoZWRnZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3ROZXh0KG5leHQuZ2V0Q2xvc2VzdE5leHQoKSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdE5leHQoZWRnZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdFByZXYoZWRnZS5nZXRDbG9zZXN0UHJldigpKTtcbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRDbG9zZXN0UHJldihuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBuZXh0LnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCghdGhpcy5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQobmV4dCwgZWRnZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogIWJyYWNrZXRTaG91bGRCZVN3aXRjaGVkKG5leHQsIGVkZ2UpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0LmdldENsb3Nlc3RQcmV2KCkgIT09IG51bGwgJiYgbmV4dC5nZXRDbG9zZXN0UHJldigpLmdldENsb3Nlc3ROZXh0KCkgPT09IG5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSBuZXh0LmdldENsb3Nlc3RQcmV2KCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0ID0gZWRnZS5nZXRDbG9zZXN0TmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZWRnZSA9IG5leHQ7XG4gICAgICAgICAgICAgICAgICAgIG5leHQgPSBuZXh0LmdldENsb3Nlc3ROZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2Vjb25kID0gc2Vjb25kLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBpZiAod2FzKSB7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uQWxsU3RvcmVZKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdhcztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYXNzZXJ0VmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gQ2hlY2sgdGhhdCBhbGwgZWRnZXMgaGF2ZSBzdGFydC9lbmQgcG9pbnRzXG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ICE9PSB1bmRlZmluZWQsICdFZGdlIGhhcyB1bnJlY29nbml6ZWQgc3RhcnRwb2ludDogJyArIGVkZ2Uuc3RhcnRwb2ludCk7XG4gICAgICAgIGFzc2VydChlZGdlLmVuZHBvaW50LnggIT09IHVuZGVmaW5lZCwgJ0VkZ2UgaGFzIHVucmVjb2duaXplZCBlbmRwb2ludDogJyArIGVkZ2UuZW5kcG9pbnQpO1xuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyRWRnZUxpc3Q7XG4iLCIvKmdsb2JhbHMgZGVmaW5lLCBXZWJHTUVHbG9iYWwqL1xuLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksICAvLyBGSVhNRVxuICAgIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJQb2ludExpc3RQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50TGlzdCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXV0b1JvdXRlclBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUGF0aCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKSxcbiAgICBBdXRvUm91dGVyQm94ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkJveCcpLFxuICAgIEF1dG9Sb3V0ZXJFZGdlID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkVkZ2UnKSxcbiAgICBBdXRvUm91dGVyRWRnZUxpc3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuRWRnZUxpc3QnKTtcblxudmFyIF9sb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdXRvUm91dGVyLkdyYXBoJyksXG4gICAgQ09VTlRFUiA9IDE7ICAvLyBVc2VkIGZvciB1bmlxdWUgaWRzXG5cbnZhciBBdXRvUm91dGVyR3JhcGggPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jb21wbGV0ZWx5Q29ubmVjdGVkID0gdHJ1ZTsgIC8vIHRydWUgaWYgYWxsIHBhdGhzIGFyZSBjb25uZWN0ZWRcbiAgICB0aGlzLmhvcml6b250YWwgPSBuZXcgQXV0b1JvdXRlckVkZ2VMaXN0KHRydWUpO1xuICAgIHRoaXMudmVydGljYWwgPSBuZXcgQXV0b1JvdXRlckVkZ2VMaXN0KGZhbHNlKTtcbiAgICB0aGlzLmJveGVzID0ge307XG4gICAgdGhpcy5wYXRocyA9IFtdO1xuICAgIHRoaXMuYnVmZmVyQm94ZXMgPSBbXTtcbiAgICB0aGlzLmJveDJidWZmZXJCb3ggPSB7fTsgLy8gbWFwcyBib3hJZCB0byBjb3JyZXNwb25kaW5nIGJ1ZmZlcmJveCBvYmplY3RcblxuICAgIHRoaXMuaG9yaXpvbnRhbC5vd25lciA9IHRoaXM7XG4gICAgdGhpcy52ZXJ0aWNhbC5vd25lciA9IHRoaXM7XG5cbiAgICAvL0luaXRpYWxpemluZyBzZWxmUG9pbnRzXG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW1xuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NSU5DT09SRCksXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NQVhDT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSxcbiAgICAgICAgbmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUFYQ09PUkQpLFxuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRClcbiAgICBdO1xuXG4gICAgdGhpcy5fYWRkU2VsZkVkZ2VzKCk7XG59O1xuXG4vL0Z1bmN0aW9uc1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQWxsQm94ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAodmFyIGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuYm94ZXNbaWRzW2ldXS5kZXN0cm95KCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmJveGVzW2lkc1tpXV07XG4gICAgfVxuICAgIC8vIENsZWFuIHVwIHRoZSBidWZmZXJCb3hlc1xuICAgIHRoaXMuYnVmZmVyQm94ZXMgPSBbXTtcbiAgICB0aGlzLmJveDJidWZmZXJCb3ggPSB7fTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldEJveEF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKTtcbiAgICBmb3IgKHZhciBpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5ib3hlc1tpZHNbaV1dLmlzQm94QXQocG9pbnQsIG5lYXJuZXNzKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYm94ZXNbaWRzW2ldXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fc2V0UG9ydEF0dHIgPSBmdW5jdGlvbiAocG9ydCwgYXR0cikge1xuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0Zyb20ocG9ydCk7XG4gICAgcG9ydC5hdHRyaWJ1dGVzID0gYXR0cjtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzUmVjdENsaXBCb3hlcyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIGJveFJlY3Q7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAodmFyIGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGJveFJlY3QgPSB0aGlzLmJveGVzW2lkc1tpXV0ucmVjdDtcbiAgICAgICAgaWYgKFV0aWxzLmlzUmVjdENsaXAocmVjdCwgYm94UmVjdCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzUmVjdENsaXBCdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIGkgPSB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCxcbiAgICAgICAgYztcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgYyA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChjLS0pIHtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1JlY3RDbGlwKHJlY3QsIHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW5bY10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9pc0xpbmVDbGlwQnVmZmVyQm94ZXMgPSBmdW5jdGlvbiAocDEsIHAyKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KHAxLCBwMik7XG4gICAgcmVjdC5ub3JtYWxpemVSZWN0KCk7XG4gICAgYXNzZXJ0KHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IsXG4gICAgICAgICdBUkdyYXBoLnRoaXMuX2lzTGluZUNsaXBCb3hlczogcmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vciBGQUlMRUQnKTtcblxuICAgIGlmIChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmVjdC5yaWdodCsrO1xuICAgIH1cbiAgICBpZiAocmVjdC5jZWlsID09PSByZWN0LmZsb29yKSB7XG4gICAgICAgIHJlY3QuZmxvb3IrKztcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faXNSZWN0Q2xpcEJ1ZmZlckJveGVzKHJlY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNMaW5lQ2xpcEJveGVzID0gZnVuY3Rpb24gKHAxLCBwMikge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChwMSwgcDIpO1xuICAgIHJlY3Qubm9ybWFsaXplUmVjdCgpO1xuICAgIGFzc2VydChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQgfHwgcmVjdC5jZWlsID09PSByZWN0LmZsb29yLFxuICAgICAgICAnQVJHcmFwaC5pc0xpbmVDbGlwQm94ZXM6IHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IgRkFJTEVEJyk7XG5cbiAgICBpZiAocmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0KSB7XG4gICAgICAgIHJlY3QucmlnaHQrKztcbiAgICB9XG4gICAgaWYgKHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vcikge1xuICAgICAgICByZWN0LmZsb29yKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2lzUmVjdENsaXBCb3hlcyhyZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NhbkJveEF0ID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICByZXR1cm4gIXRoaXMuX2lzUmVjdENsaXBCb3hlcy5pbmZsYXRlZFJlY3QocmVjdCwgMSk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5hZGQ6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmhhc093bmVyKCksICdBUkdyYXBoLmFkZDogIXBhdGguaGFzT3duZXIoKSBGQUlMRUQnKTtcblxuICAgIHBhdGgub3duZXIgPSB0aGlzO1xuXG4gICAgdGhpcy5wYXRocy5wdXNoKHBhdGgpO1xuXG4gICAgdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyhwYXRoKTtcbiAgICB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyhwYXRoKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5fYXNzZXJ0VmFsaWRQYXRoKHBhdGgpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQWxsUGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMucGF0aHNbaV0uZGVzdHJveSgpOyAgLy8gUmVtb3ZlIHBvaW50IGZyb20gc3RhcnQvZW5kIHBvcnRcbiAgICB9XG5cbiAgICB0aGlzLnBhdGhzID0gW107XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9oYXNOb1BhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGF0aHMubGVuZ3RoID09PSAwO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0UGF0aENvdW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnBhdGhzLmxlbmd0aDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldExpc3RFZGdlQXQgPSBmdW5jdGlvbiAocG9pbnQsIG5lYXJuZXNzKSB7XG5cbiAgICB2YXIgZWRnZSA9IHRoaXMuaG9yaXpvbnRhbC5nZXRFZGdlQXQocG9pbnQsIG5lYXJuZXNzKTtcbiAgICBpZiAoZWRnZSkge1xuICAgICAgICByZXR1cm4gZWRnZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy52ZXJ0aWNhbC5nZXRFZGdlQXQocG9pbnQsIG5lYXJuZXNzKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldFN1cnJvdW5kUmVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QoMCwgMCwgMCwgMCksXG4gICAgICAgIGk7XG5cbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICByZWN0LnVuaW9uQXNzaWduKHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0KTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICByZWN0LnVuaW9uQXNzaWduKHRoaXMucGF0aHNbaV0uZ2V0U3Vycm91bmRSZWN0KCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZWN0O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0T3V0T2ZCb3ggPSBmdW5jdGlvbiAoZGV0YWlscykge1xuICAgIHZhciBidWZmZXJPYmplY3QgPSB0aGlzLmJveDJidWZmZXJCb3hbZGV0YWlscy5ib3guaWRdLFxuICAgICAgICBjaGlsZHJlbiA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbixcbiAgICAgICAgaSA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbi5sZW5ndGgsXG4gICAgICAgIHBvaW50ID0gZGV0YWlscy5wb2ludCxcbiAgICAgICAgZGlyID0gZGV0YWlscy5kaXIsXG4gICAgICAgIGJveFJlY3QgPSBuZXcgQXJSZWN0KGRldGFpbHMuYm94LnJlY3QpO1xuXG4gICAgYm94UmVjdC5pbmZsYXRlUmVjdChDT05TVEFOVFMuQlVGRkVSKTsgLy9DcmVhdGUgYSBjb3B5IG9mIHRoZSBidWZmZXIgYm94XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmdldE91dE9mQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG5cbiAgICB3aGlsZSAoYm94UmVjdC5wdEluUmVjdChwb2ludCkpIHtcbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgICAgICBwb2ludC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgZGlyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvaW50LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBkaXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLnB0SW5SZWN0KHBvaW50KSkge1xuICAgICAgICAgICAgICAgIGJveFJlY3QgPSBjaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLmxlbmd0aDtcbiAgICB9XG5cbiAgICBhc3NlcnQoIWJveFJlY3QucHRJblJlY3QocG9pbnQpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogIWJveFJlY3QucHRJblJlY3QoIHBvaW50KSBGQUlMRUQnKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dvVG9OZXh0QnVmZmVyQm94ID0gZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICB2YXIgcG9pbnQgPSBhcmdzLnBvaW50LFxuICAgICAgICBlbmQgPSBhcmdzLmVuZCxcbiAgICAgICAgZGlyID0gYXJncy5kaXIsXG4gICAgICAgIGRpcjIgPSBhcmdzLmRpcjIgPT09IHVuZGVmaW5lZCB8fCAhVXRpbHMuaXNSaWdodEFuZ2xlKGFyZ3MuZGlyMikgPyAoZW5kIGluc3RhbmNlb2YgQXJQb2ludCA/XG4gICAgICAgICAgICBVdGlscy5leEdldE1ham9yRGlyKGVuZC5taW51cyhwb2ludCkpIDogQ09OU1RBTlRTLkRpck5vbmUpIDogYXJncy5kaXIyLFxuICAgICAgICBzdG9waGVyZSA9IGFyZ3MuZW5kICE9PSB1bmRlZmluZWQgPyBhcmdzLmVuZCA6XG4gICAgICAgICAgICAoZGlyID09PSAxIHx8IGRpciA9PT0gMiA/IENPTlNUQU5UUy5FRF9NQVhDT09SRCA6IENPTlNUQU5UUy5FRF9NSU5DT09SRCApO1xuXG4gICAgaWYgKGRpcjIgPT09IGRpcikge1xuICAgICAgICBkaXIyID0gVXRpbHMuaXNSaWdodEFuZ2xlKFV0aWxzLmV4R2V0TWlub3JEaXIoZW5kLm1pbnVzKHBvaW50KSkpID9cbiAgICAgICAgICAgIFV0aWxzLmV4R2V0TWlub3JEaXIoZW5kLm1pbnVzKHBvaW50KSkgOiAoZGlyICsgMSkgJSA0O1xuICAgIH1cblxuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0UG9pbnRDb29yZChzdG9waGVyZSwgZGlyKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBckdyYXBoLmdvVG9OZXh0QnVmZmVyQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KFV0aWxzLmdldFBvaW50Q29vcmQocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlLFxuICAgICAgICAnQXJHcmFwaC5nb1RvTmV4dEJ1ZmZlckJveDogVXRpbHMuZ2V0UG9pbnRDb29yZCAocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlIEZBSUxFRCcpO1xuXG4gICAgdmFyIGJveGJ5ID0gbnVsbCxcbiAgICAgICAgaSA9IC0xLFxuICAgICAgICBib3hSZWN0O1xuICAgIC8vanNjczpkaXNhYmxlIG1heGltdW1MaW5lTGVuZ3RoXG4gICAgd2hpbGUgKCsraSA8IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoKSB7XG4gICAgICAgIGJveFJlY3QgPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmJveDtcblxuICAgICAgICBpZiAoIVV0aWxzLmlzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJveFJlY3QsIGRpcikgJiYgLy9BZGQgc3VwcG9ydCBmb3IgZW50ZXJpbmcgdGhlIHBhcmVudCBib3hcbiAgICAgICAgICAgIFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMocG9pbnQsIGJveFJlY3QsIGRpcikgJiYgIC8vIGlmIGl0IHdpbGwgbm90IHB1dCB0aGUgcG9pbnQgaW4gYSBjb3JuZXIgKHJlbGF0aXZlIHRvIGRpcjIpXG4gICAgICAgICAgICBVdGlscy5pc0Nvb3JkSW5EaXJGcm9tKHN0b3BoZXJlLFxuICAgICAgICAgICAgICAgIFV0aWxzLmdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tKHRoaXMuYnVmZmVyQm94ZXNbaV0sIGRpciwgcG9pbnQpLmNvb3JkLCBkaXIpKSB7XG4gICAgICAgICAgICAvL1JldHVybiBleHRyZW1lIChwYXJlbnQgYm94KSBmb3IgdGhpcyBjb21wYXJpc29uXG4gICAgICAgICAgICBzdG9waGVyZSA9IFV0aWxzLmdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tKHRoaXMuYnVmZmVyQm94ZXNbaV0sIGRpciwgcG9pbnQpLmNvb3JkO1xuICAgICAgICAgICAgYm94YnkgPSB0aGlzLmJ1ZmZlckJveGVzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vanNjczplbmFibGUgbWF4aW11bUxpbmVMZW5ndGhcblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICBwb2ludC54ID0gc3RvcGhlcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9pbnQueSA9IHN0b3BoZXJlO1xuICAgIH1cblxuICAgIHJldHVybiBib3hieTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2h1Z0NoaWxkcmVuID0gZnVuY3Rpb24gKGJ1ZmZlck9iamVjdCwgcG9pbnQsIGRpcjEsIGRpcjIsIGV4aXRDb25kaXRpb24pIHtcbiAgICAvLyBUaGlzIG1ldGhvZCBjcmVhdGVzIGEgcGF0aCB0aGF0IGVudGVycyB0aGUgcGFyZW50IGJveCBhbmQgJ2h1Z3MnIHRoZSBjaGlsZHJlbiBib3hlc1xuICAgIC8vIChyZW1haW5zIHdpdGhpbiBvbmUgcGl4ZWwgb2YgdGhlbSkgYW5kIGZvbGxvd3MgdGhlbSBvdXQuXG4gICAgYXNzZXJ0KChkaXIxICsgZGlyMikgJSAyID09PSAxLCAnQVJHcmFwaC5odWdDaGlsZHJlbjogT25lIGFuZCBvbmx5IG9uZSBkaXJlY3Rpb24gbXVzdCBiZSBob3Jpem9udGFsJyk7XG4gICAgdmFyIGNoaWxkcmVuID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLFxuICAgICAgICBwYXJlbnRCb3ggPSBidWZmZXJPYmplY3QuYm94LFxuICAgICAgICBpbml0UG9pbnQgPSBuZXcgQXJQb2ludChwb2ludCksXG4gICAgICAgIGNoaWxkID0gdGhpcy5fZ29Ub05leHRCb3gocG9pbnQsIGRpcjEsIChkaXIxID09PSAxIHx8IGRpcjEgPT09IDIgP1xuICAgICAgICAgICAgQ09OU1RBTlRTLkVEX01BWENPT1JEIDogQ09OU1RBTlRTLkVEX01JTkNPT1JEICksIGNoaWxkcmVuKSxcbiAgICAgICAgZmluYWxQb2ludCxcbiAgICAgICAgZGlyID0gZGlyMixcbiAgICAgICAgbmV4dERpciA9IFV0aWxzLm5leHRDbG9ja3dpc2VEaXIoZGlyMSkgPT09IGRpcjIgPyBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyIDogVXRpbHMucHJldkNsb2Nrd2lzZURpcixcbiAgICAgICAgcG9pbnRzID0gW25ldyBBclBvaW50KHBvaW50KV0sXG4gICAgICAgIGhhc0V4aXQgPSB0cnVlLFxuICAgICAgICBuZXh0Q2hpbGQsXG4gICAgICAgIG9sZDtcblxuICAgIGFzc2VydChjaGlsZCAhPT0gbnVsbCwgJ0FSR3JhcGguaHVnQ2hpbGRyZW46IGNoaWxkICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGV4aXRDb25kaXRpb24gPSBleGl0Q29uZGl0aW9uID09PSB1bmRlZmluZWQgPyBmdW5jdGlvbiAocHQpIHtcbiAgICAgICAgcmV0dXJuICFwYXJlbnRCb3gucHRJblJlY3QocHQpO1xuICAgIH0gOiBleGl0Q29uZGl0aW9uO1xuXG4gICAgX2xvZ2dlci5pbmZvKCdBYm91dCB0byBodWcgY2hpbGQgYm94ZXMgdG8gZmluZCBhIHBhdGgnKTtcbiAgICB3aGlsZSAoaGFzRXhpdCAmJiAhZXhpdENvbmRpdGlvbihwb2ludCwgYnVmZmVyT2JqZWN0KSkge1xuICAgICAgICBvbGQgPSBuZXcgQXJQb2ludChwb2ludCk7XG4gICAgICAgIG5leHRDaGlsZCA9IHRoaXMuX2dvVG9OZXh0Qm94KHBvaW50LCBkaXIsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGNoaWxkLCBkaXIpLCBjaGlsZHJlbik7XG5cbiAgICAgICAgaWYgKCFwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdLmVxdWFscyhvbGQpKSB7XG4gICAgICAgICAgICBwb2ludHMucHVzaChuZXcgQXJQb2ludChvbGQpKTsgLy9UaGUgcG9pbnRzIGFycmF5IHNob3VsZCBub3QgY29udGFpbiB0aGUgbW9zdCByZWNlbnQgcG9pbnQuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dENoaWxkID09PSBudWxsKSB7XG4gICAgICAgICAgICBkaXIgPSBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNDb29yZEluRGlyRnJvbShVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChuZXh0Q2hpbGQsIFV0aWxzLnJldmVyc2VEaXIobmV4dERpcihkaXIpKSksXG4gICAgICAgICAgICAgICAgVXRpbHMuZ2V0UG9pbnRDb29yZChwb2ludCwgVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpKSwgVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpKSkge1xuICAgICAgICAgICAgZGlyID0gbmV4dERpcihkaXIpO1xuICAgICAgICAgICAgY2hpbGQgPSBuZXh0Q2hpbGQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmluYWxQb2ludCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmaW5hbFBvaW50ID0gbmV3IEFyUG9pbnQocG9pbnQpO1xuICAgICAgICB9IGVsc2UgaWYgKCFmaW5hbFBvaW50LmVxdWFscyhvbGQpKSB7XG4gICAgICAgICAgICBoYXNFeGl0ID0gIXBvaW50LmVxdWFscyhmaW5hbFBvaW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb2ludHNbMF0uZXF1YWxzKGluaXRQb2ludCkpIHtcbiAgICAgICAgcG9pbnRzLnNwbGljZSgwLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhc0V4aXQpIHtcbiAgICAgICAgcG9pbnRzID0gbnVsbDtcbiAgICAgICAgcG9pbnQuYXNzaWduKGluaXRQb2ludCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBvaW50cztcblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ29Ub05leHRCb3ggPSBmdW5jdGlvbiAocG9pbnQsIGRpciwgc3RvcDEsIGJveExpc3QpIHtcbiAgICB2YXIgc3RvcGhlcmUgPSBzdG9wMTtcblxuICAgIC8qXG4gICAgIGlmIChzdG9wMiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgIGlmIChzdG9wMiBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgIGJveExpc3QgPSBzdG9wMjtcbiAgICAgfSBlbHNlIHtcbiAgICAgc3RvcGhlcmUgPSBzdG9wMSBpbnN0YW5jZW9mIEFyUG9pbnQgP1xuICAgICBjaG9vc2VJbkRpci5nZXRQb2ludENvb3JkIChzdG9wMSwgZGlyKSwgVXRpbHMuZ2V0UG9pbnRDb29yZCAoc3RvcDIsIGRpciksIFV0aWxzLnJldmVyc2VEaXIgKGRpcikpIDpcbiAgICAgY2hvb3NlSW5EaXIoc3RvcDEsIHN0b3AyLCBVdGlscy5yZXZlcnNlRGlyIChkaXIpKTtcbiAgICAgfVxuXG4gICAgIH1lbHNlICovXG4gICAgaWYgKHN0b3AxIGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBzdG9waGVyZSA9IFV0aWxzLmdldFBvaW50Q29vcmQoc3RvcGhlcmUsIGRpcik7XG4gICAgfVxuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQXJHcmFwaC5nb1RvTmV4dEJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuICAgIGFzc2VydChVdGlscy5nZXRQb2ludENvb3JkKHBvaW50LCBkaXIpICE9PSBzdG9waGVyZSxcbiAgICAgICAgJ0FyR3JhcGguZ29Ub05leHRCb3g6IFV0aWxzLmdldFBvaW50Q29vcmQgKHBvaW50LCBkaXIpICE9PSBzdG9waGVyZSBGQUlMRUQnKTtcblxuICAgIHZhciBib3hieSA9IG51bGwsXG4gICAgICAgIGl0ZXIgPSBib3hMaXN0Lmxlbmd0aCxcbiAgICAgICAgYm94UmVjdDtcblxuICAgIHdoaWxlIChpdGVyLS0pIHtcbiAgICAgICAgYm94UmVjdCA9IGJveExpc3RbaXRlcl07XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJveFJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyKSkgJiZcbiAgICAgICAgICAgIFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMocG9pbnQsIGJveFJlY3QsIGRpcikgJiZcbiAgICAgICAgICAgIFV0aWxzLmlzQ29vcmRJbkRpckZyb20oc3RvcGhlcmUsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJveFJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyKSksIGRpcikpIHtcbiAgICAgICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIpKTtcbiAgICAgICAgICAgIGJveGJ5ID0gYm94TGlzdFtpdGVyXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICBwb2ludC54ID0gc3RvcGhlcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9pbnQueSA9IHN0b3BoZXJlO1xuICAgIH1cblxuICAgIHJldHVybiBib3hieTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldExpbWl0c09mRWRnZSA9IGZ1bmN0aW9uIChzdGFydFB0LCBlbmRQdCwgbWluLCBtYXgpIHtcbiAgICB2YXIgdCxcbiAgICAgICAgc3RhcnQgPSAobmV3IEFyUG9pbnQoc3RhcnRQdCkpLFxuICAgICAgICBlbmQgPSAobmV3IEFyUG9pbnQoZW5kUHQpKSxcbiAgICAgICAgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyksXG4gICAgICAgIGksXG4gICAgICAgIHJlY3Q7XG5cbiAgICBpZiAoc3RhcnQueSA9PT0gZW5kLnkpIHtcbiAgICAgICAgaWYgKHN0YXJ0LnggPiBlbmQueCkge1xuICAgICAgICAgICAgdCA9IHN0YXJ0Lng7XG4gICAgICAgICAgICBzdGFydC54ID0gZW5kLng7XG4gICAgICAgICAgICBlbmQueCA9IHQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICByZWN0ID0gdGhpcy5ib3hlc1tpZHNbaV1dLnJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChzdGFydC54IDwgcmVjdC5yaWdodCAmJiByZWN0LmxlZnQgPD0gZW5kLngpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVjdC5mbG9vciA8PSBzdGFydC55ICYmIHJlY3QuZmxvb3IgPiBtaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgbWluID0gcmVjdC5mbG9vcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlY3QuY2VpbCA+IHN0YXJ0LnkgJiYgcmVjdC5jZWlsIDwgbWF4KSB7XG4gICAgICAgICAgICAgICAgICAgIG1heCA9IHJlY3QuY2VpbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoc3RhcnQueCA9PT0gZW5kLngsICdBUkdyYXBoLnRoaXMuZ2V0TGltaXRzT2ZFZGdlOiBzdGFydC54ID09PSBlbmQueCBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoc3RhcnQueSA+IGVuZC55KSB7XG4gICAgICAgICAgICB0ID0gc3RhcnQueTtcbiAgICAgICAgICAgIHN0YXJ0LnkgPSBlbmQueTtcbiAgICAgICAgICAgIGVuZC55ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHJlY3QgPSB0aGlzLmJveGVzW2lkc1tpXV0ucmVjdDtcblxuICAgICAgICAgICAgaWYgKHN0YXJ0LnkgPCByZWN0LmZsb29yICYmIHJlY3QuY2VpbCA8PSBlbmQueSkge1xuICAgICAgICAgICAgICAgIGlmIChyZWN0LnJpZ2h0IDw9IHN0YXJ0LnggJiYgcmVjdC5yaWdodCA+IG1pbikge1xuICAgICAgICAgICAgICAgICAgICBtaW4gPSByZWN0LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVjdC5sZWZ0ID4gc3RhcnQueCAmJiByZWN0LmxlZnQgPCBtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gcmVjdC5sZWZ0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1heC0tO1xuXG4gICAgcmV0dXJuIHttaW46IG1pbiwgbWF4OiBtYXh9O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgdmFyIHN0YXJ0cG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCksXG4gICAgICAgIGVuZHBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKSxcbiAgICAgICAgc3RhcnRwb2ludCA9IHBhdGguc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQgPSBwYXRoLmVuZHBvaW50O1xuXG4gICAgYXNzZXJ0KHN0YXJ0cG9ydC5oYXNQb2ludChzdGFydHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogc3RhcnRwb3J0Lmhhc1BvaW50KHN0YXJ0cG9pbnQpIEZBSUxFRCcpO1xuICAgIGFzc2VydChlbmRwb3J0Lmhhc1BvaW50KGVuZHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogZW5kcG9ydC5oYXNQb2ludChlbmRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnRSb290ID0gc3RhcnRwb3J0Lm93bmVyLmdldFJvb3RCb3goKSxcbiAgICAgICAgZW5kUm9vdCA9IGVuZHBvcnQub3duZXIuZ2V0Um9vdEJveCgpLFxuICAgICAgICBzdGFydElkID0gc3RhcnRSb290LmlkLFxuICAgICAgICBlbmRJZCA9IGVuZFJvb3QuaWQsXG4gICAgICAgIHN0YXJ0ZGlyID0gc3RhcnRwb3J0LnBvcnRPbldoaWNoRWRnZShzdGFydHBvaW50KSxcbiAgICAgICAgZW5kZGlyID0gZW5kcG9ydC5wb3J0T25XaGljaEVkZ2UoZW5kcG9pbnQpO1xuXG4gICAgaWYgKHN0YXJ0cG9pbnQuZXF1YWxzKGVuZHBvaW50KSkge1xuICAgICAgICBVdGlscy5zdGVwT25lSW5EaXIoc3RhcnRwb2ludCwgVXRpbHMubmV4dENsb2Nrd2lzZURpcihzdGFydGRpcikpO1xuICAgIH1cblxuICAgIGlmICghcGF0aC5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICBwYXRoLmNyZWF0ZUN1c3RvbVBhdGgoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCkgJiYgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJveDJidWZmZXJCb3hbc3RhcnRJZF0gPT09IHRoaXMuYm94MmJ1ZmZlckJveFtlbmRJZF0gJiZcbiAgICAgICAgc3RhcnRkaXIgPT09IFV0aWxzLnJldmVyc2VEaXIoZW5kZGlyKSAmJiBzdGFydFJvb3QgIT09IGVuZFJvb3QpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5fY29ubmVjdFBvaW50c1NoYXJpbmdQYXJlbnRCb3gocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQsIHN0YXJ0ZGlyKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jb25uZWN0UGF0aFdpdGhQb2ludHMocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdFBhdGhXaXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50KSB7XG4gICAgYXNzZXJ0KHN0YXJ0cG9pbnQgaW5zdGFuY2VvZiBBclBvaW50LCAnQVJHcmFwaC5jb25uZWN0OiBzdGFydHBvaW50IGluc3RhbmNlb2YgQXJQb2ludCBGQUlMRUQnKTtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCAmJiBwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5jb25uZWN0OiBwYXRoICE9PSBudWxsICYmIHBhdGgub3duZXIgPT09IHNlbGYgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmNvbm5lY3Q6ICFwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFzdGFydHBvaW50LmVxdWFscyhlbmRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6ICFzdGFydHBvaW50LmVxdWFscyhlbmRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnRQb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKTtcbiAgICBhc3NlcnQoc3RhcnRQb3J0ICE9PSBudWxsLCAnQVJHcmFwaC5jb25uZWN0OiBzdGFydFBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnRkaXIgPSBzdGFydFBvcnQucG9ydE9uV2hpY2hFZGdlKHN0YXJ0cG9pbnQpLFxuICAgICAgICBlbmRQb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCk7XG5cbiAgICBhc3NlcnQoZW5kUG9ydCAhPT0gbnVsbCwgJ0FSR3JhcGguY29ubmVjdDogZW5kUG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICB2YXIgZW5kZGlyID0gZW5kUG9ydC5wb3J0T25XaGljaEVkZ2UoZW5kcG9pbnQpO1xuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoc3RhcnRkaXIpICYmIFV0aWxzLmlzUmlnaHRBbmdsZShlbmRkaXIpLFxuICAgICAgICAnQVJHcmFwaC5jb25uZWN0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKHN0YXJ0ZGlyKSAmJiBVdGlscy5pc1JpZ2h0QW5nbGUgKGVuZGRpcikgRkFJTEVEJyk7XG5cbiAgICAvL0ZpbmQgdGhlIGJ1ZmZlcmJveCBjb250YWluaW5nIHN0YXJ0cG9pbnQsIGVuZHBvaW50XG4gICAgdmFyIHN0YXJ0ID0gbmV3IEFyUG9pbnQoc3RhcnRwb2ludCk7XG4gICAgdGhpcy5fZ2V0T3V0T2ZCb3goe1xuICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgIGRpcjogc3RhcnRkaXIsXG4gICAgICAgIGVuZDogZW5kcG9pbnQsXG4gICAgICAgIGJveDogc3RhcnRQb3J0Lm93bmVyXG4gICAgfSk7XG4gICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMoc3RhcnRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6ICFzdGFydC5lcXVhbHMoc3RhcnRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgZW5kID0gbmV3IEFyUG9pbnQoZW5kcG9pbnQpO1xuICAgIHRoaXMuX2dldE91dE9mQm94KHtcbiAgICAgICAgcG9pbnQ6IGVuZCxcbiAgICAgICAgZGlyOiBlbmRkaXIsXG4gICAgICAgIGVuZDogc3RhcnQsXG4gICAgICAgIGJveDogZW5kUG9ydC5vd25lclxuICAgIH0pO1xuICAgIGFzc2VydCghZW5kLmVxdWFscyhlbmRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6ICFlbmQuZXF1YWxzKGVuZHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBwb2ludHMsXG4gICAgICAgIGlzQXV0b1JvdXRlZCA9IHBhdGguaXNBdXRvUm91dGVkKCk7XG4gICAgaWYgKGlzQXV0b1JvdXRlZCkge1xuICAgICAgICBwb2ludHMgPSB0aGlzLl9jb25uZWN0UG9pbnRzKHN0YXJ0LCBlbmQsIHN0YXJ0ZGlyLCBlbmRkaXIpO1xuICAgIH1cblxuICAgIHBhdGgucG9pbnRzID0gcG9pbnRzO1xuICAgIHBhdGgucG9pbnRzLnVuc2hpZnQoc3RhcnRwb2ludCk7XG4gICAgcGF0aC5wb2ludHMucHVzaChlbmRwb2ludCk7XG5cbiAgICBpZiAoaXNBdXRvUm91dGVkKSB7XG4gICAgICAgIHRoaXMuX3NpbXBsaWZ5UGF0aEN1cnZlcyhwYXRoKTtcbiAgICAgICAgcGF0aC5zaW1wbGlmeVRyaXZpYWxseSgpO1xuICAgICAgICB0aGlzLl9zaW1wbGlmeVBhdGhQb2ludHMocGF0aCk7XG4gICAgICAgIHRoaXMuX2NlbnRlclN0YWlyc0luUGF0aFBvaW50cyhwYXRoLCBzdGFydGRpciwgZW5kZGlyKTtcbiAgICB9XG4gICAgcGF0aC5zZXRTdGF0ZShDT05TVEFOVFMuUGF0aFN0YXRlQ29ubmVjdGVkKTtcblxuICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpICYmIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdFBvaW50c1NoYXJpbmdQYXJlbnRCb3ggPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQsIHN0YXJ0ZGlyKSB7XG4gICAgLy8gQ29ubmVjdCBwb2ludHMgdGhhdCBzaGFyZSBhIHBhcmVudCBib3ggYW5kIGZhY2UgZWFjaCBvdGhlclxuICAgIC8vIFRoZXNlIHdpbGwgbm90IG5lZWQgdGhlIHNpbXBsaWZpY2F0aW9uIGFuZCBjb21wbGljYXRlZCBwYXRoIGZpbmRpbmdcbiAgICB2YXIgc3RhcnQgPSBuZXcgQXJQb2ludChzdGFydHBvaW50KSxcbiAgICAgICAgZHggPSBlbmRwb2ludC54IC0gc3RhcnQueCxcbiAgICAgICAgZHkgPSBlbmRwb2ludC55IC0gc3RhcnQueTtcblxuICAgIHBhdGguZGVsZXRlQWxsKCk7XG5cbiAgICBwYXRoLmFkZFRhaWwoc3RhcnRwb2ludCk7XG4gICAgaWYgKGR4ICE9PSAwICYmIGR5ICE9PSAwKSB7XG4gICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoc3RhcnRkaXIpKSB7XG4gICAgICAgICAgICBzdGFydC54ICs9IGR4IC8gMjtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgc3RhcnQueSArPSBkeTtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnQueSArPSBkeSAvIDI7XG4gICAgICAgICAgICBwYXRoLmFkZFRhaWwobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgICAgIHN0YXJ0LnggKz0gZHg7XG4gICAgICAgICAgICBwYXRoLmFkZFRhaWwobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBwYXRoLmFkZFRhaWwoZW5kcG9pbnQpO1xuXG4gICAgcGF0aC5zZXRTdGF0ZShDT05TVEFOVFMuUGF0aFN0YXRlQ29ubmVjdGVkKTtcblxuICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpICYmIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0UG9pbnRzID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGhpbnRzdGFydGRpciwgaGludGVuZGRpciwgZmxpcHBlZCkge1xuICAgIHZhciByZXQgPSBuZXcgQXJQb2ludExpc3RQYXRoKCksXG4gICAgICAgIHRoZXN0YXJ0ID0gbmV3IEFyUG9pbnQoc3RhcnQpLFxuICAgICAgICBidWZmZXJPYmplY3QsXG4gICAgICAgIGJveCxcbiAgICAgICAgcmVjdCxcbiAgICAgICAgZGlyMSxcbiAgICAgICAgZGlyMixcbiAgICAgICAgb2xkLFxuICAgICAgICBvbGRFbmQsXG4gICAgICAgIHJldDIsXG4gICAgICAgIHB0cyxcbiAgICAgICAgcmV2LFxuICAgICAgICBpLFxuXG4gICAgLy9FeGl0IGNvbmRpdGlvbnNcbiAgICAvL2lmIHRoZXJlIGlzIGEgc3RyYWlnaHQgbGluZSB0byB0aGUgZW5kIHBvaW50XG4gICAgICAgIGZpbmRFeGl0VG9FbmRwb2ludCA9IGZ1bmN0aW9uIChwdCwgYm8pIHtcbiAgICAgICAgICAgIHJldHVybiAocHQueCA9PT0gZW5kLnggfHwgcHQueSA9PT0gZW5kLnkpICYmICFVdGlscy5pc0xpbmVDbGlwUmVjdHMocHQsIGVuZCwgYm8uY2hpbGRyZW4pO1xuICAgICAgICB9LCAgLy9JZiB5b3UgcGFzcyB0aGUgZW5kcG9pbnQsIHlvdSBuZWVkIHRvIGhhdmUgYSB3YXkgb3V0LlxuXG4gICAgLy9leGl0Q29uZGl0aW9uIGlzIHdoZW4geW91IGdldCB0byB0aGUgZGlyMSBzaWRlIG9mIHRoZSBib3ggb3Igd2hlbiB5b3UgcGFzcyBlbmRcbiAgICAgICAgZ2V0VG9EaXIxU2lkZSA9IGZ1bmN0aW9uIChwdCwgYm8pIHtcbiAgICAgICAgICAgIHJldHVybiBVdGlscy5nZXRQb2ludENvb3JkKHB0LCBkaXIxKSA9PT0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm8uYm94LCBkaXIxKSB8fFxuICAgICAgICAgICAgICAgICggVXRpbHMuaXNQb2ludEluRGlyRnJvbShwdCwgZW5kLCBkaXIxKSk7XG4gICAgICAgIH07XG5cblxuICAgIC8vVGhpcyBpcyB3aGVyZSB3ZSBjcmVhdGUgdGhlIG9yaWdpbmFsIHBhdGggdGhhdCB3ZSB3aWxsIGxhdGVyIGFkanVzdFxuICAgIHdoaWxlICghc3RhcnQuZXF1YWxzKGVuZCkpIHtcblxuICAgICAgICBkaXIxID0gVXRpbHMuZXhHZXRNYWpvckRpcihlbmQubWludXMoc3RhcnQpKTtcbiAgICAgICAgZGlyMiA9IFV0aWxzLmV4R2V0TWlub3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSk7XG5cbiAgICAgICAgYXNzZXJ0KGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KGRpcjEgPT09IFV0aWxzLmdldE1ham9yRGlyKGVuZC5taW51cyhzdGFydCkpLFxuICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMSA9PT0gVXRpbHMuZ2V0TWFqb3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSkgRkFJTEVEJyk7XG4gICAgICAgIGFzc2VydChkaXIyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fCBkaXIyID09PSBVdGlscy5nZXRNaW5vckRpcihlbmQubWludXMoc3RhcnQpKSxcbiAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGRpcjIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8ICcgK1xuICAgICAgICAgICAgJ2RpcjIgPT09IFV0aWxzLmdldE1pbm9yRGlyKGVuZC5taW51cyhzdGFydCkpIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChkaXIyID09PSBoaW50c3RhcnRkaXIgJiYgZGlyMiAhPT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgICAgIC8vIGkuZS4gc3RkOjpzd2FwKGRpcjEsIGRpcjIpO1xuICAgICAgICAgICAgZGlyMiA9IGRpcjE7XG4gICAgICAgICAgICBkaXIxID0gaGludHN0YXJ0ZGlyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcblxuICAgICAgICBvbGQgPSBuZXcgQXJQb2ludChzdGFydCk7XG5cbiAgICAgICAgYnVmZmVyT2JqZWN0ID0gdGhpcy5fZ29Ub05leHRCdWZmZXJCb3goe1xuICAgICAgICAgICAgcG9pbnQ6IHN0YXJ0LFxuICAgICAgICAgICAgZGlyOiBkaXIxLFxuICAgICAgICAgICAgZGlyMjogZGlyMixcbiAgICAgICAgICAgIGVuZDogZW5kXG4gICAgICAgIH0pOyAgLy8gTW9kaWZpZWQgZ29Ub05leHRCb3ggKHRoYXQgYWxsb3dzIGVudGVyaW5nIHBhcmVudCBidWZmZXIgYm94ZXMgaGVyZVxuICAgICAgICBib3ggPSBidWZmZXJPYmplY3QgPT09IG51bGwgPyBudWxsIDogYnVmZmVyT2JqZWN0LmJveDtcblxuICAgICAgICAvL0lmIGdvVG9OZXh0Qm94IGRvZXMgbm90IG1vZGlmeSBzdGFydFxuICAgICAgICBpZiAoc3RhcnQuZXF1YWxzKG9sZCkpIHtcblxuICAgICAgICAgICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgcmVjdCA9IGJveCBpbnN0YW5jZW9mIEFyUmVjdCA/IGJveCA6IGJveC5yZWN0O1xuXG4gICAgICAgICAgICBpZiAoZGlyMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgICAgICAgICBkaXIyID0gVXRpbHMubmV4dENsb2Nrd2lzZURpcihkaXIxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KGRpcjEgIT09IGRpcjIgJiYgZGlyMSAhPT0gQ09OU1RBTlRTLkRpck5vbmUgJiYgZGlyMiAhPT0gQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMSAhPT0gZGlyMiAmJiBkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSAmJiBkaXIyICE9PSAnICtcbiAgICAgICAgICAgICAgICAnQ09OU1RBTlRTLkRpck5vbmUgRkFJTEVEJyk7XG4gICAgICAgICAgICBpZiAoYnVmZmVyT2JqZWN0LmJveC5wdEluUmVjdChlbmQpICYmICFidWZmZXJPYmplY3QuYm94LnB0SW5SZWN0KHN0YXJ0KSAmJiBmbGlwcGVkKSB7XG4gICAgICAgICAgICAgICAgLy9VbmZvcnR1bmF0ZWx5LCBpZiBwYXJlbnRib3hlcyBhcmUgYSBwaXhlbCBhcGFydCwgc3RhcnQvZW5kIGNhbiBnZXQgc3R1Y2sgYW5kIG5vdCBjcm9zcyB0aGUgYm9yZGVyXG4gICAgICAgICAgICAgICAgLy9zZXBhcmF0aW5nIHRoZW0uLi4uIFRoaXMgaXMgYSBudWRnZSB0byBnZXQgdGhlbSB0byBjcm9zcyBpdC5cbiAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChidWZmZXJPYmplY3QuYm94LnB0SW5SZWN0KGVuZCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZsaXBwZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdDb3VsZCBub3QgZmluZCBwYXRoIGZyb20nLHN0YXJ0LCd0bycsIGVuZCwnLiBGbGlwcGluZyBzdGFydCBhbmQgZW5kIHBvaW50cycpO1xuICAgICAgICAgICAgICAgICAgICBvbGRFbmQgPSBuZXcgQXJQb2ludChlbmQpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldDIgPSB0aGlzLl9jb25uZWN0UG9pbnRzKGVuZCwgc3RhcnQsIGhpbnRlbmRkaXIsIGRpcjEsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBpID0gcmV0Mi5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChpLS0gPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChyZXQyW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChzdGFydC5lcXVhbHMoZW5kKSwgJ0FyR3JhcGguY29ubmVjdFBvaW50czogc3RhcnQuZXF1YWxzKGVuZCkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIG9sZCA9IENPTlNUQU5UUy5FTVBUWV9QT0lOVDtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQgPSBlbmQgPSBvbGRFbmQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgIC8vSWYgd2UgaGF2ZSBmbGlwcGVkIGFuZCBib3RoIHBvaW50cyBhcmUgaW4gdGhlIHNhbWUgYnVmZmVyYm94XG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIHdpbGwgaHVnY2hpbGRyZW4gdW50aWwgd2UgY2FuIGNvbm5lY3QgYm90aCBwb2ludHMuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGNhbid0LCBmb3JjZSBpdFxuICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihidWZmZXJPYmplY3QsIHN0YXJ0LCBkaXIxLCBkaXIyLCBmaW5kRXhpdFRvRW5kcG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHRzICE9PSBudWxsKSB7ICAvLyBUaGVyZSBpcyBhIHBhdGggZnJvbSBzdGFydCAtPiBlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwdHMubGVuZ3RoKSB7ICAvLyBBZGQgbmV3IHBvaW50cyB0byB0aGUgY3VycmVudCBsaXN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldCA9IHJldC5jb25jYXQocHRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC5hc3NpZ24oZW5kKTsgIC8vIFRoZXNlIHNob3VsZCBub3QgYmUgc2tldyEgRklYTUVcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL0ZvcmNlIHRvIHRoZSBlbmRwb2ludFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIxKSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIxKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIVV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoc3RhcnQuZXF1YWxzKGVuZCkpOyAgLy8gV2UgYXJlIGZvcmNpbmcgb3V0IHNvIHRoZXNlIHNob3VsZCBiZSB0aGUgc2FtZSBub3dcblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCghc3RhcnQuZXF1YWxzKG9sZCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShlbmQsIHJlY3QsIGRpcjIpKSB7XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQoIVV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpLFxuICAgICAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMikgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgYm94ID0gdGhpcy5fZ29Ub05leHRCdWZmZXJCb3goe1xuICAgICAgICAgICAgICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgIGRpcjogZGlyMixcbiAgICAgICAgICAgICAgICAgICAgZGlyMjogZGlyMSxcbiAgICAgICAgICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIHRoaXMgYXNzZXJ0IGZhaWxzIGlmIHR3byBib3hlcyBhcmUgYWRqYWNlbnQsIGFuZCBhIGNvbm5lY3Rpb24gd2FudHMgdG8gZ28gYmV0d2VlblxuICAgICAgICAgICAgICAgIC8vYXNzZXJ0KFV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpLFxuICAgICAgICAgICAgICAgIC8vICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgbm90IHRoZSBiZXN0IGNoZWNrIHdpdGggcGFyZW50IGJveGVzXG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0LmVxdWFscyhvbGQpKSB7IC8vVGhlbiB3ZSBhcmUgaW4gYSBjb3JuZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJveC5jaGlsZHJlbi5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihib3gsIHN0YXJ0LCBkaXIyLCBkaXIxLCBnZXRUb0RpcjFTaWRlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJ1ZmZlck9iamVjdCwgc3RhcnQsIGRpcjEsIGRpcjIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChwdHMgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9BZGQgbmV3IHBvaW50cyB0byB0aGUgY3VycmVudCBsaXN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gcmV0LmNvbmNhdChwdHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vR28gdGhyb3VnaCB0aGUgYmxvY2tpbmcgYm94XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjEpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIxKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhlbmQsIHJlY3QsIGRpcjEpLFxuICAgICAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKGVuZCwgcmVjdCwgZGlyMSkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KCFVdGlscy5pc1BvaW50SW4oZW5kLCByZWN0KSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogIVV0aWxzLmlzUG9pbnRJbihlbmQsIHJlY3QpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgcmV2ID0gMDtcblxuICAgICAgICAgICAgICAgIGlmIChVdGlscy5yZXZlcnNlRGlyKGRpcjIpID09PSBoaW50ZW5kZGlyICYmXG4gICAgICAgICAgICAgICAgICAgIFV0aWxzLmdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tKGJ1ZmZlck9iamVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIyKSwgc3RhcnQpID09PVxuICAgICAgICAgICAgICAgICAgICBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcjIpKSkgeyAvL0FuZCBpZiBwb2ludCBjYW4gZXhpdCB0aGF0IHdheVxuICAgICAgICAgICAgICAgICAgICByZXYgPSAxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGlyMiAhPT0gaGludGVuZGRpcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyh0aGVzdGFydCwgcmVjdCwgZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKHJlY3QuZ2V0VG9wTGVmdCgpLnBsdXMocmVjdC5nZXRCb3R0b21SaWdodCgpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQucGx1cyhlbmQpLCBkaXIyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldiA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgdGhlc3RhcnQsIGRpcjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXYgPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHJldikge1xuICAgICAgICAgICAgICAgICAgICBkaXIyID0gVXRpbHMucmV2ZXJzZURpcihkaXIyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL0lmIHRoZSBib3ggaW4gdGhlIHdheSBoYXMgb25lIGNoaWxkXG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmZlck9iamVjdC5jaGlsZHJlbi5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIGRpcjIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIGRpcjIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMob2xkKSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogIXN0YXJ0LmVxdWFscyhvbGQpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgICAgICAgICBvbGQuYXNzaWduKHN0YXJ0KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNQb2ludEluRGlyRnJvbShlbmQsIHN0YXJ0LCBkaXIxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUG9pbnRJbkRpckZyb20oZW5kLCBzdGFydCwgZGlyMSkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5nZXRQb2ludENvb3JkKHN0YXJ0LCBkaXIxKSAhPT0gVXRpbHMuZ2V0UG9pbnRDb29yZChlbmQsIGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nb1RvTmV4dEJ1ZmZlckJveCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnQ6IHN0YXJ0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcjogZGlyMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmQ6IGVuZFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vSWYgdGhlIGJveCBoYXMgbXVsdGlwbGUgY2hpbGRyZW5cbiAgICAgICAgICAgICAgICAgICAgcHRzID0gdGhpcy5faHVnQ2hpbGRyZW4oYnVmZmVyT2JqZWN0LCBzdGFydCwgZGlyMSwgZGlyMiwgZ2V0VG9EaXIxU2lkZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwdHMgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9BZGQgbmV3IHBvaW50cyB0byB0aGUgY3VycmVudCBsaXN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gcmV0LmNvbmNhdChwdHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vR28gdGhyb3VnaCB0aGUgYmxvY2tpbmcgYm94XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjEpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIxKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhvbGQpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhc3RhcnQuZXF1YWxzKG9sZCkgRkFJTEVEJyk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIHJldC5wdXNoKGVuZCk7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHJldC5hc3NlcnRWYWxpZCgpOyAgLy8gQ2hlY2sgdGhhdCBhbGwgZWRnZXMgYXJlIGhvcml6b250YWwgYXJlIHZlcnRpY2FsXG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RBbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuZGlzY29ubmVjdCh0aGlzLnBhdGhzW2ldKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGlmIChwYXRoLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgdGhpcy5kZWxldGVFZGdlcyhwYXRoKTtcbiAgICB9XG5cbiAgICBwYXRoLmRlbGV0ZUFsbCgpO1xuICAgIHRoaXMuY29tcGxldGVseUNvbm5lY3RlZCA9IGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5wYXRoc1tpXS5pc1BhdGhDbGlwKHJlY3QpKSB7XG4gICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QodGhpcy5wYXRoc1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0UGF0aHNGcm9tID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciBpdGVyID0gdGhpcy5wYXRocy5sZW5ndGgsXG4gICAgICAgIHBhdGgsXG4gICAgICAgIHN0YXJ0cG9ydCxcbiAgICAgICAgZW5kcG9ydDtcblxuICAgIGlmIChvYmogaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94KSB7XG4gICAgICAgIHZhciBib3ggPSBvYmosXG4gICAgICAgICAgICBzdGFydGJveCxcbiAgICAgICAgICAgIGVuZGJveDtcbiAgICAgICAgd2hpbGUgKGl0ZXItLSkge1xuICAgICAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaXRlcl07XG5cbiAgICAgICAgICAgIGFzc2VydChwYXRoLnN0YXJ0cG9ydHMgIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IHN0YXJ0cG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGFzc2VydChwYXRoLnN0YXJ0cG9ydHMubGVuZ3RoID4gMCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogUGF0aCBoYXMgbm8gc3RhcnRwb3J0cycpO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGguZW5kcG9ydHMgIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IGVuZHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBhc3NlcnQocGF0aC5lbmRwb3J0cy5sZW5ndGggPiAwLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBQYXRoIGhhcyBubyBlbmRwb3J0cycpO1xuXG4gICAgICAgICAgICAvLyBDYW4gc2ltcGx5IHNlbGVjdCBhbnkgc3RhcnQvZW5kIHBvcnQgdG8gY2hlY2sgdGhlIG93bmVyXG4gICAgICAgICAgICBzdGFydGJveCA9IHBhdGguc3RhcnRwb3J0c1swXS5vd25lcjtcbiAgICAgICAgICAgIGVuZGJveCA9IHBhdGguZW5kcG9ydHNbMF0ub3duZXI7XG5cbiAgICAgICAgICAgIGFzc2VydChzdGFydGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogc3RhcnRib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBhc3NlcnQoZW5kYm94ICE9PSBudWxsLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBlbmRib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGlmICgoc3RhcnRib3ggPT09IGJveCB8fCBlbmRib3ggPT09IGJveCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QocGF0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7ICAvLyBBc3N1bWluZyAnYm94JyBpcyBhIHBvcnRcblxuICAgICAgICB2YXIgcG9ydCA9IG9iajtcbiAgICAgICAgd2hpbGUgKGl0ZXItLSkge1xuICAgICAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaXRlcl07XG4gICAgICAgICAgICBzdGFydHBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpO1xuICAgICAgICAgICAgZW5kcG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpO1xuXG4gICAgICAgICAgICBpZiAoKHN0YXJ0cG9ydCA9PT0gcG9ydCB8fCBlbmRwb3J0ID09PSBwb3J0KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdChwYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkU2VsZkVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRFZGdlcyh0aGlzKTtcbiAgICB0aGlzLnZlcnRpY2FsLmFkZEVkZ2VzKHRoaXMpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkRWRnZXMgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgYXNzZXJ0KCEob2JqIGluc3RhbmNlb2YgQXV0b1JvdXRlclBhdGgpLCAnTm8gUGF0aHMgc2hvdWxkIGJlIGhlcmUhJyk7XG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJQb3J0KSB7XG4gICAgICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRQb3J0RWRnZXMob2JqKTtcbiAgICAgICAgdGhpcy52ZXJ0aWNhbC5hZGRQb3J0RWRnZXMob2JqKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhvcml6b250YWwuYWRkRWRnZXMob2JqKTtcbiAgICAgICAgdGhpcy52ZXJ0aWNhbC5hZGRFZGdlcyhvYmopO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGVsZXRlRWRnZXMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmRlbGV0ZUVkZ2VzKG9iamVjdCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5kZWxldGVFZGdlcyhvYmplY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkQWxsRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuaG9yaXpvbnRhbC5pc0VtcHR5KCkgJiYgdGhpcy52ZXJ0aWNhbC5pc0VtcHR5KCksXG4gICAgICAgICdBUkdyYXBoLmFkZEFsbEVkZ2VzOiBob3Jpem9udGFsLmlzRW1wdHkoKSAmJiB2ZXJ0aWNhbC5pc0VtcHR5KCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuX2FkZEJveEFuZFBvcnRFZGdlcyh0aGlzLmJveGVzW2lkc1tpXV0pO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXModGhpcy5wYXRoc1tpXSk7XG4gICAgICAgIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHRoaXMucGF0aHNbaV0pO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZUFsbEVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5kZWxldGVBbGxFZGdlcygpO1xuICAgIHRoaXMudmVydGljYWwuZGVsZXRlQWxsRWRnZXMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZEJveEFuZFBvcnRFZGdlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5hZGRCb3hBbmRQb3J0RWRnZXM6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuX2FkZEVkZ2VzKGJveCk7XG5cbiAgICBmb3IgKHZhciBpID0gYm94LnBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9hZGRFZGdlcyhib3gucG9ydHNbaV0pO1xuICAgIH1cblxuICAgIC8vIEFkZCB0byBidWZmZXJib3hlc1xuICAgIHRoaXMuX2FkZFRvQnVmZmVyQm94ZXMoYm94KTtcbiAgICB0aGlzLl91cGRhdGVCb3hQb3J0QXZhaWxhYmlsaXR5KGJveCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlQm94QW5kUG9ydEVkZ2VzOiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLmRlbGV0ZUVkZ2VzKGJveCk7XG5cbiAgICBmb3IgKHZhciBpID0gYm94LnBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmRlbGV0ZUVkZ2VzKGJveC5wb3J0c1tpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVtb3ZlRnJvbUJ1ZmZlckJveGVzKGJveCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRFZGdlTGlzdCA9IGZ1bmN0aW9uIChpc2hvcml6b250YWwpIHtcbiAgICByZXR1cm4gaXNob3Jpem9udGFsID8gdGhpcy5ob3Jpem9udGFsIDogdGhpcy52ZXJ0aWNhbDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NhbmRlbGV0ZVR3b0VkZ2VzQXQgPSBmdW5jdGlvbiAocGF0aCwgcG9pbnRzLCBwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIGFzc2VydChwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgcG9pbnRzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgaWYgKHBvcyArIDIgPj0gcG9pbnRzLmxlbmd0aCB8fCBwb3MgPCAxKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbnBvaW50cG9zID0gcG9zLFxuICAgICAgICBucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubnBvaW50cG9zID0gcG9zO1xuXG4gICAgcG9zID0gcG9pbnRwb3M7XG4gICAgcG9zLS07XG4gICAgdmFyIHBwb2ludHBvcyA9IHBvcztcblxuICAgIHZhciBwcG9pbnQgPSBwb2ludHNbcG9zLS1dLFxuICAgICAgICBwcHBvaW50cG9zID0gcG9zO1xuXG4gICAgaWYgKG5wb2ludC5lcXVhbHMocG9pbnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gZGlyZWN0aW9uIG9mIHplcm8tbGVuZ3RoIGVkZ2VzIGNhbid0IGJlIGRldGVybWluZWQsIHNvIGRvbid0IGRlbGV0ZSB0aGVtXG4gICAgfVxuXG4gICAgYXNzZXJ0KHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmXG4gICAgICAgIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgsXG4gICAgICAgICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYnICtcbiAgICAgICAgJ3BvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgdmFyIGRpciA9IFV0aWxzLmdldERpcihucG9pbnQubWludXMocG9pbnQpKTtcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuICAgIHZhciBpc2hvcml6b250YWwgPSBVdGlscy5pc0hvcml6b250YWwoZGlyKTtcblxuICAgIHZhciBuZXdwb2ludCA9IG5ldyBBclBvaW50KCk7XG5cbiAgICBpZiAoaXNob3Jpem9udGFsKSB7XG4gICAgICAgIG5ld3BvaW50LnggPSBVdGlscy5nZXRQb2ludENvb3JkKG5wb2ludCwgaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdwb2ludC55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgICAgIG5ld3BvaW50LnggPSBVdGlscy5nZXRQb2ludENvb3JkKHBwb2ludCwgIWlzaG9yaXpvbnRhbCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KFV0aWxzLmdldERpcihuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyLFxuICAgICAgICAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5nZXREaXIgKG5ld3BvaW50Lm1pbnVzKHBwb2ludCkpID09PSBkaXIgRkFJTEVEJyk7XG5cbiAgICBpZiAodGhpcy5faXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBucG9pbnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgcHBvaW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVUd29FZGdlc0F0ID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cywgcG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgICAgICBhc3NlcnQocGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgICAgIHBvaW50cy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHZhciBwb2ludHBvcyA9IHBvcywgLy9HZXR0aW5nIHRoZSBuZXh0LCBhbmQgbmV4dC1uZXh0LCBwb2ludHNcbiAgICAgICAgcG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBucG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIG5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ucG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIG5ucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubm5wb2ludHBvcyA9IHBvcztcblxuICAgIHBvcyA9IHBvaW50cG9zO1xuICAgIHBvcy0tO1xuXG4gICAgdmFyIHBwb2ludHBvcyA9IHBvcywgLy9HZXR0aW5nIHRoZSBwcmV2LCBwcmV2LXByZXYgcG9pbnRzXG4gICAgICAgIHBwb2ludCA9IHBvaW50c1twb3MtLV0sXG4gICAgICAgIHBwcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBwcG9pbnQgPSBwb2ludHNbcG9zLS1dO1xuXG4gICAgYXNzZXJ0KHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmXG4gICAgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogcHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8ICcgK1xuICAgICAgICAncG9pbnRzLmxlbmd0aCAmJiBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuICAgIGFzc2VydChwcHBvaW50ICE9PSBudWxsICYmIHBwb2ludCAhPT0gbnVsbCAmJiBwb2ludCAhPT0gbnVsbCAmJiBucG9pbnQgIT09IG51bGwgJiYgbm5wb2ludCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogcHBwb2ludCAhPT0gbnVsbCAmJiBwcG9pbnQgIT09IG51bGwgJiYgcG9pbnQgIT09IG51bGwgJiYgbnBvaW50ICE9PSBudWxsICYmJyArXG4gICAgICAgICcgbm5wb2ludCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBkaXIgPSBVdGlscy5nZXREaXIobnBvaW50Lm1pbnVzKHBvaW50KSk7XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcbiAgICB2YXIgaXNob3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKGRpcik7XG5cbiAgICB2YXIgbmV3cG9pbnQgPSBuZXcgQXJQb2ludCgpO1xuICAgIGlmIChpc2hvcml6b250YWwpIHtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld3BvaW50LnggPSBVdGlscy5nZXRQb2ludENvb3JkKHBwb2ludCwgIWlzaG9yaXpvbnRhbCk7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKG5wb2ludCwgaXNob3Jpem9udGFsKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuZ2V0RGlyKG5ld3BvaW50Lm1pbnVzKHBwb2ludCkpID09PSBkaXIsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IFV0aWxzLmdldERpciAobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpciBGQUlMRUQnKTtcblxuICAgIGFzc2VydCghdGhpcy5faXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBucG9pbnQpLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiAhaXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBucG9pbnQpIEZBSUxFRCcpO1xuICAgIGFzc2VydCghdGhpcy5faXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBwcG9pbnQpLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiAhaXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBwcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGhsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoaXNob3Jpem9udGFsKSxcbiAgICAgICAgdmxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdCghaXNob3Jpem9udGFsKTtcblxuICAgIHZhciBwcGVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwcG9pbnQpLFxuICAgICAgICBwZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBvaW50KSxcbiAgICAgICAgbmVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHBvaW50KSxcbiAgICAgICAgbm5lZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihucG9pbnQpO1xuXG4gICAgYXNzZXJ0KHBwZWRnZSAhPT0gbnVsbCAmJiBwZWRnZSAhPT0gbnVsbCAmJiBuZWRnZSAhPT0gbnVsbCAmJiBubmVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6ICBwcGVkZ2UgIT09IG51bGwgJiYgcGVkZ2UgIT09IG51bGwgJiYgbmVkZ2UgIT09IG51bGwgJiYgbm5lZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmxpc3QucmVtb3ZlKHBlZGdlKTtcbiAgICBobGlzdC5yZW1vdmUobmVkZ2UpO1xuXG4gICAgcG9pbnRzLnNwbGljZShwcG9pbnRwb3MsIDMsIG5ld3BvaW50KTtcbiAgICBwcGVkZ2UuZW5kcG9pbnROZXh0ID0gbm5wb2ludDtcbiAgICBwcGVkZ2UuZW5kcG9pbnQgPSBuZXdwb2ludDtcblxuICAgIG5uZWRnZS5zdGFydHBvaW50ID0gbmV3cG9pbnQ7XG4gICAgbm5lZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcHBwb2ludDtcblxuICAgIGlmIChubm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIG5ubmVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKG5ucG9pbnQsIChubm5wb2ludHBvcykpO1xuICAgICAgICBhc3NlcnQobm5uZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IG5ubmVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgIGFzc2VydChubm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhucG9pbnQpICYmIG5ubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobm5wb2ludCksXG4gICAgICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhucG9pbnQpJyArXG4gICAgICAgICAgICAnJiYgbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSBGQUlMRUQnKTtcbiAgICAgICAgbm5uZWRnZS5zdGFydHBvaW50UHJldiA9IHBwb2ludDtcbiAgICB9XG5cbiAgICBpZiAobm5wb2ludC5lcXVhbHMobmV3cG9pbnQpKSB7XG4gICAgICAgIHRoaXMuX2RlbGV0ZVNhbWVQb2ludHNBdChwYXRoLCBwb2ludHMsIHBwb2ludHBvcyk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVTYW1lUG9pbnRzQXQgPSBmdW5jdGlvbiAocGF0aCwgcG9pbnRzLCBwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICAgICAgYXNzZXJ0KHBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgICAgIHBvaW50cy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHZhciBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBucG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIG5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ucG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIG5ucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubm5wb2ludHBvcyA9IHBvcztcblxuICAgIHBvcyA9IHBvaW50cG9zO1xuICAgIHBvcy0tO1xuXG4gICAgdmFyIHBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcHBvaW50ID0gcG9pbnRzW3Bvcy0tXSxcbiAgICAgICAgcHBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcHBwb2ludCA9IHBvcyA9PT0gcG9pbnRzLmxlbmd0aCA/IG51bGwgOiBwb2ludHNbcG9zLS1dO1xuXG4gICAgYXNzZXJ0KHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiZcbiAgICBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCk7XG4gICAgYXNzZXJ0KHBwb2ludCAhPT0gbnVsbCAmJiBwb2ludCAhPT0gbnVsbCAmJiBucG9pbnQgIT09IG51bGwgJiYgbm5wb2ludCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwcG9pbnQgIT09IG51bGwgJiYgcG9pbnQgIT09IG51bGwgJiYgbnBvaW50ICE9PSBudWxsICYmICcgK1xuICAgICAgICAnbm5wb2ludCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQocG9pbnQuZXF1YWxzKG5wb2ludCkgJiYgIXBvaW50LmVxdWFscyhwcG9pbnQpLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBvaW50LmVxdWFscyhucG9pbnQpICYmICFwb2ludC5lcXVhbHMocHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBkaXIgPSBVdGlscy5nZXREaXIocG9pbnQubWludXMocHBvaW50KSk7XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcblxuICAgIHZhciBpc2hvcml6b250YWwgPSBVdGlscy5pc0hvcml6b250YWwoZGlyKSxcbiAgICAgICAgaGxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChpc2hvcml6b250YWwpLFxuICAgICAgICB2bGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KCFpc2hvcml6b250YWwpLFxuXG4gICAgICAgIHBlZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwcG9pbnQsIHBvaW50KSxcbiAgICAgICAgbmVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBvaW50LCBucG9pbnQpLFxuICAgICAgICBubmVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKG5wb2ludCwgbm5wb2ludCk7XG5cbiAgICBhc3NlcnQocGVkZ2UgIT09IG51bGwgJiYgbmVkZ2UgIT09IG51bGwgJiYgbm5lZGdlICE9PSBudWxsLCAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBlZGdlICE9PSBudWxsICcgK1xuICAgICcmJiBuZWRnZSAhPT0gbnVsbCAmJiBubmVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2bGlzdC5yZW1vdmUocGVkZ2UpO1xuICAgIGhsaXN0LnJlbW92ZShuZWRnZSk7XG5cbiAgICBwb2ludHMuc3BsaWNlKHBvaW50cG9zLCAyKTtcblxuICAgIGlmIChwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgcHBlZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwcHBvaW50LCBwcG9pbnQpO1xuICAgICAgICBhc3NlcnQocHBlZGdlICE9PSBudWxsICYmIHBwZWRnZS5lbmRwb2ludC5lcXVhbHMocHBvaW50KSAmJiBwcGVkZ2UuZW5kcG9pbnROZXh0LmVxdWFscyhwb2ludCksXG4gICAgICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBwZWRnZSAhPT0gbnVsbCAmJiBwcGVkZ2UuZW5kcG9pbnQuZXF1YWxzKHBwb2ludCkgJiYgJyArXG4gICAgICAgICAgICAncHBlZGdlLmVuZHBvaW50TmV4dC5lcXVhbHMocG9pbnQpIEZBSUxFRCcpO1xuICAgICAgICBwcGVkZ2UuZW5kcG9pbnROZXh0ID0gbm5wb2ludDtcbiAgICB9XG5cbiAgICBhc3NlcnQobm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5wb2ludCkgJiYgbm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhwb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogbm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5wb2ludCkgJiYgbm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhwb2ludCknICtcbiAgICAgICAgJyBGQUlMRUQnKTtcbiAgICBubmVkZ2Uuc2V0U3RhcnRQb2ludChwcG9pbnQpO1xuICAgIG5uZWRnZS5zdGFydHBvaW50UHJldiA9IHBwcG9pbnQ7XG5cbiAgICBpZiAobm5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBubm5lZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihubnBvaW50LCAobm5ucG9pbnRwb3MpKTsgLy8mKlxuICAgICAgICBhc3NlcnQobm5uZWRnZSAhPT0gbnVsbCAmJiBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhucG9pbnQpICYmIG5ubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobm5wb2ludCksXG4gICAgICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IG5ubmVkZ2UgIT09IG51bGwgJiYgbm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KSAmJiAnICtcbiAgICAgICAgICAgICdubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpIEZBSUxFRCcpO1xuICAgICAgICBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcHBvaW50O1xuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUdfREVFUCkge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fc2ltcGxpZnlQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZSxcbiAgICAgICAgcGF0aCxcbiAgICAgICAgcG9pbnRMaXN0LFxuICAgICAgICBwb2ludHBvcztcblxuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpXTtcblxuICAgICAgICBpZiAocGF0aC5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICAgICAgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKTtcbiAgICAgICAgICAgIHBvaW50cG9zID0gMDtcblxuICAgICAgICAgICAgbW9kaWZpZWQgPSB0aGlzLl9maXhTaG9ydFBhdGhzKHBhdGgpIHx8IG1vZGlmaWVkO1xuXG4gICAgICAgICAgICB3aGlsZSAocG9pbnRwb3MgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NhbmRlbGV0ZVR3b0VkZ2VzQXQocGF0aCwgcG9pbnRMaXN0LCBwb2ludHBvcykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGVsZXRlVHdvRWRnZXNBdChwYXRoLCBwb2ludExpc3QsIHBvaW50cG9zKTtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcG9pbnRwb3MrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NlbnRlclN0YWlyc0luUGF0aFBvaW50cyA9IGZ1bmN0aW9uIChwYXRoLCBoaW50c3RhcnRkaXIsIGhpbnRlbmRkaXIpIHtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiBwYXRoICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghcGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6ICFwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKTtcbiAgICBhc3NlcnQocG9pbnRMaXN0Lmxlbmd0aCA+PSAyLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6IHBvaW50TGlzdC5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cblxuICAgIHZhciBwMSxcbiAgICAgICAgcDIsXG4gICAgICAgIHAzLFxuICAgICAgICBwNCxcblxuICAgICAgICBwMXAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwMnAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwM3AgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwNHAgPSBwb2ludExpc3QubGVuZ3RoLFxuXG4gICAgICAgIGQxMiA9IENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBkMjMgPSBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgZDM0ID0gQ09OU1RBTlRTLkRpck5vbmUsXG5cbiAgICAgICAgb3V0T2ZCb3hTdGFydFBvaW50ID0gcGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQoaGludHN0YXJ0ZGlyKSxcbiAgICAgICAgb3V0T2ZCb3hFbmRQb2ludCA9IHBhdGguZ2V0T3V0T2ZCb3hFbmRQb2ludChoaW50ZW5kZGlyKSxcblxuICAgICAgICBwb3MgPSAwO1xuICAgIGFzc2VydChwb3MgPCBwb2ludExpc3QubGVuZ3RoLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHMgcG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHAxcCA9IHBvcztcbiAgICBwMSA9IChwb2ludExpc3RbcG9zKytdKTtcblxuICAgIHZhciBucDIsXG4gICAgICAgIG5wMyxcbiAgICAgICAgaCxcbiAgICAgICAgcDR4LFxuICAgICAgICBwM3gsXG4gICAgICAgIHAxeCxcbiAgICAgICAgdG1wLFxuICAgICAgICB0LFxuICAgICAgICBtO1xuXG5cbiAgICB3aGlsZSAocG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICBwNHAgPSBwM3A7XG4gICAgICAgIHAzcCA9IHAycDtcbiAgICAgICAgcDJwID0gcDFwO1xuICAgICAgICBwMXAgPSBwb3M7XG5cbiAgICAgICAgcDQgPSBwMztcbiAgICAgICAgcDMgPSBwMjtcbiAgICAgICAgcDIgPSBwMTtcbiAgICAgICAgcDEgPSAocG9pbnRMaXN0W3BvcysrXSk7XG5cbiAgICAgICAgZDM0ID0gZDIzO1xuICAgICAgICBkMjMgPSBkMTI7XG5cbiAgICAgICAgaWYgKHAycCA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGQxMiA9IFV0aWxzLmdldERpcihwMi5taW51cyhwMSkpO1xuICAgICAgICAgICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZDEyKSwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiAnICtcbiAgICAgICAgICAgICAgICAnVXRpbHMuaXNSaWdodEFuZ2xlIChkMTIpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIGlmIChwM3AgIT09IHBvaW50TGlzdC5lbmQoKSkge1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuYXJlSW5SaWdodEFuZ2xlKGQxMiwgZDIzKSwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1V0aWxzLmFyZUluUmlnaHRBbmdsZSAoZDEyLCBkMjMpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwNHAgPCBwb2ludExpc3QubGVuZ3RoICYmIGQxMiA9PT0gZDM0KSB7XG4gICAgICAgICAgICBhc3NlcnQocDFwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwMnAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAzcCA8IHBvaW50TGlzdC5sZW5ndGggJiZcbiAgICAgICAgICAgIHA0cCA8IHBvaW50TGlzdC5sZW5ndGgsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogcDFwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiAnICtcbiAgICAgICAgICAgICdwMnAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAzcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgbnAyID0gbmV3IEFyUG9pbnQocDIpO1xuICAgICAgICAgICAgbnAzID0gbmV3IEFyUG9pbnQocDMpO1xuICAgICAgICAgICAgaCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkMTIpO1xuXG4gICAgICAgICAgICBwNHggPSBVdGlscy5nZXRQb2ludENvb3JkKHA0LCBoKTtcbiAgICAgICAgICAgIHAzeCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDMsIGgpO1xuICAgICAgICAgICAgcDF4ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwMSwgaCk7XG5cbiAgICAgICAgICAgIC8vIHAxeCB3aWxsIHJlcHJlc2VudCB0aGUgbGFyZ2VyIHggdmFsdWUgaW4gdGhpcyAnc3RlcCcgc2l0dWF0aW9uXG4gICAgICAgICAgICBpZiAocDF4IDwgcDR4KSB7XG4gICAgICAgICAgICAgICAgdCA9IHAxeDtcbiAgICAgICAgICAgICAgICBwMXggPSBwNHg7XG4gICAgICAgICAgICAgICAgcDR4ID0gdDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHA0eCA8IHAzeCAmJiBwM3ggPCBwMXgpIHtcbiAgICAgICAgICAgICAgICBtID0gTWF0aC5yb3VuZCgocDR4ICsgcDF4KSAvIDIpO1xuICAgICAgICAgICAgICAgIGlmIChoKSB7XG4gICAgICAgICAgICAgICAgICAgIG5wMi54ID0gbTtcbiAgICAgICAgICAgICAgICAgICAgbnAzLnggPSBtO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5wMi55ID0gbTtcbiAgICAgICAgICAgICAgICAgICAgbnAzLnkgPSBtO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRtcCA9IHRoaXMuX2dldExpbWl0c09mRWRnZShucDIsIG5wMywgcDR4LCBwMXgpO1xuICAgICAgICAgICAgICAgIHA0eCA9IHRtcC5taW47XG4gICAgICAgICAgICAgICAgcDF4ID0gdG1wLm1heDtcblxuICAgICAgICAgICAgICAgIG0gPSBNYXRoLnJvdW5kKChwNHggKyBwMXgpIC8gMik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaCkge1xuICAgICAgICAgICAgICAgICAgICBucDIueCA9IG07XG4gICAgICAgICAgICAgICAgICAgIG5wMy54ID0gbTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBucDIueSA9IG07XG4gICAgICAgICAgICAgICAgICAgIG5wMy55ID0gbTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhucDIsIG5wMykgJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhwMXAgPT09IHBvaW50TGlzdC5sZW5ndGggP1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0T2ZCb3hFbmRQb2ludCA6IHAxLCBucDIpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDRwID09PSAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgIG91dE9mQm94U3RhcnRQb2ludCA6IHA0LCBucDMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHAyID0gbnAyO1xuICAgICAgICAgICAgICAgICAgICBwMyA9IG5wMztcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwMnAsIDEsIHAyKTtcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwM3AsIDEsIHAzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWRQb2ludHMoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIE1ha2Ugc3VyZSBpZiBhIHN0cmFpZ2h0IGxpbmUgaXMgcG9zc2libGUsIGNyZWF0ZSBhIHN0cmFpZ2h0IGxpbmUgZm9yXG4gKiB0aGUgcGF0aC5cbiAqXG4gKiBAcGFyYW0ge0F1dG9Sb3V0ZXJQYXRofSBwYXRoXG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2ZpeFNob3J0UGF0aHMgPSBmdW5jdGlvbiAocGF0aCkge1xuXG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2UsXG4gICAgICAgIHN0YXJ0cG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCksXG4gICAgICAgIGVuZHBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKSxcbiAgICAgICAgbGVuID0gcGF0aC5nZXRQb2ludExpc3QoKS5sZW5ndGg7XG5cbiAgICBpZiAobGVuID09PSA0KSB7XG4gICAgICAgIHZhciBwb2ludHMgPSBwYXRoLmdldFBvaW50TGlzdCgpLFxuICAgICAgICAgICAgc3RhcnRwb2ludCA9IHBvaW50c1swXSxcbiAgICAgICAgICAgIGVuZHBvaW50ID0gcG9pbnRzW2xlbiAtIDFdLFxuICAgICAgICAgICAgc3RhcnREaXIgPSBzdGFydHBvcnQucG9ydE9uV2hpY2hFZGdlKHN0YXJ0cG9pbnQpLFxuICAgICAgICAgICAgZW5kRGlyID0gZW5kcG9ydC5wb3J0T25XaGljaEVkZ2UoZW5kcG9pbnQpLFxuICAgICAgICAgICAgdHN0U3RhcnQsXG4gICAgICAgICAgICB0c3RFbmQ7XG5cbiAgICAgICAgaWYgKHN0YXJ0RGlyID09PSBVdGlscy5yZXZlcnNlRGlyKGVuZERpcikpIHtcbiAgICAgICAgICAgIHZhciBpc0hvcml6b250YWwgPSBVdGlscy5pc0hvcml6b250YWwoc3RhcnREaXIpLFxuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gbmV3IEFyUG9pbnQoc3RhcnRwb2ludCksXG4gICAgICAgICAgICAgICAgbmV3RW5kID0gbmV3IEFyUG9pbnQoZW5kcG9pbnQpLFxuICAgICAgICAgICAgICAgIHN0YXJ0UmVjdCA9IHN0YXJ0cG9ydC5yZWN0LFxuICAgICAgICAgICAgICAgIGVuZFJlY3QgPSBlbmRwb3J0LnJlY3QsXG4gICAgICAgICAgICAgICAgbWluT3ZlcmxhcCxcbiAgICAgICAgICAgICAgICBtYXhPdmVybGFwO1xuXG4gICAgICAgICAgICBpZiAoaXNIb3Jpem9udGFsKSB7XG4gICAgICAgICAgICAgICAgbWluT3ZlcmxhcCA9IE1hdGgubWluKHN0YXJ0UmVjdC5mbG9vciwgZW5kUmVjdC5mbG9vcik7XG4gICAgICAgICAgICAgICAgbWF4T3ZlcmxhcCA9IE1hdGgubWF4KHN0YXJ0UmVjdC5jZWlsLCBlbmRSZWN0LmNlaWwpO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5ld1kgPSAobWluT3ZlcmxhcCArIG1heE92ZXJsYXApIC8gMjtcbiAgICAgICAgICAgICAgICBuZXdTdGFydC55ID0gbmV3WTtcbiAgICAgICAgICAgICAgICBuZXdFbmQueSA9IG5ld1k7XG5cbiAgICAgICAgICAgICAgICB0c3RTdGFydCA9IG5ldyBBclBvaW50KFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHN0YXJ0cG9ydC5vd25lci5yZWN0LCBzdGFydERpciksIG5ld1N0YXJ0LnkpO1xuICAgICAgICAgICAgICAgIHRzdEVuZCA9IG5ldyBBclBvaW50KFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZHBvcnQub3duZXIucmVjdCwgZW5kRGlyKSwgbmV3RW5kLnkpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1pbk92ZXJsYXAgPSBNYXRoLm1pbihzdGFydFJlY3QucmlnaHQsIGVuZFJlY3QucmlnaHQpO1xuICAgICAgICAgICAgICAgIG1heE92ZXJsYXAgPSBNYXRoLm1heChzdGFydFJlY3QubGVmdCwgZW5kUmVjdC5sZWZ0KTtcblxuICAgICAgICAgICAgICAgIHZhciBuZXdYID0gKG1pbk92ZXJsYXAgKyBtYXhPdmVybGFwKSAvIDI7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQueCA9IG5ld1g7XG4gICAgICAgICAgICAgICAgbmV3RW5kLnggPSBuZXdYO1xuXG4gICAgICAgICAgICAgICAgdHN0U3RhcnQgPSBuZXcgQXJQb2ludChuZXdTdGFydC54LCBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChzdGFydHBvcnQub3duZXIucmVjdCwgc3RhcnREaXIpKTtcbiAgICAgICAgICAgICAgICB0c3RFbmQgPSBuZXcgQXJQb2ludChuZXdFbmQueCwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoZW5kcG9ydC5vd25lci5yZWN0LCBlbmREaXIpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHZhbGlkUG9pbnRMb2NhdGlvbiA9IHN0YXJ0UmVjdC5wdEluUmVjdChuZXdTdGFydCkgJiYgIXN0YXJ0UmVjdC5vbkNvcm5lcihuZXdTdGFydCkgJiZcbiAgICAgICAgICAgICAgICBlbmRSZWN0LnB0SW5SZWN0KG5ld0VuZCkgJiYgIWVuZFJlY3Qub25Db3JuZXIobmV3RW5kKTtcblxuICAgICAgICAgICAgaWYgKHZhbGlkUG9pbnRMb2NhdGlvbiAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHRzdFN0YXJ0LCB0c3RFbmQpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoaXNIb3Jpem9udGFsKSxcbiAgICAgICAgICAgICAgICAgICAgdmxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdCghaXNIb3Jpem9udGFsKSxcbiAgICAgICAgICAgICAgICAgICAgZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIoc3RhcnRwb2ludCksXG4gICAgICAgICAgICAgICAgICAgIGVkZ2UyID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludHNbMV0pLFxuICAgICAgICAgICAgICAgICAgICBlZGdlMyA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnRzWzJdKTtcblxuICAgICAgICAgICAgICAgIHZsaXN0LnJlbW92ZShlZGdlMik7XG4gICAgICAgICAgICAgICAgaGxpc3QucmVtb3ZlKGVkZ2UzKTtcbiAgICAgICAgICAgICAgICBobGlzdC5yZW1vdmUoZWRnZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBUaGUgdmFsdWVzIG9mIHN0YXJ0cG9pbnQgaXMgY2hhbmdlZCBidXQgd2UgZG9uJ3QgY2hhbmdlIHRoZSBzdGFydHBvaW50IG9mIHRoZSBlZGdlXG4gICAgICAgICAgICAgICAgc3RhcnRwb2ludC5hc3NpZ24obmV3U3RhcnQpO1xuICAgICAgICAgICAgICAgIC8vIHRvIG1haW50YWluIHRoZSByZWZlcmVuY2UgdGhhdCB0aGUgcG9ydCBoYXMgdG8gdGhlIHN0YXJ0cG9pbnRcbiAgICAgICAgICAgICAgICBlbmRwb2ludC5hc3NpZ24obmV3RW5kKTtcbiAgICAgICAgICAgICAgICBlZGdlLnNldEVuZFBvaW50KGVuZHBvaW50KTtcblxuICAgICAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBudWxsO1xuICAgICAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIGVkZ2UucG9zaXRpb25ZID0gVXRpbHMuZ2V0UG9pbnRDb29yZChuZXdTdGFydCwgVXRpbHMubmV4dENsb2Nrd2lzZURpcihzdGFydERpcikpO1xuICAgICAgICAgICAgICAgIGhsaXN0Lmluc2VydChlZGdlKTtcblxuICAgICAgICAgICAgICAgIHBvaW50cy5zcGxpY2UoMSwgMik7XG4gICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgdW5uZWNlc3NhcnkgY3VydmVzIGluc2VydGVkIGludG8gdGhlIHBhdGggZnJvbSB0aGVcbiAqIHRyYWNpbmcgdGhlIGVkZ2VzIG9mIG92ZXJsYXBwaW5nIGJveGVzLiAoaHVnIGNoaWxkcmVuKVxuICpcbiAqIEBwYXJhbSB7QXV0b1JvdXRlclBhdGh9IHBhdGhcbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fc2ltcGxpZnlQYXRoQ3VydmVzID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAvLyBJbmNpZGVudGx5LCB0aGlzIHdpbGwgYWxzbyBjb250YWluIHRoZSBmdW5jdGlvbmFsaXR5IG9mIHNpbXBsaWZ5VHJpdmlhbGx5XG4gICAgdmFyIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCksXG4gICAgICAgIHAxLFxuICAgICAgICBwMixcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIGo7XG5cbiAgICAvLyBJIHdpbGwgYmUgdGFraW5nIHRoZSBmaXJzdCBwb2ludCBhbmQgY2hlY2tpbmcgdG8gc2VlIGlmIGl0IGNhbiBjcmVhdGUgYSBzdHJhaWdodCBsaW5lXG4gICAgLy8gdGhhdCBkb2VzIG5vdCBVdGlscy5pbnRlcnNlY3QgIGFueSBvdGhlciBib3hlcyBvbiB0aGUgZ3JhcGggZnJvbSB0aGUgdGVzdCBwb2ludCB0byB0aGUgb3RoZXIgcG9pbnQuXG4gICAgLy8gVGhlICdvdGhlciBwb2ludCcgd2lsbCBiZSB0aGUgZW5kIG9mIHRoZSBwYXRoIGl0ZXJhdGluZyBiYWNrIHRpbCB0aGUgdHdvIHBvaW50cyBiZWZvcmUgdGhlIFxuICAgIC8vIGN1cnJlbnQuXG4gICAgd2hpbGUgKGkgPCBwb2ludExpc3QubGVuZ3RoIC0gMykge1xuICAgICAgICBwMSA9IHBvaW50TGlzdFtpXTtcbiAgICAgICAgaiA9IHBvaW50TGlzdC5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGotLSA+IDApIHtcbiAgICAgICAgICAgIHAyID0gcG9pbnRMaXN0W2pdO1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzUmlnaHRBbmdsZShVdGlscy5nZXREaXIocDEubWludXMocDIpKSkgJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhwMSwgcDIpIHx8XG4gICAgICAgICAgICAgICAgcDEuZXF1YWxzKHAyKSkge1xuICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UoaSArIDEsIGogLSBpIC0gMSk7IC8vIFJlbW92ZSBhbGwgcG9pbnRzIGJldHdlZW4gaSwgalxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgICsraTtcbiAgICB9XG59O1xuXG4vKiBUaGUgZm9sbG93aW5nIHNoYXBlIGluIGEgcGF0aFxuICogX19fX19fX1xuICogICAgICAgfCAgICAgICBfX19cbiAqICAgICAgIHwgICAgICB8XG4gKiAgICAgICB8X19fX19ffFxuICpcbiAqIHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBcbiAqIF9fX19fX19cbiAqICAgICAgIHxfX19fX19cbiAqXG4gKiBpZiBwb3NzaWJsZS5cbiAqL1xuLyoqXG4gKiBSZXBsYWNlIDUgcG9pbnRzIGZvciAzIHdoZXJlIHBvc3NpYmxlLiBUaGlzIHdpbGwgcmVwbGFjZSAndSctbGlrZSBzaGFwZXNcbiAqIHdpdGggJ3onIGxpa2Ugc2hhcGVzLlxuICpcbiAqIEBwYXJhbSBwYXRoXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3NpbXBsaWZ5UGF0aFBvaW50cyA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiAhcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCk7XG4gICAgYXNzZXJ0KHBvaW50TGlzdC5sZW5ndGggPj0gMiwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBwb2ludExpc3QubGVuZ3RoID49IDIgRkFJTEVEJyk7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWRQb2ludHMoKTtcbiAgICB9XG5cbiAgICB2YXIgcDEsXG4gICAgICAgIHAyLFxuICAgICAgICBwMyxcbiAgICAgICAgcDQsXG4gICAgICAgIHA1LFxuXG4gICAgICAgIHAxcCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHAycCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHAzcCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHA0cCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHA1cCA9IHBvaW50TGlzdC5sZW5ndGgsXG5cbiAgICAgICAgcG9zID0gMCxcblxuICAgICAgICBucDMsXG4gICAgICAgIGQsXG4gICAgICAgIGg7XG5cbiAgICBhc3NlcnQocG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBwb3MgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgcDFwID0gcG9zO1xuICAgIHAxID0gcG9pbnRMaXN0W3BvcysrXTtcblxuICAgIHdoaWxlIChwb3MgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgIHA1cCA9IHA0cDtcbiAgICAgICAgcDRwID0gcDNwO1xuICAgICAgICBwM3AgPSBwMnA7XG4gICAgICAgIHAycCA9IHAxcDtcbiAgICAgICAgcDFwID0gcG9zO1xuXG4gICAgICAgIHA1ID0gcDQ7XG4gICAgICAgIHA0ID0gcDM7XG4gICAgICAgIHAzID0gcDI7XG4gICAgICAgIHAyID0gcDE7XG4gICAgICAgIHAxID0gcG9pbnRMaXN0W3BvcysrXTtcblxuICAgICAgICBpZiAocDVwIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgYXNzZXJ0KHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwM3AgPCBwb2ludExpc3QubGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgcDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNXAgPCBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICAgICAgICAgICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogcDFwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwMnAgPCBwb2ludExpc3QubGVuZ3RoICYmICcgK1xuICAgICAgICAgICAgICAgICdwM3AgPCBwb2ludExpc3QubGVuZ3RoICYmIHA0cCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDVwIDwgcG9pbnRMaXN0Lmxlbmd0aCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgYXNzZXJ0KCFwMS5lcXVhbHMocDIpICYmICFwMi5lcXVhbHMocDMpICYmICFwMy5lcXVhbHMocDQpICYmICFwNC5lcXVhbHMocDUpLFxuICAgICAgICAgICAgICAgICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogIXAxLmVxdWFscyhwMikgJiYgIXAyLmVxdWFscyhwMykgJiYgIXAzLmVxdWFscyhwNCkgJiYgJyArXG4gICAgICAgICAgICAgICAgJyFwNC5lcXVhbHMocDUpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBkID0gVXRpbHMuZ2V0RGlyKHAyLm1pbnVzKHAxKSk7XG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQpLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZCkgRkFJTEVEJyk7XG4gICAgICAgICAgICBoID0gVXRpbHMuaXNIb3Jpem9udGFsKGQpO1xuXG4gICAgICAgICAgICBucDMgPSBuZXcgQXJQb2ludCgpO1xuICAgICAgICAgICAgaWYgKGgpIHtcbiAgICAgICAgICAgICAgICBucDMueCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDUsIGgpO1xuICAgICAgICAgICAgICAgIG5wMy55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwMSwgIWgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBucDMueCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDEsICFoKTtcbiAgICAgICAgICAgICAgICBucDMueSA9IFV0aWxzLmdldFBvaW50Q29vcmQocDUsIGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhwMiwgbnAzKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKG5wMywgcDQpKSB7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwMnAsIDEpO1xuICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDNwLCAxKTtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHA0cCwgMSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIW5wMy5lcXVhbHMocDEpICYmICFucDMuZXF1YWxzKHA1KSkge1xuICAgICAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHA0cCwgMCwgbnAzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwMXAgPSBwb2ludExpc3QubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHAycCA9IHBvaW50TGlzdC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcDNwID0gcG9pbnRMaXN0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwNHAgPSBwb2ludExpc3QubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgcG9zID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Nvbm5lY3RBbGxEaXNjb25uZWN0ZWRQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSxcbiAgICAgICAgbGVuID0gdGhpcy5wYXRocy5sZW5ndGgsXG4gICAgICAgIHN1Y2Nlc3MgPSBmYWxzZSxcbiAgICAgICAgZ2l2ZXVwID0gZmFsc2UsXG4gICAgICAgIHBhdGg7XG5cbiAgICB3aGlsZSAoIXN1Y2Nlc3MgJiYgIWdpdmV1cCkge1xuICAgICAgICBzdWNjZXNzID0gdHJ1ZTtcbiAgICAgICAgaSA9IGxlbjtcbiAgICAgICAgd2hpbGUgKGktLSAmJiBzdWNjZXNzKSB7XG4gICAgICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpXTtcblxuICAgICAgICAgICAgaWYgKCFwYXRoLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gdGhpcy5fY29ubmVjdChwYXRoKTtcblxuICAgICAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgaXMgbWVzc2VkIHVwLCBwcm9iYWJseSBhbiBleGlzdGluZyBlZGdlIGN1c3RvbWl6YXRpb24gcmVzdWx0cyBpbiBhIHplcm8gbGVuZ3RoIGVkZ2VcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gdGhhdCBjYXNlIHdlIHRyeSB0byBkZWxldGUgYW55IGN1c3RvbWl6YXRpb24gZm9yIHRoaXMgcGF0aCB0byByZWNvdmVyIGZyb20gdGhlIHByb2JsZW1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhdGguYXJlVGhlcmVQYXRoQ3VzdG9taXphdGlvbnMoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aC5yZW1vdmVQYXRoQ3VzdG9taXphdGlvbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdpdmV1cCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFzdWNjZXNzICYmICFnaXZldXApIHtcbiAgICAgICAgICAgIHRoaXMuX2Rpc2Nvbm5lY3RBbGwoKTtcdC8vIFRoZXJlIHdhcyBhbiBlcnJvciwgZGVsZXRlIGhhbGZ3YXkgcmVzdWx0cyB0byBiZSBhYmxlIHRvIHN0YXJ0IGEgbmV3IHBhc3NcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbXBsZXRlbHlDb25uZWN0ZWQgPSB0cnVlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fdXBkYXRlQm94UG9ydEF2YWlsYWJpbGl0eSA9IGZ1bmN0aW9uIChpbnB1dEJveCkge1xuICAgIHZhciBidWZmZXJib3gsXG4gICAgICAgIHNpYmxpbmdzLFxuICAgICAgICBza2lwQm94ZXMgPSB7fSxcbiAgICAgICAgYm94LFxuICAgICAgICBpZDtcblxuICAgIGJ1ZmZlcmJveCA9IHRoaXMuYm94MmJ1ZmZlckJveFtpbnB1dEJveC5pZF07XG4gICAgYXNzZXJ0KGJ1ZmZlcmJveCwgJ0J1ZmZlcmJveCBub3QgZm91bmQgZm9yICcgKyBpbnB1dEJveC5pZCk7XG4gICAgc2libGluZ3MgPSBidWZmZXJib3guY2hpbGRyZW47XG4gICAgLy8gSWdub3JlIG92ZXJsYXAgZnJvbSBhbmNlc3RvciBib3hlcyBpbiB0aGUgYm94IHRyZWVzXG4gICAgYm94ID0gaW5wdXRCb3g7XG4gICAgZG8ge1xuICAgICAgICBza2lwQm94ZXNbYm94LmlkXSA9IHRydWU7XG4gICAgICAgIGJveCA9IGJveC5wYXJlbnQ7XG4gICAgfSB3aGlsZSAoYm94KTtcblxuICAgIGZvciAodmFyIGkgPSBzaWJsaW5ncy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWQgPSBzaWJsaW5nc1tpXS5pZDtcbiAgICAgICAgaWYgKHNraXBCb3hlc1tpZF0pIHsgIC8vIFNraXAgYm94ZXMgb24gdGhlIGJveCB0cmVlXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbnB1dEJveC5yZWN0LnRvdWNoaW5nKHNpYmxpbmdzW2ldKSkge1xuICAgICAgICAgICAgaW5wdXRCb3guYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSh0aGlzLmJveGVzW3NpYmxpbmdzW2ldLmlkXSk7XG4gICAgICAgICAgICB0aGlzLmJveGVzW3NpYmxpbmdzW2ldLmlkXS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KGlucHV0Qm94KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZFRvQnVmZmVyQm94ZXMgPSBmdW5jdGlvbiAoaW5wdXRCb3gpIHtcbiAgICB2YXIgYm94ID0ge3JlY3Q6IG5ldyBBclJlY3QoaW5wdXRCb3gucmVjdCksIGlkOiBpbnB1dEJveC5pZH0sXG4gICAgICAgIG92ZXJsYXBCb3hlc0luZGljZXMgPSBbXSxcbiAgICAgICAgYnVmZmVyQm94LFxuICAgICAgICBjaGlsZHJlbiA9IFtdLFxuICAgICAgICBwYXJlbnRCb3gsXG4gICAgICAgIGlkcyA9IFtpbnB1dEJveC5pZF0sXG4gICAgICAgIGNoaWxkLFxuICAgICAgICBpLFxuICAgICAgICBqO1xuXG4gICAgYm94LnJlY3QuaW5mbGF0ZVJlY3QoQ09OU1RBTlRTLkJVRkZFUik7XG4gICAgYXNzZXJ0KCF0aGlzLmJveDJidWZmZXJCb3hbaW5wdXRCb3guaWRdLFxuICAgICAgICAnQ2FuXFwndCBhZGQgYm94IHRvIDIgYnVmZmVyYm94ZXMnKTtcblxuICAgIC8vIEZvciBldmVyeSBidWZmZXIgYm94IHRvdWNoaW5nIHRoZSBpbnB1dCBib3hcbiAgICAvLyBSZWNvcmQgdGhlIGJ1ZmZlciBib3hlcyB3aXRoIGNoaWxkcmVuIHRvdWNoaW5nIFxuICAgIC8vIHRoZSBpbnB1dCBib3hcbiAgICBmb3IgKGkgPSB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAoIWJveC5yZWN0LnRvdWNoaW5nKHRoaXMuYnVmZmVyQm94ZXNbaV0uYm94KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBqID0gdGhpcy5idWZmZXJCb3hlc1tpXS5jaGlsZHJlbi5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChqLS0pIHtcbiAgICAgICAgICAgIGNoaWxkID0gdGhpcy5idWZmZXJCb3hlc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgICAgIGlmIChib3gucmVjdC50b3VjaGluZyhjaGlsZCkpIHtcbiAgICAgICAgICAgICAgICBpbnB1dEJveC5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbY2hpbGQuaWRdKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJveGVzW2NoaWxkLmlkXS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KGlucHV0Qm94KTtcblxuICAgICAgICAgICAgICAgIGlmIChvdmVybGFwQm94ZXNJbmRpY2VzLmluZGV4T2YoaSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIG92ZXJsYXBCb3hlc0luZGljZXMucHVzaChpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBhcmVudEJveCA9IG5ldyBBclJlY3QoYm94LnJlY3QpO1xuICAgIC8vIElmIG92ZXJsYXBwZWQgb3RoZXIgYm94ZXMsIGNyZWF0ZSB0aGUgbmV3IGJ1ZmZlcmJveCBwYXJlbnQgcmVjdFxuICAgIGlmIChvdmVybGFwQm94ZXNJbmRpY2VzLmxlbmd0aCAhPT0gMCkge1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvdmVybGFwQm94ZXNJbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhc3NlcnQob3ZlcmxhcEJveGVzSW5kaWNlc1tpXSA8IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICdBckdyYXBoLmFkZFRvQnVmZmVyQm94ZXM6IG92ZXJsYXBCb3hlcyBpbmRleCBvdXQgb2YgYm91bmRzLiAoJyArXG4gICAgICAgICAgICAgICAgb3ZlcmxhcEJveGVzSW5kaWNlc1tpXSArICcgPCAnICsgdGhpcy5idWZmZXJCb3hlcy5sZW5ndGggKyAnKScpO1xuXG4gICAgICAgICAgICBidWZmZXJCb3ggPSB0aGlzLmJ1ZmZlckJveGVzLnNwbGljZShvdmVybGFwQm94ZXNJbmRpY2VzW2ldLCAxKVswXTtcblxuICAgICAgICAgICAgZm9yIChqID0gYnVmZmVyQm94LmNoaWxkcmVuLmxlbmd0aDsgai0tOykge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goYnVmZmVyQm94LmNoaWxkcmVuW2pdKTtcbiAgICAgICAgICAgICAgICBpZHMucHVzaChidWZmZXJCb3guY2hpbGRyZW5bal0uaWQpOyAgLy8gU3RvcmUgdGhlIGlkcyBvZiB0aGUgY2hpbGRyZW4gdGhhdCBuZWVkIHRvIGJlIGFkanVzdGVkXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhcmVudEJveC51bmlvbkFzc2lnbihidWZmZXJCb3guYm94KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJveC5yZWN0LmlkID0gaW5wdXRCb3guaWQ7XG4gICAgY2hpbGRyZW4ucHVzaChib3gucmVjdCk7XG5cbiAgICB0aGlzLmJ1ZmZlckJveGVzLnB1c2goe2JveDogcGFyZW50Qm94LCBjaGlsZHJlbjogY2hpbGRyZW59KTtcblxuICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5ib3gyYnVmZmVyQm94W2lkc1tpXV0gPSB0aGlzLmJ1ZmZlckJveGVzW3RoaXMuYnVmZmVyQm94ZXMubGVuZ3RoIC0gMV07XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fcmVtb3ZlRnJvbUJ1ZmZlckJveGVzID0gZnVuY3Rpb24gKGJveCkge1xuICAgIC8vIEdldCB0aGUgY2hpbGRyZW4gb2YgdGhlIHBhcmVudEJveCAobm90IGluY2x1ZGluZyB0aGUgYm94IHRvIHJlbW92ZSlcbiAgICAvLyBDcmVhdGUgYnVmZmVyYm94ZXMgZnJvbSB0aGVzZSBjaGlsZHJlblxuICAgIHZhciBidWZmZXJCb3ggPSB0aGlzLmJveDJidWZmZXJCb3hbYm94LmlkXSxcbiAgICAgICAgaSA9IHRoaXMuYnVmZmVyQm94ZXMuaW5kZXhPZihidWZmZXJCb3gpLFxuICAgICAgICBjaGlsZHJlbiA9IGJ1ZmZlckJveC5jaGlsZHJlbixcbiAgICAgICAgZ3JvdXBzID0gW10sXG4gICAgICAgIGFkZCA9IGZhbHNlLFxuICAgICAgICBwYXJlbnRCb3gsXG4gICAgICAgIGNoaWxkLFxuICAgICAgICBncm91cCxcbiAgICAgICAgaWRzLFxuICAgICAgICBpZCxcbiAgICAgICAgaixcbiAgICAgICAgZztcblxuICAgIGFzc2VydChpICE9PSAtMSwgJ0FSR3JhcGgucmVtb3ZlRnJvbUJ1ZmZlckJveGVzOiBDYW5cXCd0IGZpbmQgdGhlIGNvcnJlY3QgYnVmZmVyYm94LicpO1xuXG4gICAgLy8gUmVtb3ZlIHJlY29yZCBvZiByZW1vdmVkIGJveFxuICAgIHRoaXMuYnVmZmVyQm94ZXMuc3BsaWNlKGksIDEpO1xuICAgIHRoaXMuYm94MmJ1ZmZlckJveFtib3guaWRdID0gdW5kZWZpbmVkO1xuXG4gICAgLy9DcmVhdGUgZ3JvdXBzIG9mIG92ZXJsYXAgZnJvbSBjaGlsZHJlblxuICAgIGkgPSBjaGlsZHJlbi5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBnID0gZ3JvdXBzLmxlbmd0aDtcbiAgICAgICAgY2hpbGQgPSBjaGlsZHJlbltpXTtcbiAgICAgICAgZ3JvdXAgPSBbY2hpbGRdO1xuICAgICAgICBhZGQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmJveGVzW2NoaWxkLmlkXS5yZXNldFBvcnRBdmFpbGFiaWxpdHkoKTsgIC8vIFJlc2V0IGJveCdzIHBvcnRzIGF2YWlsYWJsZUFyZWFzXG5cbiAgICAgICAgaWYgKGNoaWxkLmlkID09PSBib3guaWQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGctLSkge1xuICAgICAgICAgICAgaiA9IGdyb3Vwc1tnXS5sZW5ndGg7XG5cbiAgICAgICAgICAgIHdoaWxlIChqLS0pIHtcbiAgICAgICAgICAgICAgICBpZiAoZ3JvdXBzW2ddW2pdLnRvdWNoaW5nKGNoaWxkKSkge1xuICAgICAgICAgICAgICAgICAgICBpZCA9IGdyb3Vwc1tnXVtqXS5pZDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ib3hlc1tjaGlsZC5pZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSh0aGlzLmJveGVzW2lkXSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYm94ZXNbaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tjaGlsZC5pZF0pO1xuICAgICAgICAgICAgICAgICAgICBhZGQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFkZCkge1xuICAgICAgICAgICAgICAgIC8vIGdyb3VwIHdpbGwgYWNjdW11bGF0ZSBhbGwgdGhpbmdzIG92ZXJsYXBwaW5nIHRoZSBjaGlsZFxuICAgICAgICAgICAgICAgIGdyb3VwID0gZ3JvdXAuY29uY2F0KGdyb3Vwcy5zcGxpY2UoZywgMSlbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ3JvdXBzLnB1c2goZ3JvdXApOyAgLy8gQWRkIGdyb3VwIHRvIGdyb3Vwc1xuICAgIH1cblxuICAgIGkgPSBncm91cHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgaiA9IGdyb3Vwc1tpXS5sZW5ndGg7XG4gICAgICAgIHBhcmVudEJveCA9IG5ldyBBclJlY3QoZ3JvdXBzW2ldWzBdKTtcbiAgICAgICAgaWRzID0gW107XG5cbiAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgcGFyZW50Qm94LnVuaW9uQXNzaWduKGdyb3Vwc1tpXVtqXSk7XG4gICAgICAgICAgICBpZHMucHVzaChncm91cHNbaV1bal0uaWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5idWZmZXJCb3hlcy5wdXNoKHtib3g6IHBhcmVudEJveCwgY2hpbGRyZW46IGdyb3Vwc1tpXX0pO1xuXG4gICAgICAgIGogPSBpZHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICB0aGlzLmJveDJidWZmZXJCb3hbaWRzW2pdXSA9IHRoaXMuYnVmZmVyQm94ZXNbdGhpcy5idWZmZXJCb3hlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgfVxuICAgIH1cblxufTtcblxuLy9QdWJsaWMgRnVuY3Rpb25zXG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuc2V0QnVmZmVyID0gZnVuY3Rpb24gKG5ld0J1ZmZlcikge1xuICAgIENPTlNUQU5UUy5CVUZGRVIgPSBuZXdCdWZmZXI7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmNhbGN1bGF0ZVNlbGZQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01JTkNPT1JELCBDT05TVEFOVFMuRURfTUlOQ09PUkQpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUFYQ09PUkQsIENPTlNUQU5UUy5FRF9NSU5DT09SRCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NQVhDT09SRCwgQ09OU1RBTlRTLkVEX01BWENPT1JEKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01JTkNPT1JELCBDT05TVEFOVFMuRURfTUFYQ09PUkQpKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuY3JlYXRlQm94ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBib3ggPSBuZXcgQXV0b1JvdXRlckJveCgpO1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLmNyZWF0ZUJveDogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIGJveDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuYWRkQm94ID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsXG4gICAgICAgICdBUkdyYXBoLmFkZEJveDogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChib3ggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94LFxuICAgICAgICAnQVJHcmFwaC5hZGRCb3g6IGJveCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3ggRkFJTEVEJyk7XG5cbiAgICB2YXIgcmVjdCA9IGJveC5yZWN0O1xuXG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcocmVjdCk7XG5cbiAgICBib3gub3duZXIgPSB0aGlzO1xuICAgIHZhciBib3hJZCA9IChDT1VOVEVSKyspLnRvU3RyaW5nKCk7XG4gICAgd2hpbGUgKGJveElkLmxlbmd0aCA8IDYpIHtcbiAgICAgICAgYm94SWQgPSAnMCcgKyBib3hJZDtcbiAgICB9XG4gICAgYm94SWQgPSAnQk9YXycgKyBib3hJZDtcbiAgICBib3guaWQgPSBib3hJZDtcblxuICAgIHRoaXMuYm94ZXNbYm94SWRdID0gYm94O1xuXG4gICAgdGhpcy5fYWRkQm94QW5kUG9ydEVkZ2VzKGJveCk7XG5cbiAgICAvLyBhZGQgY2hpbGRyZW4gb2YgdGhlIGJveFxuICAgIHZhciBjaGlsZHJlbiA9IGJveC5jaGlsZEJveGVzLFxuICAgICAgICBpID0gY2hpbGRyZW4ubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5hZGRCb3goY2hpbGRyZW5baV0pO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGVsZXRlQm94ID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZUJveDogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgaWYgKGJveC5oYXNPd25lcigpKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBib3gucGFyZW50LFxuICAgICAgICAgICAgY2hpbGRyZW4gPSBib3guY2hpbGRCb3hlcyxcbiAgICAgICAgICAgIGkgPSBjaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgLy8gbm90aWZ5IHRoZSBwYXJlbnQgb2YgdGhlIGRlbGV0aW9uXG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChib3gpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGNoaWxkcmVuXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlQm94KGNoaWxkcmVuW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RlbGV0ZUJveEFuZFBvcnRFZGdlcyhib3gpO1xuICAgICAgICBib3gub3duZXIgPSBudWxsO1xuICAgICAgICBhc3NlcnQodGhpcy5ib3hlc1tib3guaWRdICE9PSB1bmRlZmluZWQsICdBUkdyYXBoLnJlbW92ZTogQm94IGRvZXMgbm90IGV4aXN0Jyk7XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuYm94ZXNbYm94LmlkXTtcbiAgICB9XG5cbiAgICBib3guZGVzdHJveSgpO1xuICAgIGJveCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnNoaWZ0Qm94QnkgPSBmdW5jdGlvbiAoYm94LCBvZmZzZXQpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5zaGlmdEJveEJ5OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCEhdGhpcy5ib3hlc1tib3guaWRdLCAnQVJHcmFwaC5zaGlmdEJveEJ5OiBCb3ggZG9lcyBub3QgZXhpc3QhJyk7XG5cbiAgICB2YXIgcmVjdCA9IHRoaXMuYm94MmJ1ZmZlckJveFtib3guaWRdLmJveCxcbiAgICAgICAgY2hpbGRyZW4gPSBib3guY2hpbGRCb3hlcztcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nKHJlY3QpOyAvLyByZWRyYXcgYWxsIHBhdGhzIGNsaXBwaW5nIHBhcmVudCBib3guXG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzRnJvbShib3gpO1xuXG4gICAgdGhpcy5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzKGJveCk7XG5cbiAgICBib3guc2hpZnRCeShvZmZzZXQpO1xuICAgIHRoaXMuX2FkZEJveEFuZFBvcnRFZGdlcyhib3gpO1xuXG4gICAgcmVjdCA9IGJveC5yZWN0O1xuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nKHJlY3QpO1xuXG4gICAgZm9yICh2YXIgaSA9IGNoaWxkcmVuLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnNoaWZ0Qm94QnkoY2hpbGRyZW5baV0sIG9mZnNldCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5zZXRCb3hSZWN0ID0gZnVuY3Rpb24gKGJveCwgcmVjdCkge1xuICAgIGlmIChib3ggPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2RlbGV0ZUJveEFuZFBvcnRFZGdlcyhib3gpO1xuICAgIGJveC5zZXRSZWN0KHJlY3QpO1xuICAgIHRoaXMuX2FkZEJveEFuZFBvcnRFZGdlcyhib3gpO1xuXG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcocmVjdCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnJvdXRlU3luYyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3RhdGUgPSB7ZmluaXNoZWQ6IGZhbHNlfTtcblxuICAgIHRoaXMuX2Nvbm5lY3RBbGxEaXNjb25uZWN0ZWRQYXRocygpO1xuXG4gICAgd2hpbGUgKCFzdGF0ZS5maW5pc2hlZCkge1xuICAgICAgICBzdGF0ZSA9IHRoaXMuX29wdGltaXplKHN0YXRlKTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUucm91dGVBc3luYyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICB1cGRhdGVGbiA9IG9wdGlvbnMudXBkYXRlIHx8IFV0aWxzLm5vcCxcbiAgICAgICAgZmlyc3RGbiA9IG9wdGlvbnMuZmlyc3QgfHwgVXRpbHMubm9wLFxuICAgICAgICBjYWxsYmFja0ZuID0gb3B0aW9ucy5jYWxsYmFjayB8fCBVdGlscy5ub3AsXG4gICAgICAgIHRpbWUgPSBvcHRpb25zLnRpbWUgfHwgNSxcbiAgICAgICAgb3B0aW1pemVGbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyBvcHRpbWl6YXRpb24gY3ljbGUgc3RhcnRlZCcpO1xuXG4gICAgICAgICAgICAvLyBJZiBhIHBhdGggaGFzIGJlZW4gZGlzY29ubmVjdGVkLCBzdGFydCB0aGUgcm91dGluZyBvdmVyXG4gICAgICAgICAgICBpZiAoIXNlbGYuY29tcGxldGVseUNvbm5lY3RlZCkge1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgb3B0aW1pemF0aW9uIGludGVycnVwdGVkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoc3RhcnRSb3V0aW5nLCB0aW1lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdXBkYXRlRm4oc2VsZi5wYXRocyk7XG4gICAgICAgICAgICBpZiAoc3RhdGUuZmluaXNoZWQpIHtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIHJvdXRpbmcgZmluaXNoZWQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2tGbihzZWxmLnBhdGhzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBzZWxmLl9vcHRpbWl6ZShzdGF0ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQob3B0aW1pemVGbiwgdGltZSwgc3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzdGFydFJvdXRpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIHJvdXRpbmcgc3RhcnRlZCcpO1xuICAgICAgICAgICAgdmFyIHN0YXRlID0ge2ZpbmlzaGVkOiBmYWxzZX07XG4gICAgICAgICAgICBzZWxmLl9jb25uZWN0QWxsRGlzY29ubmVjdGVkUGF0aHMoKTtcblxuICAgICAgICAgICAgLy8gU3RhcnQgdGhlIG9wdGltaXphdGlvblxuICAgICAgICAgICAgc2V0VGltZW91dChvcHRpbWl6ZUZuLCB0aW1lLCBzdGF0ZSk7XG4gICAgICAgIH07XG5cbiAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIHJvdXRpbmcgdHJpZ2dlcmVkJyk7XG4gICAgLy8gQ29ubmVjdCBhbGwgZGlzY29ubmVjdGVkIHBhdGhzIHdpdGggYSBzdHJhaWdodCBsaW5lXG4gICAgdmFyIGRpc2Nvbm5lY3RlZCA9IHRoaXMuX3F1aWNrQ29ubmVjdERpc2Nvbm5lY3RlZFBhdGhzKCk7XG4gICAgZmlyc3RGbihkaXNjb25uZWN0ZWQpO1xuXG4gICAgdGhpcy5fZGlzY29ubmVjdFRlbXBQYXRocyhkaXNjb25uZWN0ZWQpO1xuXG4gICAgc2V0VGltZW91dChzdGFydFJvdXRpbmcsIHRpbWUpO1xufTtcblxuLyoqXG4gKiBDb25uZWN0IGFsbCBkaXNjb25uZWN0ZWQgcGF0aHMgaW4gYSBxdWljayB3YXkgd2hpbGUgYSBiZXR0ZXIgbGF5b3V0IGlzXG4gKiBiZWluZyBjYWxjdWxhdGVkLlxuICpcbiAqIEByZXR1cm4ge0FycmF5PFBhdGg+fSBkaXNjb25uZWN0ZWQgcGF0aHNcbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fcXVpY2tDb25uZWN0RGlzY29ubmVjdGVkUGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBhdGgsXG4gICAgICAgIGRpc2Nvbm5lY3RlZCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpXTtcbiAgICAgICAgaWYgKCFwYXRoLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgICAgIHBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0cygpO1xuICAgICAgICAgICAgcGF0aC5wb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKHBhdGguc3RhcnRwb2ludCwgcGF0aC5lbmRwb2ludCk7XG4gICAgICAgICAgICBkaXNjb25uZWN0ZWQucHVzaChwYXRoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGlzY29ubmVjdGVkO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGlzY29ubmVjdFRlbXBQYXRocyA9IGZ1bmN0aW9uIChwYXRocykge1xuICAgIGZvciAodmFyIGkgPSBwYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcGF0aHNbaV0ucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUGVyZm9ybXMgb25lIHNldCBvZiBvcHRpbWl6YXRpb25zLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCBUaGlzIHN0b3JlcyB0aGUgbWF4IG51bWJlciBvZiBvcHRpbWl6YXRpb25zIGFsbG93ZWRcbiAqIEBwYXJhbSB7TnVtYmVyfSBsYXN0IFRoaXMgc3RvcmVzIHRoZSBsYXN0IG9wdGltaXphdGlvbiB0eXBlIG1hZGVcbiAqXG4gKiBAcmV0dXJuIHtPYmplY3R9IEN1cnJlbnQgY291bnQsIGxhc3QgdmFsdWVzXG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX29wdGltaXplID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgbWF4T3BlcmF0aW9ucyA9IG9wdGlvbnMubWF4T3BlcmF0aW9ucyB8fCAxMDAsXG4gICAgICAgIGxhc3QgPSBvcHRpb25zLmxhc3QgfHwgMCxcbiAgICAgICAgZG0gPSBvcHRpb25zLmRtIHx8IDEwLFx0XHQvLyBtYXggIyBvZiBkaXN0cmlidXRpb24gb3BcbiAgICAgICAgZCA9IG9wdGlvbnMuZCB8fCAwLFxuICAgICAgICBnZXRTdGF0ZSA9IGZ1bmN0aW9uIChmaW5pc2hlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBmaW5pc2hlZDogZmluaXNoZWQgfHwgIW1heE9wZXJhdGlvbnMsXG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9uczogbWF4T3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICBsYXN0OiBsYXN0LFxuICAgICAgICAgICAgICAgIGRtOiBkbSxcbiAgICAgICAgICAgICAgICBkOiBkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG5cbiAgICAgICAgaWYgKGxhc3QgPT09IDEpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMuX3NpbXBsaWZ5UGF0aHMoKSkge1xuICAgICAgICAgICAgbGFzdCA9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKSB7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgICAgICB9IHdoaWxlIChtYXhPcGVyYXRpb25zID4gMCAmJiB0aGlzLmhvcml6b250YWwuYmxvY2tTY2FuQmFja3dhcmQoKSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0IDwgMiB8fCBsYXN0ID4gNSkge1xuICAgICAgICAgICAgICAgIGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgrK2QgPj0gZG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxhc3QgPSAyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSAzKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLmhvcml6b250YWwuYmxvY2tTY2FuRm9yd2FyZCgpKSB7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgICAgICB9IHdoaWxlIChtYXhPcGVyYXRpb25zID4gMCAmJiB0aGlzLmhvcml6b250YWwuYmxvY2tTY2FuRm9yd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDM7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDQpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMudmVydGljYWwuYmxvY2tTY2FuQmFja3dhcmQoKSkge1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMudmVydGljYWwuYmxvY2tTY2FuQmFja3dhcmQoKSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0IDwgMiB8fCBsYXN0ID4gNSkge1xuICAgICAgICAgICAgICAgIGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgrK2QgPj0gZG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxhc3QgPSA0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSA1KSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkZvcndhcmQoKSkge1xuXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gNTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNikge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5ob3Jpem9udGFsLmJsb2NrU3dpdGNoV3JvbmdzKCkpIHtcbiAgICAgICAgICAgIGxhc3QgPSA2O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSA3KSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLnZlcnRpY2FsLmJsb2NrU3dpdGNoV3JvbmdzKCkpIHtcbiAgICAgICAgICAgIGxhc3QgPSA3O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxhc3QgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgIH1cblxuICAgIHJldHVybiBnZXRTdGF0ZShmYWxzZSk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlbGV0ZVBhdGggPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5kZWxldGVQYXRoOiBwYXRoICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgaWYgKHBhdGguaGFzT3duZXIoKSkge1xuICAgICAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguZGVsZXRlUGF0aDogcGF0aC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcblxuICAgICAgICB0aGlzLmRlbGV0ZUVkZ2VzKHBhdGgpO1xuICAgICAgICBwYXRoLm93bmVyID0gbnVsbDtcbiAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5wYXRocy5pbmRleE9mKHBhdGgpO1xuXG4gICAgICAgIGFzc2VydChpbmRleCA+IC0xLCAnQVJHcmFwaC5yZW1vdmU6IFBhdGggZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgdGhpcy5wYXRocy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cblxuICAgIHBhdGguZGVzdHJveSgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uIChhZGRCYWNrU2VsZkVkZ2VzKSB7XG4gICAgdGhpcy5fZGVsZXRlQWxsUGF0aHMoKTtcbiAgICB0aGlzLl9kZWxldGVBbGxCb3hlcygpO1xuICAgIHRoaXMuX2RlbGV0ZUFsbEVkZ2VzKCk7XG4gICAgaWYgKGFkZEJhY2tTZWxmRWRnZXMpIHtcbiAgICAgICAgdGhpcy5fYWRkU2VsZkVkZ2VzKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hZGRQYXRoID0gZnVuY3Rpb24gKGlzQXV0b1JvdXRlZCwgc3RhcnRwb3J0cywgZW5kcG9ydHMpIHtcbiAgICB2YXIgcGF0aCA9IG5ldyBBdXRvUm91dGVyUGF0aCgpO1xuXG4gICAgcGF0aC5zZXRBdXRvUm91dGluZyhpc0F1dG9Sb3V0ZWQpO1xuICAgIHBhdGguc2V0U3RhcnRFbmRQb3J0cyhzdGFydHBvcnRzLCBlbmRwb3J0cyk7XG4gICAgdGhpcy5fYWRkKHBhdGgpO1xuXG4gICAgcmV0dXJuIHBhdGg7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmlzRWRnZUZpeGVkID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50KSB7XG4gICAgdmFyIGQgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpLFxuICAgICAgICBoID0gVXRpbHMuaXNIb3Jpem9udGFsKGQpLFxuXG4gICAgICAgIGVsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoaCksXG5cbiAgICAgICAgZWRnZSA9IGVsaXN0LmdldEVkZ2UocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgIGlmIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBlZGdlLmdldEVkZ2VGaXhlZCgpICYmICFlZGdlLmdldEVkZ2VDdXN0b21GaXhlZCgpO1xuICAgIH1cblxuICAgIGFzc2VydChmYWxzZSwgJ0FSR3JhcGguaXNFZGdlRml4ZWQ6IEZBSUxFRCcpO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZGVsZXRlQWxsKGZhbHNlKTtcblxuICAgIHRoaXMuaG9yaXpvbnRhbC5TZXRPd25lcihudWxsKTtcbiAgICB0aGlzLnZlcnRpY2FsLlNldE93bmVyKG51bGwpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSB0aGlzLmJveGVzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmFzc2VydFZhbGlkQm94KHRoaXMuYm94ZXNbaWRzW2ldXSk7XG4gICAgfVxuXG4gICAgZm9yIChpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fYXNzZXJ0VmFsaWRQYXRoKHRoaXMucGF0aHNbaV0pO1xuICAgIH1cblxuICAgIHRoaXMuaG9yaXpvbnRhbC5hc3NlcnRWYWxpZCgpO1xuICAgIHRoaXMudmVydGljYWwuYXNzZXJ0VmFsaWQoKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRCb3ggPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYm94LmFzc2VydFZhbGlkKCk7XG4gICAgYXNzZXJ0KGJveC5vd25lciA9PT0gdGhpcyxcbiAgICAgICAgJ0FSR3JhcGguYXNzZXJ0VmFsaWRCb3g6IGJveC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICBhc3NlcnQodGhpcy5ib3hlc1tib3guaWRdICE9PSB1bmRlZmluZWQsXG4gICAgICAgICdBUkdyYXBoLmFzc2VydFZhbGlkQm94OiB0aGlzLmJveGVzW2JveC5pZF0gIT09IHVuZGVmaW5lZCBGQUlMRUQnKTtcblxuICAgIC8vIFZlcmlmeSB0aGF0IHRoZSBib3ggKGFuZCBwb3J0KSBlZGdlcyBhcmUgb24gdGhlIGdyYXBoXG4gICAgYXNzZXJ0KHRoaXMuX2NvbnRhaW5zUmVjdEVkZ2VzKGJveC5yZWN0KSxcbiAgICAgICAgJ0dyYXBoIGRvZXMgbm90IGNvbnRhaW4gZWRnZXMgZm9yIGJveCAnICsgYm94LmlkKTtcblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29udGFpbnNSZWN0RWRnZXMgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciB0b3BMZWZ0ID0gcmVjdC5nZXRUb3BMZWZ0KCksXG4gICAgICAgIGJvdHRvbVJpZ2h0ID0gcmVjdC5nZXRCb3R0b21SaWdodCgpLFxuICAgICAgICBwb2ludHMgPSBbXSxcbiAgICAgICAgcmVzdWx0ID0gdHJ1ZSxcbiAgICAgICAgbGVuLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kO1xuXG4gICAgcG9pbnRzLnB1c2godG9wTGVmdCk7XG4gICAgcG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoYm90dG9tUmlnaHQueCwgdG9wTGVmdC55KSk7ICAvLyB0b3AgcmlnaHRcbiAgICBwb2ludHMucHVzaChib3R0b21SaWdodCk7XG4gICAgcG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodG9wTGVmdC54LCBib3R0b21SaWdodC55KSk7ICAvLyBib3R0b20gbGVmdFxuXG4gICAgbGVuID0gcG9pbnRzLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHN0YXJ0ID0gcG9pbnRzW2ldO1xuICAgICAgICBlbmQgPSBwb2ludHNbKGkgKyAxKSAlIGxlbl07XG4gICAgICAgIHJlc3VsdCA9IHJlc3VsdCAmJiB0aGlzLl9jb250YWluc0VkZ2Uoc3RhcnQsIGVuZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogVGhpcyBjaGVja3MgZm9yIGFuIGVkZ2Ugd2l0aCB0aGUgZ2l2ZW4gc3RhcnQvZW5kIHBvaW50cy4gVGhpcyB3aWxsIG9ubHlcbiAqIHdvcmsgZm9yIGZpeGVkIGVkZ2VzIHN1Y2ggYXMgYm94ZXMgb3IgcG9ydHMuXG4gKlxuICogQHBhcmFtIHN0YXJ0XG4gKiBAcGFyYW0gZW5kXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NvbnRhaW5zRWRnZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gICAgdmFyIGRpcjtcblxuICAgIGRpciA9IFV0aWxzLmdldERpcihzdGFydC5taW51cyhlbmQpKTtcbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICdFZGdlIGlzIGludmFsaWQ6ICcgKyBVdGlscy5zdHJpbmdpZnkoc3RhcnQpICsgJyBhbmQgJyArIFV0aWxzLnN0cmluZ2lmeShlbmQpKTtcblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5ob3Jpem9udGFsLmNvbnRhaW5zKHN0YXJ0LCBlbmQpIHx8IHRoaXMuaG9yaXpvbnRhbC5jb250YWlucyhlbmQsIHN0YXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy52ZXJ0aWNhbC5jb250YWlucyhzdGFydCwgZW5kKSB8fCB0aGlzLnZlcnRpY2FsLmNvbnRhaW5zKGVuZCwgc3RhcnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Fzc2VydFZhbGlkUGF0aCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsXG4gICAgICAgICdBUkdyYXBoLmFzc2VydFZhbGlkQm94OiBib3gub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kdW1wUGF0aHMgPSBmdW5jdGlvbiAocG9zLCBjKSB7XG4gICAgX2xvZ2dlci5kZWJ1ZygnUGF0aHMgZHVtcCBwb3MgJyArIHBvcyArICcsIGMgJyArIGMpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBhdGhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoaSArICcuIFBhdGg6ICcpO1xuICAgICAgICB0aGlzLnBhdGhzW2ldLmdldFBvaW50TGlzdCgpLmR1bXBQb2ludHMoJ0R1bXBQYXRocycpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kdW1wRWRnZUxpc3RzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5kdW1wRWRnZXMoJ0hvcml6b250YWwgZWRnZXM6Jyk7XG4gICAgdGhpcy52ZXJ0aWNhbC5kdW1wRWRnZXMoJ1ZlcnRpY2FsIGVkZ2VzOicpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyR3JhcGg7XG4iLCIndXNlIHN0cmljdCc7XG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICAgIExFVkVMUyA9IFsnd2FybicsICdkZWJ1ZycsICdpbmZvJ107XG5cbnZhciBMb2dnZXIgPSBmdW5jdGlvbihuYW1lKXtcbiAgICBmb3IgKHZhciBpID0gTEVWRUxTLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzW0xFVkVMU1tpXV0gPSBkZWJ1ZyhuYW1lICsgJzonICsgTEVWRUxTW2ldKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvZ2dlcjtcbiIsIi8qZ2xvYmFscyBkZWZpbmUqL1xuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEFyUG9pbnRMaXN0UGF0aCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludExpc3QnKTtcblxuLy8gQXV0b1JvdXRlclBhdGhcbnZhciBBdXRvUm91dGVyUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmlkID0gJ05vbmUnO1xuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvcnRzID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvcnRzID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9ydCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb3J0ID0gbnVsbDtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBDT05TVEFOVFMuUGF0aERlZmF1bHQ7XG4gICAgdGhpcy5zdGF0ZSA9IENPTlNUQU5UUy5QYXRoU3RhdGVEZWZhdWx0O1xuICAgIHRoaXMuaXNBdXRvUm91dGluZ09uID0gdHJ1ZTtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gW107XG4gICAgdGhpcy5jdXN0b21pemF0aW9uVHlwZSA9ICdQb2ludHMnO1xuICAgIHRoaXMucGF0aERhdGFUb0RlbGV0ZSA9IFtdO1xuICAgIHRoaXMucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpO1xufTtcblxuXG4vLy0tLS1Qb2ludHNcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmhhc093bmVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLm93bmVyICE9PSBudWxsO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldFN0YXJ0RW5kUG9ydHMgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICAgIHRoaXMuc3RhcnRwb3J0cyA9IHN0YXJ0O1xuICAgIHRoaXMuZW5kcG9ydHMgPSBlbmQ7XG4gICAgdGhpcy5jYWxjdWxhdGVTdGFydEVuZFBvcnRzKCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2xlYXJQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyByZW1vdmUgdGhlIHN0YXJ0L2VuZHBvaW50cyBmcm9tIHRoZSBnaXZlbiBwb3J0c1xuICAgIGlmICh0aGlzLnN0YXJ0cG9pbnQpIHtcbiAgICAgICAgdGhpcy5zdGFydHBvcnQucmVtb3ZlUG9pbnQodGhpcy5zdGFydHBvaW50KTtcbiAgICAgICAgdGhpcy5zdGFydHBvaW50ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZW5kcG9pbnQpIHtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgICAgICB0aGlzLmVuZHBvaW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGFydHBvcnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9ydCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0U3RhcnRQb3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoLCBcbiAgICAgICAgJ0FSUG9ydC5nZXRTdGFydFBvcnQ6IENhblxcJ3QgcmV0cmlldmUgc3RhcnQgcG9ydC4gZnJvbSAnK3RoaXMuaWQpO1xuXG4gICAgaWYgKCF0aGlzLnN0YXJ0cG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0UG9ydHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb3J0O1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldEVuZFBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoLCBcbiAgICAgICAgJ0FSUG9ydC5nZXRFbmRQb3J0OiBDYW5cXCd0IHJldHJpZXZlIGVuZCBwb3J0IGZyb20gJyt0aGlzLmlkKTtcbiAgICBpZiAoIXRoaXMuZW5kcG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZUVuZFBvcnRzKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmVuZHBvcnQ7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBwb3J0IGZyb20gc3RhcnQvZW5kIHBvcnQgbGlzdHMuXG4gKlxuICogQHBhcmFtIHBvcnRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnJlbW92ZVBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIHZhciByZW1vdmVkID0gVXRpbHMucmVtb3ZlRnJvbUFycmF5cyhwb3J0LCB0aGlzLnN0YXJ0cG9ydHMsIHRoaXMuZW5kcG9ydHMpO1xuICAgIGFzc2VydChyZW1vdmVkLCAnUG9ydCB3YXMgbm90IHJlbW92ZWQgZnJvbSBwYXRoIHN0YXJ0L2VuZCBwb3J0cycpO1xuXG4gICAgLy8gSWYgbm8gbW9yZSBzdGFydC9lbmQgcG9ydHMsIHJlbW92ZSB0aGUgcGF0aFxuICAgIC8vIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoICYmIHRoaXMuZW5kcG9ydHMubGVuZ3RoLCAnUmVtb3ZlZCBhbGwgc3RhcnQvZW5kcG9ydHMgb2YgcGF0aCAnICsgdGhpcy5pZCk7XG4gICAgdGhpcy5vd25lci5kaXNjb25uZWN0KHRoaXMpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtzcmM6IHRoaXMuY2FsY3VsYXRlU3RhcnRQb3J0cygpLCBkc3Q6IHRoaXMuY2FsY3VsYXRlRW5kUG9ydHMoKX07XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlU3RhcnRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3JjUG9ydHMgPSBbXSxcbiAgICAgICAgdGd0LFxuICAgICAgICBpO1xuXG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnQXJQYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHM6IHRoaXMuc3RhcnRwb3J0cyBjYW5ub3QgYmUgZW1wdHkhJyk7XG5cbiAgICAvL1JlbW92ZSB0aGlzLnN0YXJ0cG9pbnRcbiAgICBpZiAodGhpcy5zdGFydHBvcnQgJiYgdGhpcy5zdGFydHBvcnQuaGFzUG9pbnQodGhpcy5zdGFydHBvaW50KSkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIH1cblxuICAgIC8vR2V0IGF2YWlsYWJsZSBwb3J0c1xuICAgIGZvciAoaSA9IHRoaXMuc3RhcnRwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0c1tpXS5vd25lcixcbiAgICAgICAgICAgICdBUlBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogcG9ydCAnICsgdGhpcy5zdGFydHBvcnRzW2ldLmlkICsgJyBoYXMgaW52YWxpZCB0aGlzLm93bmVyIScpO1xuICAgICAgICBpZiAodGhpcy5zdGFydHBvcnRzW2ldLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgIHNyY1BvcnRzLnB1c2godGhpcy5zdGFydHBvcnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzcmNQb3J0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgc3JjUG9ydHMgPSB0aGlzLnN0YXJ0cG9ydHM7XG4gICAgfVxuXG4gICAgLy9QcmV2ZW50aW5nIHNhbWUgc3RhcnQvZW5kcG9ydFxuICAgIGlmICh0aGlzLmVuZHBvcnQgJiYgc3JjUG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBpID0gc3JjUG9ydHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoc3JjUG9ydHNbaV0gPT09IHRoaXMuZW5kcG9ydCkge1xuICAgICAgICAgICAgICAgIHNyY1BvcnRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gR2V0dGluZyB0YXJnZXRcbiAgICBpZiAodGhpcy5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICB2YXIgYWNjdW11bGF0ZVBvcnRDZW50ZXJzID0gZnVuY3Rpb24gKHByZXYsIGN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSBjdXJyZW50LnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgICAgICBwcmV2LnggKz0gY2VudGVyLng7XG4gICAgICAgICAgICBwcmV2LnkgKz0gY2VudGVyLnk7XG4gICAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgfTtcbiAgICAgICAgdGd0ID0gdGhpcy5lbmRwb3J0cy5yZWR1Y2UoYWNjdW11bGF0ZVBvcnRDZW50ZXJzLCBuZXcgQXJQb2ludCgwLCAwKSk7XG5cbiAgICAgICAgdGd0LnggLz0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG4gICAgICAgIHRndC55IC89IHRoaXMuZW5kcG9ydHMubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRndCA9IHRoaXMuY3VzdG9tUGF0aERhdGFbMF07XG4gICAgfVxuICAgIC8vIEdldCB0aGUgb3B0aW1hbCBwb3J0IHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLnN0YXJ0cG9ydCA9IFV0aWxzLmdldE9wdGltYWxQb3J0cyhzcmNQb3J0cywgdGd0KTtcblxuICAgIC8vIENyZWF0ZSBhIHRoaXMuc3RhcnRwb2ludCBhdCB0aGUgcG9ydFxuICAgIHZhciBzdGFydGRpciA9IHRoaXMuZ2V0U3RhcnREaXIoKSxcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCA9IGZhbHNlLFxuICAgICAgICBzdGFydHBvcnRDYW5IYXZlID0gdHJ1ZTtcblxuICAgIGlmIChzdGFydGRpciAhPT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCA9IHRoaXMuc3RhcnRwb3J0Lmhhc0xpbWl0ZWREaXJzKCk7XG4gICAgICAgIHN0YXJ0cG9ydENhbkhhdmUgPSB0aGlzLnN0YXJ0cG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKHN0YXJ0ZGlyLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0ZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fFx0XHRcdFx0XHRcdFx0Ly8gcmVjYWxjIHN0YXJ0ZGlyIGlmIGVtcHR5XG4gICAgICAgIHN0YXJ0cG9ydEhhc0xpbWl0ZWQgJiYgIXN0YXJ0cG9ydENhbkhhdmUpIHtcdFx0Ly8gb3IgaXMgbGltaXRlZCBhbmQgdXNlcnByZWYgaXMgaW52YWxpZFxuICAgICAgICBzdGFydGRpciA9IHRoaXMuc3RhcnRwb3J0LmdldFN0YXJ0RW5kRGlyVG8odGd0LCB0cnVlKTtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSB0aGlzLnN0YXJ0cG9ydC5jcmVhdGVTdGFydEVuZFBvaW50VG8odGd0LCBzdGFydGRpcik7XG4gICAgdGhpcy5zdGFydHBvaW50Lm93bmVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlRW5kUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGRzdFBvcnRzID0gW10sXG4gICAgICAgIHRndCxcbiAgICAgICAgaSA9IHRoaXMuZW5kcG9ydHMubGVuZ3RoO1xuXG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoID4gMCwgJ0FyUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiB0aGlzLmVuZHBvcnRzIGNhbm5vdCBiZSBlbXB0eSEnKTtcblxuICAgIC8vUmVtb3ZlIG9sZCB0aGlzLmVuZHBvaW50XG4gICAgaWYgKHRoaXMuZW5kcG9ydCAmJiB0aGlzLmVuZHBvcnQuaGFzUG9pbnQodGhpcy5lbmRwb2ludCkpIHtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgIH1cblxuICAgIC8vR2V0IGF2YWlsYWJsZSBwb3J0c1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHNbaV0ub3duZXIsICdBUlBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogdGhpcy5lbmRwb3J0IGhhcyBpbnZhbGlkIHRoaXMub3duZXIhJyk7XG4gICAgICAgIGlmICh0aGlzLmVuZHBvcnRzW2ldLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgIGRzdFBvcnRzLnB1c2godGhpcy5lbmRwb3J0c1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZHN0UG9ydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRzdFBvcnRzID0gdGhpcy5lbmRwb3J0cztcbiAgICB9XG5cbiAgICAvL1ByZXZlbnRpbmcgc2FtZSBzdGFydC90aGlzLmVuZHBvcnRcbiAgICBpZiAodGhpcy5zdGFydHBvcnQgJiYgZHN0UG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBpID0gZHN0UG9ydHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoZHN0UG9ydHNbaV0gPT09IHRoaXMuc3RhcnRwb3J0KSB7XG4gICAgICAgICAgICAgICAgZHN0UG9ydHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9HZXR0aW5nIHRhcmdldFxuICAgIGlmICh0aGlzLmlzQXV0b1JvdXRlZCgpKSB7XG5cbiAgICAgICAgdmFyIGFjY3VtdWxhdGVQb3J0Q2VudGVycyA9IGZ1bmN0aW9uIChwcmV2LCBjdXJyZW50KSB7XG4gICAgICAgICAgICB2YXIgY2VudGVyID0gY3VycmVudC5yZWN0LmdldENlbnRlcigpO1xuICAgICAgICAgICAgcHJldi54ICs9IGNlbnRlci54O1xuICAgICAgICAgICAgcHJldi55ICs9IGNlbnRlci55O1xuICAgICAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICAgIH07XG4gICAgICAgIHRndCA9IHRoaXMuc3RhcnRwb3J0cy5yZWR1Y2UoYWNjdW11bGF0ZVBvcnRDZW50ZXJzLCBuZXcgQXJQb2ludCgwLCAwKSk7XG5cbiAgICAgICAgdGd0LnggLz0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDtcbiAgICAgICAgdGd0LnkgLz0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRndCA9IHRoaXMuY3VzdG9tUGF0aERhdGFbdGhpcy5jdXN0b21QYXRoRGF0YS5sZW5ndGggLSAxXTtcbiAgICB9XG5cbiAgICAvL0dldCB0aGUgb3B0aW1hbCBwb3J0IHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLmVuZHBvcnQgPSBVdGlscy5nZXRPcHRpbWFsUG9ydHMoZHN0UG9ydHMsIHRndCk7XG5cbiAgICAvL0NyZWF0ZSB0aGlzLmVuZHBvaW50IGF0IHRoZSBwb3J0XG4gICAgdmFyIGVuZGRpciA9IHRoaXMuZ2V0RW5kRGlyKCksXG4gICAgICAgIHN0YXJ0ZGlyID0gdGhpcy5nZXRTdGFydERpcigpLFxuICAgICAgICBlbmRwb3J0SGFzTGltaXRlZCA9IGZhbHNlLFxuICAgICAgICBlbmRwb3J0Q2FuSGF2ZSA9IHRydWU7XG5cbiAgICBpZiAoZW5kZGlyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICBlbmRwb3J0SGFzTGltaXRlZCA9IHRoaXMuZW5kcG9ydC5oYXNMaW1pdGVkRGlycygpO1xuICAgICAgICBlbmRwb3J0Q2FuSGF2ZSA9IHRoaXMuZW5kcG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGVuZGRpciwgZmFsc2UpO1xuICAgIH1cbiAgICBpZiAoZW5kZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fCAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsaWtlIGFib3ZlXG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkICYmICFlbmRwb3J0Q2FuSGF2ZSkge1xuICAgICAgICBlbmRkaXIgPSB0aGlzLmVuZHBvcnQuZ2V0U3RhcnRFbmREaXJUbyh0Z3QsIGZhbHNlLCB0aGlzLnN0YXJ0cG9ydCA9PT0gdGhpcy5lbmRwb3J0ID9cbiAgICAgICAgICAgIHN0YXJ0ZGlyIDogQ09OU1RBTlRTLkRpck5vbmUpO1xuICAgIH1cblxuICAgIHRoaXMuZW5kcG9pbnQgPSB0aGlzLmVuZHBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvKHRndCwgZW5kZGlyKTtcbiAgICB0aGlzLmVuZHBvaW50Lm93bmVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5lbmRwb3J0O1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzQ29ubmVjdGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0ZSAmIENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmFkZFRhaWwgPSBmdW5jdGlvbiAocHQpIHtcbiAgICBhc3NlcnQoIXRoaXMuaXNDb25uZWN0ZWQoKSxcbiAgICAgICAgJ0FSUGF0aC5hZGRUYWlsOiAhdGhpcy5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgIHRoaXMucG9pbnRzLnB1c2gocHQpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmRlbGV0ZUFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKTtcbiAgICB0aGlzLnN0YXRlID0gQ09OU1RBTlRTLlBhdGhTdGF0ZURlZmF1bHQ7XG4gICAgdGhpcy5jbGVhclBvcnRzKCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0U3RhcnRCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBvcnQgPSB0aGlzLnN0YXJ0cG9ydCB8fCB0aGlzLnN0YXJ0cG9ydHNbMF07XG4gICAgcmV0dXJuIHBvcnQub3duZXIuZ2V0Um9vdEJveCgpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldEVuZEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IHRoaXMuZW5kcG9ydCB8fCB0aGlzLmVuZHBvcnRzWzBdO1xuICAgIHJldHVybiBwb3J0Lm93bmVyLmdldFJvb3RCb3goKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRPdXRPZkJveFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAoaGludERpcikge1xuICAgIHZhciBzdGFydEJveFJlY3QgPSB0aGlzLmdldFN0YXJ0Qm94KCk7XG5cbiAgICBhc3NlcnQoaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcsICdBUlBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50OiBoaW50RGlyICE9PSBDT05TVEFOVFMuRGlyU2tldyBGQUlMRUQnKTtcbiAgICBhc3NlcnQodGhpcy5wb2ludHMubGVuZ3RoID49IDIsICdBUlBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50OiB0aGlzLnBvaW50cy5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIHZhciBwb3MgPSAwLFxuICAgICAgICBwID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbcG9zKytdKSxcbiAgICAgICAgZCA9IFV0aWxzLmdldERpcih0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKTtcblxuICAgIGlmIChkID09PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICBkID0gaGludERpcjtcbiAgICB9XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZCkgRkFJTEVEJyk7XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGQpKSB7XG4gICAgICAgIHAueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHN0YXJ0Qm94UmVjdCwgZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRCb3hSZWN0LCBkKTtcbiAgICB9XG5cbiAgICAvL2Fzc2VydChVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8XG4gICAgLy8gVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCwgJ1V0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09XG4gICAgLy8gVXRpbHMucmV2ZXJzZURpciAoIGQgKSB8fCBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0T3V0T2ZCb3hFbmRQb2ludCA9IGZ1bmN0aW9uIChoaW50RGlyKSB7XG4gICAgdmFyIGVuZEJveFJlY3QgPSB0aGlzLmdldEVuZEJveCgpO1xuXG4gICAgYXNzZXJ0KGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3LCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3IEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLnBvaW50cy5sZW5ndGggPj0gMiwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiB0aGlzLnBvaW50cy5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIHZhciBwb3MgPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxLFxuICAgICAgICBwID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbcG9zLS1dKSxcbiAgICAgICAgZCA9IFV0aWxzLmdldERpcih0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKTtcblxuICAgIGlmIChkID09PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICBkID0gaGludERpcjtcbiAgICB9XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGQpIEZBSUxFRCcpO1xuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkKSkge1xuICAgICAgICBwLnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRCb3hSZWN0LCBkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwLnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRCb3hSZWN0LCBkKTtcbiAgICB9XG5cbiAgICAvL2Fzc2VydChVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8XG4gICAgLy8gVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiBVdGlscy5nZXREaXJcbiAgICAvLyAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IGQgfHwgVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNpbXBsaWZ5VHJpdmlhbGx5ID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCghdGhpcy5pc0Nvbm5lY3RlZCgpLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiAhaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLnBvaW50cy5sZW5ndGggPD0gMikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIHBvczEgPSBwb3M7XG5cbiAgICBhc3NlcnQocG9zMSAhPT0gdGhpcy5wb2ludHMubGVuZ3RoLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiBwb3MxICE9PSB0aGlzLnBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgdmFyIHAxID0gdGhpcy5wb2ludHNbcG9zKytdLFxuICAgICAgICBwb3MyID0gcG9zO1xuXG4gICAgYXNzZXJ0KHBvczIgIT09IHRoaXMucG9pbnRzLmxlbmd0aCwgJ0FSUGF0aC5zaW1wbGlmeVRyaXZpYWxseTogcG9zMiAhPT0gdGhpcy5wb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuICAgIHZhciBwMiA9IHRoaXMucG9pbnRzW3BvcysrXSxcbiAgICAgICAgZGlyMTIgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKSxcbiAgICAgICAgcG9zMyA9IHBvcztcblxuICAgIGFzc2VydChwb3MzICE9PSB0aGlzLnBvaW50cy5sZW5ndGgsICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6IHBvczMgIT09IHRoaXMucG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICB2YXIgcDMgPSB0aGlzLnBvaW50c1twb3MrK10sXG4gICAgICAgIGRpcjIzID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAyKSk7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBpZiAoZGlyMTIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8IGRpcjIzID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fFxuICAgICAgICAgICAgKGRpcjEyICE9PSBDT05TVEFOVFMuRGlyU2tldyAmJiBkaXIyMyAhPT0gQ09OU1RBTlRTLkRpclNrZXcgJiZcbiAgICAgICAgICAgIChkaXIxMiA9PT0gZGlyMjMgfHwgZGlyMTIgPT09IFV0aWxzLnJldmVyc2VEaXIoZGlyMjMpKSApKSB7XG4gICAgICAgICAgICB0aGlzLnBvaW50cy5zcGxpY2UocG9zMiwgMSk7XG4gICAgICAgICAgICBwb3MtLTtcbiAgICAgICAgICAgIHBvczMtLTtcbiAgICAgICAgICAgIGRpcjEyID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3MxID0gcG9zMjtcbiAgICAgICAgICAgIHAxID0gcDI7XG4gICAgICAgICAgICBkaXIxMiA9IGRpcjIzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvcyA9PT0gdGhpcy5wb2ludHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBwb3MyID0gcG9zMztcbiAgICAgICAgcDIgPSBwMztcblxuICAgICAgICBwb3MzID0gcG9zO1xuICAgICAgICBwMyA9IHRoaXMucG9pbnRzW3BvcysrXTtcblxuICAgICAgICBkaXIyMyA9IFV0aWxzLmdldERpcihwMy5taW51cyhwMikpO1xuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRQb2ludExpc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucG9pbnRzO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzUGF0aENsaXAgPSBmdW5jdGlvbiAociwgaXNTdGFydE9yRW5kUmVjdCkge1xuICAgIHZhciB0bXAgPSB0aGlzLnBvaW50cy5nZXRUYWlsRWRnZSgpLFxuICAgICAgICBhID0gdG1wLnN0YXJ0LFxuICAgICAgICBiID0gdG1wLmVuZCxcbiAgICAgICAgcG9zID0gdG1wLnBvcyxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIG51bUVkZ2VzID0gdGhpcy5wb2ludHMubGVuZ3RoIC0gMTtcblxuICAgIHdoaWxlIChwb3MgPj0gMCkge1xuICAgICAgICBpZiAoaXNTdGFydE9yRW5kUmVjdCAmJiAoIGkgPT09IDAgfHwgaSA9PT0gbnVtRWRnZXMgLSAxICkpIHtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50SW4oYSwgciwgMSkgJiZcbiAgICAgICAgICAgICAgICBVdGlscy5pc1BvaW50SW4oYiwgciwgMSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc0xpbmVDbGlwUmVjdChhLCBiLCByKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSB0aGlzLnBvaW50cy5nZXRQcmV2RWRnZShwb3MsIGEsIGIpO1xuICAgICAgICBhID0gdG1wLnN0YXJ0O1xuICAgICAgICBiID0gdG1wLmVuZDtcbiAgICAgICAgcG9zID0gdG1wLnBvcztcbiAgICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5pc0ZpeGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoRml4ZWQpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5pc01vdmVhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoRml4ZWQpID09PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgYXNzZXJ0KHRoaXMub3duZXIgIT09IG51bGwsICdBUlBhdGguc2V0U3RhdGU6IHRoaXMub3duZXIgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLnN0YXRlID0gcztcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kRGlyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhID0gdGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhFbmRNYXNrO1xuICAgIHJldHVybiBhICYgQ09OU1RBTlRTLlBhdGhFbmRPblRvcCA/IENPTlNUQU5UUy5EaXJUb3AgOlxuICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhFbmRPblJpZ2h0ID8gQ09OU1RBTlRTLkRpclJpZ2h0IDpcbiAgICAgICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uQm90dG9tID8gQ09OU1RBTlRTLkRpckJvdHRvbSA6XG4gICAgICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoRW5kT25MZWZ0ID8gQ09OU1RBTlRTLkRpckxlZnQgOiBDT05TVEFOVFMuRGlyTm9uZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydERpciA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYSA9IHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoU3RhcnRNYXNrO1xuICAgIHJldHVybiBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uVG9wID8gQ09OU1RBTlRTLkRpclRvcCA6XG4gICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25SaWdodCA/IENPTlNUQU5UUy5EaXJSaWdodCA6XG4gICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uQm90dG9tID8gQ09OU1RBTlRTLkRpckJvdHRvbSA6XG4gICAgICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoU3RhcnRPbkxlZnQgPyBDT05TVEFOVFMuRGlyTGVmdCA6IENPTlNUQU5UUy5EaXJOb25lO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldEVuZERpciA9IGZ1bmN0aW9uIChwYXRoRW5kKSB7XG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gKHRoaXMuYXR0cmlidXRlcyAmIH5DT05TVEFOVFMuUGF0aEVuZE1hc2spICsgcGF0aEVuZDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGFydERpciA9IGZ1bmN0aW9uIChwYXRoU3RhcnQpIHtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSAodGhpcy5hdHRyaWJ1dGVzICYgfkNPTlNUQU5UUy5QYXRoU3RhcnRNYXNrKSArIHBhdGhTdGFydDtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjdXN0b20gcG9pbnRzIG9mIHRoZSBwYXRoIGFuZCBkZXRlcm1pbmUgc3RhcnQvZW5kIHBvaW50cy9wb3J0cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5PEFyUG9pbnQ+fSBwb2ludHNcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldEN1c3RvbVBhdGhQb2ludHMgPSBmdW5jdGlvbiAocG9pbnRzKSB7XG4gICAgdGhpcy5jdXN0b21QYXRoRGF0YSA9IHBvaW50cztcblxuICAgIC8vIEZpbmQgdGhlIHN0YXJ0L2VuZHBvcnRzXG4gICAgdGhpcy5jYWxjdWxhdGVTdGFydEVuZFBvcnRzKCk7XG5cbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKS5jb25jYXQocG9pbnRzKTtcblxuICAgIC8vIEFkZCB0aGUgc3RhcnQvZW5kIHBvaW50cyB0byB0aGUgbGlzdFxuICAgIHRoaXMucG9pbnRzLnVuc2hpZnQodGhpcy5zdGFydHBvaW50KTtcbiAgICB0aGlzLnBvaW50cy5wdXNoKHRoaXMuZW5kcG9pbnQpO1xuXG4gICAgLy8gU2V0IGFzIGNvbm5lY3RlZFxuICAgIHRoaXMuc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY3JlYXRlQ3VzdG9tUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnBvaW50cy5zaGlmdCgpO1xuICAgIHRoaXMucG9pbnRzLnBvcCgpO1xuXG4gICAgdGhpcy5wb2ludHMudW5zaGlmdCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIHRoaXMucG9pbnRzLnB1c2godGhpcy5lbmRwb2ludCk7XG5cbiAgICB0aGlzLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnJlbW92ZVBhdGhDdXN0b21pemF0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gW107XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYXJlVGhlcmVQYXRoQ3VzdG9taXphdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tUGF0aERhdGEubGVuZ3RoICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzQXV0b1JvdXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pc0F1dG9Sb3V0aW5nT247XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0QXV0b1JvdXRpbmcgPSBmdW5jdGlvbiAoYXJTdGF0ZSkge1xuICAgIHRoaXMuaXNBdXRvUm91dGluZ09uID0gYXJTdGF0ZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgdGhpcy5zdGFydHBvcnQucmVtb3ZlUG9pbnQodGhpcy5zdGFydHBvaW50KTtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaTtcblxuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoID4gMCwgJ1BhdGggaGFzIG5vIHN0YXJ0cG9ydHMhJyk7XG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoID4gMCwgJ1BhdGggaGFzIG5vIGVuZHBvcnRzIScpO1xuXG4gICAgZm9yIChpID0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydHNbaV0uYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLmVuZHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmVuZHBvcnRzW2ldLmFzc2VydFZhbGlkKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNBdXRvUm91dGVkKCkpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgYXNzZXJ0KHRoaXMucG9pbnRzLmxlbmd0aCAhPT0gMCxcbiAgICAgICAgICAgICAgICAnQVJQYXRoLmFzc2VydFZhbGlkOiB0aGlzLnBvaW50cy5sZW5ndGggIT09IDAgRkFJTEVEJyk7XG4gICAgICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5nZXRQb2ludExpc3QoKTtcbiAgICAgICAgICAgIHBvaW50cy5hc3NlcnRWYWxpZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgaXQgaGFzIGEgc3RhcnRwb2ludCwgbXVzdCBhbHNvIGhhdmUgYSBzdGFydHBvcnRcbiAgICBpZiAodGhpcy5zdGFydHBvaW50KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydCwgJ1BhdGggaGFzIGEgc3RhcnRwb2ludCB3aXRob3V0IGEgc3RhcnRwb3J0Jyk7XG4gICAgfVxuICAgIGlmICh0aGlzLmVuZHBvaW50KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLmVuZHBvcnQsICdQYXRoIGhhcyBhIGVuZHBvaW50IHdpdGhvdXQgYSBlbmRwb3J0Jyk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMub3duZXIsICdQYXRoIGRvZXMgbm90IGhhdmUgb3duZXIhJyk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJQYXRoO1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpO1xuXG52YXIgQXJQb2ludCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgLy8gTXVsdGlwbGUgQ29uc3RydWN0b3JzXG4gICAgaWYgKHggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB4ID0gMDtcbiAgICAgICAgeSA9IDA7XG4gICAgfSBlbHNlIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHgueTtcbiAgICAgICAgeCA9IHgueDtcbiAgICB9XG5cbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBwb2ludHMgaGF2ZSB0aGUgc2FtZSBjb29yZGluYXRlcy5cbiAqXG4gKiBAcGFyYW0ge0FyUG9pbnR9IG90aGVyUG9pbnRcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkFyUG9pbnQucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlclBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMueCA9PT0gb3RoZXJQb2ludC54ICYmIHRoaXMueSA9PT0gb3RoZXJQb2ludC55O1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgdGhpcy54ICs9IG90aGVyT2JqZWN0LmR4O1xuICAgIHRoaXMueSArPSBvdGhlck9iamVjdC5keTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKG90aGVyT2JqZWN0KSB7IC8vZXF1aXZhbGVudCB0byArPVxuICAgIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QuY3g7XG4gICAgICAgIHRoaXMueSArPSBvdGhlck9iamVjdC5jeTtcbiAgICB9IGVsc2UgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QueDtcbiAgICAgICAgdGhpcy55ICs9IG90aGVyT2JqZWN0Lnk7XG4gICAgfVxufTtcblxuQXJQb2ludC5wcm90b3R5cGUuc3VidHJhY3QgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMueCAtPSBvdGhlck9iamVjdC5jeDtcbiAgICAgICAgdGhpcy55IC09IG90aGVyT2JqZWN0LmN5O1xuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMueCAtPSBvdGhlck9iamVjdC54O1xuICAgICAgICB0aGlzLnkgLT0gb3RoZXJPYmplY3QueTtcbiAgICB9XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5wbHVzID0gZnVuY3Rpb24gKG90aGVyT2JqZWN0KSB7IC8vZXF1aXZhbGVudCB0byArXG4gICAgdmFyIG9iamVjdENvcHkgPSBudWxsO1xuXG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIG9iamVjdENvcHkgPSBuZXcgQXJQb2ludCh0aGlzKTtcbiAgICAgICAgb2JqZWN0Q29weS5hZGQob3RoZXJPYmplY3QpO1xuXG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KG90aGVyT2JqZWN0KTtcbiAgICAgICAgb2JqZWN0Q29weS54ICs9IHRoaXMueDtcbiAgICAgICAgb2JqZWN0Q29weS55ICs9IHRoaXMueTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdENvcHkgfHwgdW5kZWZpbmVkO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUubWludXMgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHtcbiAgICB2YXIgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KG90aGVyT2JqZWN0KTtcblxuICAgIGlmIChvdGhlck9iamVjdC5jeCAhPT0gdW5kZWZpbmVkICYmIG90aGVyT2JqZWN0LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb2JqZWN0Q29weS5zdWJ0cmFjdCh0aGlzKTtcblxuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QueCAhPT0gdW5kZWZpbmVkICYmIG90aGVyT2JqZWN0LnkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvYmplY3RDb3B5ID0gbmV3IEFyU2l6ZSgpO1xuICAgICAgICBvYmplY3RDb3B5LmN4ID0gdGhpcy54IC0gb3RoZXJPYmplY3QueDtcbiAgICAgICAgb2JqZWN0Q29weS5jeSA9IHRoaXMueSAtIG90aGVyT2JqZWN0Lnk7XG5cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdENvcHk7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAob3RoZXJQb2ludCkge1xuICAgIHRoaXMueCA9IG90aGVyUG9pbnQueDtcbiAgICB0aGlzLnkgPSBvdGhlclBvaW50Lnk7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAnKCcgKyB0aGlzLnggKyAnLCAnICsgdGhpcy55ICsgJyknO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclBvaW50O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLCAgLy8gRklYTUVcbiAgICBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuUG9pbnRMaXN0Jyk7XG5cbnZhciBBclBvaW50TGlzdFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy51bnNoaWZ0KGFyZ3VtZW50c1tpXSk7XG4gICAgfVxufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZSA9IFtdO1xuXG4vLyBXcmFwcGVyIEZ1bmN0aW9uc1xuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCkge1xuICAgIHZhciBuZXdQb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBuZXdQb2ludHMucHVzaCh0aGlzW2ldKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICBuZXdQb2ludHMucHVzaChsaXN0W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1BvaW50cztcbn07XG5cbi8vIEZ1bmN0aW9uc1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpc1t0aGlzLmxlbmd0aCAtIDFdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRUYWlsRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxlbmd0aDtcbiAgICB9XG5cbiAgICB2YXIgcG9zID0gdGhpcy5sZW5ndGggLSAxLFxuICAgICAgICBlbmQgPSB0aGlzW3Bvcy0tXSxcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG5cbiAgICByZXR1cm4geydwb3MnOiBwb3MsICdzdGFydCc6IHN0YXJ0LCAnZW5kJzogZW5kfTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0UHJldkVkZ2UgPSBmdW5jdGlvbiAocG9zLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgZW5kID0gdGhpc1twb3MtLV07XG4gICAgaWYgKHBvcyAhPT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG4gICAgfVxuXG4gICAgcmV0dXJuIHsncG9zJzogcG9zLCAnc3RhcnQnOiBzdGFydCwgJ2VuZCc6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldEVkZ2UgPSBmdW5jdGlvbiAocG9zLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgc3RhcnQgPSB0aGlzW3BvcysrXTtcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0RWRnZTogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBlbmQgPSB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFRhaWxFZGdlUHRycyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9zID0gdGhpcy5sZW5ndGgsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBpZiAodGhpcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiB7J3Bvcyc6IHBvc307XG4gICAgfVxuXG4gICAgYXNzZXJ0KC0tcG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0VGFpbEVkZ2VQdHJzOiAtLXBvcyA8IHRoaXMubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgZW5kID0gdGhpc1twb3MtLV07XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLCAnQXJQb2ludExpc3RQYXRoLmdldFRhaWxFZGdlUHRyczogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBzdGFydCA9IHRoaXNbcG9zXTtcblxuICAgIHJldHVybiB7J3Bvcyc6IHBvcywgJ3N0YXJ0Jzogc3RhcnQsICdlbmQnOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQcmV2RWRnZVB0cnMgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgdmFyIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBlbmQgPSB0aGlzW3Bvc107XG5cbiAgICBpZiAocG9zLS0gPiAwKSB7XG4gICAgICAgIHN0YXJ0ID0gdGhpc1twb3NdO1xuICAgIH1cblxuICAgIHJldHVybiB7cG9zOiBwb3MsIHN0YXJ0OiBzdGFydCwgZW5kOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldEVuZFBvaW50ID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHBvcysrO1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCxcbiAgICAgICAgJ0FyUG9pbnRMaXN0UGF0aC5nZXRFbmRQb2ludDogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gdGhpc1twb3NdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQb2ludEJlZm9yZUVkZ2UgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zLS07XG4gICAgaWYgKHBvcyA9PT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0UG9pbnRBZnRlckVkZ2UgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zKys7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLFxuICAgICAgICAnQXJQb2ludExpc3RQYXRoLmdldFBvaW50QWZ0ZXJFZGdlOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHBvcysrO1xuICAgIGlmIChwb3MgPT09IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKG1zZykge1xuICAgIC8vIENoZWNrIHRvIG1ha2Ugc3VyZSBlYWNoIHBvaW50IG1ha2VzIGEgaG9yaXpvbnRhbC92ZXJ0aWNhbCBsaW5lIHdpdGggaXQncyBuZWlnaGJvcnNcbiAgICBtc2cgPSBtc2cgfHwgJyc7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgICBhc3NlcnQoISF0aGlzW2ldLm1pbnVzLCAnQmFkIHZhbHVlIGF0IHBvc2l0aW9uICcgKyBpICsgJyAoJyArIFV0aWxzLnN0cmluZ2lmeSh0aGlzW2ldKSArICcpJyk7XG4gICAgICAgIGFzc2VydCghIXRoaXNbaSAtIDFdLm1pbnVzLCAnQmFkIHZhbHVlIGF0IHBvc2l0aW9uICcgKyAoaSAtIDEpICsgJyAoJyArIFV0aWxzLnN0cmluZ2lmeSh0aGlzW2kgLSAxXSkgKyAnKScpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZ2V0RGlyKHRoaXNbaSAtIDFdLm1pbnVzKHRoaXNbaV0pKSksXG4gICAgICAgICAgICBtc2cgKyAnXFxuXFx0QXJQb2ludExpc3RQYXRoIGNvbnRhaW5zIHNrZXcgZWRnZTpcXG4nICsgVXRpbHMuc3RyaW5naWZ5KHRoaXMpKTtcbiAgICB9XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkUG9zID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5hc3NlcnRWYWxpZFBvczogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmR1bXBQb2ludHMgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgbXNnICs9ICcsIHBvaW50cyBkdW1wIGJlZ2luOlxcbic7XG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBwO1xuICAgIHdoaWxlIChwb3MgPCB0aGlzLmxlbmd0aCkge1xuICAgICAgICBwID0gdGhpc1twb3MrK107XG4gICAgICAgIG1zZyArPSBpICsgJy46ICgnICsgcC54ICsgJywgJyArIHAueSArICcpXFxuJztcbiAgICAgICAgaSsrO1xuICAgIH1cbiAgICBtc2cgKz0gJ3BvaW50cyBkdW1wIGVuZC4nO1xuICAgIF9sb2dnZXIuZGVidWcobXNnKTtcbiAgICByZXR1cm4gbXNnO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclBvaW50TGlzdFBhdGg7XG5cbiIsIi8qanNoaW50IG5vZGU6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJTaXplID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlNpemUnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpO1xuXG52YXIgQXV0b1JvdXRlclBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5pZCA9IG51bGw7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5saW1pdGVkRGlyZWN0aW9ucyA9IHRydWU7XG4gICAgdGhpcy5yZWN0ID0gbmV3IEFyUmVjdCgpO1xuICAgIHRoaXMuYXR0cmlidXRlcyA9IENPTlNUQU5UUy5Qb3J0RGVmYXVsdDtcblxuICAgIC8vIEZvciB0aGlzLnBvaW50cyBvbiBDT05TVEFOVFMuRGlyVG9wLCBDT05TVEFOVFMuRGlyTGVmdCwgQ09OU1RBTlRTLkRpclJpZ2h0LCBldGNcbiAgICB0aGlzLnBvaW50cyA9IFtbXSwgW10sIFtdLCBbXV07XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5hdmFpbGFibGVBcmVhID0gW107ICAvLyBhdmFpbGFibGVBcmVhcyBrZWVwcyB0cmFjayBvZiB2aXNpYmxlIChub3Qgb3ZlcmxhcHBlZCkgcG9ydGlvbnMgb2YgdGhlIHBvcnRcblxuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbGN1bGF0ZVNlbGZQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmdldFRvcExlZnQoKSkpO1xuXG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmZsb29yKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmxlZnQsIHRoaXMucmVjdC5mbG9vcikpO1xuICAgIHRoaXMucmVzZXRBdmFpbGFibGVBcmVhKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVjdC5pc1JlY3RFbXB0eSgpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWN0LmdldENlbnRlclBvaW50KCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgYXNzZXJ0KHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyxcbiAgICAgICAgJ0FSUG9ydC5zZXRSZWN0OiByLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFzc2lnbihyKTtcbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbiAgICB0aGlzLnJlc2V0QXZhaWxhYmxlQXJlYSgpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnNoaWZ0QnkgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgYXNzZXJ0KCF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSwgJ0FSUG9ydC5zaGlmdEJ5OiAhdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCkgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFkZChvZmZzZXQpO1xuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG4gICAgLy8gU2hpZnQgcG9pbnRzXG4gICAgdGhpcy5zaGlmdFBvaW50cyhvZmZzZXQpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmlzQ29ubmVjdFRvQ2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBvcnRDb25uZWN0VG9DZW50ZXIpICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmhhc0xpbWl0ZWREaXJzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmxpbWl0ZWREaXJlY3Rpb25zO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnNldExpbWl0ZWREaXJzID0gZnVuY3Rpb24gKGx0ZCkge1xuICAgIHRoaXMubGltaXRlZERpcmVjdGlvbnMgPSBsdGQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucG9ydE9uV2hpY2hFZGdlID0gZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgcmV0dXJuIFV0aWxzLm9uV2hpY2hFZGdlKHRoaXMucmVjdCwgcG9pbnQpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50T24gPSBmdW5jdGlvbiAoZGlyLCBpc1N0YXJ0KSB7XG4gICAgYXNzZXJ0KDAgPD0gZGlyICYmIGRpciA8PSAzLCAnQVJQb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T246IDAgPD0gZGlyICYmIGRpciA8PSAzIEZBSUxFRCEnKTtcblxuICAgIGlmIChpc1N0YXJ0KSB7XG4gICAgICAgIGRpciArPSA0O1xuICAgIH1cblxuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmICgxIDw8IGRpcikpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5jYW5IYXZlU3RhcnRFbmRQb2ludCA9IGZ1bmN0aW9uIChpc1N0YXJ0KSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgKGlzU3RhcnQgPyBDT05TVEFOVFMuUG9ydFN0YXJ0T25BbGwgOiBDT05TVEFOVFMuUG9ydEVuZE9uQWxsKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCA9IGZ1bmN0aW9uIChpc0hvcml6b250YWwpIHtcbiAgICByZXR1cm4gKCh0aGlzLmF0dHJpYnV0ZXMgJlxuICAgIChpc0hvcml6b250YWwgPyBDT05TVEFOVFMuUG9ydFN0YXJ0RW5kSG9yaXpvbnRhbCA6IENPTlNUQU5UUy5Qb3J0U3RhcnRFbmRWZXJ0aWNhbCkpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5nZXRTdGFydEVuZERpclRvID0gZnVuY3Rpb24gKHBvaW50LCBpc1N0YXJ0LCBub3R0aGlzKSB7XG4gICAgYXNzZXJ0KCF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSwgJ0FSUG9ydC5nZXRTdGFydEVuZERpclRvOiAhdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCkgRkFJTEVEIScpO1xuXG4gICAgbm90dGhpcyA9IG5vdHRoaXMgPyBub3R0aGlzIDogQ09OU1RBTlRTLkRpck5vbmU7IC8vIGlmIG5vdHRoaXMgaXMgdW5kZWZpbmVkLCBzZXQgaXQgdG8gQ09OU1RBTlRTLkRpck5vbmUgKC0xKVxuXG4gICAgdmFyIG9mZnNldCA9IHBvaW50Lm1pbnVzKHRoaXMucmVjdC5nZXRDZW50ZXJQb2ludCgpKSxcbiAgICAgICAgZGlyMSA9IFV0aWxzLmdldE1ham9yRGlyKG9mZnNldCk7XG5cbiAgICBpZiAoZGlyMSAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMSwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjE7XG4gICAgfVxuXG4gICAgdmFyIGRpcjIgPSBVdGlscy5nZXRNaW5vckRpcihvZmZzZXQpO1xuXG4gICAgaWYgKGRpcjIgIT09IG5vdHRoaXMgJiYgdGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjIsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIyO1xuICAgIH1cblxuICAgIHZhciBkaXIzID0gVXRpbHMucmV2ZXJzZURpcihkaXIyKTtcblxuICAgIGlmIChkaXIzICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIzLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMztcbiAgICB9XG5cbiAgICB2YXIgZGlyNCA9IFV0aWxzLnJldmVyc2VEaXIoZGlyMSk7XG5cbiAgICBpZiAoZGlyNCAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyNCwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIxLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjIsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIyO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMywgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXI0LCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyNDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yb3VuZFRvSGFsZkdyaWQgPSBmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICB2YXIgYnR3biA9IChsZWZ0ICsgcmlnaHQpIC8gMjtcbiAgICBhc3NlcnQoYnR3biA8IE1hdGgubWF4KGxlZnQsIHJpZ2h0KSAmJiBidHduID4gTWF0aC5taW4obGVmdCwgcmlnaHQpLFxuICAgICAgICAncm91bmRUb0hhbGZHcmlkOiBidHduIHZhcmlhYmxlIG5vdCBiZXR3ZWVuIGxlZnQsIHJpZ2h0IHZhbHVlcy4gUGVyaGFwcyBib3gvY29ubmVjdGlvbkFyZWEgaXMgdG9vIHNtYWxsPycpO1xuICAgIHJldHVybiBidHduO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbyA9IGZ1bmN0aW9uIChwb2ludCwgZGlyKSB7XG4gICAgLy8gY2FsY3VsYXRlIHBhdGhBbmdsZVxuICAgIHZhciBkeCA9IHBvaW50LnggLSB0aGlzLmdldENlbnRlcigpLngsXG4gICAgICAgIGR5ID0gcG9pbnQueSAtIHRoaXMuZ2V0Q2VudGVyKCkueSxcbiAgICAgICAgcGF0aEFuZ2xlID0gTWF0aC5hdGFuMigtZHksIGR4KSxcbiAgICAgICAgayA9IDAsXG4gICAgICAgIG1heFggPSB0aGlzLnJlY3QucmlnaHQsXG4gICAgICAgIG1heFkgPSB0aGlzLnJlY3QuZmxvb3IsXG4gICAgICAgIG1pblggPSB0aGlzLnJlY3QubGVmdCxcbiAgICAgICAgbWluWSA9IHRoaXMucmVjdC5jZWlsLFxuICAgICAgICByZXN1bHRQb2ludCxcbiAgICAgICAgc21hbGxlclB0ID0gbmV3IEFyUG9pbnQobWluWCwgbWluWSksICAvLyBUaGUgdGhpcy5wb2ludHMgdGhhdCB0aGUgcmVzdWx0UG9pbnQgaXMgY2VudGVyZWQgYmV0d2VlblxuICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KG1heFgsIG1heFkpO1xuXG4gICAgLy8gRmluZCB0aGUgc21hbGxlciBhbmQgbGFyZ2VyIHBvaW50c1xuICAgIC8vIEFzIHRoZSBwb2ludHMgY2Fubm90IGJlIG9uIHRoZSBjb3JuZXIgb2YgYW4gZWRnZSAoYW1iaWd1b3VzIGRpcmVjdGlvbiksIFxuICAgIC8vIHdlIHdpbGwgc2hpZnQgdGhlIG1pbiwgbWF4IGluIG9uZSBwaXhlbFxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkgeyAgLy8gc2hpZnQgeCBjb29yZGluYXRlc1xuICAgICAgICBtaW5YKys7XG4gICAgICAgIG1heFgtLTtcbiAgICB9IGVsc2UgeyAvLyBzaGlmdCB5IGNvb3JkaW5hdGVzXG4gICAgICAgIG1pblkrKztcbiAgICAgICAgbWF4WS0tO1xuICAgIH1cblxuICAgIC8vIEFkanVzdCBhbmdsZSBiYXNlZCBvbiBwYXJ0IG9mIHBvcnQgdG8gd2hpY2ggaXQgaXMgY29ubmVjdGluZ1xuICAgIHN3aXRjaCAoZGlyKSB7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgcGF0aEFuZ2xlID0gMiAqIE1hdGguUEkgLSAocGF0aEFuZ2xlICsgTWF0aC5QSSAvIDIpO1xuICAgICAgICAgICAgbGFyZ2VyUHQueSA9IHRoaXMucmVjdC5jZWlsO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICBwYXRoQW5nbGUgPSAyICogTWF0aC5QSSAtIHBhdGhBbmdsZTtcbiAgICAgICAgICAgIHNtYWxsZXJQdC54ID0gdGhpcy5yZWN0LnJpZ2h0O1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcGF0aEFuZ2xlIC09IE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgc21hbGxlclB0LnkgPSB0aGlzLnJlY3QuZmxvb3I7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgbGFyZ2VyUHQueCA9IHRoaXMucmVjdC5sZWZ0O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhBbmdsZSA8IDApIHtcbiAgICAgICAgcGF0aEFuZ2xlICs9IDIgKiBNYXRoLlBJO1xuICAgIH1cblxuICAgIHBhdGhBbmdsZSAqPSAxODAgLyBNYXRoLlBJOyAgLy8gVXNpbmcgZGVncmVlcyBmb3IgZWFzaWVyIGRlYnVnZ2luZ1xuXG4gICAgLy8gRmluZGluZyB0aGlzLnBvaW50cyBvcmRlcmluZ1xuICAgIHdoaWxlIChrIDwgdGhpcy5wb2ludHNbZGlyXS5sZW5ndGggJiYgcGF0aEFuZ2xlID4gdGhpcy5wb2ludHNbZGlyXVtrXS5wYXRoQW5nbGUpIHtcbiAgICAgICAgaysrO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnBvaW50c1tkaXJdLmxlbmd0aCkge1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgICAgbGFyZ2VyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2tdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGsgIT09IHRoaXMucG9pbnRzW2Rpcl0ubGVuZ3RoKSB7XG4gICAgICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2sgLSAxXSk7XG4gICAgICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1ba10pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2sgLSAxXSk7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3VsdFBvaW50ID0gbmV3IEFyUG9pbnQoKGxhcmdlclB0LnggKyBzbWFsbGVyUHQueCkgLyAyLCAobGFyZ2VyUHQueSArIHNtYWxsZXJQdC55KSAvIDIpO1xuICAgIHJlc3VsdFBvaW50LnBhdGhBbmdsZSA9IHBhdGhBbmdsZTtcblxuICAgIC8vIE1vdmUgdGhlIHBvaW50IG92ZXIgdG8gYW4gJ3RoaXMuYXZhaWxhYmxlQXJlYScgaWYgYXBwcm9wcmlhdGVcbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGNsb3Nlc3RBcmVhID0gMCxcbiAgICAgICAgZGlzdGFuY2UgPSBJbmZpbml0eSxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIC8vIEZpbmQgZGlzdGFuY2UgZnJvbSBlYWNoIHRoaXMuYXZhaWxhYmxlQXJlYSBhbmQgc3RvcmUgY2xvc2VzdCBpbmRleFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMF07XG4gICAgICAgIGVuZCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtpXVsxXTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNPbkVkZ2Uoc3RhcnQsIGVuZCwgcmVzdWx0UG9pbnQpKSB7XG4gICAgICAgICAgICBjbG9zZXN0QXJlYSA9IC0xO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuZGlzdGFuY2VGcm9tTGluZShyZXN1bHRQb2ludCwgc3RhcnQsIGVuZCkgPCBkaXN0YW5jZSkge1xuICAgICAgICAgICAgY2xvc2VzdEFyZWEgPSBpO1xuICAgICAgICAgICAgZGlzdGFuY2UgPSBVdGlscy5kaXN0YW5jZUZyb21MaW5lKHJlc3VsdFBvaW50LCBzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjbG9zZXN0QXJlYSAhPT0gLTEgJiYgdGhpcy5pc0F2YWlsYWJsZSgpKSB7IC8vIHJlc3VsdFBvaW50IG5lZWRzIHRvIGJlIG1vdmVkIHRvIHRoZSBjbG9zZXN0IGF2YWlsYWJsZSBhcmVhXG4gICAgICAgIHZhciBkaXIyID0gVXRpbHMuZ2V0RGlyKHRoaXMuYXZhaWxhYmxlQXJlYVtjbG9zZXN0QXJlYV1bMF0ubWludXMocmVzdWx0UG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjIpLFxuICAgICAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjIpIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChkaXIyID09PSBDT05TVEFOVFMuRGlyTGVmdCB8fCBkaXIyID09PSBDT05TVEFOVFMuRGlyVG9wKSB7IC8vIFRoZW4gcmVzdWx0UG9pbnQgbXVzdCBiZSBtb3ZlZCB1cFxuICAgICAgICAgICAgbGFyZ2VyUHQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbY2xvc2VzdEFyZWFdWzFdO1xuICAgICAgICB9IGVsc2UgeyAvLyBUaGVuIHJlc3VsdFBvaW50IG11c3QgYmUgbW92ZWQgZG93blxuICAgICAgICAgICAgc21hbGxlclB0ID0gdGhpcy5hdmFpbGFibGVBcmVhW2Nsb3Nlc3RBcmVhXVswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdFBvaW50ID0gbmV3IEFyUG9pbnQoKGxhcmdlclB0LnggKyBzbWFsbGVyUHQueCkgLyAyLCAobGFyZ2VyUHQueSArIHNtYWxsZXJQdC55KSAvIDIpO1xuICAgIH1cblxuICAgIHRoaXMucG9pbnRzW2Rpcl0uc3BsaWNlKGssIDAsIHJlc3VsdFBvaW50KTtcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKSxcbiAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHJlc3VsdFBvaW50KSkgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcmVzdWx0UG9pbnQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucmVtb3ZlUG9pbnQgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB2YXIgcmVtb3ZlZDtcblxuICAgIHJlbW92ZWQgPSBVdGlscy5yZW1vdmVGcm9tQXJyYXlzLmFwcGx5KG51bGwsIFtwdF0uY29uY2F0KHRoaXMucG9pbnRzKSk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzUG9pbnQgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGs7XG5cbiAgICB3aGlsZSAoaSA8IDQpIHsgLy9DaGVjayBhbGwgc2lkZXMgZm9yIHRoZSBwb2ludFxuICAgICAgICBrID0gdGhpcy5wb2ludHNbaV0uaW5kZXhPZihwdCk7XG5cbiAgICAgICAgaWYgKGsgPiAtMSkgeyAvL0lmIHRoZSBwb2ludCBpcyBvbiB0aGlzIHNpZGUgb2YgdGhlIHBvcnRcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2hpZnRQb2ludHMgPSBmdW5jdGlvbiAoc2hpZnQpIHtcbiAgICBmb3IgKHZhciBzID0gdGhpcy5wb2ludHMubGVuZ3RoOyBzLS07KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50c1tzXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIC8vIFNoaWZ0IHRoaXMgcG9pbnRcbiAgICAgICAgICAgIHRoaXMucG9pbnRzW3NdW2ldLmFkZChzaGlmdCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0UG9pbnRDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGNvdW50ID0gMDtcblxuICAgIHdoaWxlIChpIDwgNCkgeyAvLyBDaGVjayBhbGwgc2lkZXMgZm9yIHRoZSBwb2ludFxuICAgICAgICBjb3VudCArPSB0aGlzLnBvaW50c1tpKytdLmxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gY291bnQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucmVzZXRBdmFpbGFibGVBcmVhID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXZhaWxhYmxlQXJlYSA9IFtdO1xuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyVG9wKSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbdGhpcy5yZWN0LmdldFRvcExlZnQoKSwgbmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCldKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKENPTlNUQU5UUy5EaXJSaWdodCkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW25ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmNlaWwpLCB0aGlzLnJlY3QuZ2V0Qm90dG9tUmlnaHQoKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpckJvdHRvbSkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW25ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpLCB0aGlzLnJlY3QuZ2V0Qm90dG9tUmlnaHQoKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpckxlZnQpKSB7XG4gICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFt0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpLCBuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKV0pO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmFkanVzdEF2YWlsYWJsZUFyZWEgPSBmdW5jdGlvbiAocikge1xuICAgIC8vRm9yIGFsbCBsaW5lcyBzcGVjaWZpZWQgaW4gYXZhaWxhYmxlQXJlYXMsIGNoZWNrIGlmIHRoZSBsaW5lIFV0aWxzLmludGVyc2VjdCBzIHRoZSByZWN0YW5nbGVcbiAgICAvL0lmIGl0IGRvZXMsIHJlbW92ZSB0aGUgcGFydCBvZiB0aGUgbGluZSB0aGF0IFV0aWxzLmludGVyc2VjdCBzIHRoZSByZWN0YW5nbGVcbiAgICBpZiAoIXRoaXMucmVjdC50b3VjaGluZyhyKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGkgPSB0aGlzLmF2YWlsYWJsZUFyZWEubGVuZ3RoLFxuICAgICAgICBpbnRlcnNlY3Rpb24sXG4gICAgICAgIGxpbmU7XG5cbiAgICB3aGlsZSAoaS0tKSB7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzTGluZUNsaXBSZWN0KHRoaXMuYXZhaWxhYmxlQXJlYVtpXVswXSwgdGhpcy5hdmFpbGFibGVBcmVhW2ldWzFdLCByKSkge1xuICAgICAgICAgICAgbGluZSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5zcGxpY2UoaSwgMSlbMF07XG4gICAgICAgICAgICBpbnRlcnNlY3Rpb24gPSBVdGlscy5nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3QobGluZVswXSwgbGluZVsxXSwgcik7XG5cbiAgICAgICAgICAgIGlmICghaW50ZXJzZWN0aW9uWzBdLmVxdWFscyhsaW5lWzBdKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFtsaW5lWzBdLCBpbnRlcnNlY3Rpb25bMF1dKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpbnRlcnNlY3Rpb25bMV0uZXF1YWxzKGxpbmVbMV0pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW2ludGVyc2VjdGlvblsxXSwgbGluZVsxXV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldFRvdGFsQXZhaWxhYmxlQXJlYSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGxlbmd0aCA9IG5ldyBBclNpemUoKTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgbGVuZ3RoLmFkZCh0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMV0ubWludXModGhpcy5hdmFpbGFibGVBcmVhW2ldWzBdKSk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGxlbmd0aC5jeCA9PT0gMCB8fCBsZW5ndGguY3kgPT09IDAsXG4gICAgICAgICdBUlBvcnQuZ2V0VG90YWxBdmFpbGFibGVBcmVhOiBsZW5ndGhbMF0gPT09IDAgfHwgbGVuZ3RoWzFdID09PSAwIEZBSUxFRCcpO1xuICAgIHJldHVybiBsZW5ndGguY3ggfHwgbGVuZ3RoLmN5O1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmF2YWlsYWJsZUFyZWEubGVuZ3RoID4gMDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBDaGVjayB0aGF0IGFsbCBwb2ludHMgYXJlIG9uIGEgc2lkZSBvZiB0aGUgcG9ydFxuICAgIHZhciBwb2ludDtcblxuICAgIGFzc2VydCh0aGlzLm93bmVyLCAnUG9ydCAnICsgdGhpcy5pZCArICcgZG9lcyBub3QgaGF2ZSB2YWxpZCBvd25lciEnKTtcbiAgICBmb3IgKHZhciBzID0gdGhpcy5wb2ludHMubGVuZ3RoOyBzLS07KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50c1tzXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHBvaW50ID0gdGhpcy5wb2ludHNbc11baV07XG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHBvaW50KSksXG4gICAgICAgICAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHJlc3VsdFBvaW50KSknICtcbiAgICAgICAgICAgICAgICAnIEZBSUxFRCcpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gUmVtb3ZlIGFsbCBwb2ludHNcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcblxuICAgIC8vIFJlbW92ZSBhbGwgcG9pbnRzIGFuZCBzZWxmIGZyb20gYWxsIHBhdGhzXG4gICAgdmFyIHBvaW50LFxuICAgICAgICBwYXRoO1xuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucG9pbnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBmb3IgKHZhciBqID0gdGhpcy5wb2ludHNbaV0ubGVuZ3RoOyBqLS07KSB7XG4gICAgICAgICAgICBwb2ludCA9IHRoaXMucG9pbnRzW2ldW2pdO1xuICAgICAgICAgICAgcGF0aCA9IHBvaW50Lm93bmVyO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGgsICdzdGFydC9lbmQgcG9pbnQgZG9lcyBub3QgaGF2ZSBhbiBvd25lciEnKTtcbiAgICAgICAgICAgIHBhdGgucmVtb3ZlUG9ydCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMucG9pbnRzID0gW1tdLCBbXSwgW10sIFtdXTtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyUG9ydDtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpLFxuICAgIExvZ2dlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Mb2dnZXInKSxcbiAgICBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5SZWN0Jyk7XG5cbnZhciBBclJlY3QgPSBmdW5jdGlvbiAoTGVmdCwgQ2VpbCwgUmlnaHQsIEZsb29yKSB7XG4gICAgaWYgKExlZnQgPT09IHVuZGVmaW5lZCkgeyAvL05vIGFyZ3VtZW50c1xuICAgICAgICBMZWZ0ID0gMDtcbiAgICAgICAgQ2VpbCA9IDA7XG4gICAgICAgIFJpZ2h0ID0gMDtcbiAgICAgICAgRmxvb3IgPSAwO1xuXG4gICAgfSBlbHNlIGlmIChDZWlsID09PSB1bmRlZmluZWQgJiYgTGVmdCBpbnN0YW5jZW9mIEFyUmVjdCkgeyAvLyBPbmUgYXJndW1lbnRcbiAgICAgICAgLy8gTGVmdCBpcyBhbiBBclJlY3RcbiAgICAgICAgQ2VpbCA9IExlZnQuY2VpbDtcbiAgICAgICAgUmlnaHQgPSBMZWZ0LnJpZ2h0O1xuICAgICAgICBGbG9vciA9IExlZnQuZmxvb3I7XG4gICAgICAgIExlZnQgPSBMZWZ0LmxlZnQ7XG5cbiAgICB9IGVsc2UgaWYgKFJpZ2h0ID09PSB1bmRlZmluZWQgJiYgTGVmdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHsgLy8gVHdvIGFyZ3VtZW50c1xuICAgICAgICAvLyBDcmVhdGluZyBBclJlY3Qgd2l0aCBBclBvaW50IGFuZCBlaXRoZXIgYW5vdGhlciBBclBvaW50IG9yIEFyU2l6ZVxuICAgICAgICBpZiAoQ2VpbCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICAgICAgUmlnaHQgPSBMZWZ0LnggKyBDZWlsLmN4O1xuICAgICAgICAgICAgRmxvb3IgPSBMZWZ0LnkgKyBDZWlsLmN5O1xuICAgICAgICAgICAgQ2VpbCA9IExlZnQueTtcbiAgICAgICAgICAgIExlZnQgPSBMZWZ0Lng7XG5cbiAgICAgICAgfSBlbHNlIGlmIChMZWZ0IGluc3RhbmNlb2YgQXJQb2ludCAmJiBDZWlsIGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICAgICAgUmlnaHQgPSBNYXRoLnJvdW5kKENlaWwueCk7XG4gICAgICAgICAgICBGbG9vciA9IE1hdGgucm91bmQoQ2VpbC55KTtcbiAgICAgICAgICAgIENlaWwgPSBNYXRoLnJvdW5kKExlZnQueSk7XG4gICAgICAgICAgICBMZWZ0ID0gTWF0aC5yb3VuZChMZWZ0LngpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEFyUmVjdCBDb25zdHJ1Y3RvcicpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKEZsb29yID09PSB1bmRlZmluZWQpIHsgLy8gSW52YWxpZFxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQXJSZWN0IENvbnN0cnVjdG9yJyk7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0ID0gTWF0aC5yb3VuZChMZWZ0KTtcbiAgICB0aGlzLmNlaWwgPSBNYXRoLnJvdW5kKENlaWwpO1xuICAgIHRoaXMuZmxvb3IgPSBNYXRoLnJvdW5kKEZsb29yKTtcbiAgICB0aGlzLnJpZ2h0ID0gTWF0aC5yb3VuZChSaWdodCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4geyd4JzogKHRoaXMubGVmdCArIHRoaXMucmlnaHQpIC8gMiwgJ3knOiAodGhpcy5jZWlsICsgdGhpcy5mbG9vcikgLyAyfTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0V2lkdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnJpZ2h0IC0gdGhpcy5sZWZ0KTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0SGVpZ2h0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5mbG9vciAtIHRoaXMuY2VpbCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldFNpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBBclNpemUodGhpcy5nZXRXaWR0aCgpLCB0aGlzLmdldEhlaWdodCgpKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0VG9wTGVmdCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyUG9pbnQodGhpcy5sZWZ0LCB0aGlzLmNlaWwpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRCb3R0b21SaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyUG9pbnQodGhpcy5yaWdodCwgdGhpcy5mbG9vcik7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldENlbnRlclBvaW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJQb2ludCh0aGlzLmxlZnQgKyB0aGlzLmdldFdpZHRoKCkgLyAyLCB0aGlzLmNlaWwgKyB0aGlzLmdldEhlaWdodCgpIC8gMik7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmlzUmVjdEVtcHR5ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICgodGhpcy5sZWZ0ID49IHRoaXMucmlnaHQpICYmICh0aGlzLmNlaWwgPj0gdGhpcy5mbG9vcikpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuXG5BclJlY3QucHJvdG90eXBlLmlzUmVjdE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMubGVmdCA9PT0gMCAmJlxuICAgICAgICB0aGlzLnJpZ2h0ID09PSAwICYmXG4gICAgICAgIHRoaXMuY2VpbCA9PT0gMCAmJlxuICAgICAgICB0aGlzLmZsb29yID09PSAwKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUucHRJblJlY3QgPSBmdW5jdGlvbiAocHQpIHtcbiAgICBpZiAocHQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBwdCA9IHB0WzBdO1xuICAgIH1cblxuICAgIGlmIChwdC54ID49IHRoaXMubGVmdCAmJlxuICAgICAgICBwdC54IDw9IHRoaXMucmlnaHQgJiZcbiAgICAgICAgcHQueSA+PSB0aGlzLmNlaWwgJiZcbiAgICAgICAgcHQueSA8PSB0aGlzLmZsb29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChuTGVmdCwgbkNlaWwsIG5SaWdodCwgbkZsb29yKSB7XG4gICAgaWYgKG5DZWlsID09PSB1bmRlZmluZWQgJiYgbkxlZnQgaW5zdGFuY2VvZiBBclJlY3QpIHsgLy9cbiAgICAgICAgdGhpcy5hc3NpZ24obkxlZnQpO1xuXG4gICAgfSBlbHNlIGlmIChuUmlnaHQgPT09IHVuZGVmaW5lZCB8fCBuRmxvb3IgPT09IHVuZGVmaW5lZCkgeyAvL2ludmFsaWRcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZygnSW52YWxpZCBhcmdzIGZvciBbQXJSZWN0XS5zZXRSZWN0Jyk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxlZnQgPSBuTGVmdDtcbiAgICAgICAgdGhpcy5jZWlsID0gbkNlaWw7XG4gICAgICAgIHRoaXMucmlnaHQgPSBuUmlnaHQ7XG4gICAgICAgIHRoaXMuZmxvb3IgPSBuRmxvb3I7XG4gICAgfVxuXG59O1xuXG5BclJlY3QucHJvdG90eXBlLnNldFJlY3RFbXB0eSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHRoaXMuY2VpbCA9IDA7XG4gICAgdGhpcy5yaWdodCA9IDA7XG4gICAgdGhpcy5mbG9vciA9IDA7XG4gICAgdGhpcy5sZWZ0ID0gMDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaW5mbGF0ZVJlY3QgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIGlmICh4ICE9PSB1bmRlZmluZWQgJiYgeC5jeCAhPT0gdW5kZWZpbmVkICYmIHguY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geC5jeTtcbiAgICAgICAgeCA9IHguY3g7XG4gICAgfSBlbHNlIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHg7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0IC09IHg7XG4gICAgdGhpcy5yaWdodCArPSB4O1xuICAgIHRoaXMuY2VpbCAtPSB5O1xuICAgIHRoaXMuZmxvb3IgKz0geTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZGVmbGF0ZVJlY3QgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIGlmICh4ICE9PSB1bmRlZmluZWQgJiYgeC5jeCAhPT0gdW5kZWZpbmVkICYmIHguY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geC5jeTtcbiAgICAgICAgeCA9IHguY3g7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0ICs9IHg7XG4gICAgdGhpcy5yaWdodCAtPSB4O1xuICAgIHRoaXMuY2VpbCArPSB5O1xuICAgIHRoaXMuZmxvb3IgLT0geTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUubm9ybWFsaXplUmVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGVtcDtcblxuICAgIGlmICh0aGlzLmxlZnQgPiB0aGlzLnJpZ2h0KSB7XG4gICAgICAgIHRlbXAgPSB0aGlzLmxlZnQ7XG4gICAgICAgIHRoaXMubGVmdCA9IHRoaXMucmlnaHQ7XG4gICAgICAgIHRoaXMucmlnaHQgPSB0ZW1wO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNlaWwgPiB0aGlzLmZsb29yKSB7XG4gICAgICAgIHRlbXAgPSB0aGlzLmNlaWw7XG4gICAgICAgIHRoaXMuY2VpbCA9IHRoaXMuZmxvb3I7XG4gICAgICAgIHRoaXMuZmxvb3IgPSB0ZW1wO1xuICAgIH1cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuYXNzaWduID0gZnVuY3Rpb24gKHJlY3QpIHtcblxuICAgIHRoaXMuY2VpbCA9IHJlY3QuY2VpbDtcbiAgICB0aGlzLnJpZ2h0ID0gcmVjdC5yaWdodDtcbiAgICB0aGlzLmZsb29yID0gcmVjdC5mbG9vcjtcbiAgICB0aGlzLmxlZnQgPSByZWN0LmxlZnQ7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgaWYgKHRoaXMubGVmdCA9PT0gcmVjdC5sZWZ0ICYmXG4gICAgICAgIHRoaXMucmlnaHQgPT09IHJlY3QucmlnaHQgJiZcbiAgICAgICAgdGhpcy5jZWlsID09PSByZWN0LmNlaWwgJiZcbiAgICAgICAgdGhpcy5mbG9vciA9PT0gcmVjdC5mbG9vcikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG5cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgdmFyIGR4LFxuICAgICAgICBkeTtcbiAgICBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIGR4ID0gQXJPYmplY3QueDtcbiAgICAgICAgZHkgPSBBck9iamVjdC55O1xuXG4gICAgfSBlbHNlIGlmIChBck9iamVjdC5jeCAhPT0gdW5kZWZpbmVkICYmIEFyT2JqZWN0LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZHggPSBBck9iamVjdC5jeDtcbiAgICAgICAgZHkgPSBBck9iamVjdC5jeTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoJ0ludmFsaWQgYXJnIGZvciBbQXJSZWN0XS5hZGQgbWV0aG9kJyk7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0ICs9IGR4O1xuICAgIHRoaXMucmlnaHQgKz0gZHg7XG4gICAgdGhpcy5jZWlsICs9IGR5O1xuICAgIHRoaXMuZmxvb3IgKz0gZHk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnN1YnRyYWN0ID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgaWYgKEFyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICB0aGlzLmRlZmxhdGVSZWN0KEFyT2JqZWN0LngsIEFyT2JqZWN0LnkpO1xuXG4gICAgfSBlbHNlIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICB0aGlzLmRlZmxhdGVSZWN0KEFyT2JqZWN0KTtcblxuICAgIH0gZWxzZSBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclJlY3QpIHtcbiAgICAgICAgdGhpcy5sZWZ0ICs9IEFyT2JqZWN0LmxlZnQ7XG4gICAgICAgIHRoaXMucmlnaHQgLT0gQXJPYmplY3QucmlnaHQ7XG4gICAgICAgIHRoaXMuY2VpbCArPSBBck9iamVjdC5jZWlsO1xuICAgICAgICB0aGlzLmZsb29yIC09IEFyT2JqZWN0LmZsb29yO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZygnSW52YWxpZCBhcmcgZm9yIFtBclJlY3RdLnN1YnRyYWN0IG1ldGhvZCcpO1xuICAgIH1cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUucGx1cyA9IGZ1bmN0aW9uIChBck9iamVjdCkge1xuICAgIHZhciByZXNPYmplY3QgPSBuZXcgQXJSZWN0KHRoaXMpO1xuICAgIHJlc09iamVjdC5hZGQoQXJPYmplY3QpO1xuXG4gICAgcmV0dXJuIHJlc09iamVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUubWludXMgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICB2YXIgcmVzT2JqZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcbiAgICByZXNPYmplY3Quc3VidHJhY3QoQXJPYmplY3QpO1xuXG4gICAgcmV0dXJuIHJlc09iamVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudW5pb25Bc3NpZ24gPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIGlmIChyZWN0LmlzUmVjdEVtcHR5KCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc1JlY3RFbXB0eSgpKSB7XG4gICAgICAgIHRoaXMuYXNzaWduKHJlY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9UYWtlIHRoZSBvdXRlcm1vc3QgZGltZW5zaW9uXG4gICAgdGhpcy5sZWZ0ID0gTWF0aC5taW4odGhpcy5sZWZ0LCByZWN0LmxlZnQpO1xuICAgIHRoaXMucmlnaHQgPSBNYXRoLm1heCh0aGlzLnJpZ2h0LCByZWN0LnJpZ2h0KTtcbiAgICB0aGlzLmNlaWwgPSBNYXRoLm1pbih0aGlzLmNlaWwsIHJlY3QuY2VpbCk7XG4gICAgdGhpcy5mbG9vciA9IE1hdGgubWF4KHRoaXMuZmxvb3IsIHJlY3QuZmxvb3IpO1xuXG59O1xuXG5BclJlY3QucHJvdG90eXBlLnVuaW9uID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgcmVzUmVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG4gICAgcmVzUmVjdC51bmlvbkFzc2lnbihyZWN0KTtcblxuICAgIHJldHVybiByZXNSZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pbnRlcnNlY3RBc3NpZ24gPSBmdW5jdGlvbiAocmVjdDEsIHJlY3QyKSB7XG4gICAgcmVjdDIgPSByZWN0MiA/IHJlY3QyIDogdGhpcztcbiAgICAvL1NldHMgdGhpcyByZWN0IHRvIHRoZSBpbnRlcnNlY3Rpb24gcmVjdFxuICAgIHRoaXMubGVmdCA9IE1hdGgubWF4KHJlY3QxLmxlZnQsIHJlY3QyLmxlZnQpO1xuICAgIHRoaXMucmlnaHQgPSBNYXRoLm1pbihyZWN0MS5yaWdodCwgcmVjdDIucmlnaHQpO1xuICAgIHRoaXMuY2VpbCA9IE1hdGgubWF4KHJlY3QxLmNlaWwsIHJlY3QyLmNlaWwpO1xuICAgIHRoaXMuZmxvb3IgPSBNYXRoLm1pbihyZWN0MS5mbG9vciwgcmVjdDIuZmxvb3IpO1xuXG4gICAgaWYgKHRoaXMubGVmdCA+PSB0aGlzLnJpZ2h0IHx8IHRoaXMuY2VpbCA+PSB0aGlzLmZsb29yKSB7XG4gICAgICAgIHRoaXMuc2V0UmVjdEVtcHR5KCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaW50ZXJzZWN0ID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgcmVzUmVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG5cbiAgICByZXNSZWN0LmludGVyc2VjdEFzc2lnbihyZWN0KTtcbiAgICByZXR1cm4gcmVzUmVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudG91Y2hpbmcgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIC8vT25lIHBpeGVsIGlzIGFkZGVkIHRvIHRoZSBtaW5pbXVtcyBzbywgaWYgdGhleSBhcmUgbm90IGRlZW1lZCB0byBiZSB0b3VjaGluZ1xuICAgIC8vdGhlcmUgaXMgZ3VhcmFudGVlZCB0byBiZSBhdCBsZWFzZSBhIG9uZSBwaXhlbCBwYXRoIGJldHdlZW4gdGhlbVxuICAgIHJldHVybiBNYXRoLm1heChyZWN0LmxlZnQsIHRoaXMubGVmdCkgPD0gTWF0aC5taW4ocmVjdC5yaWdodCwgdGhpcy5yaWdodCkgKyAxICYmXG4gICAgICAgIE1hdGgubWF4KHJlY3QuY2VpbCwgdGhpcy5jZWlsKSA8PSBNYXRoLm1pbihyZWN0LmZsb29yLCB0aGlzLmZsb29yKSArIDE7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gcG9pbnQgaXMgb24gb25lIG9mIHRoZSBjb3JuZXJzIG9mIHRoZSByZWN0YW5nbGUuXG4gKlxuICogQHBhcmFtIHBvaW50XG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkFyUmVjdC5wcm90b3R5cGUub25Db3JuZXIgPSBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICB2YXIgb25Ib3Jpem9udGFsU2lkZSxcbiAgICAgICAgb25WZXJ0aWNhbFNpZGU7XG5cbiAgICBvbkhvcml6b250YWxTaWRlID0gcG9pbnQueCA9PT0gdGhpcy5sZWZ0IHx8IHBvaW50LnggPT09IHRoaXMucmlnaHQ7XG4gICAgb25WZXJ0aWNhbFNpZGUgPSBwb2ludC55ID09PSB0aGlzLmNlaWwgfHwgcG9pbnQueSA9PT0gdGhpcy5mbG9vcjtcblxuICAgIHJldHVybiBvbkhvcml6b250YWxTaWRlICYmIG9uVmVydGljYWxTaWRlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRUb3BMZWZ0KCkudG9TdHJpbmcoKSArICcgJyArIHRoaXMuZ2V0Qm90dG9tUmlnaHQoKS50b1N0cmluZygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclJlY3Q7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEFyU2l6ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgLy9NdWx0aXBsZSBDb25zdHJ1Y3RvcnNcbiAgICBpZiAoeCA9PT0gdW5kZWZpbmVkKSB7IC8vTm8gYXJndW1lbnRzIHdlcmUgcGFzc2VkIHRvIGNvbnN0cnVjdG9yXG4gICAgICAgIHggPSAwO1xuICAgICAgICB5ID0gMDtcbiAgICB9IGVsc2UgaWYgKHkgPT09IHVuZGVmaW5lZCkgeyAvL09uZSBhcmd1bWVudCBwYXNzZWQgdG8gY29uc3RydWN0b3JcbiAgICAgICAgeSA9IHguY3k7XG4gICAgICAgIHggPSB4LmN4O1xuICAgIH1cblxuICAgIHRoaXMuY3ggPSB4O1xuICAgIHRoaXMuY3kgPSB5O1xufTtcblxuQXJTaXplLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAob3RoZXJTaXplKSB7XG4gICAgaWYgKHRoaXMuY3ggPT09IG90aGVyU2l6ZS5jeCAmJiB0aGlzLmN5ID09PSBvdGhlclNpemUuY3kpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJTaXplLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob3RoZXJTaXplKSB7IC8vZXF1aXZhbGVudCB0byArPVxuICAgIGlmIChvdGhlclNpemUuY3ggfHwgb3RoZXJTaXplLmN5KSB7XG4gICAgICAgIHRoaXMuY3ggKz0gb3RoZXJTaXplLmN4O1xuICAgICAgICB0aGlzLmN5ICs9IG90aGVyU2l6ZS5jeTtcbiAgICB9XG4gICAgaWYgKG90aGVyU2l6ZS54IHx8IG90aGVyU2l6ZS55KSB7XG4gICAgICAgIHRoaXMuY3ggKz0gb3RoZXJTaXplLng7XG4gICAgICAgIHRoaXMuY3kgKz0gb3RoZXJTaXplLnk7XG4gICAgfVxufTtcblxuQXJTaXplLnByb3RvdHlwZS5nZXRBcnJheSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzID0gW107XG4gICAgcmVzLnB1c2godGhpcy5jeCk7XG4gICAgcmVzLnB1c2godGhpcy5jeSk7XG4gICAgcmV0dXJuIHJlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXJTaXplO1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBhc3NlcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKS5hc3NlcnQsXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50Jyk7XG5cbnZhciBfZ2V0T3B0aW1hbFBvcnRzID0gZnVuY3Rpb24gKHBvcnRzLCB0Z3QpIHtcbiAgICAvL0kgd2lsbCBnZXQgdGhlIGR4LCBkeSB0aGF0IHRvIHRoZSBzcmMvZHN0IHRhcmdldCBhbmQgdGhlbiBJIHdpbGwgY2FsY3VsYXRlXG4gICAgLy8gYSBwcmlvcml0eSB2YWx1ZSB0aGF0IHdpbGwgcmF0ZSB0aGUgcG9ydHMgYXMgY2FuZGlkYXRlcyBmb3IgdGhlIFxuICAgIC8vZ2l2ZW4gcGF0aFxuICAgIHZhciBzcmNDID0gbmV3IEFyUG9pbnQoKSwgLy9zcmMgY2VudGVyXG4gICAgICAgIHZlY3RvcixcbiAgICAgICAgcG9ydCwgLy9yZXN1bHRcbiAgICAgICAgbWF4UCA9IC1JbmZpbml0eSxcbiAgICAgICAgbWF4QXJlYSA9IDAsXG4gICAgICAgIHNQb2ludCxcbiAgICAgICAgaTtcblxuICAgIC8vR2V0IHRoZSBjZW50ZXIgcG9pbnRzIG9mIHRoZSBzcmMsZHN0IHBvcnRzXG4gICAgZm9yIChpID0gMDsgaSA8IHBvcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHNQb2ludCA9IHBvcnRzW2ldLnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgIHNyY0MueCArPSBzUG9pbnQueDtcbiAgICAgICAgc3JjQy55ICs9IHNQb2ludC55O1xuXG4gICAgICAgIC8vYWRqdXN0IG1heEFyZWFcbiAgICAgICAgaWYgKG1heEFyZWEgPCBwb3J0c1tpXS5nZXRUb3RhbEF2YWlsYWJsZUFyZWEoKSkge1xuICAgICAgICAgICAgbWF4QXJlYSA9IHBvcnRzW2ldLmdldFRvdGFsQXZhaWxhYmxlQXJlYSgpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvL0dldCB0aGUgYXZlcmFnZSBjZW50ZXIgcG9pbnQgb2Ygc3JjXG4gICAgc3JjQy54ID0gc3JjQy54IC8gcG9ydHMubGVuZ3RoO1xuICAgIHNyY0MueSA9IHNyY0MueSAvIHBvcnRzLmxlbmd0aDtcblxuICAgIC8vR2V0IHRoZSBkaXJlY3Rpb25zXG4gICAgdmVjdG9yID0gKHRndC5taW51cyhzcmNDKS5nZXRBcnJheSgpKTtcblxuICAgIC8vQ3JlYXRlIHByaW9yaXR5IGZ1bmN0aW9uXG4gICAgZnVuY3Rpb24gY3JlYXRlUHJpb3JpdHkocG9ydCwgY2VudGVyKSB7XG4gICAgICAgIHZhciBwcmlvcml0eSA9IDAsXG4gICAgICAgIC8vcG9pbnQgPSBbICBjZW50ZXIueCAtIHBvcnQucmVjdC5nZXRDZW50ZXIoKS54LCBjZW50ZXIueSAtIHBvcnQucmVjdC5nZXRDZW50ZXIoKS55XSxcbiAgICAgICAgICAgIHBvaW50ID0gW3BvcnQucmVjdC5nZXRDZW50ZXIoKS54IC0gY2VudGVyLngsIHBvcnQucmVjdC5nZXRDZW50ZXIoKS55IC0gY2VudGVyLnldLFxuICAgICAgICAgICAgbGluZUNvdW50ID0gKHBvcnQuZ2V0UG9pbnRDb3VudCgpIHx8IDEpLFxuICAgICAgICAgICAgLy9JZiB0aGVyZSBpcyBhIHByb2JsZW0gd2l0aCBtYXhBcmVhLCBqdXN0IGlnbm9yZSBkZW5zaXR5XG4gICAgICAgICAgICBkZW5zaXR5ID0gKHBvcnQuZ2V0VG90YWxBdmFpbGFibGVBcmVhKCkgLyBsaW5lQ291bnQpIC8gbWF4QXJlYSB8fCAxLFxuICAgICAgICAgICAgbWFqb3IgPSBNYXRoLmFicyh2ZWN0b3JbMF0pID4gTWF0aC5hYnModmVjdG9yWzFdKSA/IDAgOiAxLFxuICAgICAgICAgICAgbWlub3IgPSAobWFqb3IgKyAxKSAlIDI7XG5cbiAgICAgICAgaWYgKHBvaW50W21ham9yXSA+IDAgPT09IHZlY3RvclttYWpvcl0gPiAwICYmIChwb2ludFttYWpvcl0gPT09IDApID09PSAodmVjdG9yW21ham9yXSA9PT0gMCkpIHtcbiAgICAgICAgICAgIC8vaGFuZGxpbmcgdGhlID09PSAwIGVycm9yXG4gICAgICAgICAgICAvL0lmIHRoZXkgaGF2ZSB0aGUgc2FtZSBwYXJpdHksIGFzc2lnbiB0aGUgcHJpb3JpdHkgdG8gbWF4aW1pemUgdGhhdCBpcyA+IDFcbiAgICAgICAgICAgIHByaW9yaXR5ID0gKE1hdGguYWJzKHZlY3RvclttYWpvcl0pIC8gTWF0aC5hYnModmVjdG9yW21ham9yXSAtIHBvaW50W21ham9yXSkpICogMjU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9pbnRbbWlub3JdID4gMCA9PT0gdmVjdG9yW21pbm9yXSA+IDAgJiYgKHBvaW50W21pbm9yXSA9PT0gMCkgPT09ICh2ZWN0b3JbbWlub3JdID09PSAwKSkge1xuICAgICAgICAgICAgLy9oYW5kbGluZyB0aGUgPT09IDAgZXJyb3JcbiAgICAgICAgICAgIC8vSWYgdGhleSBoYXZlIHRoZSBzYW1lIHBhcml0eSwgYXNzaWduIHRoZSBwcmlvcml0eSB0byBtYXhpbWl6ZSB0aGF0IGlzIDwgMVxuICAgICAgICAgICAgcHJpb3JpdHkgKz0gdmVjdG9yW21pbm9yXSAhPT0gcG9pbnRbbWlub3JdID9cbiAgICAgICAgICAgIChNYXRoLmFicyh2ZWN0b3JbbWlub3JdKSAvIE1hdGguYWJzKHZlY3RvclttaW5vcl0gLSBwb2ludFttaW5vcl0pKSAqIDEgOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9BZGp1c3QgcHJpb3JpdHkgYmFzZWQgb24gdGhlIGRlbnNpdHkgb2YgdGhlIGxpbmVzLi4uXG4gICAgICAgIHByaW9yaXR5ICo9IGRlbnNpdHk7XG5cbiAgICAgICAgcmV0dXJuIHByaW9yaXR5O1xuICAgIH1cblxuICAgIC8vQ3JlYXRlIHByaW9yaXR5IHZhbHVlcyBmb3IgZWFjaCBwb3J0LlxuICAgIHZhciBwcmlvcml0eTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcHJpb3JpdHkgPSBjcmVhdGVQcmlvcml0eShwb3J0c1tpXSwgc3JjQykgfHwgMDtcbiAgICAgICAgaWYgKHByaW9yaXR5ID49IG1heFApIHtcbiAgICAgICAgICAgIHBvcnQgPSBwb3J0c1tpXTtcbiAgICAgICAgICAgIG1heFAgPSBwcmlvcml0eTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzc2VydChwb3J0Lm93bmVyLCAnQVJHcmFwaC5nZXRPcHRpbWFsUG9ydHM6IHBvcnQgaGFzIGludmFsaWQgb3duZXInKTtcblxuICAgIHJldHVybiBwb3J0O1xufTtcblxudmFyIF9nZXRQb2ludENvb3JkID0gZnVuY3Rpb24gKHBvaW50LCBob3JEaXIpIHtcbiAgICBpZiAoaG9yRGlyID09PSB0cnVlIHx8IF9pc0hvcml6b250YWwoaG9yRGlyKSkge1xuICAgICAgICByZXR1cm4gcG9pbnQueDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcG9pbnQueTtcbiAgICB9XG59O1xuXG52YXIgX2luZmxhdGVkUmVjdCA9IGZ1bmN0aW9uIChyZWN0LCBhKSB7XG4gICAgdmFyIHIgPSByZWN0O1xuICAgIHIuaW5mbGF0ZVJlY3QoYSwgYSk7XG4gICAgcmV0dXJuIHI7XG59O1xuXG52YXIgX2lzUG9pbnROZWFyID0gZnVuY3Rpb24gKHAxLCBwMiwgbmVhcm5lc3MpIHtcbiAgICByZXR1cm4gcDIueCAtIG5lYXJuZXNzIDw9IHAxLnggJiYgcDEueCA8PSBwMi54ICsgbmVhcm5lc3MgJiZcbiAgICAgICAgcDIueSAtIG5lYXJuZXNzIDw9IHAxLnkgJiYgcDEueSA8PSBwMi55ICsgbmVhcm5lc3M7XG59O1xuXG52YXIgX2lzUG9pbnRJbiA9IGZ1bmN0aW9uIChwb2ludCwgcmVjdCwgbmVhcm5lc3MpIHtcbiAgICB2YXIgdG1wUiA9IG5ldyBBclJlY3QocmVjdCk7XG4gICAgdG1wUi5pbmZsYXRlUmVjdChuZWFybmVzcywgbmVhcm5lc3MpO1xuICAgIHJldHVybiB0bXBSLnB0SW5SZWN0KHBvaW50KSA9PT0gdHJ1ZTtcbn07XG5cbnZhciBfaXNSZWN0SW4gPSBmdW5jdGlvbiAocjEsIHIyKSB7XG4gICAgcmV0dXJuIHIyLmxlZnQgPD0gcjEubGVmdCAmJiByMS5yaWdodCA8PSByMi5yaWdodCAmJlxuICAgICAgICByMi5jZWlsIDw9IHIxLmNlaWwgJiYgcjEuZmxvb3IgPD0gcjIuZmxvb3I7XG59O1xuXG52YXIgX2lzUmVjdENsaXAgPSBmdW5jdGlvbiAocjEsIHIyKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KCk7XG4gICAgcmV0dXJuIHJlY3QuaW50ZXJzZWN0QXNzaWduKHIxLCByMikgPT09IHRydWU7XG59O1xuXG52YXIgX2Rpc3RhbmNlRnJvbUhMaW5lID0gZnVuY3Rpb24gKHAsIHgxLCB4MiwgeSkge1xuICAgIGFzc2VydCh4MSA8PSB4MiwgJ0FySGVscGVyLmRpc3RhbmNlRnJvbUhMaW5lOiB4MSA8PSB4MiBGQUlMRUQnKTtcblxuICAgIHJldHVybiBNYXRoLm1heChNYXRoLmFicyhwLnkgLSB5KSwgTWF0aC5tYXgoeDEgLSBwLngsIHAueCAtIHgyKSk7XG59O1xuXG52YXIgX2Rpc3RhbmNlRnJvbVZMaW5lID0gZnVuY3Rpb24gKHAsIHkxLCB5MiwgeCkge1xuICAgIGFzc2VydCh5MSA8PSB5MiwgJ0FySGVscGVyLmRpc3RhbmNlRnJvbVZMaW5lOiB5MSA8PSB5MiBGQUlMRUQnKTtcblxuICAgIHJldHVybiBNYXRoLm1heChNYXRoLmFicyhwLnggLSB4KSwgTWF0aC5tYXgoeTEgLSBwLnksIHAueSAtIHkyKSk7XG59O1xuXG52YXIgX2Rpc3RhbmNlRnJvbUxpbmUgPSBmdW5jdGlvbiAocHQsIHN0YXJ0LCBlbmQpIHtcbiAgICB2YXIgZGlyID0gX2dldERpcihlbmQubWludXMoc3RhcnQpKTtcblxuICAgIGlmIChfaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgcmV0dXJuIF9kaXN0YW5jZUZyb21WTGluZShwdCwgc3RhcnQueSwgZW5kLnksIHN0YXJ0LngpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBfZGlzdGFuY2VGcm9tSExpbmUocHQsIHN0YXJ0LngsIGVuZC54LCBzdGFydC55KTtcbiAgICB9XG59O1xuXG52YXIgX2lzT25FZGdlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHB0KSB7XG4gICAgaWYgKHN0YXJ0LnggPT09IGVuZC54KSB7XHRcdFx0Ly8gdmVydGljYWwgZWRnZSwgaG9yaXpvbnRhbCBtb3ZlXG4gICAgICAgIGlmIChlbmQueCA9PT0gcHQueCAmJiBwdC55IDw9IE1hdGgubWF4KGVuZC55LCBzdGFydC55KSAmJiBwdC55ID49IE1hdGgubWluKGVuZC55LCBzdGFydC55KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0LnkgPT09IGVuZC55KSB7XHQvLyBob3Jpem9udGFsIGxpbmUsIHZlcnRpY2FsIG1vdmVcbiAgICAgICAgaWYgKHN0YXJ0LnkgPT09IHB0LnkgJiYgcHQueCA8PSBNYXRoLm1heChlbmQueCwgc3RhcnQueCkgJiYgcHQueCA+PSBNYXRoLm1pbihlbmQueCwgc3RhcnQueCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxudmFyIF9pc1BvaW50TmVhckxpbmUgPSBmdW5jdGlvbiAocG9pbnQsIHN0YXJ0LCBlbmQsIG5lYXJuZXNzKSB7XG4gICAgYXNzZXJ0KDAgPD0gbmVhcm5lc3MsICdBckhlbHBlci5pc1BvaW50TmVhckxpbmU6IDAgPD0gbmVhcm5lc3MgRkFJTEVEJyk7XG5cbiAgICAvLyBiZWdpbiBab2xtb2xcbiAgICAvLyB0aGUgcm91dGluZyBtYXkgY3JlYXRlIGVkZ2VzIHRoYXQgaGF2ZSBzdGFydD09ZW5kXG4gICAgLy8gdGh1cyBjb25mdXNpbmcgdGhpcyBhbGdvcml0aG1cbiAgICBpZiAoZW5kLnggPT09IHN0YXJ0LnggJiYgZW5kLnkgPT09IHN0YXJ0LnkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBlbmQgWm9sbW9sXG5cbiAgICB2YXIgcG9pbnQyID0gcG9pbnQ7XG5cbiAgICBwb2ludDIuc3VidHJhY3Qoc3RhcnQpO1xuXG4gICAgdmFyIGVuZDIgPSBlbmQ7XG4gICAgZW5kMi5zdWJ0cmFjdChzdGFydCk7XG5cbiAgICB2YXIgeCA9IGVuZDIueCxcbiAgICAgICAgeSA9IGVuZDIueSxcbiAgICAgICAgdSA9IHBvaW50Mi54LFxuICAgICAgICB2ID0gcG9pbnQyLnksXG4gICAgICAgIHh1eXYgPSB4ICogdSArIHkgKiB2LFxuICAgICAgICB4MnkyID0geCAqIHggKyB5ICogeTtcblxuICAgIGlmICh4dXl2IDwgMCB8fCB4dXl2ID4geDJ5Mikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGV4cHIxID0gKHggKiB2IC0geSAqIHUpO1xuICAgIGV4cHIxICo9IGV4cHIxO1xuICAgIHZhciBleHByMiA9IG5lYXJuZXNzICogbmVhcm5lc3MgKiB4MnkyO1xuXG4gICAgcmV0dXJuIGV4cHIxIDw9IGV4cHIyO1xufTtcblxudmFyIF9pc0xpbmVNZWV0SExpbmUgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgeDEsIHgyLCB5KSB7XG4gICAgYXNzZXJ0KHgxIDw9IHgyLCAnQXJIZWxwZXIuaXNMaW5lTWVldEhMaW5lOiB4MSA8PSB4MiBGQUlMRUQnKTtcbiAgICBpZiAoc3RhcnQgaW5zdGFuY2VvZiBBcnJheSkgey8vQ29udmVydGluZyBmcm9tICdwb2ludGVyJ1xuICAgICAgICBzdGFydCA9IHN0YXJ0WzBdO1xuICAgIH1cbiAgICBpZiAoZW5kIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgZW5kID0gZW5kWzBdO1xuICAgIH1cblxuICAgIGlmICghKChzdGFydC55IDw9IHkgJiYgeSA8PSBlbmQueSkgfHwgKGVuZC55IDw9IHkgJiYgeSA8PSBzdGFydC55ICkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZW5kMiA9IG5ldyBBclBvaW50KGVuZCk7XG4gICAgZW5kMi5zdWJ0cmFjdChzdGFydCk7XG4gICAgeDEgLT0gc3RhcnQueDtcbiAgICB4MiAtPSBzdGFydC54O1xuICAgIHkgLT0gc3RhcnQueTtcblxuICAgIGlmIChlbmQyLnkgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHkgPT09IDAgJiYgKCggeDEgPD0gMCAmJiAwIDw9IHgyICkgfHwgKHgxIDw9IGVuZDIueCAmJiBlbmQyLnggPD0geDIpKTtcbiAgICB9XG5cbiAgICB2YXIgeCA9ICgoZW5kMi54KSAvIGVuZDIueSkgKiB5O1xuICAgIHJldHVybiB4MSA8PSB4ICYmIHggPD0geDI7XG59O1xuXG52YXIgX2lzTGluZU1lZXRWTGluZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCB5MSwgeTIsIHgpIHtcbiAgICBhc3NlcnQoeTEgPD0geTIsICdBckhlbHBlci5pc0xpbmVNZWV0VkxpbmU6IHkxIDw9IHkyICBGQUlMRUQnKTtcbiAgICBpZiAoc3RhcnQgaW5zdGFuY2VvZiBBcnJheSkgey8vQ29udmVydGluZyBmcm9tICdwb2ludGVyJ1xuICAgICAgICBzdGFydCA9IHN0YXJ0WzBdO1xuICAgIH1cbiAgICBpZiAoZW5kIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgZW5kID0gZW5kWzBdO1xuICAgIH1cblxuICAgIGlmICghKChzdGFydC54IDw9IHggJiYgeCA8PSBlbmQueCkgfHwgKGVuZC54IDw9IHggJiYgeCA8PSBzdGFydC54ICkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZW5kMiA9IG5ldyBBclBvaW50KGVuZCk7XG4gICAgZW5kMi5zdWJ0cmFjdChzdGFydCk7XG4gICAgeTEgLT0gc3RhcnQueTtcbiAgICB5MiAtPSBzdGFydC55O1xuICAgIHggLT0gc3RhcnQueDtcblxuICAgIGlmIChlbmQyLnggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHggPT09IDAgJiYgKCggeTEgPD0gMCAmJiAwIDw9IHkyICkgfHwgKHkxIDw9IGVuZDIueSAmJiBlbmQyLnkgPD0geTIpKTtcbiAgICB9XG5cbiAgICB2YXIgeSA9ICgoZW5kMi55KSAvIGVuZDIueCkgKiB4O1xuICAgIHJldHVybiB5MSA8PSB5ICYmIHkgPD0geTI7XG59O1xuXG52YXIgX2lzTGluZUNsaXBSZWN0cyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCByZWN0cykge1xuICAgIHZhciBpID0gcmVjdHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgaWYgKF9pc0xpbmVDbGlwUmVjdChzdGFydCwgZW5kLCByZWN0c1tpXSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBfaXNMaW5lQ2xpcFJlY3QgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcmVjdCkge1xuICAgIGlmIChyZWN0LnB0SW5SZWN0KHN0YXJ0KSB8fCByZWN0LnB0SW5SZWN0KGVuZCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9pc0xpbmVNZWV0SExpbmUoc3RhcnQsIGVuZCwgcmVjdC5sZWZ0LCByZWN0LnJpZ2h0LCByZWN0LmNlaWwpIHx8XG4gICAgICAgIF9pc0xpbmVNZWV0SExpbmUoc3RhcnQsIGVuZCwgcmVjdC5sZWZ0LCByZWN0LnJpZ2h0LCByZWN0LmZsb29yKSB8fFxuICAgICAgICBfaXNMaW5lTWVldFZMaW5lKHN0YXJ0LCBlbmQsIHJlY3QuY2VpbCwgcmVjdC5mbG9vciwgcmVjdC5sZWZ0KSB8fFxuICAgICAgICBfaXNMaW5lTWVldFZMaW5lKHN0YXJ0LCBlbmQsIHJlY3QuY2VpbCwgcmVjdC5mbG9vciwgcmVjdC5yaWdodCk7XG59O1xuXG52YXIgX2dldExpbmVDbGlwUmVjdEludGVyc2VjdCA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCByZWN0KSB7XG4gICAgLy9yZXR1cm4gdGhlIGVuZHBvaW50cyBvZiB0aGUgaW50ZXJzZWN0aW9uIGxpbmVcbiAgICB2YXIgZGlyID0gX2dldERpcihlbmQubWludXMoc3RhcnQpKSxcbiAgICAgICAgZW5kcG9pbnRzID0gW25ldyBBclBvaW50KHN0YXJ0KSwgbmV3IEFyUG9pbnQoZW5kKV07XG5cbiAgICBpZiAoIV9pc0xpbmVDbGlwUmVjdChzdGFydCwgZW5kLCByZWN0KSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0OiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICAvL01ha2Ugc3VyZSB3ZSBhcmUgd29ya2luZyBsZWZ0IHRvIHJpZ2h0IG9yIHRvcCBkb3duXG4gICAgaWYgKGRpciA9PT0gQ09OU1RBTlRTLkRpckxlZnQgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyVG9wKSB7XG4gICAgICAgIGRpciA9IF9yZXZlcnNlRGlyKGRpcik7XG4gICAgICAgIGVuZHBvaW50cy5wdXNoKGVuZHBvaW50cy5zcGxpY2UoMCwgMSlbMF0pOyAvL1N3YXAgcG9pbnQgMCBhbmQgcG9pbnQgMVxuICAgIH1cblxuICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShlbmRwb2ludHNbMF0sIHJlY3QuZ2V0VG9wTGVmdCgpLCBfcmV2ZXJzZURpcihkaXIpKSkge1xuICAgICAgICBlbmRwb2ludHNbMF0uYXNzaWduKHJlY3QuZ2V0VG9wTGVmdCgpKTtcbiAgICB9XG5cbiAgICBpZiAoX2lzUG9pbnRJbkRpckZyb20oZW5kcG9pbnRzWzFdLCByZWN0LmdldEJvdHRvbVJpZ2h0KCksIGRpcikpIHtcbiAgICAgICAgZW5kcG9pbnRzWzFdLmFzc2lnbihyZWN0LmdldEJvdHRvbVJpZ2h0KCkpO1xuICAgIH1cblxuICAgIGlmIChfaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgZW5kcG9pbnRzWzBdLnkgPSBzdGFydC55O1xuICAgICAgICBlbmRwb2ludHNbMV0ueSA9IGVuZC55O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVuZHBvaW50c1swXS54ID0gc3RhcnQueDtcbiAgICAgICAgZW5kcG9pbnRzWzFdLnggPSBlbmQueDtcbiAgICB9XG5cbiAgICByZXR1cm4gZW5kcG9pbnRzO1xuXG59O1xuXG52YXIgX2ludGVyc2VjdCA9IGZ1bmN0aW9uIChhMSwgYTIsIGIxLCBiMikge1xuICAgIHJldHVybiBNYXRoLm1pbihhMSwgYTIpIDw9IE1hdGgubWF4KGIxLCBiMikgJiYgTWF0aC5taW4oYjEsIGIyKSA8PSBNYXRoLm1heChhMSwgYTIpO1xufTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFJvdXRpbmdEaXJlY3Rpb25cblxudmFyIF9pc0hvcml6b250YWwgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgcmV0dXJuIGRpciA9PT0gQ09OU1RBTlRTLkRpclJpZ2h0IHx8IGRpciA9PT0gQ09OU1RBTlRTLkRpckxlZnQ7XG59O1xuXG52YXIgX2lzVmVydGljYWwgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgcmV0dXJuIGRpciA9PT0gQ09OU1RBTlRTLkRpclRvcCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJCb3R0b207XG59O1xuXG52YXIgX2lzUmlnaHRBbmdsZSA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcCA8PSBkaXIgJiYgZGlyIDw9IENPTlNUQU5UUy5EaXJMZWZ0O1xufTtcblxudmFyIF9hcmVJblJpZ2h0QW5nbGUgPSBmdW5jdGlvbiAoZGlyMSwgZGlyMikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpcjEpICYmIF9pc1JpZ2h0QW5nbGUoZGlyMiksXG4gICAgICAgICdBckhlbHBlci5hcmVJblJpZ2h0QW5nbGU6IF9pc1JpZ2h0QW5nbGUoZGlyMSkgJiYgX2lzUmlnaHRBbmdsZShkaXIyKSBGQUlMRUQnKTtcbiAgICByZXR1cm4gX2lzSG9yaXpvbnRhbChkaXIxKSA9PT0gX2lzVmVydGljYWwoZGlyMik7XG59O1xuXG52YXIgX25leHRDbG9ja3dpc2VEaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgaWYgKF9pc1JpZ2h0QW5nbGUoZGlyKSkge1xuICAgICAgICByZXR1cm4gKChkaXIgKyAxKSAlIDQpO1xuICAgIH1cblxuICAgIHJldHVybiBkaXI7XG59O1xuXG52YXIgX3ByZXZDbG9ja3dpc2VEaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgaWYgKF9pc1JpZ2h0QW5nbGUoZGlyKSkge1xuICAgICAgICByZXR1cm4gKChkaXIgKyAzKSAlIDQpO1xuICAgIH1cblxuICAgIHJldHVybiBkaXI7XG59O1xuXG52YXIgX3JldmVyc2VEaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgaWYgKF9pc1JpZ2h0QW5nbGUoZGlyKSkge1xuICAgICAgICByZXR1cm4gKChkaXIgKyAyKSAlIDQpO1xuICAgIH1cblxuICAgIHJldHVybiBkaXI7XG59O1xuXG52YXIgX3N0ZXBPbmVJbkRpciA9IGZ1bmN0aW9uIChwb2ludCwgZGlyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLnN0ZXBPbkluRGlyOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICBwb2ludC55LS07XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgIHBvaW50LngrKztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgIHBvaW50LnkrKztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckxlZnQ6XG4gICAgICAgICAgICBwb2ludC54LS07XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbn07XG5cbnZhciBfZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20gPSBmdW5jdGlvbiAoYnVmZmVyT2JqZWN0LCBpbkRpciwgcG9pbnQpIHsgLy9Qb2ludCB0cmF2ZWxzIGluRGlyIHVudGlsIGhpdHMgY2hpbGQgYm94XG4gICAgdmFyIGNoaWxkcmVuID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLFxuICAgICAgICBpID0gLTEsXG4gICAgICAgIGJveCA9IG51bGwsXG4gICAgICAgIHJlcyA9IF9nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBpbkRpcik7XG5cbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShpbkRpciksICdnZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbTogX2lzUmlnaHRBbmdsZShpbkRpcikgRkFJTEVEJyk7XG4gICAgLy9UaGUgbmV4dCBhc3NlcnQgZmFpbHMgaWYgdGhlIHBvaW50IGlzIGluIHRoZSBvcHBvc2l0ZSBkaXJlY3Rpb24gb2YgdGhlIHJlY3RhbmdsZSB0aGF0IGl0IGlzIGNoZWNraW5nLlxuICAgIC8vIGUuZy4gVGhlIHBvaW50IGlzIGNoZWNraW5nIHdoZW4gaXQgd2lsbCBoaXQgdGhlIGJveCBmcm9tIHRoZSByaWdodCBidXQgdGhlIHBvaW50IGlzIG9uIHRoZSBsZWZ0XG4gICAgYXNzZXJ0KCFfaXNQb2ludEluRGlyRnJvbShwb2ludCwgYnVmZmVyT2JqZWN0LmJveCwgaW5EaXIpLFxuICAgICAgICAnZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb206ICFpc1BvaW50SW5EaXJGcm9tKHBvaW50LCBidWZmZXJPYmplY3QuYm94LnJlY3QsIChpbkRpcikpIEZBSUxFRCcpO1xuXG4gICAgd2hpbGUgKCsraSA8IGNoaWxkcmVuLmxlbmd0aCkge1xuXG4gICAgICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShwb2ludCwgY2hpbGRyZW5baV0sIF9yZXZlcnNlRGlyKGluRGlyKSkgJiZcbiAgICAgICAgICAgIF9pc1BvaW50QmV0d2VlblNpZGVzKHBvaW50LCBjaGlsZHJlbltpXSwgaW5EaXIpICYmXG4gICAgICAgICAgICBfaXNDb29yZEluRGlyRnJvbShyZXMsIF9nZXRSZWN0T3V0ZXJDb29yZChjaGlsZHJlbltpXSwgX3JldmVyc2VEaXIoaW5EaXIpKSwgKGluRGlyKSkpIHtcblxuICAgICAgICAgICAgcmVzID0gX2dldFJlY3RPdXRlckNvb3JkKGNoaWxkcmVuW2ldLCBfcmV2ZXJzZURpcihpbkRpcikpO1xuICAgICAgICAgICAgYm94ID0gY2hpbGRyZW5baV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geydib3gnOiBib3gsICdjb29yZCc6IHJlc307XG59O1xuXG52YXIgX2dldFJlY3RPdXRlckNvb3JkID0gZnVuY3Rpb24gKHJlY3QsIGRpcikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdVdGlscy5nZXRSZWN0T3V0ZXJDb29yZDogaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG4gICAgdmFyIHQgPSByZWN0LmNlaWwgLSAxLFxuICAgICAgICByID0gcmVjdC5yaWdodCArIDEsXG4gICAgICAgIGIgPSByZWN0LmZsb29yICsgMSxcbiAgICAgICAgbCA9IHJlY3QubGVmdCAtIDE7XG5cbiAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICByZXR1cm4gdDtcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgIHJldHVybiByO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgIHJldHVybiBiO1xuICAgIH1cblxuICAgIHJldHVybiBsO1xufTtcblxuLy9cdEluZGV4ZXM6XG4vL1x0XHRcdFx0IDA0XG4vL1x0XHRcdFx0MSAgNVxuLy9cdFx0XHRcdDMgIDdcbi8vXHRcdFx0XHQgMjZcblxudmFyIGdldERpclRhYmxlSW5kZXggPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIChvZmZzZXQuY3ggPj0gMCkgKiA0ICsgKG9mZnNldC5jeSA+PSAwKSAqIDIgKyAoTWF0aC5hYnMob2Zmc2V0LmN4KSA+PSBNYXRoLmFicyhvZmZzZXQuY3kpKTtcbn07XG5cbnZhciBtYWpvckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHRcbiAgICBdO1xuXG52YXIgX2dldE1ham9yRGlyID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiBtYWpvckRpclRhYmxlW2dldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG52YXIgbWlub3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tXG4gICAgXTtcblxudmFyIF9nZXRNaW5vckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gbWlub3JEaXJUYWJsZVtnZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxuLy9cdEZHMTIzXG4vL1x0RSAgIDRcbi8vXHREIDAgNVxuLy9cdEMgICA2XG4vLyAgQkE5ODdcblxuXG52YXIgX2V4R2V0RGlyVGFibGVJbmRleCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAvL1RoaXMgcmVxdWlyZWQgYSB2YXJpYWJsZSBhc3NpZ25tZW50OyBvdGhlcndpc2UgdGhpcyBmdW5jdGlvblxuICAgIC8vcmV0dXJuZWQgdW5kZWZpbmVkLi4uXG4gICAgdmFyIHJlcyA9XG4gICAgICAgIG9mZnNldC5jeCA+IDAgP1xuICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgIG9mZnNldC5jeSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3ggPiBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3ggPCBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA3XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN5IDwgMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN4ID4gLW9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3ggPCAtb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgNVxuICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgKG9mZnNldC5jeCA8IDAgP1xuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN5ID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLW9mZnNldC5jeCA+IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoLW9mZnNldC5jeCA8IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDExXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN5IDwgMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3ggPCBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDE0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3ggPiBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDE1XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDlcbiAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeSA8IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgKSk7XG5cbiAgICByZXR1cm4gcmVzO1xufTtcbnZhciBleE1ham9yRGlyVGFibGUgPVxuICAgIFtcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3BcbiAgICBdO1xuXG52YXIgX2V4R2V0TWFqb3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIGV4TWFqb3JEaXJUYWJsZVtfZXhHZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxudmFyIGV4TWlub3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnRcbiAgICBdO1xuXG52YXIgX2V4R2V0TWlub3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIGV4TWlub3JEaXJUYWJsZVtfZXhHZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxudmFyIF9nZXREaXIgPSBmdW5jdGlvbiAob2Zmc2V0LCBub2Rpcikge1xuICAgIGlmIChvZmZzZXQuY3ggPT09IDApIHtcbiAgICAgICAgaWYgKG9mZnNldC5jeSA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGlyO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9mZnNldC5jeSA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJCb3R0b207XG4gICAgfVxuXG4gICAgaWYgKG9mZnNldC5jeSA9PT0gMCkge1xuICAgICAgICBpZiAob2Zmc2V0LmN4ID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJSaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyTGVmdDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclNrZXc7XG59O1xuXG52YXIgX2lzUG9pbnRJbkRpckZyb21DaGlsZHJlbiA9IGZ1bmN0aW9uIChwb2ludCwgZnJvbVBhcmVudCwgZGlyKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gZnJvbVBhcmVudC5jaGlsZHJlbixcbiAgICAgICAgaSA9IDA7XG5cbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnaXNQb2ludEluRGlyRnJvbUNoaWxkcmVuOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICB3aGlsZSAoaSA8IGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICBpZiAoX2lzUG9pbnRJbkRpckZyb20ocG9pbnQsIGNoaWxkcmVuW2ldLnJlY3QsIGRpcikpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgICsraTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgX2lzUG9pbnRJbkRpckZyb20gPSBmdW5jdGlvbiAocG9pbnQsIGZyb20sIGRpcikge1xuICAgIGlmIChmcm9tIGluc3RhbmNlb2YgQXJSZWN0KSB7XG4gICAgICAgIHZhciByZWN0ID0gZnJvbTtcbiAgICAgICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmlzUG9pbnRJbkRpckZyb206IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgICAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55IDwgcmVjdC5jZWlsO1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA+PSByZWN0LnJpZ2h0O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPj0gcmVjdC5mbG9vcjtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyTGVmdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA8IHJlY3QubGVmdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5pc1BvaW50SW5EaXJGcm9tOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICAgICAgc3dpdGNoIChkaXIpIHtcbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueSA8PSBmcm9tLnk7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54ID49IGZyb20ueDtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55ID49IGZyb20ueTtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyTGVmdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA8PSBmcm9tLng7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICB9XG59O1xuXG52YXIgX2lzUG9pbnRCZXR3ZWVuU2lkZXMgPSBmdW5jdGlvbiAocG9pbnQsIHJlY3QsIGlzaG9yaXpvbnRhbCkge1xuICAgIGlmIChpc2hvcml6b250YWwgPT09IHRydWUgfHwgX2lzSG9yaXpvbnRhbChpc2hvcml6b250YWwpKSB7XG4gICAgICAgIHJldHVybiByZWN0LmNlaWwgPD0gcG9pbnQueSAmJiBwb2ludC55IDwgcmVjdC5mbG9vcjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVjdC5sZWZ0IDw9IHBvaW50LnggJiYgcG9pbnQueCA8IHJlY3QucmlnaHQ7XG59O1xuXG52YXIgX2lzQ29vcmRJbkRpckZyb20gPSBmdW5jdGlvbiAoY29vcmQsIGZyb20sIGRpcikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5pc0Nvb3JkSW5EaXJGcm9tOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG4gICAgaWYgKGZyb20gaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIGZyb20gPSBfZ2V0UG9pbnRDb29yZChmcm9tLCBkaXIpO1xuICAgIH1cblxuICAgIGlmIChkaXIgPT09IENPTlNUQU5UUy5EaXJUb3AgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyTGVmdCkge1xuICAgICAgICByZXR1cm4gY29vcmQgPD0gZnJvbTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29vcmQgPj0gZnJvbTtcbn07XG5cbi8vIFRoaXMgbmV4dCBtZXRob2Qgb25seSBzdXBwb3J0cyB1bmFtYmlndW91cyBvcmllbnRhdGlvbnMuIFRoYXQgaXMsIHRoZSBwb2ludFxuLy8gY2Fubm90IGJlIGluIGEgY29ybmVyIG9mIHRoZSByZWN0YW5nbGUuXG4vLyBOT1RFOiB0aGUgcmlnaHQgYW5kIGZsb29yIHVzZWQgdG8gYmUgLSAxLiBcbnZhciBfb25XaGljaEVkZ2UgPSBmdW5jdGlvbiAocmVjdCwgcG9pbnQpIHtcbiAgICBpZiAocG9pbnQueSA9PT0gcmVjdC5jZWlsICYmIHJlY3QubGVmdCA8IHBvaW50LnggJiYgcG9pbnQueCA8IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJUb3A7XG4gICAgfVxuXG4gICAgaWYgKHBvaW50LnkgPT09IHJlY3QuZmxvb3IgJiYgcmVjdC5sZWZ0IDwgcG9pbnQueCAmJiBwb2ludC54IDwgcmVjdC5yaWdodCkge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckJvdHRvbTtcbiAgICB9XG5cbiAgICBpZiAocG9pbnQueCA9PT0gcmVjdC5sZWZ0ICYmIHJlY3QuY2VpbCA8IHBvaW50LnkgJiYgcG9pbnQueSA8IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJMZWZ0O1xuICAgIH1cblxuICAgIGlmIChwb2ludC54ID09PSByZWN0LnJpZ2h0ICYmIHJlY3QuY2VpbCA8IHBvaW50LnkgJiYgcG9pbnQueSA8IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJSaWdodDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpck5vbmU7XG59O1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIENBckZpbmROZWFyZXN0TGluZVxuXG52YXIgQXJGaW5kTmVhcmVzdExpbmUgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB0aGlzLnBvaW50ID0gcHQ7XG4gICAgdGhpcy5kaXN0MSA9IEluZmluaXR5O1xuICAgIHRoaXMuZGlzdDIgPSBJbmZpbml0eTtcbn07XG5cbkFyRmluZE5lYXJlc3RMaW5lLnByb3RvdHlwZS5oTGluZSA9IGZ1bmN0aW9uICh4MSwgeDIsIHkpIHtcbiAgICBhc3NlcnQoeDEgPD0geDIsICdBckZpbmROZWFyZXN0TGluZS5oTGluZTogeDEgPD0geDIgIEZBSUxFRCcpO1xuXG4gICAgdmFyIGQxID0gX2Rpc3RhbmNlRnJvbUhMaW5lKHRoaXMucG9pbnQsIHgxLCB4MiwgeSksXG4gICAgICAgIGQyID0gTWF0aC5hYnModGhpcy5wb2ludC55IC0geSk7XG5cbiAgICBpZiAoZDEgPCB0aGlzLmRpc3QxIHx8IChkMSA9PT0gdGhpcy5kaXN0MSAmJiBkMiA8IHRoaXMuZGlzdDIpKSB7XG4gICAgICAgIHRoaXMuZGlzdDEgPSBkMTtcbiAgICAgICAgdGhpcy5kaXN0MiA9IGQyO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BckZpbmROZWFyZXN0TGluZS5wcm90b3R5cGUudkxpbmUgPSBmdW5jdGlvbiAoeTEsIHkyLCB4KSB7XG4gICAgYXNzZXJ0KHkxIDw9IHkyLCAnQXJGaW5kTmVhcmVzdExpbmUuaExpbmU6IHkxIDw9IHkyIEZBSUxFRCcpO1xuXG4gICAgdmFyIGQxID0gX2Rpc3RhbmNlRnJvbVZMaW5lKHRoaXMucG9pbnQsIHkxLCB5MiwgeCksXG4gICAgICAgIGQyID0gTWF0aC5hYnModGhpcy5wb2ludC54IC0geCk7XG5cbiAgICBpZiAoZDEgPCB0aGlzLmRpc3QxIHx8IChkMSA9PT0gdGhpcy5kaXN0MSAmJiBkMiA8IHRoaXMuZGlzdDIpKSB7XG4gICAgICAgIHRoaXMuZGlzdDEgPSBkMTtcbiAgICAgICAgdGhpcy5kaXN0MiA9IGQyO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BckZpbmROZWFyZXN0TGluZS5wcm90b3R5cGUud2FzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmRpc3QxIDwgSW5maW5pdHkgJiYgdGhpcy5kaXN0MiA8IEluZmluaXR5O1xufTtcblxuLy8gQ29udmVuaWVuY2UgRnVuY3Rpb25zXG52YXIgcmVtb3ZlRnJvbUFycmF5cyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHZhciBpbmRleCxcbiAgICAgICAgcmVtb3ZlZCA9IGZhbHNlLFxuICAgICAgICBhcnJheTtcblxuICAgIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgICBhcnJheSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaW5kZXggPSBhcnJheS5pbmRleE9mKHZhbHVlKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlbW92ZWQ7XG59O1xuXG52YXIgc3RyaW5naWZ5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlLCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICBpZiAoa2V5ID09PSAnb3duZXInICYmIHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUuaWQgfHwgdHlwZW9mIHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICogUm91bmQgdGhlIG51bWJlciB0byB0aGUgZ2l2ZW4gZGVjaW1hbCBwbGFjZXMuIFRydW5jYXRlIGZvbGxvd2luZyBkaWdpdHMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcGFyYW0ge051bWJlcn0gcGxhY2VzXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHJlc3VsdFxuICovXG52YXIgcm91bmRUcnVuYyA9IGZ1bmN0aW9uICh2YWx1ZSwgcGxhY2VzKSB7XG4gICAgdmFsdWUgPSArdmFsdWU7XG4gICAgdmFyIHNjYWxlID0gTWF0aC5wb3coMTAsICtwbGFjZXMpLFxuICAgICAgICBmbiA9ICdmbG9vcic7XG5cbiAgICBpZiAodmFsdWUgPCAwKSB7XG4gICAgICAgIGZuID0gJ2NlaWwnO1xuICAgIH1cblxuICAgIHJldHVybiBNYXRoW2ZuXSh2YWx1ZSAqIHNjYWxlKSAvIHNjYWxlO1xufTtcblxuLy9GbG9hdCBlcXVhbHNcbnZhciBmbG9hdEVxdWFscyA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgcmV0dXJuICgoYSAtIDAuMSkgPCBiKSAmJiAoYiA8IChhICsgMC4xKSk7XG59O1xuXG4vKipcbiAqIENvbnZlcnQgYW4gb2JqZWN0IHdpdGggaW5jcmVhc2luZyBpbnRlZ2VyIGtleXMgdG8gYW4gYXJyYXkuXG4gKiBVc2luZyBtZXRob2QgZnJvbSBodHRwOi8vanNwZXJmLmNvbS9hcmd1bWVudHMtcGVyZm9ybWFuY2UvNlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge0FycmF5fVxuICovXG52YXIgdG9BcnJheSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG9iai5sZW5ndGh8fDApLFxuICAgICAgICBpID0gMDtcbiAgICB3aGlsZSAob2JqW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzdWx0W2ldID0gb2JqW2krK107XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG52YXIgcGljayA9IGZ1bmN0aW9uKGtleXMsIG9iaikge1xuICAgIHZhciByZXMgPSB7fTtcbiAgICBmb3IgKHZhciBpID0ga2V5cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcmVzW2tleXNbaV1dID0gb2JqW2tleXNbaV1dO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufTtcblxudmFyIG5vcCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIG5vcFxufTtcblxudmFyIGFzc2VydCA9IGZ1bmN0aW9uKGNvbmQsIG1zZykge1xuICAgIGlmICghY29uZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnIHx8ICdBc3NlcnQgZmFpbGVkJyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgb25XaGljaEVkZ2U6IF9vbldoaWNoRWRnZSxcbiAgICBpc0Nvb3JkSW5EaXJGcm9tOiBfaXNDb29yZEluRGlyRnJvbSxcbiAgICBpc1BvaW50QmV0d2VlblNpZGVzOiBfaXNQb2ludEJldHdlZW5TaWRlcyxcbiAgICBpc1BvaW50SW5EaXJGcm9tOiBfaXNQb2ludEluRGlyRnJvbSxcbiAgICBpc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW46IF9pc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW4sXG4gICAgaXNQb2ludEluOiBfaXNQb2ludEluLFxuICAgIGlzUG9pbnROZWFyOiBfaXNQb2ludE5lYXIsXG4gICAgZ2V0RGlyOiBfZ2V0RGlyLFxuICAgIGV4R2V0TWlub3JEaXI6IF9leEdldE1pbm9yRGlyLFxuICAgIGV4R2V0TWFqb3JEaXI6IF9leEdldE1ham9yRGlyLFxuICAgIGV4R2V0RGlyVGFibGVJbmRleDogX2V4R2V0RGlyVGFibGVJbmRleCxcbiAgICBnZXRNaW5vckRpcjogX2dldE1pbm9yRGlyLFxuICAgIGdldE1ham9yRGlyOiBfZ2V0TWFqb3JEaXIsXG4gICAgZ2V0UmVjdE91dGVyQ29vcmQ6IF9nZXRSZWN0T3V0ZXJDb29yZCxcbiAgICBnZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbTogX2dldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tLFxuICAgIHN0ZXBPbmVJbkRpcjogX3N0ZXBPbmVJbkRpcixcbiAgICByZXZlcnNlRGlyOiBfcmV2ZXJzZURpcixcbiAgICBwcmV2Q2xvY2t3aXNlRGlyOiBfcHJldkNsb2Nrd2lzZURpcixcbiAgICBuZXh0Q2xvY2t3aXNlRGlyOiBfbmV4dENsb2Nrd2lzZURpcixcbiAgICBhcmVJblJpZ2h0QW5nbGU6IF9hcmVJblJpZ2h0QW5nbGUsXG4gICAgaXNSaWdodEFuZ2xlOiBfaXNSaWdodEFuZ2xlLFxuICAgIGlzSG9yaXpvbnRhbDogX2lzSG9yaXpvbnRhbCxcbiAgICBpbnRlcnNlY3Q6IF9pbnRlcnNlY3QsXG4gICAgZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0OiBfZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0LFxuICAgIGlzTGluZUNsaXBSZWN0OiBfaXNMaW5lQ2xpcFJlY3QsXG4gICAgaXNMaW5lQ2xpcFJlY3RzOiBfaXNMaW5lQ2xpcFJlY3RzLFxuICAgIGlzUG9pbnROZWFyTGluZTogX2lzUG9pbnROZWFyTGluZSxcbiAgICBpc09uRWRnZTogX2lzT25FZGdlLFxuICAgIGRpc3RhbmNlRnJvbUxpbmU6IF9kaXN0YW5jZUZyb21MaW5lLFxuICAgIGlzUmVjdENsaXA6IF9pc1JlY3RDbGlwLFxuICAgIGlzUmVjdEluOiBfaXNSZWN0SW4sXG4gICAgaW5mbGF0ZWRSZWN0OiBfaW5mbGF0ZWRSZWN0LFxuICAgIGdldFBvaW50Q29vcmQ6IF9nZXRQb2ludENvb3JkLFxuICAgIGdldE9wdGltYWxQb3J0czogX2dldE9wdGltYWxQb3J0cyxcbiAgICBBckZpbmROZWFyZXN0TGluZTogQXJGaW5kTmVhcmVzdExpbmUsXG5cbiAgICByZW1vdmVGcm9tQXJyYXlzOiByZW1vdmVGcm9tQXJyYXlzLFxuICAgIHN0cmluZ2lmeTogc3RyaW5naWZ5LFxuICAgIGZsb2F0RXF1YWxzOiBmbG9hdEVxdWFscyxcbiAgICByb3VuZFRydW5jOiByb3VuZFRydW5jLFxuICAgIHRvQXJyYXk6IHRvQXJyYXksXG4gICAgbm9wOiBub3AsXG4gICAgYXNzZXJ0OiBhc3NlcnQsXG4gICAgcGljazogcGljayBcbn07XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IGJyb3dzZXI6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIHV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gdXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEF1dG9Sb3V0ZXJHcmFwaCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5HcmFwaCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKTtcblxudmFyIEF1dG9Sb3V0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gaW50ZXJuYWwgdG8gZXh0ZXJuYWwgaWRzXG4gICAgdGhpcy5fYm94SWRzID0ge307XG4gICAgdGhpcy5fcG9ydElkcyA9IHt9O1xuICAgIHRoaXMuX3BhdGhJZHMgPSB7fTtcblxuICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uID0ge307ICAvLyBwb3J0SWRzID0+IHBhdGhzXG4gICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb24gPSB7fTsgIC8vIGJveElkcyA9PiBwYXRoc1xuICAgIHRoaXMuX3BhdGhTcmMgPSB7fTtcbiAgICB0aGlzLl9wYXRoRHN0ID0ge307XG5cbiAgICB0aGlzLl9ncmFwaCA9IG5ldyBBdXRvUm91dGVyR3JhcGgoKTtcbn07XG5cbi8qICogKiAqICogKiAqIFB1YmxpYyBBUEkgKiAqICogKiAqICogKi9cblxuQXV0b1JvdXRlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fZ3JhcGguY2xlYXIodHJ1ZSk7XG4gICAgdGhpcy5fYm94SWRzID0ge307XG4gICAgdGhpcy5fcG9ydElkcyA9IHt9O1xuICAgIHRoaXMuX3BhdGhJZHMgPSB7fTtcblxuICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uID0ge307ICAvLyBwb3J0SWRzID0+IHBhdGhzXG4gICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb24gPSB7fTsgIC8vIGJveElkcyA9PiBwYXRoc1xuICAgIHRoaXMuX3BhdGhTcmMgPSB7fTtcbiAgICB0aGlzLl9wYXRoRHN0ID0ge307XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRCb3ggPSBmdW5jdGlvbihpZCwgcmVjdCkge1xuICAgIHZhciBib3g7XG4gICAgaWYgKHJlY3QgPT09IG51bGwpIHsgIC8vIFJlbW92ZSB0aGUgYm94XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW1vdmVCb3goaWQpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fYm94SWRzW2lkXSkge1xuICAgICAgICBib3ggPSB0aGlzLl9jcmVhdGVCb3gocmVjdCk7XG4gICAgICAgIC8vIFVwZGF0ZSByZWNvcmRzXG4gICAgICAgIHRoaXMuX2JveElkc1tpZF0gPSBib3guaWQ7XG4gICAgICAgIHRoaXMuX3BvcnRJZHNbaWRdID0ge307XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlQm94KGlkLCByZWN0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXREZXBlbmRlbnRCb3ggPSBmdW5jdGlvbihwYXJlbnRJZCwgY2hpbGRJZCkge1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLl9ib3gocGFyZW50SWQpLFxuICAgICAgICBjaGlsZCA9IHRoaXMuX2JveChjaGlsZElkKTtcblxuICAgIGFzc2VydChwYXJlbnQgJiYgY2hpbGQsICdDb3VsZCBub3QgZmluZCBwYXJlbnQgb3IgY2hpbGQnKTtcbiAgICBwYXJlbnQuYWRkQ2hpbGQoY2hpbGQpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0UG9ydCA9IGZ1bmN0aW9uKGJveElkLCBwb3J0SWQsIGFyZWEpIHtcbiAgICBpZiAoYXJlYSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVtb3ZlUG9ydChib3hJZCwgcG9ydElkKTtcbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5fYm94KGJveElkKSwgJ0JveCBcIicgKyBib3hJZCArICdcIiBkb2VzIG5vdCBleGlzdCcpO1xuICAgIGlmICghdGhpcy5fcG9ydElkc1tib3hJZF0gfHwgIXRoaXMuX3BvcnRJZHNbYm94SWRdW3BvcnRJZF0pIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlUG9ydChib3hJZCwgcG9ydElkLCBhcmVhKTtcbiAgICAgICAgYXNzZXJ0KHRoaXMuX3BvcnQoYm94SWQsIHBvcnRJZCksICdQb3J0IG5vdCBhZGRlZCEnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91cGRhdGVQb3J0KGJveElkLCBwb3J0SWQsIGFyZWEpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldFBhdGggPSBmdW5jdGlvbihpZCwgc3JjSWQsIGRzdElkKSB7XG4gICAgaWYgKHNyY0lkID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW1vdmVQYXRoKGlkKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3BhdGhJZHNbaWRdKSB7XG4gICAgICAgIHRoaXMuX2NyZWF0ZVBhdGgoaWQsIHNyY0lkLCBkc3RJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlUGF0aChpZCwgc3JjSWQsIGRzdElkKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRDdXN0b21Sb3V0aW5nID0gZnVuY3Rpb24oaWQsIHBvaW50cykge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aChpZCk7XG5cbiAgICBpZiAocGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93ICdBdXRvUm91dGVyOiBOZWVkIHRvIGhhdmUgYW4gQXV0b1JvdXRlclBhdGggdHlwZSB0byBzZXQgY3VzdG9tIHBhdGggcG9pbnRzJztcbiAgICB9XG5cbiAgICBpZiAocG9pbnRzID09PSBudWxsKSB7XG4gICAgICAgIHBhdGguc2V0QXV0b1JvdXRpbmcodHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc2V0Q3VzdG9tUGF0aChwYXRoLCBwb2ludHMpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnJvdXRlU3luYyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9ncmFwaC5yb3V0ZVN5bmMoKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnJvdXRlQXN5bmMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHRoaXMuX2dyYXBoLnJvdXRlQXN5bmMob3B0aW9ucyk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5ib3ggPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgcEJveCA9IHRoaXMuX2JveChpZCksICAvLyBwcml2YXRlIGJveFxuICAgICAgICByZWN0O1xuXG4gICAgaWYgKCFwQm94KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJlY3QgPSBwQm94LnJlY3Q7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICB4OiByZWN0LmxlZnQsXG4gICAgICAgIHdpZHRoOiByZWN0LnJpZ2h0IC0gcmVjdC5sZWZ0LFxuICAgICAgICB5OiByZWN0LmNlaWwsXG4gICAgICAgIGhlaWdodDogcmVjdC5mbG9vciAtIHJlY3QuY2VpbFxuICAgIH07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5wb3J0ID0gZnVuY3Rpb24gKGJveElkLCBpZCkge1xuICAgIHZhciBjb250YWluZXIgPSB0aGlzLl9wb3J0KGJveElkLCBpZCksXG4gICAgICAgIHJlY3Q7XG5cbiAgICBpZiAoIWNvbnRhaW5lcikge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZWN0ID0gY29udGFpbmVyLnBvcnRzWzBdLnJlY3Q7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIHg6IHJlY3QubGVmdCxcbiAgICAgICAgd2lkdGg6IHJlY3QucmlnaHQgLSByZWN0LmxlZnQsXG4gICAgICAgIHk6IHJlY3QuY2VpbCxcbiAgICAgICAgaGVpZ2h0OiByZWN0LmZsb29yIC0gcmVjdC5jZWlsXG4gICAgfTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBhdGggPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGgoaWQpO1xuICAgIHJldHVybiB7ICAvLyBUT0RPOiBDb25zaWRlciBhZGRpbmcgc3JjLCBkc3RcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICBwb2ludHM6IHBhdGgucG9pbnRzLm1hcChmdW5jdGlvbihwdCkge1xuICAgICAgICAgICAgcmV0dXJuIFtwdC54LCBwdC55XTtcbiAgICAgICAgfSlcbiAgICB9O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuYm94ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2JveElkcyk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5wb3J0cyA9IGZ1bmN0aW9uIChib3hJZCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9wb3J0SWRzW2JveElkXSk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5wYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fcGF0aElkcyk7XG59O1xuXG4vKiAqICogKiAqICogKiBQcml2YXRlIEFQSSAqICogKiAqICogKiAqL1xuXG4vLyBHZXR0ZXJzXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9ib3ggPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgcElkID0gdGhpcy5fYm94SWRzW2lkXTtcbiAgICByZXR1cm4gdGhpcy5fZ3JhcGguYm94ZXNbcElkXSB8fCBudWxsO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3BvcnQgPSBmdW5jdGlvbiAoYm94SWQsIGlkKSB7XG4gICAgYXNzZXJ0KGJveElkICE9PSB1bmRlZmluZWQgJiYgaWQgIT09IHVuZGVmaW5lZCwgJ01pc3NpbmcgJyArIChib3hJZCA/ICdib3hJZCcgOiAnaWQnKSk7XG4gICAgcmV0dXJuIHRoaXMuX3BvcnRJZHNbYm94SWRdW2lkXTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9wYXRoID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBJZCA9IHRoaXMuX3BhdGhJZHNbaWRdO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9ncmFwaC5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKHRoaXMuX2dyYXBoLnBhdGhzW2ldLmlkID09PSBwSWQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9ncmFwaC5wYXRoc1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbi8vIEJveGVzXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVCb3ggPSBmdW5jdGlvbiAocGFyYW1zKSB7XG4gICAgdmFyIHgxID0gcGFyYW1zLngxLFxuICAgICAgICB4MiA9IHBhcmFtcy54MixcbiAgICAgICAgeTEgPSBwYXJhbXMueTEsXG4gICAgICAgIHkyID0gcGFyYW1zLnkyLFxuICAgICAgICBib3ggPSB0aGlzLl9ncmFwaC5jcmVhdGVCb3goKSxcbiAgICAgICAgcmVjdCA9IG5ldyBBclJlY3QoeDEsIHkxLCB4MiwgeTIpO1xuXG4gICAgYXNzZXJ0KCFpc05hTih4MSArIHgyICsgeTEgKyB5MiksICdNaXNzaW5nIHNpemUgaW5mbyBmb3IgYm94Jyk7XG5cbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIGJveC5zZXRSZWN0KHJlY3QpO1xuXG4gICAgLy8gQWRkIHRoZSBib3ggdG8gdGhlIGdyYXBoXG4gICAgdGhpcy5fZ3JhcGguYWRkQm94KGJveCk7XG4gICAgLy8gUmVjb3JkIGtlZXBpbmcgaXMgbm90IGRvbmUgaW4gdGhpcyBmdW5jdGlvbiBiYyB0aGlzIGZ1bmN0aW9uXG4gICAgLy8gaXMgcmV1c2VkIGZvciB0aGUgcG9ydCBjb250YWluZXJzXG4gICAgcmV0dXJuIGJveDtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVCb3ggPSBmdW5jdGlvbiAoaWQsIHBhcmFtcykgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIGJveCA9IHRoaXMuX2JveChpZCksXG4gICAgICAgIHJlY3QgPSBib3gucmVjdCxcbiAgICAgICAgbmV3V2lkdGggPSBwYXJhbXMueDIgLSBwYXJhbXMueDEsXG4gICAgICAgIG5ld0hlaWdodCA9IHBhcmFtcy55MiAtIHBhcmFtcy55MSxcbiAgICAgICAgZHgsXG4gICAgICAgIGR5LFxuICAgICAgICBuZXdSZWN0O1xuXG4gICAgLy8gU2hpZnRcbiAgICBpZiAobmV3SGVpZ2h0ID09PSByZWN0LmdldEhlaWdodCgpICYmIG5ld1dpZHRoID09PSByZWN0LmdldFdpZHRoKCkpIHtcbiAgICAgICAgZHggPSBwYXJhbXMueDEgLSByZWN0LmxlZnQ7XG4gICAgICAgIGR5ID0gcGFyYW1zLnkxIC0gcmVjdC5jZWlsO1xuICAgICAgICB0aGlzLl9ncmFwaC5zaGlmdEJveEJ5KGJveCwge2N4OiBkeCwgY3k6IGR5fSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmVjdCA9IG5ldyBBclJlY3QocGFyYW1zLngxLCBwYXJhbXMueTEsIHBhcmFtcy54MiwgcGFyYW1zLnkyKTtcbiAgICAgICAgdGhpcy5fZ3JhcGguc2V0Qm94UmVjdChib3gsIG5ld1JlY3QpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3JlbW92ZUJveCA9IGZ1bmN0aW9uIChpZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIGJveCA9IHRoaXMuX2JveChpZCksXG4gICAgICAgIHBvcnRzID0gT2JqZWN0LmtleXModGhpcy5fcG9ydElkc1tpZF0pO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwb3J0c1xuICAgIGZvciAodmFyIGkgPSBwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fcmVtb3ZlUG9ydChpZCwgcG9ydHNbaV0pO1xuICAgIH1cblxuICAgIHRoaXMuX2dyYXBoLmRlbGV0ZUJveChib3gpO1xuICAgIGRlbGV0ZSB0aGlzLl9ib3hJZHNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9wb3J0SWRzW2lkXTtcbiAgICBkZWxldGUgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdO1xufTtcblxuLy8gUGF0aHNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZVBhdGggPSBmdW5jdGlvbiAoaWQsIHNyY0lkLCBkc3RJZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIHNyY1BvcnRzID0gdGhpcy5fZ2V0UG9ydHNGb3Ioc3JjSWQpLFxuICAgICAgICBkc3RQb3J0cyA9IHRoaXMuX2dldFBvcnRzRm9yKGRzdElkKSxcbiAgICAgICAgcG9ydHMgPSBzcmNQb3J0cy5jb25jYXQoZHN0UG9ydHMpLFxuICAgICAgICBwYXRoO1xuXG4gICAgYXNzZXJ0KHNyY1BvcnRzLCAnTWlzc2luZyBzcmNQb3J0cyAoJyArIHNyY1BvcnRzICsgJyknKTtcbiAgICBhc3NlcnQoZHN0UG9ydHMsICdNaXNzaW5nIGRzdFBvcnRzICgnICsgZHN0UG9ydHMgKyAnKScpO1xuXG4gICAgcGF0aCA9IHRoaXMuX2dyYXBoLmFkZFBhdGgodHJ1ZSwgc3JjUG9ydHMsIGRzdFBvcnRzKTtcbiAgICBwYXRoLmlkID0gaWQ7XG4gICAgdGhpcy5fcGF0aElkc1tpZF0gPSBwYXRoLmlkO1xuXG4gICAgLy8gVXBkYXRlIHRoZSB1cGRhdGVzIGRpY3Rpb25hcmllc1xuICAgIGZvciAodmFyIGkgPSBwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0c1tpXS5pZF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uW3BvcnRzW2ldLmlkXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uW3BvcnRzW2ldLmlkXS5wdXNoKHBhdGgpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygc3JjSWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bc3JjSWRdKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltzcmNJZF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltzcmNJZF0ucHVzaChwYXRoKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBkc3RJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltkc3RJZF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2RzdElkXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2RzdElkXS5wdXNoKHBhdGgpO1xuICAgIH1cbiAgICB0aGlzLl9wYXRoU3JjW2lkXSA9IHNyY0lkO1xuICAgIHRoaXMuX3BhdGhEc3RbaWRdID0gZHN0SWQ7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fZ2V0UG9ydHNGb3IgPSBmdW5jdGlvbiAoYm94SWQpIHtcbiAgICBpZiAoYm94SWQgaW5zdGFuY2VvZiBBcnJheSkgeyAgLy8gbGlzdCBvZiBwb3J0cyAtPiBub3QgYSBib3hJZFxuICAgICAgICAvLyBGSVhNRTogVGhlc2UgcG9ydHMgd291bGQgYWxzbyBuZWVkIHRvIGJlIHJlc29sdmVkIVxuICAgICAgICByZXR1cm4gYm94SWQ7XG4gICAgfSBlbHNlIHsgIC8vIGJveElkIGlzIGEgYm94IGlkIC0+IGdldCB0aGUgcG9ydHNcbiAgICAgICAgdmFyIHBvcnRJZHMgPSBPYmplY3Qua2V5cyh0aGlzLl9wb3J0SWRzW2JveElkXSksXG4gICAgICAgICAgICBwb3J0cyA9IFtdO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSBwb3J0SWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgYXNzZXJ0KHRoaXMuX3BvcnRJZHNbYm94SWRdW3BvcnRJZHNbaV1dLnBvcnRzLmxlbmd0aCA9PT0gMSk7XG4gICAgICAgICAgICBwb3J0cy5wdXNoKHRoaXMuX3BvcnRJZHNbYm94SWRdW3BvcnRJZHNbaV1dLnBvcnRzWzBdKTtcbiAgICAgICAgfVxuICAgICAgICBhc3NlcnQocG9ydHMsICdubyBwb3J0cyBmb3VuZCAoJyArIHBvcnRzICsgJyknKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgYXNzZXJ0IChwb3J0c1tpXS5vd25lciwgJ0ludmFsaWQgb3duZXInKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG9ydHM7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3VwZGF0ZVBhdGggPSBmdW5jdGlvbiAoaWQsIHNyY0lkLCBkc3RJZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdGhpcy5fcmVtb3ZlUGF0aChpZCk7XG4gICAgdGhpcy5fY3JlYXRlUGF0aChpZCwgc3JjSWQsIGRzdElkKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9yZW1vdmVQYXRoID0gZnVuY3Rpb24gKGlkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGgoaWQpO1xuICAgIHRoaXMuX2dyYXBoLmRlbGV0ZVBhdGgocGF0aCk7XG4gICAgZGVsZXRlIHRoaXMuX3BhdGhJZHNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoU3JjW2lkXTtcbiAgICBkZWxldGUgdGhpcy5fcGF0aERzdFtpZF07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fc2V0Q3VzdG9tUGF0aCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMpIHsgIC8vIHB1YmxpYyBpZFxuICAgIC8vIENvbnZlcnQgcG9pbnRzIHRvIGFycmF5IG9mIEFyUG9pbnRzXG4gICAgcG9pbnRzID0gcG9pbnRzLm1hcChmdW5jdGlvbiAocG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBclBvaW50KHBvaW50WzBdLCBwb2ludFsxXSk7XG4gICAgfSk7XG5cbiAgICBwYXRoLnNldEN1c3RvbVBhdGhQb2ludHMocG9pbnRzKTtcbiAgICBwYXRoLnNldEF1dG9Sb3V0aW5nKGZhbHNlKTtcbn07XG5cbi8vIFBvcnRzXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQsIGFyZWEpIHsgIC8vIGFyZWE6IFtbeDEsIHkxXSwgW3gyLCB5Ml1dXG4gICAgdmFyIGJveCA9IHRoaXMuX2JveChib3hJZCksXG4gICAgICAgIGNvbnRhaW5lcixcbiAgICAgICAgY1JlY3QgPSBuZXcgQXJSZWN0KCksXG4gICAgICAgIHBvcnQgPSBuZXcgQXV0b1JvdXRlclBvcnQoKSxcbiAgICAgICAgcmVjdCA9IHRoaXMuX2NyZWF0ZVJlY3RGcm9tQXJlYShhcmVhKSxcbiAgICAgICAgYXR0cjtcblxuICAgIC8vIENyZWF0ZSB0aGUgcG9ydFxuICAgIGF0dHIgPSB0aGlzLl9nZXRQb3J0QXR0cmlidXRlcyhib3gucmVjdCwgYXJlYSk7XG4gICAgcG9ydC5pZCA9IGJveElkICsgJy98XFxcXCcgKyBwb3J0SWQ7XG4gICAgcG9ydC5zZXRMaW1pdGVkRGlycyhmYWxzZSk7XG4gICAgcG9ydC5hdHRyaWJ1dGVzID0gYXR0cjtcbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIHBvcnQuc2V0UmVjdChyZWN0KTtcblxuICAgIC8vIENyZWF0ZSBhIGNvbnRhaW5lciByZWN0XG4gICAgY1JlY3QuYXNzaWduKHJlY3QpO1xuICAgIGNSZWN0LmluZmxhdGVSZWN0KDEpO1xuICAgIGNvbnRhaW5lciA9IHRoaXMuX2NyZWF0ZUJveCh7XG4gICAgICAgIHgxOiBjUmVjdC5sZWZ0LFxuICAgICAgICB5MTogY1JlY3QuY2VpbCxcbiAgICAgICAgeDI6IGNSZWN0LnJpZ2h0LFxuICAgICAgICB5MjogY1JlY3QuZmxvb3JcbiAgICB9KTtcblxuICAgIGJveC5hZGRDaGlsZChjb250YWluZXIpO1xuICAgIGNvbnRhaW5lci5hZGRQb3J0KHBvcnQpO1xuICAgIHRoaXMuX3BvcnRJZHNbYm94SWRdW3BvcnRJZF0gPSBjb250YWluZXI7XG5cbiAgICAvLyBVcGRhdGUgcGF0aHMgYXMgbmVlZGVkXG4gICAgdmFyIHBhdGhzID0gdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bYm94SWRdIHx8IFtdLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kO1xuXG4gICAgZm9yICh2YXIgaSA9IHBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAvLyBHZXQgdGhlIG5ldyBwb3J0c1xuICAgICAgICBzdGFydCA9IHRoaXMuX2dldFBvcnRzRm9yKHRoaXMuX3BhdGhTcmNbcGF0aHNbaV0uaWRdKTtcbiAgICAgICAgZW5kID0gdGhpcy5fZ2V0UG9ydHNGb3IodGhpcy5fcGF0aERzdFtwYXRoc1tpXS5pZF0pO1xuXG4gICAgICAgIC8vIERpc2Nvbm5lY3QgYW5kIHVwZGF0ZSBwYXRoXG4gICAgICAgIHRoaXMuX2dyYXBoLmRpc2Nvbm5lY3QocGF0aHNbaV0pO1xuICAgICAgICBwYXRoc1tpXS5zZXRTdGFydEVuZFBvcnRzKHN0YXJ0LCBlbmQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVSZWN0RnJvbUFyZWEgPSBmdW5jdGlvbiAoYXJlYSkge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChhcmVhLngxLCBhcmVhLnkxLCBhcmVhLngyLCBhcmVhLnkyKTtcbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIHJldHVybiByZWN0O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2dldFBvcnRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKHJlY3QsIGFyZWEpIHtcbiAgICB2YXIgYXR0ciA9IDAsXG4gICAgICAgIHgxID0gYXJlYS54MSxcbiAgICAgICAgeDIgPSBhcmVhLngyLFxuICAgICAgICB5MSA9IGFyZWEueTEsXG4gICAgICAgIHkyID0gYXJlYS55MixcbiAgICAgICAgaG9yaXpvbnRhbCA9IHkxID09PSB5MjtcblxuICAgIGlmIChob3Jpem9udGFsKSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh5MSAtIHJlY3QuY2VpbCkgPCBNYXRoLmFicyh5MSAtIHJlY3QuZmxvb3IpKSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcFxuICAgICAgICAgICAgYXR0ciA9IENPTlNUQU5UUy5Qb3J0U3RhcnRPblRvcCArIENPTlNUQU5UUy5Qb3J0RW5kT25Ub3A7XG4gICAgICAgIH0gZWxzZSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcCAoaG9yaXpvbnRhbClcbiAgICAgICAgICAgIGF0dHIgPSBDT05TVEFOVFMuUG9ydFN0YXJ0T25Cb3R0b20gKyBDT05TVEFOVFMuUG9ydEVuZE9uQm90dG9tO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTWF0aC5hYnMoeDEgLSByZWN0LmxlZnQpIDwgTWF0aC5hYnMoeDEgLSByZWN0LnJpZ2h0KSkgeyAgLy8gQ2xvc2VyIHRvIHRoZSBsZWZ0XG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uTGVmdCArIENPTlNUQU5UUy5Qb3J0RW5kT25MZWZ0O1xuICAgICAgICB9IGVsc2UgeyAgLy8gQ2xvc2VyIHRvIHRoZSByaWdodCAodmVydGljYWwpXG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uUmlnaHQgKyBDT05TVEFOVFMuUG9ydEVuZE9uUmlnaHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYXR0cjtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQsIGFyZWEpIHtcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyID0gdGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSxcbiAgICAgICAgY1JlY3QgPSBjb250YWluZXIucmVjdCxcbiAgICAgICAgcG9ydCA9IGNvbnRhaW5lci5wb3J0c1swXSxcbiAgICAgICAgcmVjdCA9IHRoaXMuX2NyZWF0ZVJlY3RGcm9tQXJlYShhcmVhKSxcbiAgICAgICAgYXR0cjtcblxuICAgIC8vIFVwZGF0ZSB0aGUgcG9ydCdzIHJlY3RcbiAgICBhdHRyID0gdGhpcy5fZ2V0UG9ydEF0dHJpYnV0ZXMoYm94LnJlY3QsIGFyZWEpO1xuICAgIHBvcnQuc2V0TGltaXRlZERpcnMoZmFsc2UpO1xuICAgIHBvcnQuYXR0cmlidXRlcyA9IGF0dHI7XG4gICAgdGhpcy5fc2V0VmFsaWRSZWN0U2l6ZShyZWN0KTtcbiAgICBwb3J0LnNldFJlY3QocmVjdCk7XG5cbiAgICBjUmVjdC5hc3NpZ24ocG9ydC5yZWN0KTtcbiAgICBjUmVjdC5pbmZsYXRlUmVjdCgxKTtcbiAgICBjb250YWluZXIuc2V0UmVjdChjUmVjdCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlUG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgcG9ydElkKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuX3BvcnQoYm94SWQsIHBvcnRJZCksXG4gICAgICAgIHBvcnQgPSBjb250YWluZXIucG9ydHNbMF0sXG4gICAgICAgIHBhdGhzID0gdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydC5pZF0gfHwgW10sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICB0aGlzLl9ncmFwaC5kZWxldGVCb3goY29udGFpbmVyKTtcblxuICAgIC8vIFVwZGF0ZSBwYXRoc1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0LmlkXTtcbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHN0YXJ0ID0gcGF0aHNbaV0uc3RhcnRwb3J0cztcbiAgICAgICAgZW5kID0gcGF0aHNbaV0uZW5kcG9ydHM7XG4gICAgICAgIHV0aWxzLnJlbW92ZUZyb21BcnJheXMocG9ydCwgc3RhcnQsIGVuZCk7XG4gICAgICAgIHBhdGhzW2ldLnNldFN0YXJ0RW5kUG9ydHMoc3RhcnQsIGVuZCk7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRdO1xufTtcblxuLy8gU2hhcmVkIHV0aWxpdGllc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fc2V0VmFsaWRSZWN0U2l6ZSA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgLy8gTWFrZSBzdXJlIHRoZSByZWN0IGlzIGF0IGxlYXN0IDN4M1xuICAgIHZhciBoZWlnaHQgPSByZWN0LmdldEhlaWdodCgpLFxuICAgICAgICB3aWR0aCA9IHJlY3QuZ2V0V2lkdGgoKSxcbiAgICAgICAgZHggPSBNYXRoLm1heCgoMyAtIHdpZHRoKSAvIDIsIDApLFxuICAgICAgICBkeSA9IE1hdGgubWF4KCgzIC0gaGVpZ2h0KSAvIDIsIDApO1xuXG4gICAgcmVjdC5pbmZsYXRlUmVjdChkeCwgZHkpO1xuICAgIHJldHVybiByZWN0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyO1xuIl19
