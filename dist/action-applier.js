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
    path.setStartPorts(startports);
    path.setEndPorts(endports);
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

AutoRouterPath.prototype.setStartPorts = function (newPorts) {
    this.startports = newPorts;

    if (this.startport) {
        this.calculateStartPorts();
    }
};

AutoRouterPath.prototype.setEndPorts = function (newPorts) {
    this.endports = newPorts;

    if (this.endport) {
        this.calculateEndPorts();
    }
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
    assert = require('./AutoRouter.Utils').assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterGraph = require('./AutoRouter.Graph'),
    AutoRouterPort = require('./AutoRouter.Port');

var AutoRouter = function () {
    // internal to external ids
    this._boxIds = {};
    this._portIds = {};
    this._pathIds = {};

    this._graph = new AutoRouterGraph();
};

/* * * * * * * Public API * * * * * * */

AutoRouter.prototype.clear = function () {
    this._graph.clear(true);
    this._boxIds = {};
    this._portIds = {};
    this._pathIds = {};
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
        this._removePort(boxId, portId);
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
    var pBox = this._box(id);  // private box
    return {
        id: id,
        x1: pBox.rect.left,
        x2: pBox.rect.right,
        y1: pBox.rect.ceil,
        y2: pBox.rect.floor
    };
};

AutoRouter.prototype.port = function (boxId, id) {
    var pPort = this._port(boxId, id);  // private box
    return {
        id: id,
        x1: pPort.rect.left,
        x2: pPort.rect.right,
        y1: pPort.rect.ceil,
        y2: pPort.rect.floor
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
};

// Paths

AutoRouter.prototype._createPath = function (id, srcId, dstId) {  // public id
    var srcPorts = this._getPortsFor(srcId),
        dstPorts = this._getPortsFor(dstId),
        path;

    assert(srcPorts, 'Missing srcPorts (' + srcPorts + ')');
    assert(dstPorts, 'Missing dstPorts (' + dstPorts + ')');
    path = this._graph.addPath(true, srcPorts, dstPorts);
    path.id = id;

    this._pathIds[id] = path.id;
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
};

AutoRouter.prototype._setCustomPath = function (path, points) {  // public id
    path.setAutoRouting(true);

    // Convert points to array of ArPoints
    points = points.map(function (point) {
        return new ArPoint(point[0], point[1]);
    });

    path.setCustomPathPoints(points);
};

// Ports

AutoRouter.prototype._createPort = function (boxId, portId, area) {  // area: {x1, x2, y1, y2}
    var box = this._box(boxId),
        container,
        cRect = new ArRect(),
        port = new AutoRouterPort(),
        rect = this._createRectFromArea(area),
        attr;

    // Create the port
    attr = this._getPortAttributes(box.rect, area);
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
    var container = this._port(boxId, portId);

    this._graph.deleteBox(container);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGVidWcvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9ub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJzcmMvQXV0b1JvdXRlci5BY3Rpb25BcHBsaWVyLmpzIiwic3JjL0F1dG9Sb3V0ZXIuQm94LmpzIiwic3JjL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzLmpzIiwic3JjL0F1dG9Sb3V0ZXIuRWRnZS5qcyIsInNyYy9BdXRvUm91dGVyLkVkZ2VMaXN0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuR3JhcGguanMiLCJzcmMvQXV0b1JvdXRlci5Mb2dnZXIuanMiLCJzcmMvQXV0b1JvdXRlci5QYXRoLmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9pbnQuanMiLCJzcmMvQXV0b1JvdXRlci5Qb2ludExpc3QuanMiLCJzcmMvQXV0b1JvdXRlci5Qb3J0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUmVjdC5qcyIsInNyYy9BdXRvUm91dGVyLlNpemUuanMiLCJzcmMvQXV0b1JvdXRlci5VdGlscy5qcyIsInNyYy9BdXRvUm91dGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6dkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbDVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RlYnVnJyk7XG5leHBvcnRzLmxvZyA9IGxvZztcbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuZXhwb3J0cy5zdG9yYWdlID0gJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZVxuICAgICAgICAgICAgICAgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlXG4gICAgICAgICAgICAgICAgICA/IGNocm9tZS5zdG9yYWdlLmxvY2FsXG4gICAgICAgICAgICAgICAgICA6IGxvY2Fsc3RvcmFnZSgpO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcbiAgJ2xpZ2h0c2VhZ3JlZW4nLFxuICAnZm9yZXN0Z3JlZW4nLFxuICAnZ29sZGVucm9kJyxcbiAgJ2RvZGdlcmJsdWUnLFxuICAnZGFya29yY2hpZCcsXG4gICdjcmltc29uJ1xuXTtcblxuLyoqXG4gKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG4gKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG4gKlxuICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcbiAqL1xuXG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG4gIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG4gIHJldHVybiAoJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSkgfHxcbiAgICAvLyBpcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG4gICAgKHdpbmRvdy5jb25zb2xlICYmIChjb25zb2xlLmZpcmVidWcgfHwgKGNvbnNvbGUuZXhjZXB0aW9uICYmIGNvbnNvbGUudGFibGUpKSkgfHxcbiAgICAvLyBpcyBmaXJlZm94ID49IHYzMT9cbiAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcbiAgICAobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEpO1xufVxuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xufTtcblxuXG4vKipcbiAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFyZ3MoKSB7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cbiAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpXG4gICAgKyB0aGlzLm5hbWVzcGFjZVxuICAgICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKVxuICAgICsgYXJnc1swXVxuICAgICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKVxuICAgICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG4gIGlmICghdXNlQ29sb3JzKSByZXR1cm4gYXJncztcblxuICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG4gIGFyZ3MgPSBbYXJnc1swXSwgYywgJ2NvbG9yOiBpbmhlcml0J10uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDEpKTtcblxuICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuICAvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG4gIC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuICB2YXIgaW5kZXggPSAwO1xuICB2YXIgbGFzdEMgPSAwO1xuICBhcmdzWzBdLnJlcGxhY2UoLyVbYS16JV0vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICBpZiAoJyUlJyA9PT0gbWF0Y2gpIHJldHVybjtcbiAgICBpbmRleCsrO1xuICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuICAgICAgLy8gd2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG4gICAgICAvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuICAgICAgbGFzdEMgPSBpbmRleDtcbiAgICB9XG4gIH0pO1xuXG4gIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcbiAgcmV0dXJuIGFyZ3M7XG59XG5cbi8qKlxuICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbG9nKCkge1xuICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBjb25zb2xlXG4gICAgJiYgY29uc29sZS5sb2dcbiAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG4gIHRyeSB7XG4gICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZztcbiAgfSBjYXRjaChlKSB7fVxuICByZXR1cm4gcjtcbn1cblxuLyoqXG4gKiBFbmFibGUgbmFtZXNwYWNlcyBsaXN0ZWQgaW4gYGxvY2FsU3RvcmFnZS5kZWJ1Z2AgaW5pdGlhbGx5LlxuICovXG5cbmV4cG9ydHMuZW5hYmxlKGxvYWQoKSk7XG5cbi8qKlxuICogTG9jYWxzdG9yYWdlIGF0dGVtcHRzIHRvIHJldHVybiB0aGUgbG9jYWxzdG9yYWdlLlxuICpcbiAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugc2FmYXJpIHRocm93c1xuICogd2hlbiBhIHVzZXIgZGlzYWJsZXMgY29va2llcy9sb2NhbHN0b3JhZ2VcbiAqIGFuZCB5b3UgYXR0ZW1wdCB0byBhY2Nlc3MgaXQuXG4gKlxuICogQHJldHVybiB7TG9jYWxTdG9yYWdlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9jYWxzdG9yYWdlKCl7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG4gIH0gY2F0Y2ggKGUpIHt9XG59XG4iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gZGVidWc7XG5leHBvcnRzLmNvZXJjZSA9IGNvZXJjZTtcbmV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5leHBvcnRzLmVuYWJsZSA9IGVuYWJsZTtcbmV4cG9ydHMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5leHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSgnbXMnKTtcblxuLyoqXG4gKiBUaGUgY3VycmVudGx5IGFjdGl2ZSBkZWJ1ZyBtb2RlIG5hbWVzLCBhbmQgbmFtZXMgdG8gc2tpcC5cbiAqL1xuXG5leHBvcnRzLm5hbWVzID0gW107XG5leHBvcnRzLnNraXBzID0gW107XG5cbi8qKlxuICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuICpcbiAqIFZhbGlkIGtleSBuYW1lcyBhcmUgYSBzaW5nbGUsIGxvd2VyY2FzZWQgbGV0dGVyLCBpLmUuIFwiblwiLlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycyA9IHt9O1xuXG4vKipcbiAqIFByZXZpb3VzbHkgYXNzaWduZWQgY29sb3IuXG4gKi9cblxudmFyIHByZXZDb2xvciA9IDA7XG5cbi8qKlxuICogUHJldmlvdXMgbG9nIHRpbWVzdGFtcC5cbiAqL1xuXG52YXIgcHJldlRpbWU7XG5cbi8qKlxuICogU2VsZWN0IGEgY29sb3IuXG4gKlxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2VsZWN0Q29sb3IoKSB7XG4gIHJldHVybiBleHBvcnRzLmNvbG9yc1twcmV2Q29sb3IrKyAlIGV4cG9ydHMuY29sb3JzLmxlbmd0aF07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlYnVnKG5hbWVzcGFjZSkge1xuXG4gIC8vIGRlZmluZSB0aGUgYGRpc2FibGVkYCB2ZXJzaW9uXG4gIGZ1bmN0aW9uIGRpc2FibGVkKCkge1xuICB9XG4gIGRpc2FibGVkLmVuYWJsZWQgPSBmYWxzZTtcblxuICAvLyBkZWZpbmUgdGhlIGBlbmFibGVkYCB2ZXJzaW9uXG4gIGZ1bmN0aW9uIGVuYWJsZWQoKSB7XG5cbiAgICB2YXIgc2VsZiA9IGVuYWJsZWQ7XG5cbiAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuICAgIHZhciBjdXJyID0gK25ldyBEYXRlKCk7XG4gICAgdmFyIG1zID0gY3VyciAtIChwcmV2VGltZSB8fCBjdXJyKTtcbiAgICBzZWxmLmRpZmYgPSBtcztcbiAgICBzZWxmLnByZXYgPSBwcmV2VGltZTtcbiAgICBzZWxmLmN1cnIgPSBjdXJyO1xuICAgIHByZXZUaW1lID0gY3VycjtcblxuICAgIC8vIGFkZCB0aGUgYGNvbG9yYCBpZiBub3Qgc2V0XG4gICAgaWYgKG51bGwgPT0gc2VsZi51c2VDb2xvcnMpIHNlbGYudXNlQ29sb3JzID0gZXhwb3J0cy51c2VDb2xvcnMoKTtcbiAgICBpZiAobnVsbCA9PSBzZWxmLmNvbG9yICYmIHNlbGYudXNlQ29sb3JzKSBzZWxmLmNvbG9yID0gc2VsZWN0Q29sb3IoKTtcblxuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIGFyZ3NbMF0gPSBleHBvcnRzLmNvZXJjZShhcmdzWzBdKTtcblxuICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcbiAgICAgIC8vIGFueXRoaW5nIGVsc2UgbGV0J3MgaW5zcGVjdCB3aXRoICVvXG4gICAgICBhcmdzID0gWyclbyddLmNvbmNhdChhcmdzKTtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgYXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16JV0pL2csIGZ1bmN0aW9uKG1hdGNoLCBmb3JtYXQpIHtcbiAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcbiAgICAgIGlmIChtYXRjaCA9PT0gJyUlJykgcmV0dXJuIG1hdGNoO1xuICAgICAgaW5kZXgrKztcbiAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9ybWF0dGVyKSB7XG4gICAgICAgIHZhciB2YWwgPSBhcmdzW2luZGV4XTtcbiAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG4gICAgICAgIC8vIG5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcbiAgICAgICAgYXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICBpbmRleC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuXG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmZvcm1hdEFyZ3MpIHtcbiAgICAgIGFyZ3MgPSBleHBvcnRzLmZvcm1hdEFyZ3MuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgfVxuICAgIHZhciBsb2dGbiA9IGVuYWJsZWQubG9nIHx8IGV4cG9ydHMubG9nIHx8IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgbG9nRm4uYXBwbHkoc2VsZiwgYXJncyk7XG4gIH1cbiAgZW5hYmxlZC5lbmFibGVkID0gdHJ1ZTtcblxuICB2YXIgZm4gPSBleHBvcnRzLmVuYWJsZWQobmFtZXNwYWNlKSA/IGVuYWJsZWQgOiBkaXNhYmxlZDtcblxuICBmbi5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG5cbiAgcmV0dXJuIGZuO1xufVxuXG4vKipcbiAqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcbiAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcbiAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG4gIHZhciBzcGxpdCA9IChuYW1lc3BhY2VzIHx8ICcnKS5zcGxpdCgvW1xccyxdKy8pO1xuICB2YXIgbGVuID0gc3BsaXQubGVuZ3RoO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoIXNwbGl0W2ldKSBjb250aW51ZTsgLy8gaWdub3JlIGVtcHR5IHN0cmluZ3NcbiAgICBuYW1lc3BhY2VzID0gc3BsaXRbaV0ucmVwbGFjZSgvXFwqL2csICcuKj8nKTtcbiAgICBpZiAobmFtZXNwYWNlc1swXSA9PT0gJy0nKSB7XG4gICAgICBleHBvcnRzLnNraXBzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzLnN1YnN0cigxKSArICckJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLm5hbWVzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzICsgJyQnKSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkaXNhYmxlKCkge1xuICBleHBvcnRzLmVuYWJsZSgnJyk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBtb2RlIG5hbWUgaXMgZW5hYmxlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGVkKG5hbWUpIHtcbiAgdmFyIGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLnNraXBzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5uYW1lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLm5hbWVzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ29lcmNlIGB2YWxgLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuICogQHJldHVybiB7TWl4ZWR9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBjb2VyY2UodmFsKSB7XG4gIGlmICh2YWwgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIHZhbC5zdGFjayB8fCB2YWwubWVzc2FnZTtcbiAgcmV0dXJuIHZhbDtcbn1cbiIsIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7U3RyaW5nfE51bWJlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih2YWwsIG9wdGlvbnMpe1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB2YWwpIHJldHVybiBwYXJzZSh2YWwpO1xuICByZXR1cm4gb3B0aW9ucy5sb25nXG4gICAgPyBsb25nKHZhbClcbiAgICA6IHNob3J0KHZhbCk7XG59O1xuXG4vKipcbiAqIFBhcnNlIHRoZSBnaXZlbiBgc3RyYCBhbmQgcmV0dXJuIG1pbGxpc2Vjb25kcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShzdHIpIHtcbiAgc3RyID0gJycgKyBzdHI7XG4gIGlmIChzdHIubGVuZ3RoID4gMTAwMDApIHJldHVybjtcbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5cnMnOlxuICAgIGNhc2UgJ3lyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdocnMnOlxuICAgIGNhc2UgJ2hyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ21pbnMnOlxuICAgIGNhc2UgJ21pbic6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzZWNzJzpcbiAgICBjYXNlICdzZWMnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG4gICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgIGNhc2UgJ21zZWNzJzpcbiAgICBjYXNlICdtc2VjJzpcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNob3J0KG1zKSB7XG4gIGlmIChtcyA+PSBkKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICBpZiAobXMgPj0gaCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcbiAgaWYgKG1zID49IG0pIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG4gIGlmIChtcyA+PSBzKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9uZyhtcykge1xuICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JylcbiAgICB8fCBwbHVyYWwobXMsIGgsICdob3VyJylcbiAgICB8fCBwbHVyYWwobXMsIG0sICdtaW51dGUnKVxuICAgIHx8IHBsdXJhbChtcywgcywgJ3NlY29uZCcpXG4gICAgfHwgbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcbiAgaWYgKG1zIDwgbikgcmV0dXJuO1xuICBpZiAobXMgPCBuICogMS41KSByZXR1cm4gTWF0aC5mbG9vcihtcyAvIG4pICsgJyAnICsgbmFtZTtcbiAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcbn1cbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEF1dG9Sb3V0ZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXInKSxcbiAgICBhc3NlcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKS5hc3NlcnQ7XG5cbnZhciBBdXRvUm91dGVyQWN0aW9uQXBwbGllciA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLkF1dG9Sb3V0ZXIgPSBBdXRvUm91dGVyO1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wb3J0U2VwYXJhdG9yID0gdGhpcy5fcG9ydFNlcGFyYXRvciB8fCAnX3hfJztcbiAgICB0aGlzLmF1dG9yb3V0ZXIgPSBuZXcgQXV0b1JvdXRlcigpO1xuICAgIHRoaXMuZGVidWdBY3Rpb25TZXF1ZW5jZSA9ICdbJztcbiAgICB0aGlzLl9jbGVhclJlY29yZHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fY2xlYXJSZWNvcmRzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2F1dG9yb3V0ZXJCb3hlcyA9IHt9OyAgLy8gRGVmaW5lIGNvbnRhaW5lciB0aGF0IHdpbGwgbWFwIG9iaitzdWJJRCAtPiBib3hcbiAgICB0aGlzLl9hdXRvcm91dGVyUG9ydHMgPSB7fTsgIC8vIE1hcHMgYm94SWRzIHRvIGFuIGFycmF5IG9mIHBvcnQgaWRzIHRoYXQgaGF2ZSBiZWVuIG1hcHBlZFxuICAgIHRoaXMuX2F1dG9yb3V0ZXJQYXRocyA9IHt9O1xuICAgIHRoaXMuX2FyUGF0aElkMk9yaWdpbmFsID0ge307XG59O1xuXG4vKipcbiAqIFJlcGxhY2UgaWQgc3RvcmVkIGF0IHRoZSBnaXZlbiBpbmRpY2VzIG9mIHRoZSBhcnJheSB3aXRoIHRoZSBpdGVtIGZyb20gdGhlIGRpY3Rpb25hcnkuXG4gKlxuICogQHBhcmFtIHtEaWN0aW9uYXJ5fSBkaWN0aW9uYXJ5XG4gKiBAcGFyYW0ge0FycmF5fSBhcnJheVxuICogQHBhcmFtIHtBcnJheTxOdW1iZXI+fSBpbmRpY2VzXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fbG9va3VwSXRlbSA9IGZ1bmN0aW9uIChkaWN0aW9uYXJ5LCBhcnJheSwgaW5kaWNlcykgeyAgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgdmFyIGluZGV4LFxuICAgICAgICBpZDtcblxuICAgIGZvciAodmFyIGkgPSAyOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGluZGV4ID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBpZCA9IGFycmF5W2luZGV4XTtcbiAgICAgICAgYXJyYXlbaW5kZXhdID0gZGljdGlvbmFyeVtpZF07XG4gICAgfVxufTtcblxuLy8gRklYTUU6IFVwZGF0ZSB0aGlzIG1ldGhvZCBmb3IgbmV3IGFwaVxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9maXhBcmdzID0gZnVuY3Rpb24gKGNvbW1hbmQsIGFyZ3MpIHtcbiAgICB2YXIgaWQ7XG4gICAgLy8gRml4IGFyZ3MsIGlmIG5lZWRlZFxuICAgIHN3aXRjaCAoY29tbWFuZCkge1xuICAgICAgICBjYXNlICdtb3ZlJzogIC8vIGFyZ3NbMF0gaXMgaWQgc2hvdWxkIGJlIHRoZSBib3hcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGFyZ3NbMF0gPSBhcmdzWzBdLmJveDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2dldFBhdGhQb2ludHMnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyUGF0aHMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0UGF0aEN1c3RvbVBvaW50cyc6XG4gICAgICAgICAgICBpZCA9IGFyZ3NbMF0ucGF0aDtcbiAgICAgICAgICAgIGFyZ3NbMF0ucGF0aCA9IHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF07XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdzZXRCb3hSZWN0JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2dldEJveFJlY3QnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYXJnc1swXSA9IGFyZ3NbMF0uYm94LmlkO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAndXBkYXRlUG9ydCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdzZXRDb21wb25lbnQnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDAsIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYWRkUGF0aCc6XG4gICAgICAgICAgICB0aGlzLl9maXhQb3J0QXJncyhhcmdzWzBdLnNyYywgYXJnc1swXS5kc3QpO1xuICAgICAgICAgICAgYXJncy5wb3AoKTsgIC8vIFJlbW92ZSB0aGUgY29ubmVjdGlvbiBpZFxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAncmVtb3ZlJzpcbiAgICAgICAgICAgIHZhciBpdGVtO1xuXG4gICAgICAgICAgICBpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAodGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXSkge1xuICAgICAgICAgICAgICAgIGl0ZW0gPSB0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF07ICAvLyBJZiBvYmpJZCBpcyBhIGNvbm5lY3Rpb25cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXJnc1swXSA9IGl0ZW07XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdhZGRCb3gnOlxuICAgICAgICAgICAgYXJncy5wb3AoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fZml4UG9ydEFyZ3MgPSBmdW5jdGlvbiAocG9ydDEsIHBvcnQyKSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIHZhciBwb3J0SWQsXG4gICAgICAgIHBvcnRJZHMsXG4gICAgICAgIGFyUG9ydElkLFxuICAgICAgICBib3hJZCxcbiAgICAgICAgcG9ydHM7XG5cbiAgICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBwb3J0cyA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgcG9ydElkcyA9IE9iamVjdC5rZXlzKHBvcnRzKTtcbiAgICAgICAgZm9yICh2YXIgaiA9IHBvcnRJZHMubGVuZ3RoOyBqLS07KSB7XG4gICAgICAgICAgICBwb3J0SWQgPSBwb3J0SWRzW2pdO1xuICAgICAgICAgICAgYm94SWQgPSBwb3J0c1twb3J0SWRdO1xuXG4gICAgICAgICAgICBhclBvcnRJZCA9IHRoaXMuYXV0b3JvdXRlci5nZXRQb3J0SWQocG9ydElkLCB0aGlzLl9hdXRvcm91dGVyQm94ZXNbYm94SWRdKTtcbiAgICAgICAgICAgIHBvcnRzW3BvcnRJZF0gPSB0aGlzLl9hdXRvcm91dGVyQm94ZXNbYm94SWRdLnBvcnRzW2FyUG9ydElkXTtcbiAgICAgICAgICAgIGFzc2VydCh0aGlzLl9hdXRvcm91dGVyQm94ZXNbYm94SWRdLnBvcnRzW2FyUG9ydElkXSwgJ0FSIFBvcnQgbm90IGZvdW5kIScpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbnZva2UgYW4gQXV0b1JvdXRlciBtZXRob2QuIFRoaXMgYWxsb3dzIHRoZSBhY3Rpb24gdG8gYmUgbG9nZ2VkIGFuZCBidWdzIHJlcGxpY2F0ZWQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGNvbW1hbmRcbiAqIEBwYXJhbSB7QXJyYXl9IGFyZ3NcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9pbnZva2VBdXRvUm91dGVyTWV0aG9kID0gZnVuY3Rpb24gKGNvbW1hbmQsIGFyZ3MpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5faW52b2tlQXV0b1JvdXRlck1ldGhvZFVuc2FmZShjb21tYW5kLCBhcmdzKTtcblxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ0F1dG9Sb3V0ZXIuJyArIGNvbW1hbmQgKyAnIGZhaWxlZCB3aXRoIGVycm9yOiAnICsgZSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9pbnZva2VBdXRvUm91dGVyTWV0aG9kVW5zYWZlID0gZnVuY3Rpb24gKGNvbW1hbmQsIGFyZ3MpIHtcbiAgICB2YXIgcmVzdWx0LFxuICAgICAgICBvbGRBcmdzID0gYXJncy5zbGljZSgpO1xuXG4gICAgaWYgKHRoaXMuX3JlY29yZEFjdGlvbnMpIHtcbiAgICAgICAgdGhpcy5fcmVjb3JkQWN0aW9uKGNvbW1hbmQsIGFyZ3Muc2xpY2UoKSk7XG4gICAgfVxuXG4gICAgLy8gU29tZSBhcmd1bWVudHMgYXJlIHNpbXBseSBpZHMgZm9yIGVhc2llciByZWNvcmRpbmdcbiAgICB0aGlzLl9maXhBcmdzKGNvbW1hbmQsIGFyZ3MpO1xuXG4gICAgcmVzdWx0ID0gdGhpcy5hdXRvcm91dGVyW2NvbW1hbmRdLmFwcGx5KHRoaXMuYXV0b3JvdXRlciwgYXJncyk7XG4gICAgdGhpcy5fdXBkYXRlUmVjb3Jkcyhjb21tYW5kLCBvbGRBcmdzLCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX3VwZGF0ZVJlY29yZHMgPSBmdW5jdGlvbiAoY29tbWFuZCwgaW5wdXQsIHJlc3VsdCkge1xuICAgIGFzc2VydCAoaW5wdXQgaW5zdGFuY2VvZiBBcnJheSk7XG4gICAgdmFyIGlkLFxuICAgICAgICBhcmdzID0gaW5wdXQuc2xpY2UoKSxcbiAgICAgICAgaTtcblxuICAgIHN3aXRjaCAoY29tbWFuZCkge1xuICAgICAgICBjYXNlICdhZGRQYXRoJzpcbiAgICAgICAgICAgIGlkID0gYXJncy5wb3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF0gPSByZXN1bHQ7XG4gICAgICAgICAgICB0aGlzLl9hclBhdGhJZDJPcmlnaW5hbFtyZXN1bHRdID0gaWQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdhZGRCb3gnOlxuICAgICAgICAgICAgaWQgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXSA9IHJlc3VsdDtcblxuICAgICAgICAgICAgLy8gQWRkIHBvcnRzXG4gICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdID0gW107XG4gICAgICAgICAgICB2YXIgaWRzID0gT2JqZWN0LmtleXMocmVzdWx0LnBvcnRzKTtcbiAgICAgICAgICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdLnB1c2gocmVzdWx0LnBvcnRzW2lkc1tpXV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAncmVtb3ZlJzpcbiAgICAgICAgICAgIGlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdKSB7XG4gICAgICAgICAgICAgICAgaSA9IHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0gPyB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdLmxlbmd0aCA6IDA7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcG9ydElkID0gaWQgKyB0aGlzLl9wb3J0U2VwYXJhdG9yICsgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXVtpXTsgLy9JRCBvZiBjaGlsZCBwb3J0XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hdXRvcm91dGVyQm94ZXNbcG9ydElkXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFySWQgPSB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hclBhdGhJZDJPcmlnaW5hbFthcklkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldENvbXBvbmVudCc6XG4gICAgICAgICAgICB2YXIgbGVuLFxuICAgICAgICAgICAgICAgIHN1YkNvbXBJZDtcblxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgbGVuID0gaWQubGVuZ3RoICsgdGhpcy5fcG9ydFNlcGFyYXRvci5sZW5ndGg7XG4gICAgICAgICAgICBzdWJDb21wSWQgPSBhcmdzWzFdLnN1YnN0cmluZyhsZW4pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXS5pbmRleE9mKHN1YkNvbXBJZCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXS5wdXNoKHN1YkNvbXBJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1cGRhdGVQb3J0JzpcbiAgICAgICAgICAgIGlkID0gYXJnc1sxXS5pZDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn07XG5cbi8qKlxuICogQWRkIHRoZSBnaXZlbiBhY3Rpb24gdG8gdGhlIGN1cnJlbnQgc2VxdWVuY2Ugb2YgYXV0b3JvdXRlciBjb21tYW5kcy5cbiAqXG4gKiBAcGFyYW0gb2JqSWRcbiAqIEBwYXJhbSBzdWJDb21wSWRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9yZWNvcmRBY3Rpb24gPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuXG4gICAgdmFyIGFjdGlvbiA9IHthY3Rpb246IGNvbW1hbmQsIGFyZ3M6IGFyZ3N9LFxuICAgICAgICBjaXJjdWxhckZpeGVyID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS5vd25lcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9O1xuXG4gICAgdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlICs9IEpTT04uc3RyaW5naWZ5KGFjdGlvbiwgY2lyY3VsYXJGaXhlcikgKyAnLCc7XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2dldEFjdGlvblNlcXVlbmNlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuZGVidWdBY3Rpb25TZXF1ZW5jZS5sYXN0SW5kZXhPZignLCcpLFxuICAgICAgICByZXN1bHQgPSB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2Uuc3Vic3RyaW5nKDAsIGluZGV4KSArICddJztcblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyO1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXV0b1JvdXRlclBvcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9ydCcpO1xuXG5cbnZhciBBdXRvUm91dGVyQm94ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMucmVjdCA9IG5ldyBBclJlY3QoKTtcbiAgICB0aGlzLmF0b21pYyA9IGZhbHNlO1xuICAgIHRoaXMuc2VsZlBvaW50cyA9IFtdO1xuICAgIHRoaXMucG9ydHMgPSBbXTtcbiAgICB0aGlzLmNoaWxkQm94ZXMgPSBbXTsvL2RlcGVuZGVudCBib3hlc1xuICAgIHRoaXMucGFyZW50ID0gbnVsbDtcbiAgICB0aGlzLmlkID0gbnVsbDtcblxuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpOyAvL1BhcnQgb2YgaW5pdGlhbGl6YXRpb25cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmNhbGN1bGF0ZVNlbGZQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmdldFRvcExlZnQoKSkpO1xuXG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmZsb29yKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmxlZnQsIHRoaXMucmVjdC5mbG9vcikpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuZGVsZXRlQWxsUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBvcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMucG9ydHNbaV0uZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHRoaXMucG9ydHMgPSBbXTtcblxuICAgIHRoaXMuYXRvbWljID0gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5oYXNPd25lciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5vd25lciAhPT0gbnVsbDtcbn07XG5cbi8vIFRPRE86IFJlbW92ZSB0aGlzIGZ1bmN0aW9uXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5jcmVhdGVQb3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwb3J0ID0gbmV3IEF1dG9Sb3V0ZXJQb3J0KCk7XG4gICAgYXNzZXJ0KHBvcnQgIT09IG51bGwsICdBUkJveC5jcmVhdGVQb3J0OiBwb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5oYXNOb1BvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucG9ydHMubGVuZ3RoID09PSAwO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNBdG9taWMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXRvbWljO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuYWRkUG9ydCA9IGZ1bmN0aW9uIChwb3J0KSB7XG4gICAgYXNzZXJ0KHBvcnQgIT09IG51bGwsICdBUkJveC5hZGRQb3J0OiBwb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgcG9ydC5vd25lciA9IHRoaXM7XG4gICAgdGhpcy5wb3J0cy5wdXNoKHBvcnQpO1xuXG4gICAgaWYgKHRoaXMub3duZXIpIHsgIC8vIE5vdCBwb2ludGluZyB0byB0aGUgQVJHcmFwaFxuICAgICAgICB0aGlzLm93bmVyLl9hZGRFZGdlcyhwb3J0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5kZWxldGVQb3J0ID0gZnVuY3Rpb24gKHBvcnQpIHtcbiAgICBhc3NlcnQocG9ydCAhPT0gbnVsbCwgJ0FSQm94LmRlbGV0ZVBvcnQ6IHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgaWYgKHBvcnQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbmRleCA9IHRoaXMucG9ydHMuaW5kZXhPZihwb3J0KSxcbiAgICAgICAgZ3JhcGggPSB0aGlzLm93bmVyO1xuXG4gICAgYXNzZXJ0KGluZGV4ICE9PSAtMSwgJ0FSQm94LmRlbGV0ZVBvcnQ6IGluZGV4ICE9PSAtMSBGQUlMRUQnKTtcblxuICAgIGdyYXBoLmRlbGV0ZUVkZ2VzKHBvcnQpO1xuICAgIHRoaXMucG9ydHMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIHRoaXMuYXRvbWljID0gZmFsc2U7XG5cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzUmVjdEVtcHR5ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnNldFJlY3QgPSBmdW5jdGlvbiAocikge1xuICAgIGFzc2VydChyIGluc3RhbmNlb2YgQXJSZWN0LCAnSW52YWx0aGlzLmlkIGFyZyBpbiBBUkJveC5zZXRSZWN0LiBSZXF1aXJlcyBBclJlY3QnKTtcblxuICAgIGFzc2VydChyLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMsXG4gICAgICAgICdBUkJveC5zZXRSZWN0OiByLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMgRkFJTEVEIScpO1xuXG4gICAgYXNzZXJ0KHIuZ2V0VG9wTGVmdCgpLnggPj0gQ09OU1RBTlRTLkVEX01JTkNPT1JEICYmIHIuZ2V0VG9wTGVmdCgpLnkgPj0gQ09OU1RBTlRTLkVEX01JTkNPT1JELFxuICAgICAgICAnQVJCb3guc2V0UmVjdDogci5nZXRUb3BMZWZ0KCkueCA+PSBDT05TVEFOVFMuRURfTUlOQ09PUkQgJiYgci5nZXRUb3BMZWZ0KCkueSA+PSAnICtcbiAgICAgICAgJ0NPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQhJyk7XG5cbiAgICBhc3NlcnQoci5nZXRCb3R0b21SaWdodCgpLnggPD0gQ09OU1RBTlRTLkVEX01BWENPT1JEICYmIHIuZ2V0Qm90dG9tUmlnaHQoKS55IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSQm94LnNldFJlY3Q6ICByLmdldEJvdHRvbVJpZ2h0KCkueCA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQgJiYgci5nZXRCb3R0b21SaWdodCgpLnkgPD0gJyArXG4gICAgICAgICdDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFzc2lnbihyKTtcbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcblxuICAgIGlmICh0aGlzLmF0b21pYykge1xuICAgICAgICBhc3NlcnQodGhpcy5wb3J0cy5sZW5ndGggPT09IDEsICdBUkJveC5zZXRSZWN0OiB0aGlzLnBvcnRzLmxlbmd0aCA9PT0gMSBGQUlMRUQhJyk7XG4gICAgICAgIHRoaXMucG9ydHNbMF0uc2V0UmVjdChyKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5zaGlmdEJ5ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHRoaXMucmVjdC5hZGQob2Zmc2V0KTtcblxuICAgIHZhciBpID0gdGhpcy5wb3J0cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLnBvcnRzW2ldLnNoaWZ0Qnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICAvKlxuICAgICBUaGlzIGlzIG5vdCBuZWNlc3Nhcnk7IHRoZSBBUkdyYXBoIHdpbGwgc2hpZnQgYWxsIGNoaWxkcmVuXG4gICAgIGkgPSB0aGlzLmNoaWxkQm94ZXMubGVuZ3RoO1xuICAgICB3aGlsZShpLS0pe1xuICAgICB0aGlzLmNoaWxkQm94ZXNbaV0uc2hpZnRCeShvZmZzZXQpO1xuICAgICB9XG4gICAgICovXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5yZXNldFBvcnRBdmFpbGFiaWxpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMucG9ydHNbaV0ucmVzZXRBdmFpbGFibGVBcmVhKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBpZiAoIWJveC5oYXNBbmNlc3RvcldpdGhJZCh0aGlzLmlkKSAmJiAgIC8vIEJveGVzIGFyZSBub3QgZGVwZW5kZW50IG9uIG9uZSBhbm90aGVyXG4gICAgICAgICF0aGlzLmhhc0FuY2VzdG9yV2l0aElkKGJveC5pZCkpIHtcblxuICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHRoaXMucG9ydHNbaV0uYWRqdXN0QXZhaWxhYmxlQXJlYShib3gucmVjdCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hZGRDaGlsZCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQodGhpcy5jaGlsZEJveGVzLmluZGV4T2YoYm94KSA9PT0gLTEsXG4gICAgICAgICdBUkJveC5hZGRDaGlsZDogYm94IGFscmVhZHkgaXMgY2hpbGQgb2YgJyArIHRoaXMuaWQpO1xuICAgIGFzc2VydChib3ggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94LFxuICAgICAgICAnQ2hpbGQgYm94IG11c3QgYmUgb2YgdHlwZSBBdXRvUm91dGVyQm94Jyk7XG5cbiAgICB0aGlzLmNoaWxkQm94ZXMucHVzaChib3gpO1xuICAgIGJveC5wYXJlbnQgPSB0aGlzO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUucmVtb3ZlQ2hpbGQgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgdmFyIGkgPSB0aGlzLmNoaWxkQm94ZXMuaW5kZXhPZihib3gpO1xuICAgIGFzc2VydChpICE9PSAtMSwgJ0FSQm94LnJlbW92ZUNoaWxkOiBib3ggaXNuXFwndCBjaGlsZCBvZiAnICsgdGhpcy5pZCk7XG4gICAgdGhpcy5jaGlsZEJveGVzLnNwbGljZShpLCAxKTtcbiAgICBib3gucGFyZW50ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmhhc0FuY2VzdG9yV2l0aElkID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGJveCA9IHRoaXM7XG4gICAgd2hpbGUgKGJveCkge1xuICAgICAgICBpZiAoYm94LmlkID09PSBpZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgYm94ID0gYm94LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuZ2V0Um9vdEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYm94ID0gdGhpcztcbiAgICB3aGlsZSAoYm94LnBhcmVudCkge1xuICAgICAgICBib3ggPSBib3gucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gYm94O1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNCb3hBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcbiAgICByZXR1cm4gVXRpbHMuaXNQb2ludEluKHBvaW50LCB0aGlzLnJlY3QsIG5lYXJuZXNzKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQm94Q2xpcCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgcmV0dXJuIFV0aWxzLmlzUmVjdENsaXAodGhpcy5yZWN0LCByKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQm94SW4gPSBmdW5jdGlvbiAocikge1xuICAgIHJldHVybiBVdGlscy5pc1JlY3RJbih0aGlzLnJlY3QsIHIpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IHRoaXMuY2hpbGRCb3hlcy5sZW5ndGg7XG5cbiAgICAvL25vdGlmeSB0aGlzLnBhcmVudCBvZiBkZXN0cnVjdGlvblxuICAgIC8vaWYgdGhlcmUgaXMgYSB0aGlzLnBhcmVudCwgb2YgY291cnNlXG4gICAgaWYgKHRoaXMucGFyZW50KSB7XG4gICAgICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMuZGVsZXRlQWxsUG9ydHMoKTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5jaGlsZEJveGVzW2ldLmRlc3Ryb3koKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBwID0gdGhpcy5wb3J0cy5sZW5ndGg7IHAtLTspIHtcbiAgICAgICAgdGhpcy5wb3J0c1twXS5hc3NlcnRWYWxpZCgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckJveDtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcbnZhciBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEVNUFRZX1BPSU5UOiBuZXcgQXJQb2ludCgtMTAwMDAwLCAtMTAwMDAwKSxcbiAgICBFRF9NQVhDT09SRDogMTAwMDAwLFxuICAgIEVEX01JTkNPT1JEOiAtMiwvL1RoaXMgYWxsb3dzIGNvbm5lY3Rpb25zIHRvIGJlIHN0aWxsIGJlIGRyYXcgd2hlbiBib3ggaXMgcHJlc3NlZCBhZ2FpbnN0IHRoZSBlZGdlXG4gICAgRURfU01BTExHQVA6IDE1LFxuICAgIENPTk5FQ1RJT05DVVNUT01JWkFUSU9OREFUQVZFUlNJT046IDAsXG4gICAgRU1QVFlDT05ORUNUSU9OQ1VTVE9NSVpBVElPTkRBVEFNQUdJQzogLTEsXG4gICAgREVCVUc6IGZhbHNlLFxuICAgIEJVRkZFUjogMTAsXG5cbiAgICBFRExTX1M6IDE1LC8vRURfU01BTExHQVBcbiAgICBFRExTX1I6IDE1ICsgMSwgLy9FRF9TTUFMTEdBUCsxXG4gICAgRURMU19EOiAxMDAwMDAgKyAyLC8vRURfTUFYQ09PUkQgLSBFRF9NSU5DT09SRCxcblxuICAgIFBhdGhFbmRPbkRlZmF1bHQ6IDB4MDAwMCxcbiAgICBQYXRoRW5kT25Ub3A6IDB4MDAxMCxcbiAgICBQYXRoRW5kT25SaWdodDogMHgwMDIwLFxuICAgIFBhdGhFbmRPbkJvdHRvbTogMHgwMDQwLFxuICAgIFBhdGhFbmRPbkxlZnQ6IDB4MDA4MCxcbiAgICBQYXRoRW5kTWFzazogKDB4MDAxMCB8IDB4MDAyMCB8IDB4MDA0MCB8IDB4MDA4MCksXG4gICAgLy8gKFBhdGhFbmRPblRvcCB8IFBhdGhFbmRPblJpZ2h0IHwgUGF0aEVuZE9uQm90dG9tIHwgUGF0aEVuZE9uTGVmdCksXG5cbiAgICBQYXRoU3RhcnRPbkRlZmF1bHQ6IDB4MDAwMCxcbiAgICBQYXRoU3RhcnRPblRvcDogMHgwMTAwLFxuICAgIFBhdGhTdGFydE9uUmlnaHQ6IDB4MDIwMCxcbiAgICBQYXRoU3RhcnRPbkJvdHRvbTogMHgwNDAwLFxuICAgIFBhdGhTdGFydE9uTGVmdDogMHgwODAwLFxuICAgIFBhdGhTdGFydE1hc2s6ICgweDAxMDAgfCAweDAyMDAgfCAweDA0MDAgfCAweDA4MDApLFxuICAgIC8vIChQYXRoU3RhcnRPblRvcCB8IFBhdGhTdGFydE9uUmlnaHQgfCBQYXRoU3RhcnRPbkJvdHRvbSB8IFBhdGhTdGFydE9uTGVmdCksXG5cbiAgICBQYXRoSGlnaExpZ2h0ZWQ6IDB4MDAwMixcdFx0Ly8gYXR0cmlidXRlcyxcbiAgICBQYXRoRml4ZWQ6IDB4MDAwMSxcbiAgICBQYXRoRGVmYXVsdDogMHgwMDAwLFxuXG4gICAgUGF0aFN0YXRlQ29ubmVjdGVkOiAweDAwMDEsXHRcdC8vIHN0YXRlcyxcbiAgICBQYXRoU3RhdGVEZWZhdWx0OiAweDAwMDAsXG5cbiAgICAvLyBQb3J0IENvbm5lY3Rpb24gVmFyaWFibGVzXG4gICAgUG9ydEVuZE9uVG9wOiAweDAwMDEsXG4gICAgUG9ydEVuZE9uUmlnaHQ6IDB4MDAwMixcbiAgICBQb3J0RW5kT25Cb3R0b206IDB4MDAwNCxcbiAgICBQb3J0RW5kT25MZWZ0OiAweDAwMDgsXG4gICAgUG9ydEVuZE9uQWxsOiAweDAwMEYsXG5cbiAgICBQb3J0U3RhcnRPblRvcDogMHgwMDEwLFxuICAgIFBvcnRTdGFydE9uUmlnaHQ6IDB4MDAyMCxcbiAgICBQb3J0U3RhcnRPbkJvdHRvbTogMHgwMDQwLFxuICAgIFBvcnRTdGFydE9uTGVmdDogMHgwMDgwLFxuICAgIFBvcnRTdGFydE9uQWxsOiAweDAwRjAsXG5cbiAgICBQb3J0Q29ubmVjdE9uQWxsOiAweDAwRkYsXG4gICAgUG9ydENvbm5lY3RUb0NlbnRlcjogMHgwMTAwLFxuXG4gICAgUG9ydFN0YXJ0RW5kSG9yaXpvbnRhbDogMHgwMEFBLFxuICAgIFBvcnRTdGFydEVuZFZlcnRpY2FsOiAweDAwNTUsXG5cbiAgICBQb3J0RGVmYXVsdDogMHgwMEZGLFxuXG4gICAgLy8gUm91dGluZ0RpcmVjdGlvbiB2YXJzIFxuICAgIERpck5vbmU6IC0xLFxuICAgIERpclRvcDogMCxcbiAgICBEaXJSaWdodDogMSxcbiAgICBEaXJCb3R0b206IDIsXG4gICAgRGlyTGVmdDogMyxcbiAgICBEaXJTa2V3OiA0LFxuXG4gICAgLy9QYXRoIEN1c3RvbSBEYXRhXG4gICAgU2ltcGxlRWRnZURpc3BsYWNlbWVudDogJ0VkZ2VEaXNwbGFjZW1lbnQnLFxuICAgIEN1c3RvbVBvaW50Q3VzdG9taXphdGlvbjogJ1BvaW50Q3VzdG9taXphdGlvbidcbiAgICAvL0NPTk5FQ1RJT05DVVNUT01JWkFUSU9OREFUQVZFUlNJT04gOiBudWxsXG59O1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50Jyk7XG5cbnZhciBBdXRvUm91dGVyRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvKlxuICAgICBJbiB0aGlzIHNlY3Rpb24gZXZlcnkgY29tbWVudCByZWZlciB0byB0aGUgaG9yaXpvbnRhbCBjYXNlLCB0aGF0IGlzLCBlYWNoXHRlZGdlIGlzXG4gICAgIGhvcml6b250YWwuXG4gICAgICovXG5cbiAgICAvKlxuICAgICAqIFRPRE8gVXBkYXRlIHRoaXMgY29tbWVudFxuICAgICAqXG4gICAgIEV2ZXJ5IENBdXRvUm91dGVyRWRnZSBiZWxvbmdzIHRvIGFuIGVkZ2Ugb2YgYSBDQXV0b1JvdXRlclBhdGgsIENBdXRvUm91dGVyQm94IG9yIENBdXRvUm91dGVyUG9ydC4gVGhpcyBlZGdlIGlzXG4gICAgIFJlcHJlc2VudGVkIGJ5IGEgQ0F1dG9Sb3V0ZXJQb2ludCB3aXRoIGl0cyBuZXh0IHBvaW50LiBUaGUgdmFyaWFibGUgJ3BvaW50JyB3aWxsIHJlZmVyXG4gICAgIHRvIHRoaXMgQ0F1dG9Sb3V0ZXJQb2ludC5cblxuICAgICBUaGUgY29vcmRpbmF0ZXMgb2YgYW4gZWRnZSBhcmUgJ3gxJywgJ3gyJyBhbmQgJ3knIHdoZXJlIHgxL3gyIGlzIHRoZSB4LWNvb3JkaW5hdGVcbiAgICAgb2YgdGhlIGxlZnQvcmlnaHQgcG9pbnQsIGFuZCB5IGlzIHRoZSBjb21tb24geS1jb29yZGluYXRlIG9mIHRoZSBwb2ludHMuXG5cbiAgICAgVGhlIGVkZ2VzIGFyZSBvcmRlcmVkIGFjY29yZGluZyB0byB0aGVpciB5LWNvb3JkaW5hdGVzLiBUaGUgZmlyc3QgZWRnZSBoYXNcbiAgICAgdGhlIGxlYXN0IHktY29vcmRpbmF0ZSAodG9wbW9zdCksIGFuZCBpdHMgcG9pbnRlciBpcyBpbiAnb3JkZXJGaXJzdCcuXG4gICAgIFdlIHVzZSB0aGUgJ29yZGVyJyBwcmVmaXggaW4gdGhlIHZhcmlhYmxlIG5hbWVzIHRvIHJlZmVyIHRvIHRoaXMgb3JkZXIuXG5cbiAgICAgV2Ugd2lsbCB3YWxrIGZyb20gdG9wIHRvIGJvdHRvbSAoZnJvbSB0aGUgJ29yZGVyRmlyc3QnIGFsb25nIHRoZSAndGhpcy5vcmRlck5leHQnKS5cbiAgICAgV2Uga2VlcCB0cmFjayBhICdzZWN0aW9uJyBvZiBzb21lIGVkZ2VzLiBJZiB3ZSBoYXZlIGFuIGluZmluaXRlIGhvcml6b250YWwgbGluZSxcbiAgICAgdGhlbiB0aGUgc2VjdGlvbiBjb25zaXN0cyBvZiB0aG9zZSBlZGdlcyB0aGF0IGFyZSBhYm92ZSB0aGUgbGluZSBhbmQgbm90IGJsb2NrZWRcbiAgICAgYnkgYW5vdGhlciBlZGdlIHdoaWNoIGlzIGNsb3NlciB0byB0aGUgbGluZS4gRWFjaCBlZGdlIGluIHRoZSBzZWN0aW9uIGhhc1xuICAgICBhIHZpZXdhYmxlIHBvcnRpb24gZnJvbSB0aGUgbGluZSAodGhlIG5vdCBibG9ja2VkIHBvcnRpb24pLiBUaGUgY29vcmRpbmF0ZXNcbiAgICAgb2YgdGhpcyBwb3J0aW9uIGFyZSAndGhpcy5zZWN0aW9uWDEnIGFuZCAndGhpcy5zZWN0aW9uWDInLiBXZSBoYXZlIGFuIG9yZGVyIG9mIHRoZSBlZGdlc1xuICAgICBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgc2VjdGlvbi4gVGhlICdzZWN0aW9uX2ZpcnN0JyByZWZlcnMgdG8gdGhlIGxlZnRtb3N0XG4gICAgIGVkZ2UgaW4gdGhlIHNlY3Rpb24sIHdoaWxlIHRoZSAndGhpcy5zZWN0aW9uTmV4dCcgdG8gdGhlIG5leHQgZnJvbSBsZWZ0IHRvIHJpZ2h0LlxuXG4gICAgIFdlIHNheSB0aGF0IHRoZSBDQXV0b1JvdXRlckVkZ2UgRTEgJ3ByZWNlZGUnIHRoZSBDQXV0b1JvdXRlckVkZ2UgRTIgaWYgdGhlcmUgaXMgbm8gb3RoZXIgQ0F1dG9Sb3V0ZXJFZGdlIHdoaWNoXG4gICAgIHRvdGFsbHlcdGJsb2NrcyBTMSBmcm9tIFMyLiBTbyBhIHNlY3Rpb24gY29uc2lzdHMgb2YgdGhlIHByZWNlZGluZyBlZGdlcyBvZiBhblxuICAgICBpbmZpbml0ZSBlZGdlLiBXZSBzYXkgdGhhdCBFMSBpcyAnYWRqYWNlbnQnIHRvIEUyLCBpZiBFMSBpcyB0aGUgbmVhcmVzdCBlZGdlXG4gICAgIHRvIEUyIHdoaWNoIHByZWNlZGUgaXQuIENsZWFybHksIGV2ZXJ5IGVkZ2UgaGFzIGF0IG1vc3Qgb25lIGFkamFjZW50IHByZWNlZGVuY2UuXG5cbiAgICAgVGhlIGVkZ2VzIG9mIGFueSBDQXV0b1JvdXRlckJveCBvciBDQXV0b1JvdXRlclBvcnQgYXJlIGZpeGVkLiBXZSB3aWxsIGNvbnRpbnVhbGx5IGZpeCB0aGUgZWRnZXNcbiAgICAgb2YgdGhlIENBdXRvUm91dGVyUGF0aHMuIEJ1dCBmaXJzdCB3ZSBuZWVkIHNvbWUgZGVmaW5pdGlvbi5cblxuICAgICBXZSBjYWxsIGEgc2V0IG9mIGVkZ2VzIGFzIGEgJ2Jsb2NrJyBpZiB0aGUgdG9wbW9zdCAoZmlyc3QpIGFuZCBib3R0b21tb3N0IChsYXN0KVxuICAgICBlZGdlcyBvZiBpdCBhcmUgZml4ZWQgd2hpbGUgdGhlIGVkZ2VzIGJldHdlZW4gdGhlbSBhcmUgbm90LiBGdXJ0aGVybW9yZSwgZXZlcnlcbiAgICAgZWRnZSBpcyBhZGphY2VudCB0b1x0dGhlIG5leHQgb25lIGluIHRoZSBvcmRlci4gRXZlcnkgZWRnZSBpbiB0aGUgYmxvY2sgaGFzIGFuXG4gICAgICdpbmRleCcuIFRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgb25lICh0b3Btb3N0KSBpcyAwLCBvZiB0aGUgc2Vjb25kIGlzIDEsIGFuZCBzbyBvbi5cbiAgICAgV2UgY2FsbCB0aGUgaW5kZXggb2YgdGhlIGxhc3QgZWRnZSAoIyBvZiBlZGdlcyAtIDEpIGFzIHRoZSBpbmRleCBvZiB0aGUgZW50aXJlIGJveC5cbiAgICAgVGhlICdkZXB0aCcgb2YgYSBibG9jayBpcyB0aGUgZGlmZmVyZW5jZSBvZiB0aGUgeS1jb29yZGluYXRlcyBvZiB0aGUgZmlyc3QgYW5kIGxhc3RcbiAgICAgZWRnZXMgb2YgaXQuIFRoZSAnZ29hbCBnYXAnIG9mIHRoZSBibG9jayBpcyB0aGUgcXVvdGllbnQgb2YgdGhlIGRlcHRoIGFuZCBpbmRleFxuICAgICBvZiB0aGUgYmxvY2suIElmIHRoZSBkaWZmZXJlbmNlIG9mIHRoZSB5LWNvb3JkaW5hdGVzIG9mIHRoZSBhZGphY2VudCBlZGdlcyBpblxuICAgICB0aGUgYmxvY2sgYXJlIGFsbCBlcXVhbCB0byB0aGUgZ29hbCBnYXAsIHRoZW4gd2Ugc2F5IHRoYXQgdGhlIGJsb2NrIGlzIGV2ZW5seVxuICAgICBkaXN0cmlidXRlZC5cblxuICAgICBTbyB3ZSBzZWFyY2ggdGhlIGJsb2NrIHdoaWNoIGhhcyBtaW5pbWFsIGdvYWwgZ2FwLiBUaGVuIGlmIGl0IGlzIG5vdCBldmVubHlcbiAgICAgZGlzdHJpYnV0ZWQsIHRoZW4gd2Ugc2hpZnQgdGhlIG5vdCBmaXhlZCBlZGdlcyB0byB0aGUgZGVzaXJlZCBwb3NpdGlvbi4gSXQgaXNcbiAgICAgbm90IGhhcmQgdG8gc2VlXHR0aGF0IGlmIHRoZSBibG9jayBoYXMgbWluaW1hbCBnb2FsIGdhcCAoYW1vbmcgdGhlIGFsbFxuICAgICBwb3NzaWJpbGl0aWVzIG9mIGJsb2NrcyksIHRoZW4gaW4gdGhpcyB3YXkgd2UgZG8gbm90IG1vdmUgYW55IGVkZ2VzIGludG8gYm94ZXMuXG4gICAgIEZpbmFsbHksIHdlIHNldCB0aGUgKGlubmVyKSBlZGdlcyBvZiB0aGUgYmxvY2sgdG8gYmUgZml4ZWQgKGV4Y2VwdCB0aGUgdG9wbW9zdCBhbmRcbiAgICAgYm90dG9tbW9zdCBlZGdlcywgc2luY2UgdGhleSBhcmUgYWxyZWFkeSBmaXhlZCkuIEFuZCB3ZSBhZ2FpbiBiZWdpbiB0aGUgc2VhcmNoLlxuICAgICBJZiBldmVyeSBlZGdlIGlzIGZpeGVkLCB0aGVuIHdlIGhhdmUgZmluaXNoZWQuIFRoaXMgaXMgdGhlIGJhc2ljIGlkZWEuIFdlIHdpbGxcbiAgICAgcmVmaW5lIHRoaXMgYWxnb3JpdGhtLlxuXG4gICAgIFRoZSB2YXJpYWJsZXMgcmVsYXRlZCB0byB0aGUgYmxvY2tzIGFyZSBwcmVmaXhlZCBieSAnYmxvY2snLiBOb3RlIHRoYXQgdGhlXG4gICAgIHZhcmlhYmxlcyBvZiBhbiBlZGdlIGFyZSByZWZlciB0byB0aGF0IGJsb2NrIGluIHdoaWNoIHRoaXMgZWRnZSBpcyBpbm5lciEgVGhlXG4gICAgICdibG9ja19vbGRnYXAnIGlzIHRoZSBnb2FsIGdhcCBvZiB0aGUgYmxvY2sgd2hlbiBpdCB3YXMgbGFzdCBldmVubHkgZGlzdHJpYnV0ZWQuXG5cbiAgICAgVGhlIHZhcmlhYmxlcyAnY2Fuc3RhcnQnIGFuZCAnY2FuZW5kJyBtZWFucyB0aGF0IHRoaXMgZWdkZSBjYW4gc3RhcnQgYW5kL29yIGVuZFxuICAgICBhIGJsb2NrLiBUaGUgdG9wIGVkZ2Ugb2YgYSBib3ggb25seSBjYW5lbmQsIHdoaWxlIGEgZml4ZWQgZWRnZSBvZiBhIHBhdGggY2FuIGJvdGhcbiAgICAgc3RhcnQgYW5kIGVuZCBvZiBhIGJsb2NrLlxuXG4gICAgICovXG5cbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9pbnRQcmV2ID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9pbnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9pbnROZXh0ID0gbnVsbDtcblxuICAgIHRoaXMucG9zaXRpb25ZID0gMDtcbiAgICB0aGlzLnBvc2l0aW9uWDEgPSAwO1xuICAgIHRoaXMucG9zaXRpb25YMiA9IDA7XG4gICAgdGhpcy5icmFja2V0Q2xvc2luZyA9IGZhbHNlO1xuICAgIHRoaXMuYnJhY2tldE9wZW5pbmcgPSBmYWxzZTtcblxuICAgIHRoaXMub3JkZXJQcmV2ID0gbnVsbDtcbiAgICB0aGlzLm9yZGVyTmV4dCA9IG51bGw7XG5cbiAgICB0aGlzLnNlY3Rpb25YMSA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uWDIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbk5leHQgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbkRvd24gPSBudWxsO1xuXG4gICAgdGhpcy5lZGdlRml4ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVkZ2VDdXN0b21GaXhlZCA9IGZhbHNlO1xuICAgIHRoaXMuZWRnZUNhblBhc3NlZCA9IGZhbHNlO1xuICAgIHRoaXMuZWRnZURpcmVjdGlvbiA9IG51bGw7XG5cbiAgICB0aGlzLmJsb2NrUHJldiA9IG51bGw7XG4gICAgdGhpcy5ibG9ja05leHQgPSBudWxsO1xuICAgIHRoaXMuYmxvY2tUcmFjZSA9IG51bGw7XG5cbiAgICB0aGlzLmNsb3Nlc3RQcmV2ID0gbnVsbDtcbiAgICB0aGlzLmNsb3Nlc3ROZXh0ID0gbnVsbDtcblxufTtcblxuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuYXNzaWduID0gZnVuY3Rpb24gKG90aGVyRWRnZSkge1xuXG4gICAgaWYgKG90aGVyRWRnZSAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLm93bmVyID0gb3RoZXJFZGdlLm93bmVyO1xuICAgICAgICB0aGlzLnNldFN0YXJ0UG9pbnQob3RoZXJFZGdlLnN0YXJ0cG9pbnQsIGZhbHNlKTtcblxuICAgICAgICAvL09ubHkgY2FsY3VsYXRlRGlyZWN0aW9uIGlmIHRoaXMuZW5kcG9pbnQgaXMgbm90IG51bGxcbiAgICAgICAgdGhpcy5zZXRFbmRQb2ludChvdGhlckVkZ2UuZW5kcG9pbnQsIG90aGVyRWRnZS5lbmRwb2ludCAhPT0gbnVsbCk7XG5cbiAgICAgICAgdGhpcy5zdGFydHBvaW50UHJldiA9IG90aGVyRWRnZS5zdGFydHBvaW50UHJldjtcbiAgICAgICAgdGhpcy5lbmRwb2ludE5leHQgPSBvdGhlckVkZ2UuZW5kcG9pbnROZXh0O1xuXG4gICAgICAgIHRoaXMucG9zaXRpb25ZID0gb3RoZXJFZGdlLnBvc2l0aW9uWTtcbiAgICAgICAgdGhpcy5wb3NpdGlvblgxID0gb3RoZXJFZGdlLnBvc2l0aW9uWDE7XG4gICAgICAgIHRoaXMucG9zaXRpb25YMiA9IG90aGVyRWRnZS5wb3NpdGlvblgyO1xuICAgICAgICB0aGlzLmJyYWNrZXRDbG9zaW5nID0gb3RoZXJFZGdlLmJyYWNrZXRDbG9zaW5nO1xuICAgICAgICB0aGlzLmJyYWNrZXRPcGVuaW5nID0gb3RoZXJFZGdlLmJyYWNrZXRPcGVuaW5nO1xuXG4gICAgICAgIHRoaXMub3JkZXJOZXh0ID0gb3RoZXJFZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgdGhpcy5vcmRlclByZXYgPSBvdGhlckVkZ2Uub3JkZXJQcmV2O1xuXG4gICAgICAgIHRoaXMuc2VjdGlvblgxID0gb3RoZXJFZGdlLnNlY3Rpb25YMTtcbiAgICAgICAgdGhpcy5zZWN0aW9uWDIgPSBvdGhlckVkZ2Uuc2VjdGlvblgyO1xuICAgICAgICB0aGlzLnNldFNlY3Rpb25OZXh0KG90aGVyRWRnZS5nZXRTZWN0aW9uTmV4dCh0cnVlKSk7XG4gICAgICAgIHRoaXMuc2V0U2VjdGlvbkRvd24ob3RoZXJFZGdlLmdldFNlY3Rpb25Eb3duKHRydWUpKTtcblxuICAgICAgICB0aGlzLmVkZ2VGaXhlZCA9IG90aGVyRWRnZS5lZGdlRml4ZWQ7XG4gICAgICAgIHRoaXMuZWRnZUN1c3RvbUZpeGVkID0gb3RoZXJFZGdlLmVkZ2VDdXN0b21GaXhlZDtcbiAgICAgICAgdGhpcy5zZXRFZGdlQ2FucGFzc2VkKG90aGVyRWRnZS5nZXRFZGdlQ2FucGFzc2VkKCkpO1xuICAgICAgICB0aGlzLnNldERpcmVjdGlvbihvdGhlckVkZ2UuZ2V0RGlyZWN0aW9uKCkpO1xuXG4gICAgICAgIHRoaXMuc2V0QmxvY2tQcmV2KG90aGVyRWRnZS5nZXRCbG9ja1ByZXYoKSk7XG4gICAgICAgIHRoaXMuc2V0QmxvY2tOZXh0KG90aGVyRWRnZS5nZXRCbG9ja05leHQoKSk7XG4gICAgICAgIHRoaXMuc2V0QmxvY2tUcmFjZShvdGhlckVkZ2UuZ2V0QmxvY2tUcmFjZSgpKTtcblxuICAgICAgICB0aGlzLnNldENsb3Nlc3RQcmV2KG90aGVyRWRnZS5nZXRDbG9zZXN0UHJldigpKTtcbiAgICAgICAgdGhpcy5zZXRDbG9zZXN0TmV4dChvdGhlckVkZ2UuZ2V0Q2xvc2VzdE5leHQoKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKG90aGVyRWRnZSkge1xuICAgIHJldHVybiB0aGlzID09PSBvdGhlckVkZ2U7IC8vIFRoaXMgY2hlY2tzIGlmIHRoZXkgcmVmZXJlbmNlIHRoZSBzYW1lIG9iamVjdFxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFN0YXJ0UG9pbnRQcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnRQcmV2ICE9PSBudWxsID8gdGhpcy5zdGFydHBvaW50UHJldiB8fCB0aGlzLnN0YXJ0cG9pbnRQcmV2IDogbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gIXRoaXMuc3RhcnRwb2ludFByZXY7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U3RhcnRQb2ludCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvaW50ICE9PSBudWxsID9cbiAgICAgICAgKHRoaXMuc3RhcnRwb2ludCBpbnN0YW5jZW9mIEFycmF5ID8gbmV3IEFyUG9pbnQodGhpcy5zdGFydHBvaW50KSA6IG5ldyBBclBvaW50KHRoaXMuc3RhcnRwb2ludCkpIDpcbiAgICAgICAgQ09OU1RBTlRTLkVNUFRZX1BPSU5UOyAgLy8gcmV0dXJuaW5nIGNvcHkgb2YgdGhpcy5zdGFydHBvaW50XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNTYW1lU3RhcnRQb2ludCA9IGZ1bmN0aW9uIChwb2ludCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnQgPT09IHBvaW50O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzU3RhcnRQb2ludE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludCA9PT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvaW50LCBiKSB7XG4gICAgdGhpcy5zdGFydHBvaW50ID0gcG9pbnQ7XG5cbiAgICBpZiAoYiAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZURpcmVjdGlvbigpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydFBvaW50WCA9IGZ1bmN0aW9uIChfeCkge1xuICAgIHRoaXMuc3RhcnRwb2ludC54ID0gX3g7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U3RhcnRQb2ludFkgPSBmdW5jdGlvbiAoX3kpIHtcbiAgICB0aGlzLnN0YXJ0cG9pbnQueSA9IF95O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEVuZFBvaW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVuZHBvaW50ICE9PSBudWxsID9cbiAgICAgICAgKHRoaXMuZW5kcG9pbnQgaW5zdGFuY2VvZiBBcnJheSA/XG4gICAgICAgICAgICBuZXcgQXJQb2ludCh0aGlzLmVuZHBvaW50KSA6XG4gICAgICAgICAgICBuZXcgQXJQb2ludCh0aGlzLmVuZHBvaW50KSkgOlxuICAgICAgICBDT05TVEFOVFMuRU1QVFlfUE9JTlQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNFbmRQb2ludE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5kcG9pbnQgPT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RW5kUG9pbnQgPSBmdW5jdGlvbiAocG9pbnQsIGIpIHtcbiAgICB0aGlzLmVuZHBvaW50ID0gcG9pbnQ7XG5cbiAgICBpZiAoYiAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZURpcmVjdGlvbigpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydEFuZEVuZFBvaW50ID0gZnVuY3Rpb24gKHN0YXJ0UG9pbnQsIGVuZFBvaW50KSB7XG4gICAgdGhpcy5zZXRTdGFydFBvaW50KHN0YXJ0UG9pbnQsIGZhbHNlKTsgLy93YWl0IHVudGlsIHNldHRpbmcgdGhlIHRoaXMuZW5kcG9pbnQgdG8gcmVjYWxjdWxhdGVEaXJlY3Rpb25cbiAgICB0aGlzLnNldEVuZFBvaW50KGVuZFBvaW50KTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFbmRQb2ludFggPSBmdW5jdGlvbiAoX3gpIHtcbiAgICB0aGlzLmVuZHBvaW50LnggPSBfeDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFbmRQb2ludFkgPSBmdW5jdGlvbiAoX3kpIHtcbiAgICB0aGlzLmVuZHBvaW50LnkgPSBfeTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc0VuZFBvaW50TmV4dE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICF0aGlzLmVuZHBvaW50TmV4dDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uTmV4dCA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25OZXh0ICE9PSB1bmRlZmluZWQgPyB0aGlzLnNlY3Rpb25OZXh0WzBdIDogbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uTmV4dFB0ciA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuc2VjdGlvbk5leHQgfHwgIXRoaXMuc2VjdGlvbk5leHRbMF0pIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uTmV4dCA9IFtuZXcgQXV0b1JvdXRlckVkZ2UoKV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25OZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFNlY3Rpb25OZXh0ID0gZnVuY3Rpb24gKG5leHRTZWN0aW9uKSB7XG4gICAgbmV4dFNlY3Rpb24gPSBuZXh0U2VjdGlvbiBpbnN0YW5jZW9mIEFycmF5ID8gbmV4dFNlY3Rpb25bMF0gOiBuZXh0U2VjdGlvbjtcbiAgICBpZiAodGhpcy5zZWN0aW9uTmV4dCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbk5leHRbMF0gPSBuZXh0U2VjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlY3Rpb25OZXh0ID0gW25leHRTZWN0aW9uXTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U2VjdGlvbkRvd24gPSBmdW5jdGlvbiAoKSB7IC8vUmV0dXJucyBwb2ludGVyIC0gaWYgbm90IG51bGxcblxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25Eb3duICE9PSB1bmRlZmluZWQgPyB0aGlzLnNlY3Rpb25Eb3duWzBdIDogbnVsbDtcblxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25Eb3duUHRyID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5zZWN0aW9uRG93biB8fCAhdGhpcy5zZWN0aW9uRG93blswXSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25Eb3duID0gW25ldyBBdXRvUm91dGVyRWRnZSgpXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbkRvd247XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U2VjdGlvbkRvd24gPSBmdW5jdGlvbiAoZG93blNlY3Rpb24pIHtcbiAgICBkb3duU2VjdGlvbiA9IGRvd25TZWN0aW9uIGluc3RhbmNlb2YgQXJyYXkgPyBkb3duU2VjdGlvblswXSA6IGRvd25TZWN0aW9uO1xuICAgIGlmICh0aGlzLnNlY3Rpb25Eb3duIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uRG93blswXSA9IGRvd25TZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbkRvd24gPSBbZG93blNlY3Rpb25dO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRFZGdlQ2FucGFzc2VkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVkZ2VDYW5QYXNzZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RWRnZUNhbnBhc3NlZCA9IGZ1bmN0aW9uIChlY3ApIHtcbiAgICB0aGlzLmVkZ2VDYW5QYXNzZWQgPSBlY3A7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0RGlyZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVkZ2VEaXJlY3Rpb247XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RGlyZWN0aW9uID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRoaXMuZWRnZURpcmVjdGlvbiA9IGRpcjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5yZWNhbGN1bGF0ZURpcmVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zdGFydHBvaW50ICE9PSBudWxsICYmIHRoaXMuZW5kcG9pbnQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2UucmVjYWxjdWxhdGVEaXJlY3Rpb246IHRoaXMuc3RhcnRwb2ludCAhPT0gbnVsbCAmJiB0aGlzLmVuZHBvaW50ICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICB0aGlzLmVkZ2VEaXJlY3Rpb24gPSBVdGlscy5nZXREaXIodGhpcy5lbmRwb2ludC5taW51cyh0aGlzLnN0YXJ0cG9pbnQpKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRCbG9ja1ByZXYgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxvY2tQcmV2O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEJsb2NrUHJldiA9IGZ1bmN0aW9uIChwcmV2QmxvY2spIHtcbiAgICB0aGlzLmJsb2NrUHJldiA9IHByZXZCbG9jaztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRCbG9ja05leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxvY2tOZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEJsb2NrTmV4dCA9IGZ1bmN0aW9uIChuZXh0QmxvY2spIHtcbiAgICB0aGlzLmJsb2NrTmV4dCA9IG5leHRCbG9jaztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRCbG9ja1RyYWNlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmJsb2NrVHJhY2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0QmxvY2tUcmFjZSA9IGZ1bmN0aW9uICh0cmFjZUJsb2NrKSB7XG4gICAgdGhpcy5ibG9ja1RyYWNlID0gdHJhY2VCbG9jaztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRDbG9zZXN0UHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9zZXN0UHJldjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRDbG9zZXN0UHJldiA9IGZ1bmN0aW9uIChjcCkge1xuICAgIHRoaXMuY2xvc2VzdFByZXYgPSBjcDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRDbG9zZXN0TmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9zZXN0TmV4dDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRDbG9zZXN0TmV4dCA9IGZ1bmN0aW9uIChjcCkge1xuICAgIHRoaXMuY2xvc2VzdE5leHQgPSBjcDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckVkZ2U7XG4iLCIvKmdsb2JhbHMgZGVmaW5lLCBXZWJHTUVHbG9iYWwqL1xuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksXG4gICAgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEF1dG9Sb3V0ZXJQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBhdGgnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0JyksXG4gICAgQXV0b1JvdXRlckJveCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Cb3gnKSxcbiAgICBBdXRvUm91dGVyRWRnZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5FZGdlJyk7XG5cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUF1dG9Sb3V0ZXJFZGdlTGlzdFxuXG52YXIgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuRWRnZUxpc3QnKTtcbnZhciBBdXRvUm91dGVyRWRnZUxpc3QgPSBmdW5jdGlvbiAoYikge1xuICAgIHRoaXMub3duZXIgPSBudWxsO1xuXG4gICAgLy8tLUVkZ2VzXG4gICAgdGhpcy5pc2hvcml6b250YWwgPSBiO1xuXG4gICAgLy8tLU9yZGVyXG4gICAgdGhpcy5vcmRlckZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLm9yZGVyTGFzdCA9IG51bGw7XG5cbiAgICAvLy0tU2VjdGlvblxuICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IFtdOyAvLyBUaGlzIGlzIGFuIGFycmF5IHRvIGVtdWxhdGUgdGhlIHBvaW50ZXIgdG8gYSBwb2ludGVyIGZ1bmN0aW9uYWxpdHkgaW4gQ1BQLiBcbiAgICAvLyBUaGF0IGlzLCB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkKlxuXG4gICAgdGhpcy5faW5pdE9yZGVyKCk7XG4gICAgdGhpcy5faW5pdFNlY3Rpb24oKTtcbn07XG5cbi8vIFB1YmxpYyBGdW5jdGlvbnNcbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuY29udGFpbnMgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICAgIHZhciBjdXJyZW50RWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQ7XG5cbiAgICB3aGlsZSAoY3VycmVudEVkZ2UpIHtcbiAgICAgICAgc3RhcnRwb2ludCA9IGN1cnJlbnRFZGdlLnN0YXJ0cG9pbnQ7XG4gICAgICAgIGVuZHBvaW50ID0gY3VycmVudEVkZ2UuZW5kcG9pbnQ7XG4gICAgICAgIGlmIChzdGFydC5lcXVhbHMoc3RhcnRwb2ludCkgJiYgZW5kLmVxdWFscyhlbmRwb2ludCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGN1cnJlbnRFZGdlID0gY3VycmVudEVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNoZWNrT3JkZXIoKTtcbiAgICB0aGlzLmNoZWNrU2VjdGlvbigpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRQYXRoRWRnZXMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLm93bmVyLFxuICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogcGF0aC5vd25lciA9PT0gb3duZXIgRkFJTEVEIScpO1xuXG4gICAgdmFyIGlzUGF0aEF1dG9Sb3V0ZWQgPSBwYXRoLmlzQXV0b1JvdXRlZCgpLFxuICAgICAgICBoYXNDdXN0b21FZGdlID0gZmFsc2UsXG4gICAgICAgIGN1c3RvbWl6ZWRJbmRleGVzID0ge30sXG4gICAgICAgIGluZGV4ZXMgPSBbXSxcbiAgICAgICAgc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGRpcixcbiAgICAgICAgZWRnZSxcbiAgICAgICAgaTtcblxuICAgIGlmIChpc1BhdGhBdXRvUm91dGVkKSB7XG4gICAgICAgIGkgPSAtMTtcbiAgICAgICAgd2hpbGUgKCsraSA8IGluZGV4ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBoYXNDdXN0b21FZGdlID0gdHJ1ZTtcbiAgICAgICAgICAgIGN1c3RvbWl6ZWRJbmRleGVzW2luZGV4ZXNbaV1dID0gMDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhc0N1c3RvbUVkZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpLFxuICAgICAgICBwdHJzT2JqZWN0ID0gcG9pbnRMaXN0LmdldFRhaWxFZGdlUHRycygpLFxuICAgICAgICBpbmRJdHIsXG4gICAgICAgIGN1cnJFZGdlSW5kZXggPSBwb2ludExpc3QubGVuZ3RoIC0gMixcbiAgICAgICAgZ29vZEFuZ2xlLFxuICAgICAgICBwb3MgPSBwdHJzT2JqZWN0LnBvcyxcbiAgICAgICAgc2tpcEVkZ2UsXG4gICAgICAgIGlzTW92ZWFibGUsXG4gICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkLFxuICAgICAgICBzdGFydFBvcnQsXG4gICAgICAgIGVuZFBvcnQsXG4gICAgICAgIGlzU3RhcnRQb3J0Q29ubmVjdFRvQ2VudGVyLFxuICAgICAgICBpc0VuZFBvcnRDb25uZWN0VG9DZW50ZXIsXG4gICAgICAgIGlzUGF0aEZpeGVkO1xuXG4gICAgc3RhcnRwb2ludCA9IHB0cnNPYmplY3Quc3RhcnQ7XG4gICAgZW5kcG9pbnQgPSBwdHJzT2JqZWN0LmVuZDtcblxuICAgIHdoaWxlIChwb2ludExpc3QubGVuZ3RoICYmIHBvcyA+PSAwKSB7XG5cbiAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICBza2lwRWRnZSA9IGRpciA9PT0gQ09OU1RBTlRTLkRpck5vbmUgPyB0cnVlIDogZmFsc2U7XG4gICAgICAgIGlzTW92ZWFibGUgPSBwYXRoLmlzTW92ZWFibGUoKTtcblxuICAgICAgICBpZiAoIWlzTW92ZWFibGUgJiYgZGlyICE9PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICAgICAgZ29vZEFuZ2xlID0gVXRpbHMuaXNSaWdodEFuZ2xlKGRpcik7XG4gICAgICAgICAgICBhc3NlcnQoZ29vZEFuZ2xlLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpZiAoIWdvb2RBbmdsZSkge1xuICAgICAgICAgICAgICAgIHNraXBFZGdlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFza2lwRWRnZSAmJlxuICAgICAgICAgICAgKFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpICYmIFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCkpIHtcbiAgICAgICAgICAgIGVkZ2UgPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTtcbiAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBwYXRoO1xuXG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHBvaW50TGlzdC5nZXRQb2ludEJlZm9yZUVkZ2UocG9zKTtcbiAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gcG9pbnRMaXN0LmdldFBvaW50QWZ0ZXJFZGdlKHBvcyk7XG5cbiAgICAgICAgICAgIGlmIChoYXNDdXN0b21FZGdlKSB7XG4gICAgICAgICAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoaXNQYXRoQXV0b1JvdXRlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbmRJdHIgPSBjdXN0b21pemVkSW5kZXhlcy5pbmRleE9mKGN1cnJFZGdlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBpc0VkZ2VDdXN0b21GaXhlZCA9IChpbmRJdHIgIT09IGN1c3RvbWl6ZWRJbmRleGVzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlZGdlLmVkZ2VDdXN0b21GaXhlZCA9IGlzRWRnZUN1c3RvbUZpeGVkO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgZWRnZS5lZGdlQ3VzdG9tRml4ZWQgPSBkaXIgPT09IENPTlNUQU5UUy5EaXJTa2V3O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzdGFydFBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpO1xuXG4gICAgICAgICAgICBhc3NlcnQoc3RhcnRQb3J0ICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBzdGFydFBvcnQgIT09IG51bGwgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpc1N0YXJ0UG9ydENvbm5lY3RUb0NlbnRlciA9IHN0YXJ0UG9ydC5pc0Nvbm5lY3RUb0NlbnRlcigpO1xuICAgICAgICAgICAgZW5kUG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpO1xuXG4gICAgICAgICAgICBhc3NlcnQoZW5kUG9ydCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogZW5kUG9ydCAhPT0gbnVsbCBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlzRW5kUG9ydENvbm5lY3RUb0NlbnRlciA9IGVuZFBvcnQuaXNDb25uZWN0VG9DZW50ZXIoKTtcbiAgICAgICAgICAgIGlzUGF0aEZpeGVkID0gcGF0aC5pc0ZpeGVkKCkgfHwgIXBhdGguaXNBdXRvUm91dGVkKCk7XG5cbiAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gZWRnZS5lZGdlQ3VzdG9tRml4ZWQgfHwgaXNQYXRoRml4ZWQgfHxcbiAgICAgICAgICAgIChlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgJiYgaXNTdGFydFBvcnRDb25uZWN0VG9DZW50ZXIpIHx8XG4gICAgICAgICAgICAoZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSAmJiBpc0VuZFBvcnRDb25uZWN0VG9DZW50ZXIpO1xuXG4gICAgICAgICAgICBpZiAoZGlyICE9PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkQihlZGdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWRnZS5wb3NpdGlvblkgPSAwO1xuICAgICAgICAgICAgICAgIGVkZ2UuYnJhY2tldE9wZW5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBlZGdlLmJyYWNrZXRDbG9zaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdHJzT2JqZWN0ID0gcG9pbnRMaXN0LmdldFByZXZFZGdlUHRycyhwb3MpO1xuICAgICAgICBwb3MgPSBwdHJzT2JqZWN0LnBvcztcbiAgICAgICAgc3RhcnRwb2ludCA9IHB0cnNPYmplY3Quc3RhcnQ7XG4gICAgICAgIGVuZHBvaW50ID0gcHRyc09iamVjdC5lbmQ7XG4gICAgICAgIGN1cnJFZGdlSW5kZXgtLTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYWRkUG9ydEVkZ2VzID0gZnVuY3Rpb24gKHBvcnQpIHtcbiAgICB2YXIgc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIHNlbGZQb2ludHMsXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2LFxuICAgICAgICBlbmRwb2ludE5leHQsXG4gICAgICAgIGRpcixcbiAgICAgICAgaSxcbiAgICAgICAgY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsO1xuXG4gICAgYXNzZXJ0KHBvcnQub3duZXIub3duZXIgPT09IHRoaXMub3duZXIsXG4gICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBwb3J0Lm93bmVyID09PSAob3duZXIpIEZBSUxFRCEnKTtcblxuICAgIGlmIChwb3J0LmlzQ29ubmVjdFRvQ2VudGVyKCkgfHwgcG9ydC5vd25lci5pc0F0b21pYygpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmUG9pbnRzID0gcG9ydC5zZWxmUG9pbnRzO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2ID0gc2VsZlBvaW50c1soaSArIDMpICUgNF07XG4gICAgICAgIHN0YXJ0cG9pbnQgPSBzZWxmUG9pbnRzW2ldO1xuICAgICAgICBlbmRwb2ludCA9IHNlbGZQb2ludHNbKGkgKyAxKSAlIDRdO1xuICAgICAgICBlbmRwb2ludE5leHQgPSBzZWxmUG9pbnRzWyhpICsgMikgJSA0XTtcbiAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICBjYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWwgPSBwb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCh0aGlzLmlzaG9yaXpvbnRhbCk7XG4gICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSA9PT0gdGhpcy5pc2hvcml6b250YWwgJiYgY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsKSB7XG4gICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG5cbiAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBwb3J0O1xuICAgICAgICAgICAgZWRnZS5zZXRTdGFydEFuZEVuZFBvaW50KHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBzdGFydHBvaW50UHJldjtcbiAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gZW5kcG9pbnROZXh0O1xuXG4gICAgICAgICAgICBlZGdlLmVkZ2VGaXhlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRCKGVkZ2UpO1xuXG4gICAgICAgICAgICBpZiAoZWRnZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgIGVkZ2UuYWRkVG9Qb3NpdGlvbigwLjk5OSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRFZGdlcyA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgdmFyIHNlbGZQb2ludHMsXG4gICAgICAgIHN0YXJ0cG9pbnQsXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2LFxuICAgICAgICBlbmRwb2ludE5leHQsXG4gICAgICAgIGVuZHBvaW50LFxuICAgICAgICBlZGdlLFxuICAgICAgICBkaXIsXG4gICAgICAgIGk7XG5cbiAgICBpZiAocGF0aCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gpIHtcbiAgICAgICAgdmFyIGJveCA9IHBhdGg7XG5cbiAgICAgICAgYXNzZXJ0KGJveC5vd25lciA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBib3gub3duZXIgPT09IChvd25lcikgRkFJTEVEIScpO1xuXG5cbiAgICAgICAgc2VsZlBvaW50cyA9IGJveC5zZWxmUG9pbnRzO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgIHN0YXJ0cG9pbnRQcmV2ID0gc2VsZlBvaW50c1soaSArIDMpICUgNF07XG4gICAgICAgICAgICBzdGFydHBvaW50ID0gc2VsZlBvaW50c1tpXTtcbiAgICAgICAgICAgIGVuZHBvaW50ID0gc2VsZlBvaW50c1soaSArIDEpICUgNF07XG4gICAgICAgICAgICBlbmRwb2ludE5leHQgPSBzZWxmUG9pbnRzWyhpICsgMikgJSA0XTtcbiAgICAgICAgICAgIGRpciA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSk7XG5cbiAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGVkZ2UgPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTtcblxuICAgICAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBib3g7XG4gICAgICAgICAgICAgICAgZWRnZS5zZXRTdGFydEFuZEVuZFBvaW50KHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICAgICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gc3RhcnRwb2ludFByZXY7XG4gICAgICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBlbmRwb2ludE5leHQ7XG5cbiAgICAgICAgICAgICAgICBlZGdlLmVkZ2VGaXhlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRZKGVkZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZEIoZWRnZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZWRnZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgICAgICBlZGdlLmFkZFRvUG9zaXRpb24oMC45OTkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoKSB7ICAvLyBwYXRoIGlzIGFuIEFSR3JhcGhcbiAgICAgICAgdmFyIGdyYXBoID0gcGF0aDtcbiAgICAgICAgYXNzZXJ0KGdyYXBoID09PSB0aGlzLm93bmVyLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IGdyYXBoID09PSB0aGlzLm93bmVyIEZBSUxFRCEnKTtcblxuICAgICAgICBzZWxmUG9pbnRzID0gZ3JhcGguc2VsZlBvaW50cztcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cbiAgICAgICAgICAgIHN0YXJ0cG9pbnRQcmV2ID0gc2VsZlBvaW50c1soaSArIDMpICUgNF07XG4gICAgICAgICAgICBzdGFydHBvaW50ID0gc2VsZlBvaW50c1tpXTtcbiAgICAgICAgICAgIGVuZHBvaW50ID0gc2VsZlBvaW50c1soaSArIDEpICUgNF07XG4gICAgICAgICAgICBlbmRwb2ludE5leHQgPSBzZWxmUG9pbnRzWyhpICsgMikgJSA0XTtcbiAgICAgICAgICAgIGRpciA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSk7XG5cbiAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIGVkZ2UgPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTtcblxuICAgICAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBncmFwaDtcbiAgICAgICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBzdGFydHBvaW50UHJldjtcbiAgICAgICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IGVuZHBvaW50TmV4dDtcblxuICAgICAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZGVsZXRlRWRnZXMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIG5leHQ7XG5cbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoZWRnZS5vd25lciA9PT0gb2JqZWN0KSB7XG4gICAgICAgICAgICBuZXh0ID0gZWRnZS5vcmRlck5leHQ7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZShlZGdlKTtcbiAgICAgICAgICAgIGVkZ2UgPSBuZXh0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB9XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmRlbGV0ZUFsbEVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlICh0aGlzLm9yZGVyRmlyc3QpIHtcbiAgICAgICAgdGhpcy5yZW1vdmUodGhpcy5vcmRlckZpcnN0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2UgPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG5cbiAgICAgICAgaWYgKGVkZ2UuaXNTYW1lU3RhcnRQb2ludChzdGFydHBvaW50KSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LmdldEVkZ2U6IGVkZ2UgIT09IG51bGwgRkFJTEVEIScpO1xuICAgIHJldHVybiBlZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5nZXRFZGdlQnlQb2ludGVyID0gZnVuY3Rpb24gKHN0YXJ0cG9pbnQpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoZWRnZS5pc1NhbWVTdGFydFBvaW50KHN0YXJ0cG9pbnQpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuZ2V0RWRnZUJ5UG9pbnRlcjogZWRnZSAhPT0gbnVsbCBGQUlMRUQhJyk7XG4gICAgcmV0dXJuIGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLnNldEVkZ2VCeVBvaW50ZXIgPSBmdW5jdGlvbiAocEVkZ2UsIG5ld0VkZ2UpIHtcbiAgICBhc3NlcnQobmV3RWRnZSBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJFZGdlLFxuICAgICAgICAnQVJFZGdlTGlzdC5zZXRFZGdlQnlQb2ludGVyOiBuZXdFZGdlIGluc3RhbmNlb2YgQXV0b1JvdXRlckVkZ2UgRkFJTEVEIScpO1xuICAgIHZhciBlZGdlID0gdGhpcy5zZWN0aW9uRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKHBFZGdlID09PSBlZGdlKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGVkZ2UgPSBlZGdlLmdldFNlY3Rpb25Eb3duKCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNldEVkZ2VCeVBvaW50ZXI6IGVkZ2UgIT09IG51bGwgRkFJTEVEIScpO1xuICAgIGVkZ2UgPSBuZXdFZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5nZXRFZGdlQXQgPSBmdW5jdGlvbiAocG9pbnQsIG5lYXJuZXNzKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UpIHtcblxuICAgICAgICBpZiAoVXRpbHMuaXNQb2ludE5lYXJMaW5lKHBvaW50LCBlZGdlLnN0YXJ0cG9pbnQsIGVkZ2UuZW5kcG9pbnQsIG5lYXJuZXNzKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVkZ2U7XG4gICAgICAgIH1cblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmR1bXBFZGdlcyA9IGZ1bmN0aW9uIChtc2csIGxvZ2dlcikge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBsb2cgPSBsb2dnZXIgfHwgX2xvZ2dlci5kZWJ1ZyxcbiAgICAgICAgdG90YWwgPSAxO1xuXG4gICAgbG9nKG1zZyk7XG5cbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICBsb2coJ1xcdCcgKyBlZGdlLnN0YXJ0cG9pbnQueCArICcsICcgKyBlZGdlLnN0YXJ0cG9pbnQueSArICdcXHRcXHQnICsgZWRnZS5lbmRwb2ludC54ICsgJywgJyArXG4gICAgICAgIGVkZ2UuZW5kcG9pbnQueSArICdcXHRcXHRcXHQoJyArIChlZGdlLmVkZ2VGaXhlZCA/ICdGSVhFRCcgOiAnTU9WRUFCTEUnICkgKyAnKVxcdFxcdCcgK1xuICAgICAgICAoZWRnZS5icmFja2V0Q2xvc2luZyA/ICdCcmFja2V0IENsb3NpbmcnIDogKGVkZ2UuYnJhY2tldE9wZW5pbmcgPyAnQnJhY2tldCBPcGVuaW5nJyA6ICcnKSkpO1xuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgdG90YWwrKztcbiAgICB9XG5cbiAgICBsb2coJ1RvdGFsIEVkZ2VzOiAnICsgdG90YWwpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5nZXRFZGdlQ291bnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIHRvdGFsID0gMTtcbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgICAgIHRvdGFsKys7XG4gICAgfVxuICAgIHJldHVybiB0b3RhbDtcbn07XG5cbi8vLS1Qcml2YXRlIEZ1bmN0aW9uc1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25HZXRSZWFsWSA9IGZ1bmN0aW9uIChlZGdlLCB5KSB7XG4gICAgaWYgKHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55LFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCEnKTtcbiAgICAgICAgICAgIHJldHVybiBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEIScpO1xuICAgICAgICByZXR1cm4gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgfSBlbHNlIHtcblxuICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxZOiBlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAnICtcbiAgICAgICAgICAgICchZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCEnKTtcblxuICAgICAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55LFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCEnKTtcbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRQb2ludFkoeSk7XG4gICAgICAgICAgICBlZGdlLnNldEVuZFBvaW50WSh5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRYKHkpO1xuICAgICAgICAgICAgZWRnZS5zZXRFbmRQb2ludFgoeSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvblNldFJlYWxZID0gZnVuY3Rpb24gKGVkZ2UsIHkpIHtcbiAgICBpZiAoZWRnZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGVkZ2UgPSBlZGdlWzBdO1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9TZXRSZWFsWTogZWRnZSAhPSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fU2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEJyk7XG4gICAgICAgIGVkZ2Uuc2V0U3RhcnRQb2ludFkoeSk7XG4gICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnRZKHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fU2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG4gICAgICAgIGVkZ2Uuc2V0U3RhcnRQb2ludFgoeSk7XG4gICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnRYKHkpO1xuICAgIH1cbn07XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSBlZGdlIGVuZHBvaW50cyBzbyB4MSA8IHgyXG4gKi9cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uR2V0UmVhbFggPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWDogZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcbiAgICB2YXIgeDEsIHgyO1xuXG4gICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFg6IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGVkZ2Uuc3RhcnRwb2ludC54IDwgZWRnZS5lbmRwb2ludC54KSB7XG5cbiAgICAgICAgICAgIHgxID0gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgICAgICAgICB4MiA9IGVkZ2UuZW5kcG9pbnQueDtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgeDEgPSBlZGdlLmVuZHBvaW50Lng7XG4gICAgICAgICAgICB4MiA9IGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWDogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcbiAgICAgICAgaWYgKGVkZ2Uuc3RhcnRwb2ludC55IDwgZWRnZS5lbmRwb2ludC55KSB7XG5cbiAgICAgICAgICAgIHgxID0gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgICAgICB4MiA9IGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgeDEgPSBlZGdlLmVuZHBvaW50Lnk7XG4gICAgICAgICAgICB4MiA9IGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIFt4MSwgeDJdO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25HZXRSZWFsTyA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxPOiBlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuICAgIHZhciBvMSwgbzI7XG5cbiAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsTzogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQnKTtcbiAgICAgICAgaWYgKGVkZ2Uuc3RhcnRwb2ludC54IDwgZWRnZS5lbmRwb2ludC54KSB7XG5cbiAgICAgICAgICAgIG8xID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueSAtIGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICAgICAgbzIgPSBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpID8gMCA6IGVkZ2UuZW5kcG9pbnROZXh0LnkgLSBlZGdlLmVuZHBvaW50Lnk7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIG8xID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC55IC0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICAgICAgbzIgPSBlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgPyAwIDogZWRnZS5zdGFydHBvaW50UHJldi55IC0gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxPOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCcpO1xuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnkgPCBlZGdlLmVuZHBvaW50LnkpIHtcblxuICAgICAgICAgICAgbzEgPSBlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgPyAwIDogZWRnZS5zdGFydHBvaW50UHJldi54IC0gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgICAgICAgICBvMiA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueCAtIGVkZ2UuZW5kcG9pbnQueDtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgbzEgPSBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpID8gMCA6IGVkZ2UuZW5kcG9pbnROZXh0LnggLSBlZGdlLmVuZHBvaW50Lng7XG4gICAgICAgICAgICBvMiA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnggLSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBbbzEsIG8yXTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uTG9hZFkgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9Mb2FkWTogZWRnZSAhPT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGVkZ2UucG9zaXRpb25ZID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsWShlZGdlKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uTG9hZEIgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9Mb2FkQjogZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGVkZ2UuYnJhY2tldE9wZW5pbmcgPSAhZWRnZS5lZGdlRml4ZWQgJiYgdGhpcy5fYnJhY2tldElzT3BlbmluZyhlZGdlKTtcbiAgICBlZGdlLmJyYWNrZXRDbG9zaW5nID0gIWVkZ2UuZWRnZUZpeGVkICYmIHRoaXMuX2JyYWNrZXRJc0Nsb3NpbmcoZWRnZSk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkFsbFN0b3JlWSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSkge1xuICAgICAgICB0aGlzLl9wb3NpdGlvblNldFJlYWxZKGVkZ2UsIGVkZ2UucG9zaXRpb25ZKTtcbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25BbGxMb2FkWCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgcHRzO1xuICAgIHdoaWxlIChlZGdlKSB7XG4gICAgICAgIHB0cyA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbFgoZWRnZSk7XG4gICAgICAgIGVkZ2UucG9zaXRpb25YMSA9IHB0c1swXTtcbiAgICAgICAgZWRnZS5wb3NpdGlvblgyID0gcHRzWzFdO1xuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9pbml0T3JkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5vcmRlckZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLm9yZGVyTGFzdCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9jaGVja09yZGVyID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgPT09IG51bGwgJiYgdGhpcy5vcmRlckxhc3QgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LmNoZWNrT3JkZXI6IHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCAmJiB0aGlzLm9yZGVyTGFzdCA9PT0gbnVsbCBGQUlMRUQnKTtcbn07XG5cbi8vLS0tT3JkZXJcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5pbnNlcnRCZWZvcmUgPSBmdW5jdGlvbiAoZWRnZSwgYmVmb3JlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgYmVmb3JlICE9PSBudWxsICYmIGVkZ2UgIT09IGJlZm9yZSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiBlZGdlICE9PSBudWxsICYmIGJlZm9yZSAhPT0gbnVsbCAmJiBlZGdlICE9PSBiZWZvcmUgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgZWRnZS5vcmRlclByZXYgPSBiZWZvcmUub3JkZXJQcmV2O1xuICAgIGVkZ2Uub3JkZXJOZXh0ID0gYmVmb3JlO1xuXG4gICAgaWYgKGJlZm9yZS5vcmRlclByZXYpIHtcbiAgICAgICAgYXNzZXJ0KGJlZm9yZS5vcmRlclByZXYub3JkZXJOZXh0ID09PSBiZWZvcmUsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IGJlZm9yZS5vcmRlclByZXYub3JkZXJOZXh0ID09PSBiZWZvcmUgRkFJTEVEXFxuYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgJyArXG4gICAgICAgICAgICAnaXMgJyArIGJlZm9yZS5vcmRlclByZXYub3JkZXJOZXh0ICsgJyBhbmQgYmVmb3JlIGlzICcgKyBiZWZvcmUpO1xuXG4gICAgICAgIGJlZm9yZS5vcmRlclByZXYub3JkZXJOZXh0ID0gZWRnZTtcblxuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ICE9PSBiZWZvcmUsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IHRoaXMub3JkZXJGaXJzdCAhPT0gYmVmb3JlIEZBSUxFRCcpO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCA9PT0gYmVmb3JlLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiB0aGlzLm9yZGVyRmlyc3QgPT09IGJlZm9yZSBGQUlMRUQnKTtcbiAgICAgICAgdGhpcy5vcmRlckZpcnN0ID0gZWRnZTtcbiAgICB9XG5cbiAgICBiZWZvcmUub3JkZXJQcmV2ID0gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0QWZ0ZXIgPSBmdW5jdGlvbiAoZWRnZSwgYWZ0ZXIpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBhZnRlciAhPT0gbnVsbCAmJiAhZWRnZS5lcXVhbHMoYWZ0ZXIpLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogIGVkZ2UgIT09IG51bGwgJiYgYWZ0ZXIgIT09IG51bGwgJiYgIWVkZ2UuZXF1YWxzKGFmdGVyKSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCBGQUlMRUQgJyk7XG5cbiAgICBlZGdlLm9yZGVyTmV4dCA9IGFmdGVyLm9yZGVyTmV4dDtcbiAgICBlZGdlLm9yZGVyUHJldiA9IGFmdGVyO1xuXG4gICAgaWYgKGFmdGVyLm9yZGVyTmV4dCkge1xuICAgICAgICBhc3NlcnQoYWZ0ZXIub3JkZXJOZXh0Lm9yZGVyUHJldi5lcXVhbHMoYWZ0ZXIpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6ICBhZnRlci5vcmRlck5leHQub3JkZXJQcmV2LmVxdWFscyhhZnRlcikgRkFJTEVEJyk7XG4gICAgICAgIGFmdGVyLm9yZGVyTmV4dC5vcmRlclByZXYgPSBlZGdlO1xuXG4gICAgICAgIGFzc2VydCghdGhpcy5vcmRlckxhc3QuZXF1YWxzKGFmdGVyKSwgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6ICFvcmRlckxhc3QuZXF1YWxzKGFmdGVyKSBGQUlMRUQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckxhc3QuZXF1YWxzKGFmdGVyKSwgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6IHRoaXMub3JkZXJMYXN0LmVxdWFscyhhZnRlcikgRkFJTEVEJyk7XG4gICAgICAgIHRoaXMub3JkZXJMYXN0ID0gZWRnZTtcbiAgICB9XG5cbiAgICBhZnRlci5vcmRlck5leHQgPSBlZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5pbnNlcnRMYXN0ID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgZWRnZS5vcmRlclByZXYgPSB0aGlzLm9yZGVyTGFzdDtcblxuICAgIGlmICh0aGlzLm9yZGVyTGFzdCkge1xuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckxhc3Qub3JkZXJOZXh0ID09PSBudWxsLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogdGhpcy5vcmRlckxhc3Qub3JkZXJOZXh0ID09PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ICE9PSBudWxsLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogdGhpcy5vcmRlckZpcnN0ICE9IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgdGhpcy5vcmRlckxhc3Qub3JkZXJOZXh0ID0gZWRnZTtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgPT09IG51bGwsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiAgdGhpcy5vcmRlckZpcnN0ID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgIHRoaXMub3JkZXJGaXJzdCA9IGVkZ2U7XG4gICAgICAgIHRoaXMub3JkZXJMYXN0ID0gZWRnZTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydDogIGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnQ6IGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIHkgPSBlZGdlLnBvc2l0aW9uWTtcblxuICAgIGFzc2VydChDT05TVEFOVFMuRURfTUlOQ09PUkQgPD0geSAmJiB5IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0OiBDT05TVEFOVFMuRURfTUlOQ09PUkQgPD0geSAmJiB5IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQgKHkgaXMgJyArIHkgKyAnKScpO1xuXG4gICAgdmFyIGluc2VydCA9IHRoaXMub3JkZXJGaXJzdDtcblxuICAgIHdoaWxlIChpbnNlcnQgJiYgaW5zZXJ0LnBvc2l0aW9uWSA8IHkpIHtcbiAgICAgICAgaW5zZXJ0ID0gaW5zZXJ0Lm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBpZiAoaW5zZXJ0KSB7XG4gICAgICAgIHRoaXMuaW5zZXJ0QmVmb3JlKGVkZ2UsIGluc2VydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5pbnNlcnRMYXN0KGVkZ2UpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QucmVtb3ZlOiAgZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLm9yZGVyRmlyc3QgPT09IGVkZ2UpIHtcbiAgICAgICAgdGhpcy5vcmRlckZpcnN0ID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgaWYgKGVkZ2Uub3JkZXJOZXh0KSB7XG4gICAgICAgIGVkZ2Uub3JkZXJOZXh0Lm9yZGVyUHJldiA9IGVkZ2Uub3JkZXJQcmV2O1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9yZGVyTGFzdCA9PT0gZWRnZSkge1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2Uub3JkZXJQcmV2O1xuICAgIH1cblxuICAgIGlmIChlZGdlLm9yZGVyUHJldikge1xuICAgICAgICBlZGdlLm9yZGVyUHJldi5vcmRlck5leHQgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBlZGdlLm9yZGVyTmV4dCA9IG51bGw7XG4gICAgZWRnZS5vcmRlclByZXYgPSBudWxsO1xufTtcblxuLy8tLSBQcml2YXRlXG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzID0gZnVuY3Rpb24gKGVkZ2UsIHkpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCwgJ0FSRWRnZUxpc3Quc2xpZGVCdXROb3RQYXNzRWRnZXM6IGVkZ2UgIT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoQ09OU1RBTlRTLkVEX01JTkNPT1JEIDwgeSAmJiB5IDwgQ09OU1RBTlRTLkVEX01BWENPT1JELFxuICAgICAgICAnQVJFZGdlTGlzdC5zbGlkZUJ1dE5vdFBhc3NFZGdlczogQ09OU1RBTlRTLkVEX01JTkNPT1JEIDwgeSAmJiB5IDwgQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCcpO1xuXG4gICAgdmFyIG9sZHkgPSBlZGdlLnBvc2l0aW9uWTtcbiAgICBhc3NlcnQoQ09OU1RBTlRTLkVEX01JTkNPT1JEIDwgb2xkeSAmJiBvbGR5IDwgQ09OU1RBTlRTLkVEX01BWENPT1JELFxuICAgICAgICAnQVJFZGdlTGlzdC5zbGlkZUJ1dE5vdFBhc3NFZGdlczogQ09OU1RBTlRTLkVEX01JTkNPT1JEIDwgb2xkeSAmJiBvbGR5IDwgQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCcpO1xuXG4gICAgaWYgKG9sZHkgPT09IHkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHgxID0gZWRnZS5wb3NpdGlvblgxLFxuICAgICAgICB4MiA9IGVkZ2UucG9zaXRpb25YMixcbiAgICAgICAgcmV0ID0gbnVsbCxcbiAgICAgICAgaW5zZXJ0ID0gZWRnZTtcblxuICAgIC8vSWYgd2UgYXJlIHRyeWluZyB0byBzbGlkZSBkb3duXG5cbiAgICBpZiAob2xkeSA8IHkpIHtcbiAgICAgICAgd2hpbGUgKGluc2VydC5vcmRlck5leHQpIHtcbiAgICAgICAgICAgIGluc2VydCA9IGluc2VydC5vcmRlck5leHQ7XG5cbiAgICAgICAgICAgIGlmICh5IDwgaW5zZXJ0LnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgIC8vVGhlbiB3ZSB3b24ndCBiZSBzaGlmdGluZyBwYXN0IHRoZSBuZXcgZWRnZSAoaW5zZXJ0KVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0lmIHlvdSBjYW4ndCBwYXNzIHRoZSBlZGdlIChidXQgd2FudCB0bykgYW5kIHRoZSBsaW5lcyB3aWxsIG92ZXJsYXAgeCB2YWx1ZXMuLi5cbiAgICAgICAgICAgIGlmICghaW5zZXJ0LmdldEVkZ2VDYW5wYXNzZWQoKSAmJiBVdGlscy5pbnRlcnNlY3QoeDEsIHgyLCBpbnNlcnQucG9zaXRpb25YMSwgaW5zZXJ0LnBvc2l0aW9uWDIpKSB7XG4gICAgICAgICAgICAgICAgcmV0ID0gaW5zZXJ0O1xuICAgICAgICAgICAgICAgIHkgPSBpbnNlcnQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVkZ2UgIT09IGluc2VydCAmJiBpbnNlcnQub3JkZXJQcmV2ICE9PSBlZGdlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZShlZGdlKTtcbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0QmVmb3JlKGVkZ2UsIGluc2VydCk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSB7IC8vIElmIHdlIGFyZSB0cnlpbmcgdG8gc2xpZGUgdXBcbiAgICAgICAgd2hpbGUgKGluc2VydC5vcmRlclByZXYpIHtcbiAgICAgICAgICAgIGluc2VydCA9IGluc2VydC5vcmRlclByZXY7XG5cbiAgICAgICAgICAgIGlmICh5ID4gaW5zZXJ0LnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0lmIGluc2VydCBjYW5ub3QgYmUgcGFzc2VkIGFuZCBpdCBpcyBpbiB0aGUgd2F5IG9mIHRoZSBlZGdlIChpZiB0aGUgZWRnZSB3ZXJlIHRvIHNsaWRlIHVwKS5cbiAgICAgICAgICAgIGlmICghaW5zZXJ0LmdldEVkZ2VDYW5wYXNzZWQoKSAmJiBVdGlscy5pbnRlcnNlY3QoeDEsIHgyLCBpbnNlcnQucG9zaXRpb25YMSwgaW5zZXJ0LnBvc2l0aW9uWDIpKSB7XG4gICAgICAgICAgICAgICAgcmV0ID0gaW5zZXJ0O1xuICAgICAgICAgICAgICAgIHkgPSBpbnNlcnQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVkZ2UgIT09IGluc2VydCAmJiBpbnNlcnQub3JkZXJOZXh0ICE9PSBlZGdlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZShlZGdlKTsvL1RoaXMgaXMgd2hlcmUgSSBiZWxpZXZlIHRoZSBlcnJvciBjb3VsZCBsaWUhXG4gICAgICAgICAgICB0aGlzLmluc2VydEFmdGVyKGVkZ2UsIGluc2VydCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGVkZ2UucG9zaXRpb25ZID0geTtcblxuICAgIHJldHVybiByZXQ7XG59O1xuXG4vLy0tLS0tLVNlY3Rpb25cblxuLy8gcHJpdmF0ZVxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9pbml0U2VjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlY3Rpb25GaXJzdCA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5jaGVja1NlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCEodGhpcy5zZWN0aW9uQmxvY2tlciA9PT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9PT0gbnVsbCkpIHtcbiAgICAgICAgLy8gVGhpcyB1c2VkIHRvIGJlIGNvbnRhaW5lZCBpbiBhbiBhc3NlcnQuXG4gICAgICAgIC8vIEdlbmVyYWxseSB0aGlzIGZhaWxzIHdoZW4gdGhlIHJvdXRlciBkb2VzIG5vdCBoYXZlIGEgY2xlYW4gZXhpdCB0aGVuIGlzIGFza2VkIHRvIHJlcm91dGUuXG4gICAgICAgIHRoaXMuX2xvZ2dlci53YXJuKCdzZWN0aW9uQmxvY2tlciBhbmQgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgYXJlIG5vdCBudWxsLiAnICtcbiAgICAgICAgJ0Fzc3VtaW5nIGxhc3QgcnVuIGRpZCBub3QgZXhpdCBjbGVhbmx5LiBGaXhpbmcuLi4nKTtcbiAgICAgICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IG51bGw7XG4gICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gbnVsbDtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLnNlY3Rpb25SZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNoZWNrU2VjdGlvbigpO1xuXG4gICAgdGhpcy5zZWN0aW9uRmlyc3QgPSBudWxsO1xufTtcblxuLyoqXG4gKiBJbml0aWFsaXplIHRoZSBzZWN0aW9uIGRhdGEgc3RydWN0dXJlLlxuICpcbiAqIEBwYXJhbSBibG9ja2VyXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NlY3Rpb25CZWdpblNjYW4gPSBmdW5jdGlvbiAoYmxvY2tlcikge1xuICAgIHRoaXMuY2hlY2tTZWN0aW9uKCk7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gYmxvY2tlcjtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgxID0gdGhpcy5zZWN0aW9uQmxvY2tlci5wb3NpdGlvblgxO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgyID0gdGhpcy5zZWN0aW9uQmxvY2tlci5wb3NpdGlvblgyO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZXRTZWN0aW9uTmV4dChudWxsKTtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNldFNlY3Rpb25Eb3duKG51bGwpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbklzSW1tZWRpYXRlID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25CbG9ja2VyICE9PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbklzSW1tZWRpYXRlOiB0aGlzLnNlY3Rpb25CbG9ja2VyICE9IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT0gbnVsbCAnICtcbiAgICAgICAgJyYmICpzZWN0aW9uUHRyMkJsb2NrZWQgIT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBzZWN0aW9uQmxvY2tlZCA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLFxuICAgICAgICBlID0gc2VjdGlvbkJsb2NrZWQuZ2V0U2VjdGlvbkRvd24oKSxcbiAgICAgICAgYTEgPSBzZWN0aW9uQmxvY2tlZC5zZWN0aW9uWDEsXG4gICAgICAgIGEyID0gc2VjdGlvbkJsb2NrZWQuc2VjdGlvblgyLFxuICAgICAgICBwMSA9IHNlY3Rpb25CbG9ja2VkLnBvc2l0aW9uWDEsXG4gICAgICAgIHAyID0gc2VjdGlvbkJsb2NrZWQucG9zaXRpb25YMixcbiAgICAgICAgYjEgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMSxcbiAgICAgICAgYjIgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMjtcblxuICAgIGlmIChlICE9PSBudWxsKSB7XG4gICAgICAgIGUgPSAoZS5zdGFydHBvaW50ID09PSBudWxsIHx8IGUuc2VjdGlvblgxID09PSB1bmRlZmluZWQgPyBudWxsIDogZSk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGIxIDw9IGEyICYmIGExIDw9IGIyLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbklzSW1tZWRpYXRlOiBiMSA8PSBhMiAmJiBhMSA8PSBiMiBGQUlMRUQnKTsgICAgICAgICAgICAgICAgICAgICAvLyBub3QgY2FzZSAxIG9yIDZcblxuICAgIC8vIE5PVEUgV0UgQ0hBTkdFRCBUSEUgQ09ORElUSU9OUyAoQTE8PUIxIEFORCBCMjw9QTIpXG4gICAgLy8gQkVDQVVTRSBIRVJFIFdFIE5FRUQgVEhJUyFcblxuICAgIGlmIChhMSA8PSBiMSkge1xuICAgICAgICB3aGlsZSAoIShlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgJiYgZS5zZWN0aW9uWDIgPCBiMSkge1xuICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChiMiA8PSBhMikge1xuICAgICAgICAgICAgcmV0dXJuIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgfHwgYjIgPCBlLnNlY3Rpb25YMTsgICAgICAgICAgICAgICAvLyBjYXNlIDNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpICYmIGEyID09PSBwMjsgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgMlxuICAgIH1cblxuICAgIGlmIChiMiA8PSBhMikge1xuICAgICAgICByZXR1cm4gYTEgPT09IHAxICYmICgoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpIHx8IGIyIDwgZS5zZWN0aW9uWDEpOyAgICAvLyBjYXNlIDVcbiAgICB9XG5cbiAgICByZXR1cm4gKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSAmJiBhMSA9PT0gcDEgJiYgYTIgPT09IHAyOyAgICAgICAgICAgICAgICAgLy8gY2FzZSA0XG59O1xuXG5cbi8vIFRoZSBmb2xsb3dpbmcgbWV0aG9kcyBhcmUgY29udmVuaWVuY2UgbWV0aG9kcyBmb3IgYWRqdXN0aW5nIHRoZSAnc2VjdGlvbicgXG4vLyBvZiBhbiBlZGdlLlxuLyoqXG4gKiBHZXQgZWl0aGVyIG1pbisxIG9yIGEgdmFsdWUgYmV0d2VlbiBtaW4gYW5kIG1heC4gVGVjaG5pY2FsbHksXG4gKiB3ZSBhcmUgbG9va2luZyBmb3IgW21pbiwgbWF4KS5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWluXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4XG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHJlc3VsdFxuICovXG52YXIgZ2V0TGFyZ2VyRW5kcG9pbnQgPSBmdW5jdGlvbiAobWluLCBtYXgpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIGFzc2VydChtaW4gPCBtYXgpO1xuXG4gICAgcmVzdWx0ID0gTWF0aC5taW4obWluICsgMSwgKG1pbiArIG1heCkgLyAyKTtcbiAgICBpZiAocmVzdWx0ID09PSBtYXgpIHtcbiAgICAgICAgcmVzdWx0ID0gbWluO1xuICAgIH1cbiAgICBhc3NlcnQocmVzdWx0IDwgbWF4KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBHZXQgZWl0aGVyIG1heC0xIG9yIGEgdmFsdWUgYmV0d2VlbiBtaW4gYW5kIG1heC4gVGVjaG5pY2FsbHksXG4gKiB3ZSBhcmUgbG9va2luZyBmb3IgKG1pbiwgbWF4XS5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWluXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4XG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHJlc3VsdFxuICovXG52YXIgZ2V0U21hbGxlckVuZHBvaW50ID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBhc3NlcnQobWluIDwgbWF4KTtcblxuICAgIC8vIElmIG1pbiBpcyBzbyBzbWFsbCB0aGF0IFxuICAgIC8vIFxuICAgIC8vICAgICAgKG1pbittYXgpLzIgPT09IG1pblxuICAgIC8vXG4gICAgLy8gdGhlbiB3ZSB3aWxsIHNpbXBseSB1c2UgbWF4IHZhbHVlIGZvciB0aGUgcmVzdWx0XG4gICAgcmVzdWx0ID0gTWF0aC5tYXgobWF4IC0gMSwgKG1pbiArIG1heCkgLyAyKTtcbiAgICBpZiAocmVzdWx0ID09PSBtaW4pIHtcbiAgICAgICAgcmVzdWx0ID0gbWF4O1xuICAgIH1cblxuICAgIGFzc2VydChyZXN1bHQgPiBtaW4pO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uSGFzQmxvY2tlZEVkZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvbkJsb2NrZXIgIT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBuZXdTZWN0aW9uWDEsXG4gICAgICAgIG5ld1NlY3Rpb25YMixcbiAgICAgICAgZSxcbiAgICAgICAgYmxvY2tlclgxID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDEsXG4gICAgICAgIGJsb2NrZXJYMiA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgyO1xuXG4gICAgYXNzZXJ0KGJsb2NrZXJYMSA8PSBibG9ja2VyWDIsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGJsb2NrZXJYMSA8PSBibG9ja2VyWDIgRkFJTEVEJyk7XG5cbiAgICAvLyBTZXR0aW5nIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkXG4gICAgaWYgKHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID09PSBudWxsKSB7ICAvLyBpbml0aWFsaXplIHNlY3Rpb25QdHIyQmxvY2tlZFxuXG4gICAgICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gdGhpcy5zZWN0aW9uRmlyc3QgPT09IG51bGwgPyBbbmV3IEF1dG9Sb3V0ZXJFZGdlKCldIDogdGhpcy5zZWN0aW9uRmlyc3Q7XG4gICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gdGhpcy5zZWN0aW9uRmlyc3Q7XG4gICAgfSBlbHNlIHsgICAvLyBnZXQgbmV4dCBzZWN0aW9uUHRyMkJsb2NrZWRcbiAgICAgICAgdmFyIGN1cnJlbnRFZGdlID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF07XG5cbiAgICAgICAgYXNzZXJ0KGN1cnJlbnRFZGdlLnN0YXJ0cG9pbnQgIT09IG51bGwsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBjdXJyZW50RWRnZS5zdGFydHBvaW50ID09PSBudWxsJyk7XG5cbiAgICAgICAgdmFyIG8gPSBudWxsO1xuXG4gICAgICAgIGUgPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpWzBdO1xuICAgICAgICBuZXdTZWN0aW9uWDEgPSBjdXJyZW50RWRnZS5zZWN0aW9uWDE7XG4gICAgICAgIG5ld1NlY3Rpb25YMiA9IGN1cnJlbnRFZGdlLnNlY3Rpb25YMjtcblxuICAgICAgICBhc3NlcnQobmV3U2VjdGlvblgxIDw9IG5ld1NlY3Rpb25YMixcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IG5ld1NlY3Rpb25YMSA8PSBuZXdTZWN0aW9uWDIgRkFJTEVEICgnICsgbmV3U2VjdGlvblgxICtcbiAgICAgICAgICAgICcgPD0gJyArIG5ld1NlY3Rpb25YMiArICcpJyArICdcXG5lZGdlIGlzICcpO1xuXG4gICAgICAgIGFzc2VydChibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgyICYmIG5ld1NlY3Rpb25YMSA8PSBibG9ja2VyWDIsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgyICYmICBuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuICAgICAgICAvLyBub3QgY2FzZSAxIG9yIDZcbiAgICAgICAgaWYgKG5ld1NlY3Rpb25YMSA8IGJsb2NrZXJYMSAmJiBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDIpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDNcbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd25QdHIoKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDEgJiYgbmV3U2VjdGlvblgyIDw9IGJsb2NrZXJYMikgeyAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgNFxuXG4gICAgICAgICAgICBpZiAoZSAmJiBlLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB3aGlsZSAoZS5nZXRTZWN0aW9uTmV4dCgpICYmIGUuZ2V0U2VjdGlvbk5leHQoKS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZS5zZXRTZWN0aW9uTmV4dChjdXJyZW50RWRnZS5nZXRTZWN0aW9uTmV4dCgpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSAoY3VycmVudEVkZ2UuZ2V0U2VjdGlvbk5leHQoKSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgxICYmIGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMikgeyAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDVcblxuICAgICAgICAgICAgYXNzZXJ0KG5ld1NlY3Rpb25YMSA8PSBibG9ja2VyWDIsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogbmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcblxuICAgICAgICAgICAgLy8gTW92ZSBuZXdTZWN0aW9uWDEgc3VjaCB0aGF0IGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSA8IG5ld1NlY3Rpb25YMlxuICAgICAgICAgICAgbmV3U2VjdGlvblgxID0gZ2V0TGFyZ2VyRW5kcG9pbnQoYmxvY2tlclgyLCBuZXdTZWN0aW9uWDIpO1xuXG4gICAgICAgICAgICB3aGlsZSAoKGUgJiYgZS5zdGFydHBvaW50ICE9PSBudWxsKSAmJiBlLnNlY3Rpb25YMSA8PSBuZXdTZWN0aW9uWDEpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoZS5zZWN0aW9uWDEgPD0gZS5zZWN0aW9uWDIsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGUuc2VjdGlvblgxIDw9IGUuc2VjdGlvblgyIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG5ld1NlY3Rpb25YMSA8PSBlLnNlY3Rpb25YMikge1xuICAgICAgICAgICAgICAgICAgICBuZXdTZWN0aW9uWDEgPSBnZXRMYXJnZXJFbmRwb2ludChlLnNlY3Rpb25YMiwgbmV3U2VjdGlvblgyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvID0gZTtcbiAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobykge1xuICAgICAgICAgICAgICAgIC8vIEluc2VydCBjdXJyZW50RWRnZSB0byBiZSBzZWN0aW9uTmV4dCBvZiB0aGUgZ2l2ZW4gZWRnZSBpbiB0aGUgbGlzdCBcbiAgICAgICAgICAgICAgICAvLyBvZiBzZWN0aW9uRG93biAoYmFzaWNhbGx5LCBjb2xsYXBzaW5nIGN1cnJlbnRFZGdlIGludG8gdGhlIHNlY3Rpb25Eb3duIFxuICAgICAgICAgICAgICAgIC8vIGxpc3QuIFRoZSB2YWx1ZXMgaW4gdGhlIGxpc3QgZm9sbG93aW5nIGN1cnJlbnRFZGdlIHdpbGwgdGhlbiBiZSBzZXQgdG8gXG4gICAgICAgICAgICAgICAgLy8gYmUgc2VjdGlvbkRvd24gb2YgdGhlIGN1cnJlbnRFZGdlLilcbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKClbMF07XG4gICAgICAgICAgICAgICAgby5zZXRTZWN0aW9uTmV4dChjdXJyZW50RWRnZSk7XG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2V0U2VjdGlvbkRvd24oZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydChibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogYmxvY2tlclgyIDwgbmV3U2VjdGlvblgxIEZBSUxFRCAoJyArXG4gICAgICAgICAgICAgICAgYmxvY2tlclgyICsgJyA8ICcgKyBuZXdTZWN0aW9uWDEgKyAnKSAnICtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDIgKyAnIGlzICcgKyBuZXdTZWN0aW9uWDIgKyAnKScpO1xuICAgICAgICAgICAgLy8gU2hpZnRpbmcgdGhlIGZyb250IG9mIHRoZSBwMmIgc28gaXQgbm8gbG9uZ2VyIG92ZXJsYXBzIHRoaXMuc2VjdGlvbkJsb2NrZXJcblxuICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgxID0gbmV3U2VjdGlvblgxO1xuXG4gICAgICAgICAgICBhc3NlcnQoY3VycmVudEVkZ2Uuc2VjdGlvblgxIDwgY3VycmVudEVkZ2Uuc2VjdGlvblgyLFxuICAgICAgICAgICAgICAgICdjdXJyZW50RWRnZS5zZWN0aW9uWDEgPCBjdXJyZW50RWRnZS5zZWN0aW9uWDIgKCcgK1xuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMSArICcgPCAnICsgY3VycmVudEVkZ2Uuc2VjdGlvblgyICsgJyknKTtcbiAgICAgICAgfSBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAyXG4gICAgICAgICAgICBhc3NlcnQobmV3U2VjdGlvblgxIDwgYmxvY2tlclgxICYmIGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDIgJiYgbmV3U2VjdGlvblgyIDw9IGJsb2NrZXJYMixcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiAgbmV3U2VjdGlvblgxIDwgYmxvY2tlclgxICYmIGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDIgJiYgJyArXG4gICAgICAgICAgICAgICAgJ25ld1NlY3Rpb25YMiA8PSBibG9ja2VyWDIgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd25QdHIoKTtcblxuICAgICAgICAgICAgd2hpbGUgKGUgJiYgZS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbyA9IGU7XG4gICAgICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcblxuICAgICAgICAgICAgICAgIGlmIChvLnNlY3Rpb25YMiArIDEgPCBibG9ja2VyWDEgJiYgKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsIHx8XG4gICAgICAgICAgICAgICAgICAgIG8uc2VjdGlvblgyICsgMSA8IGUuc2VjdGlvblgxKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gby5nZXRTZWN0aW9uTmV4dFB0cigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQobyAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogbyAhPSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIG8uc2V0U2VjdGlvbk5leHQoY3VycmVudEVkZ2UuZ2V0U2VjdGlvbk5leHQoKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbGFyZ2VyID0gYmxvY2tlclgxO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnNlY3Rpb25YMSA8IGJsb2NrZXJYMSkge1xuICAgICAgICAgICAgICAgICAgICBsYXJnZXIgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDE7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgyID0gZ2V0U21hbGxlckVuZHBvaW50KG5ld1NlY3Rpb25YMSwgbGFyZ2VyKTtcblxuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNldFNlY3Rpb25OZXh0KHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpOyAvL1RoaXMgc2VlbXMgb2RkXG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBudWxsO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiA9IGdldFNtYWxsZXJFbmRwb2ludChuZXdTZWN0aW9uWDEsIGJsb2NrZXJYMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydChjdXJyZW50RWRnZS5zZWN0aW9uWDEgPCBjdXJyZW50RWRnZS5zZWN0aW9uWDIsXG4gICAgICAgICAgICAgICAgJ0V4cGVjdGVkIHNlY3Rpb25YMSA8IHNlY3Rpb25YMiBidXQgJyArIGN1cnJlbnRFZGdlLnNlY3Rpb25YMSArXG4gICAgICAgICAgICAgICAgJyBpcyBub3QgPCAnICsgY3VycmVudEVkZ2Uuc2VjdGlvblgyKTtcblxuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uTmV4dFB0cigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPSBudWxsIEZBSUxFRCcpO1xuICAgIHdoaWxlICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSAhPT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgIG5ld1NlY3Rpb25YMSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnNlY3Rpb25YMTtcbiAgICAgICAgbmV3U2VjdGlvblgyID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgyO1xuXG4gICAgICAgIGlmIChuZXdTZWN0aW9uWDIgPCBibG9ja2VyWDEpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAxXG4gICAgICAgICAgICAvL0lmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIGlzIGNvbXBsZXRlbHkgdG8gdGhlIGxlZnQgKG9yIGFib3ZlKSB0aGlzLnNlY3Rpb25CbG9ja2VyXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLmdldFNlY3Rpb25OZXh0UHRyKCk7XG5cbiAgICAgICAgICAgIGFzc2VydCh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gZWxzZSBpZiAoYmxvY2tlclgyIDwgbmV3U2VjdGlvblgxKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgNlxuICAgICAgICAgICAgLy9JZiB0aGlzLnNlY3Rpb25CbG9ja2VyIGlzIGNvbXBsZXRlbHkgdG8gdGhlIHJpZ2h0IChvciBiZWxvdykgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1NlY3Rpb25YMSA8IGJsb2NrZXJYMSAmJiBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDIpIHsgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDNcbiAgICAgICAgICAgIC8vSWYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgc3RhcnRzIGJlZm9yZSBhbmQgZW5kcyBhZnRlciB0aGlzLnNlY3Rpb25CbG9ja2VyXG4gICAgICAgICAgICB2YXIgeCA9IGJsb2NrZXJYMTtcbiAgICAgICAgICAgIGUgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5nZXRTZWN0aW9uRG93bigpO1xuXG4gICAgICAgICAgICBmb3IgKDsgOykge1xuXG4gICAgICAgICAgICAgICAgaWYgKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsIHx8IHggPCBlLnNlY3Rpb25YMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHggPD0gZS5zZWN0aW9uWDIpIHtcbiAgICAgICAgICAgICAgICAgICAgeCA9IGUuc2VjdGlvblgyICsgMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrZXJYMiA8IHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5nZXRTZWN0aW9uRG93blB0cigpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhpcyBsZWF2ZXMgdGhlIHJlZ3VsYXIgcGFydGlhbCBvdmVybGFwIHBvc3NpYmlsaXR5LlxuICAgICAgICAvLyBUaGV5IGFsc28gaW5jbHVkZSB0aGlzLnNlY3Rpb25CbG9ja2VyIHN0YXJ0aW5nIGJlZm9yZSBhbmQgZW5kaW5nIGFmdGVyIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkLlxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25OZXh0KCkgPT09IG51bGwgJiZcbiAgICAgICAgKHRoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbkRvd24oKSA9PT0gbnVsbCB8fFxuICAgICAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25Eb3duKCkuc3RhcnRwb2ludCA9PT0gbnVsbCksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbk5leHQoKSA9PT0gbnVsbCAmJicgK1xuICAgICAgICAndGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uRG93bigpID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZXRTZWN0aW9uTmV4dCh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSk7XG5cbiAgICAvLyBTZXQgYW55dGhpbmcgcG9pbnRpbmcgdG8gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgdG8gcG9pbnQgdG8gdGhpcy5zZWN0aW9uQmxvY2tlciAoZWcsIHNlY3Rpb25Eb3duKVxuICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gdGhpcy5zZWN0aW9uQmxvY2tlcjtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gbnVsbDtcblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NlY3Rpb25HZXRCbG9ja2VkRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2VjdGlvbkdldEJsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25CbG9ja2VyICE9PSBudWxsICYmICcgK1xuICAgICAgICAndGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF07XG59O1xuXG4vLy0tLS1CcmFja2V0XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2JyYWNrZXRJc0Nsb3NpbmcgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLCAnQVJFZGdlTGlzdC5fYnJhY2tldElzQ2xvc2luZzogZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9icmFja2V0SXNDbG9zaW5nOiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydCA9IGVkZ2Uuc3RhcnRwb2ludCxcbiAgICAgICAgZW5kID0gZWRnZS5lbmRwb2ludDtcblxuICAgIGlmIChlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgfHwgZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaXNob3Jpem9udGFsID9cbiAgICAgICAgKGVkZ2Uuc3RhcnRwb2ludFByZXYueSA8IHN0YXJ0LnkgJiYgZWRnZS5lbmRwb2ludE5leHQueSA8IGVuZC55ICkgOlxuICAgICAgICAoZWRnZS5zdGFydHBvaW50UHJldi54IDwgc3RhcnQueCAmJiBlZGdlLmVuZHBvaW50TmV4dC54IDwgZW5kLnggKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2JyYWNrZXRJc09wZW5pbmcgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLCAnQVJFZGdlTGlzdC5fYnJhY2tldElzT3BlbmluZzogZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9icmFja2V0SXNPcGVuaW5nOiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydCA9IGVkZ2Uuc3RhcnRwb2ludCB8fCBlZGdlLnN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZCA9IGVkZ2UuZW5kcG9pbnQgfHwgZWRnZS5lbmRwb2ludCxcbiAgICAgICAgcHJldixcbiAgICAgICAgbmV4dDtcblxuICAgIGlmIChlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgfHwgZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbmV4dCA9IGVkZ2UuZW5kcG9pbnROZXh0IHx8IGVkZ2UuZW5kcG9pbnROZXh0O1xuICAgIHByZXYgPSBlZGdlLnN0YXJ0cG9pbnRQcmV2IHx8IGVkZ2Uuc3RhcnRwb2ludFByZXY7XG5cbiAgICByZXR1cm4gdGhpcy5pc2hvcml6b250YWwgP1xuICAgICAgICAocHJldi55ID4gc3RhcnQueSAmJiBuZXh0LnkgPiBlbmQueSApIDpcbiAgICAgICAgKHByZXYueCA+IHN0YXJ0LnggJiYgbmV4dC54ID4gZW5kLnggKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2JyYWNrZXRTaG91bGRCZVN3aXRjaGVkID0gZnVuY3Rpb24gKGVkZ2UsIG5leHQpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBuZXh0ICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQ6IGVkZ2UgIT09IG51bGwgJiYgbmV4dCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBleCA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbFgoZWRnZSksXG4gICAgICAgIGV4MSA9IGV4WzBdLFxuICAgICAgICBleDIgPSBleFsxXSxcbiAgICAgICAgZW8gPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxPKGVkZ2UpLFxuICAgICAgICBlbzEgPSBlb1swXSxcbiAgICAgICAgZW8yID0gZW9bMV0sXG4gICAgICAgIG54ID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsWChuZXh0KSxcbiAgICAgICAgbngxID0gbnhbMF0sXG4gICAgICAgIG54MiA9IG54WzFdLFxuICAgICAgICBubyA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbE8obmV4dCksXG4gICAgICAgIG5vMSA9IG5vWzBdLFxuICAgICAgICBubzIgPSBub1sxXTtcblxuICAgIHZhciBjMSwgYzI7XG5cbiAgICBpZiAoKG54MSA8IGV4MSAmJiBleDEgPCBueDIgJiYgZW8xID4gMCApIHx8IChleDEgPCBueDEgJiYgbngxIDwgZXgyICYmIG5vMSA8IDApKSB7XG4gICAgICAgIGMxID0gKzE7XG4gICAgfSBlbHNlIGlmIChleDEgPT09IG54MSAmJiBlbzEgPT09IDAgJiYgbm8xID09PSAwKSB7XG4gICAgICAgIGMxID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjMSA9IC05O1xuICAgIH1cblxuICAgIGlmICgobngxIDwgZXgyICYmIGV4MiA8IG54MiAmJiBlbzIgPiAwICkgfHwgKGV4MSA8IG54MiAmJiBueDIgPCBleDIgJiYgbm8yIDwgMCkpIHtcbiAgICAgICAgYzIgPSArMTtcbiAgICB9IGVsc2UgaWYgKGV4MiA9PT0gbngyICYmIGVvMiA9PT0gMCAmJiBubzIgPT09IDApIHtcbiAgICAgICAgYzIgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGMyID0gLTk7XG4gICAgfVxuXG4gICAgcmV0dXJuIChjMSArIGMyKSA+IDA7XG59O1xuXG4vLy0tLUJsb2NrXG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2Jsb2NrR2V0RiA9IGZ1bmN0aW9uIChkLCBiLCBzKSB7XG4gICAgdmFyIGYgPSBkIC8gKGIgKyBzKSwgLy9mIGlzIHRoZSB0b3RhbCBkaXN0YW5jZSBiZXR3ZWVuIGVkZ2VzIGRpdmlkZWQgYnkgdGhlIHRvdGFsIG51bWJlciBvZiBlZGdlc1xuICAgICAgICBTID0gQ09OU1RBTlRTLkVETFNfUywgLy9UaGlzIGlzICdTTUFMTEdBUCdcbiAgICAgICAgUiA9IENPTlNUQU5UUy5FRExTX1IsLy9UaGlzIGlzICdTTUFMTEdBUCArIDEnXG4gICAgICAgIEQgPSBDT05TVEFOVFMuRURMU19EOyAvL1RoaXMgaXMgdGhlIHRvdGFsIGRpc3RhbmNlIG9mIHRoZSBncmFwaFxuXG4gICAgLy9JZiBmIGlzIGdyZWF0ZXIgdGhhbiB0aGUgU01BTExHQVAsIHRoZW4gbWFrZSBzb21lIGNoZWNrcy9lZGl0c1xuICAgIGlmIChiID09PSAwICYmIFIgPD0gZikge1xuICAgICAgICAvLyBJZiBldmVyeSBjb21wYXJpc29uIHJlc3VsdGVkIGluIGFuIG92ZXJsYXAgQU5EIFNNQUxMR0FQICsgMSBpcyBsZXNzIHRoYW5cbiAgICAgICAgLy8gdGhlIGRpc3RhbmNlIGJldHdlZW4gZWFjaCBlZGdlIChpbiB0aGUgZ2l2ZW4gcmFuZ2UpLlxuICAgICAgICBmICs9IChEIC0gUik7XG4gICAgfSBlbHNlIGlmIChTIDwgZiAmJiBzID4gMCkge1xuICAgICAgICBmID0gKChEIC0gUykgKiBkIC0gUyAqIChEIC0gUikgKiBzKSAvICgoRCAtIFMpICogYiArIChSIC0gUykgKiBzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2Jsb2NrR2V0RyA9IGZ1bmN0aW9uIChkLCBiLCBzKSB7XG4gICAgdmFyIGcgPSBkIC8gKGIgKyBzKSxcbiAgICAgICAgUyA9IENPTlNUQU5UUy5FRExTX1MsXG4gICAgICAgIFIgPSBDT05TVEFOVFMuRURMU19SLFxuICAgICAgICBEID0gQ09OU1RBTlRTLkVETFNfRDtcblxuICAgIGlmIChTIDwgZyAmJiBiID4gMCkge1xuICAgICAgICBnID0gKChSIC0gUykgKiBkICsgUyAqIChEIC0gUikgKiBiKSAvICgoRCAtIFMpICogYiArIChSIC0gUykgKiBzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2Jsb2NrUHVzaEJhY2t3YXJkID0gZnVuY3Rpb24gKGJsb2NrZWQsIGJsb2NrZXIpIHtcbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZTtcblxuICAgIGFzc2VydChibG9ja2VkICE9PSBudWxsICYmIGJsb2NrZXIgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLnBvc2l0aW9uWSA8PSBibG9ja2VyLnBvc2l0aW9uWSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBibG9ja2VkLnBvc2l0aW9uWSA8PSBibG9ja2VyLnBvc2l0aW9uWSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5nZXRCbG9ja1ByZXYoKSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBibG9ja2VkLmdldEJsb2NrUHJldigpICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIGYgPSAwLFxuICAgICAgICBnID0gMCxcbiAgICAgICAgZWRnZSA9IGJsb2NrZWQsXG4gICAgICAgIHRyYWNlID0gYmxvY2tlcixcbiAgICAgICAgZCA9IHRyYWNlLnBvc2l0aW9uWSAtIGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgYXNzZXJ0KGQgPj0gMCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBkID49IDAgRkFJTEVEJyk7XG5cbiAgICB2YXIgcyA9IChlZGdlLmJyYWNrZXRPcGVuaW5nIHx8IHRyYWNlLmJyYWNrZXRDbG9zaW5nKSxcbiAgICAgICAgYiA9IDEgLSBzLFxuICAgICAgICBkMjtcblxuICAgIGZvciAoOyA7KSB7XG4gICAgICAgIGVkZ2Uuc2V0QmxvY2tUcmFjZSh0cmFjZSk7XG4gICAgICAgIHRyYWNlID0gZWRnZTtcbiAgICAgICAgZWRnZSA9IGVkZ2UuZ2V0QmxvY2tQcmV2KCk7XG5cbiAgICAgICAgaWYgKGVkZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZDIgPSB0cmFjZS5wb3NpdGlvblkgLSBlZGdlLnBvc2l0aW9uWTtcbiAgICAgICAgYXNzZXJ0KGQyID49IDAsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6ICBkMiA+PSAwIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChlZGdlLmJyYWNrZXRPcGVuaW5nIHx8IHRyYWNlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGcpIHtcbiAgICAgICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgIGlmIChkMiA8PSBmKSB7XG4gICAgICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGQgKz0gZDI7XG4gICAgfVxuXG4gICAgaWYgKGIgKyBzID4gMSkge1xuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3NlcnQoVXRpbHMuZmxvYXRFcXVhbHMoZCwgZiAqIGIgKyBnICogcyksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGZsb2F0RXF1YWxzKGQsIGYqYiArIGcqcykgRkFJTEVEJyk7XG5cbiAgICAgICAgZWRnZSA9IHRyYWNlO1xuICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBlZGdlICE9PSBibG9ja2VkLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBlZGdlICE9PSBudWxsICYmIGVkZ2UgIT09IGJsb2NrZWQgRkFJTEVEJyk7XG5cbiAgICAgICAgdmFyIHkgPSBlZGdlLnBvc2l0aW9uWTtcblxuICAgICAgICBkbyB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBlZGdlLmdldEJsb2NrVHJhY2UoKSAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIHRyYWNlID0gZWRnZS5nZXRCbG9ja1RyYWNlKCk7XG5cbiAgICAgICAgICAgIHkgKz0gKGVkZ2UuYnJhY2tldE9wZW5pbmcgfHwgdHJhY2UuYnJhY2tldENsb3NpbmcpID8gZyA6IGY7XG4gICAgICAgICAgICB5ID0gVXRpbHMucm91bmRUcnVuYyh5LCAxMCk7ICAvLyBGaXggYW55IGZsb2F0aW5nIHBvaW50IGVycm9yc1xuXG4gICAgICAgICAgICBpZiAoeSArIDAuMDAxIDwgdHJhY2UucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyh0cmFjZSwgeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhY2Uuc2V0QmxvY2tQcmV2KG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWRnZSA9IHRyYWNlO1xuICAgICAgICB9IHdoaWxlIChlZGdlICE9PSBibG9ja2VkKTtcblxuICAgICAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgICAgICAvL3kgKz0gKGVkZ2UuYnJhY2tldE9wZW5pbmcgfHwgYmxvY2tlci5icmFja2V0Q2xvc2luZykgPyBnIDogZjtcbiAgICAgICAgICAgIGFzc2VydChVdGlscy5mbG9hdEVxdWFscyh5LCBibG9ja2VyLnBvc2l0aW9uWSksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBmbG9hdEVxdWFscyh5LCBibG9ja2VyLnBvc2l0aW9uWSkgRkFJTEVEJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja1B1c2hGb3J3YXJkID0gZnVuY3Rpb24gKGJsb2NrZWQsIGJsb2NrZXIpIHtcbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZTtcblxuICAgIGFzc2VydChibG9ja2VkICE9PSBudWxsICYmIGJsb2NrZXIgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBibG9ja2VkICE9PSBudWxsICYmIGJsb2NrZXIgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJsb2NrZWQucG9zaXRpb25ZID49IGJsb2NrZXIucG9zaXRpb25ZLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogYmxvY2tlZC5wb3NpdGlvblkgPj0gYmxvY2tlci5wb3NpdGlvblkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJsb2NrZWQuZ2V0QmxvY2tOZXh0KCkgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBibG9ja2VkLmdldEJsb2NrTmV4dCgpICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIGYgPSAwLFxuICAgICAgICBnID0gMCxcbiAgICAgICAgZWRnZSA9IGJsb2NrZWQsXG4gICAgICAgIHRyYWNlID0gYmxvY2tlcixcbiAgICAgICAgZCA9IGVkZ2UucG9zaXRpb25ZIC0gdHJhY2UucG9zaXRpb25ZO1xuXG4gICAgYXNzZXJ0KGQgPj0gMCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6ICBkID49IDAgRkFJTEVEJyk7XG5cbiAgICB2YXIgcyA9ICh0cmFjZS5icmFja2V0T3BlbmluZyB8fCBlZGdlLmJyYWNrZXRDbG9zaW5nKSxcbiAgICAgICAgYiA9IDEgLSBzLFxuICAgICAgICBkMjtcblxuICAgIGZvciAoOyA7KSB7XG4gICAgICAgIGVkZ2Uuc2V0QmxvY2tUcmFjZSh0cmFjZSk7XG4gICAgICAgIHRyYWNlID0gZWRnZTtcbiAgICAgICAgZWRnZSA9IGVkZ2UuZ2V0QmxvY2tOZXh0KCk7XG5cbiAgICAgICAgaWYgKGVkZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZDIgPSBlZGdlLnBvc2l0aW9uWSAtIHRyYWNlLnBvc2l0aW9uWTtcbiAgICAgICAgYXNzZXJ0KGQyID49IDAsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogZDIgPj0gMCBGQUlMRUQnKTtcblxuICAgICAgICBpZiAodHJhY2UuYnJhY2tldE9wZW5pbmcgfHwgZWRnZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgICAgIGlmIChkMiA8PSBnKSB7XG4gICAgICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHMrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZikge1xuICAgICAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiKys7XG4gICAgICAgIH1cblxuICAgICAgICBkICs9IGQyO1xuICAgIH1cblxuICAgIGlmIChiICsgcyA+IDEpIHsgLy9Mb29raW5nIGF0IG1vcmUgdGhhbiBvbmUgZWRnZSAob3IgZWRnZS90cmFjZSBjb21wYXJpc29uKSB7XG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2VydChVdGlscy5mbG9hdEVxdWFscyhkLCBmICogYiArIGcgKiBzKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBmbG9hdEVxdWFscyhkLCBmKmIgKyBnKnMpIEZBSUxFRCcpO1xuXG4gICAgICAgIGVkZ2UgPSB0cmFjZTtcbiAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuZXF1YWxzKGJsb2NrZWQpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGVkZ2UgIT0gbnVsbCAmJiAhZWRnZS5lcXVhbHMoYmxvY2tlZCkgRkFJTEVEJyk7XG5cbiAgICAgICAgdmFyIHkgPSBlZGdlLnBvc2l0aW9uWTtcblxuICAgICAgICBkbyB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBlZGdlLmdldEJsb2NrVHJhY2UoKSAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogZWRnZSAhPT0gbnVsbCAmJiBlZGdlLmdldEJsb2NrVHJhY2UoKSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIHRyYWNlID0gZWRnZS5nZXRCbG9ja1RyYWNlKCk7XG5cbiAgICAgICAgICAgIHkgLT0gKHRyYWNlLmJyYWNrZXRPcGVuaW5nIHx8IGVkZ2UuYnJhY2tldENsb3NpbmcpID8gZyA6IGY7XG5cbiAgICAgICAgICAgIGlmICh0cmFjZS5wb3NpdGlvblkgPCB5IC0gMC4wMDEpIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc2xpZGVCdXROb3RQYXNzRWRnZXModHJhY2UsIHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYWNlLnNldEJsb2NrTmV4dChudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVkZ2UgPSB0cmFjZTtcbiAgICAgICAgfSB3aGlsZSAoZWRnZSAhPT0gYmxvY2tlZCk7XG4gICAgfVxuXG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmJsb2NrU2NhbkZvcndhcmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9zaXRpb25BbGxMb2FkWCgpO1xuXG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICB0aGlzLnNlY3Rpb25SZXNldCgpO1xuXG4gICAgdmFyIGJsb2NrZXIgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIGJsb2NrZWQsXG4gICAgICAgIGJtaW4sXG4gICAgICAgIHNtaW4sXG4gICAgICAgIGJNaW5GLFxuICAgICAgICBzTWluRjtcblxuICAgIHdoaWxlIChibG9ja2VyKSB7XG4gICAgICAgIGJtaW4gPSBudWxsOyAvL2Jsb2NrIG1pbj9cbiAgICAgICAgc21pbiA9IG51bGw7IC8vc2VjdGlvbiBtaW4/XG4gICAgICAgIGJNaW5GID0gQ09OU1RBTlRTLkVEX01JTkNPT1JEIC0gMTtcbiAgICAgICAgc01pbkYgPSBDT05TVEFOVFMuRURfTUlOQ09PUkQgLSAxO1xuXG4gICAgICAgIHRoaXMuX3NlY3Rpb25CZWdpblNjYW4oYmxvY2tlcik7XG4gICAgICAgIHdoaWxlICh0aGlzLl9zZWN0aW9uSGFzQmxvY2tlZEVkZ2UoKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NlY3Rpb25Jc0ltbWVkaWF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlZCA9IHRoaXMuX3NlY3Rpb25HZXRCbG9ja2VkRWRnZSgpO1xuICAgICAgICAgICAgICAgIGFzc2VydChibG9ja2VkICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogYmxvY2tlZCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChibG9ja2VkLmdldEJsb2NrUHJldigpICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdGhpcy5fYmxvY2tQdXNoQmFja3dhcmQoYmxvY2tlZCwgYmxvY2tlcikgfHwgbW9kaWZpZWQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFibG9ja2VyLmVkZ2VGaXhlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2tlZC5icmFja2V0T3BlbmluZyB8fCBibG9ja2VyLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc01pbkYgPCBibG9ja2VkLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNNaW5GID0gYmxvY2tlZC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21pbiA9IGJsb2NrZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbkYgPCBibG9ja2VkLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJNaW5GID0gYmxvY2tlZC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm1pbiA9IGJsb2NrZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChibWluKSB7XG4gICAgICAgICAgICBpZiAoc21pbikge1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdFByZXYoc01pbkYgPiBiTWluRiA/IHNtaW4gOiBibWluKTtcblxuICAgICAgICAgICAgICAgIGJNaW5GID0gYmxvY2tlci5wb3NpdGlvblkgLSBiTWluRjtcbiAgICAgICAgICAgICAgICBzTWluRiA9IHRoaXMuX2Jsb2NrR2V0RihibG9ja2VyLnBvc2l0aW9uWSAtIHNNaW5GLCAwLCAxKTtcblxuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tQcmV2KHNNaW5GIDwgYk1pbkYgPyBzbWluIDogYm1pbik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tQcmV2KGJtaW4pO1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdFByZXYoYm1pbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrUHJldihzbWluKTtcbiAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdFByZXYoc21pbik7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGJsb2NrZXIgPSBibG9ja2VyLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICB0aGlzLl9wb3NpdGlvbkFsbFN0b3JlWSgpO1xuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5ibG9ja1NjYW5CYWNrd2FyZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wb3NpdGlvbkFsbExvYWRYKCk7XG5cbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZTtcblxuICAgIHRoaXMuc2VjdGlvblJlc2V0KCk7XG4gICAgdmFyIGJsb2NrZXIgPSB0aGlzLm9yZGVyTGFzdCxcbiAgICAgICAgYmxvY2tlZCxcbiAgICAgICAgYm1pbixcbiAgICAgICAgc21pbixcbiAgICAgICAgYk1pbkYsXG4gICAgICAgIHNNaW5GO1xuXG4gICAgd2hpbGUgKGJsb2NrZXIpIHtcbiAgICAgICAgYm1pbiA9IG51bGw7XG4gICAgICAgIHNtaW4gPSBudWxsO1xuICAgICAgICBiTWluRiA9IENPTlNUQU5UUy5FRF9NQVhDT09SRCArIDE7XG4gICAgICAgIHNNaW5GID0gQ09OU1RBTlRTLkVEX01BWENPT1JEICsgMTtcblxuICAgICAgICB0aGlzLl9zZWN0aW9uQmVnaW5TY2FuKGJsb2NrZXIpO1xuXG4gICAgICAgIHdoaWxlICh0aGlzLl9zZWN0aW9uSGFzQmxvY2tlZEVkZ2UoKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NlY3Rpb25Jc0ltbWVkaWF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlZCA9IHRoaXMuX3NlY3Rpb25HZXRCbG9ja2VkRWRnZSgpO1xuXG4gICAgICAgICAgICAgICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU2NhbkJhY2t3YXJkOiBibG9ja2VkICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJsb2NrZWQuZ2V0QmxvY2tOZXh0KCkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0aGlzLl9ibG9ja1B1c2hGb3J3YXJkKGJsb2NrZWQsIGJsb2NrZXIpIHx8IG1vZGlmaWVkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghYmxvY2tlci5lZGdlRml4ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrZXIuYnJhY2tldE9wZW5pbmcgfHwgYmxvY2tlZC5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNNaW5GID4gYmxvY2tlZC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzTWluRiA9IGJsb2NrZWQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtaW4gPSBibG9ja2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW5GID4gYmxvY2tlZC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiTWluRiA9IGJsb2NrZWQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJtaW4gPSBibG9ja2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJtaW4pIHtcbiAgICAgICAgICAgIGlmIChzbWluKSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0TmV4dChzTWluRiA8IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuXG4gICAgICAgICAgICAgICAgYk1pbkYgPSBiTWluRiAtIGJsb2NrZXIucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgIHNNaW5GID0gdGhpcy5fYmxvY2tHZXRGKHNNaW5GIC0gYmxvY2tlci5wb3NpdGlvblksIDAsIDEpO1xuXG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja05leHQoc01pbkYgPCBiTWluRiA/IHNtaW4gOiBibWluKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja05leHQoYm1pbik7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0TmV4dChibWluKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tOZXh0KHNtaW4pO1xuICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0TmV4dChzbWluKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJsb2NrZXIgPSBibG9ja2VyLm9yZGVyUHJldjtcbiAgICB9XG5cbiAgICB0aGlzLl9wb3NpdGlvbkFsbFN0b3JlWSgpO1xuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5ibG9ja1N3aXRjaFdyb25ncyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgd2FzID0gZmFsc2U7XG5cbiAgICB0aGlzLl9wb3NpdGlvbkFsbExvYWRYKCk7XG4gICAgdmFyIHNlY29uZCA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgZWRnZSxcbiAgICAgICAgbmV4dCxcbiAgICAgICAgZXksXG4gICAgICAgIG55LFxuICAgICAgICBhO1xuXG4gICAgd2hpbGUgKHNlY29uZCAhPT0gbnVsbCkge1xuICAgICAgICAvL0NoZWNrIGlmIGl0IHJlZmVyZW5jZXMgaXRzZWxmXG4gICAgICAgIGlmIChzZWNvbmQuZ2V0Q2xvc2VzdFByZXYoKSAhPT0gbnVsbCAmJiBzZWNvbmQuZ2V0Q2xvc2VzdFByZXYoKS5nZXRDbG9zZXN0TmV4dCgpICE9PSAoc2Vjb25kKSAmJlxuICAgICAgICAgICAgc2Vjb25kLmdldENsb3Nlc3ROZXh0KCkgIT09IG51bGwgJiYgc2Vjb25kLmdldENsb3Nlc3ROZXh0KCkuZ2V0Q2xvc2VzdFByZXYoKSA9PT0gKHNlY29uZCkpIHtcblxuICAgICAgICAgICAgYXNzZXJ0KCFzZWNvbmQuZWRnZUZpeGVkLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiAhc2Vjb25kLmVkZ2VGaXhlZCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgZWRnZSA9IHNlY29uZDtcbiAgICAgICAgICAgIG5leHQgPSBlZGdlLmdldENsb3Nlc3ROZXh0KCk7XG5cbiAgICAgICAgICAgIHdoaWxlIChuZXh0ICE9PSBudWxsICYmIGVkZ2UgPT09IG5leHQuZ2V0Q2xvc2VzdFByZXYoKSkge1xuICAgICAgICAgICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmVkZ2VGaXhlZCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6IGVkZ2UgIT0gbnVsbCAmJiAhZWRnZS5lZGdlRml4ZWQgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KG5leHQgIT09IG51bGwgJiYgIW5leHQuZWRnZUZpeGVkLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogbmV4dCAhPSBudWxsICYmICFuZXh0LmVkZ2VGaXhlZCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGV5ID0gZWRnZS5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgbnkgPSBuZXh0LnBvc2l0aW9uWTtcblxuICAgICAgICAgICAgICAgIGFzc2VydChleSA8PSBueSxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6IGV5IDw9IG55IEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGV5ICsgMSA8PSBueSAmJiB0aGlzLl9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZChlZGdlLCBuZXh0KSkge1xuICAgICAgICAgICAgICAgICAgICB3YXMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCghZWRnZS5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgIW5leHQuZ2V0RWRnZUNhbnBhc3NlZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6ICFlZGdlLmdldEVkZ2VDYW5wYXNzZWQoKSAmJiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICchbmV4dC5nZXRFZGdlQ2FucGFzc2VkKCkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RWRnZUNhbnBhc3NlZCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRFZGdlQ2FucGFzc2VkKHRydWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyhlZGdlLCAobnkgKyBleSkgLyAyICsgMC4wMDEpICE9PSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhID0gdGhpcy5fc2xpZGVCdXROb3RQYXNzRWRnZXMobmV4dCwgKG55ICsgZXkpIC8gMiAtIDAuMDAxKSAhPT0gbnVsbCB8fCBhO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3RQcmV2KG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRDbG9zZXN0TmV4dChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdFByZXYobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LnNldENsb3Nlc3ROZXh0KG51bGwpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRFZGdlQ2FucGFzc2VkKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGVkZ2UuZ2V0Q2xvc2VzdFByZXYoKSAhPT0gbnVsbCAmJiBlZGdlLmdldENsb3Nlc3RQcmV2KCkuZ2V0Q2xvc2VzdE5leHQoKSA9PT0gZWRnZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5nZXRDbG9zZXN0UHJldigpLnNldENsb3Nlc3ROZXh0KG5leHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQuZ2V0Q2xvc2VzdE5leHQoKSAhPT0gbnVsbCAmJiBuZXh0LmdldENsb3Nlc3ROZXh0KCkuZ2V0Q2xvc2VzdFByZXYoKSA9PT0gbmV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dC5nZXRDbG9zZXN0TmV4dCgpLnNldENsb3Nlc3RQcmV2KGVkZ2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRDbG9zZXN0TmV4dChuZXh0LmdldENsb3Nlc3ROZXh0KCkpO1xuICAgICAgICAgICAgICAgICAgICBuZXh0LnNldENsb3Nlc3ROZXh0KGVkZ2UpO1xuICAgICAgICAgICAgICAgICAgICBuZXh0LnNldENsb3Nlc3RQcmV2KGVkZ2UuZ2V0Q2xvc2VzdFByZXYoKSk7XG4gICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdFByZXYobmV4dCk7XG5cbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRFZGdlQ2FucGFzc2VkKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRFZGdlQ2FucGFzc2VkKGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIXRoaXMuX2JyYWNrZXRTaG91bGRCZVN3aXRjaGVkKG5leHQsIGVkZ2UpLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6ICFicmFja2V0U2hvdWxkQmVTd2l0Y2hlZChuZXh0LCBlZGdlKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobmV4dC5nZXRDbG9zZXN0UHJldigpICE9PSBudWxsICYmIG5leHQuZ2V0Q2xvc2VzdFByZXYoKS5nZXRDbG9zZXN0TmV4dCgpID09PSBuZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlID0gbmV4dC5nZXRDbG9zZXN0UHJldigpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dCA9IGVkZ2UuZ2V0Q2xvc2VzdE5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVkZ2UgPSBuZXh0O1xuICAgICAgICAgICAgICAgICAgICBuZXh0ID0gbmV4dC5nZXRDbG9zZXN0TmV4dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNlY29uZCA9IHNlY29uZC5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgaWYgKHdhcykge1xuICAgICAgICB0aGlzLl9wb3NpdGlvbkFsbFN0b3JlWSgpO1xuICAgIH1cblxuICAgIHJldHVybiB3YXM7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIENoZWNrIHRoYXQgYWxsIGVkZ2VzIGhhdmUgc3RhcnQvZW5kIHBvaW50c1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlKSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCAhPT0gdW5kZWZpbmVkLCAnRWRnZSBoYXMgdW5yZWNvZ25pemVkIHN0YXJ0cG9pbnQ6ICcgKyBlZGdlLnN0YXJ0cG9pbnQpO1xuICAgICAgICBhc3NlcnQoZWRnZS5lbmRwb2ludC54ICE9PSB1bmRlZmluZWQsICdFZGdlIGhhcyB1bnJlY29nbml6ZWQgZW5kcG9pbnQ6ICcgKyBlZGdlLmVuZHBvaW50KTtcbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckVkZ2VMaXN0O1xuIiwiLypnbG9iYWxzIGRlZmluZSwgV2ViR01FR2xvYmFsKi9cbi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLCAgLy8gRklYTUVcbiAgICBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyUG9pbnRMaXN0UGF0aCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludExpc3QnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEF1dG9Sb3V0ZXJQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBhdGgnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0JyksXG4gICAgQXV0b1JvdXRlckJveCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Cb3gnKSxcbiAgICBBdXRvUm91dGVyRWRnZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5FZGdlJyksXG4gICAgQXV0b1JvdXRlckVkZ2VMaXN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkVkZ2VMaXN0Jyk7XG5cbnZhciBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5HcmFwaCcpLFxuICAgIENPVU5URVIgPSAxOyAgLy8gVXNlZCBmb3IgdW5pcXVlIGlkc1xuXG52YXIgQXV0b1JvdXRlckdyYXBoID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY29tcGxldGVseUNvbm5lY3RlZCA9IHRydWU7ICAvLyB0cnVlIGlmIGFsbCBwYXRocyBhcmUgY29ubmVjdGVkXG4gICAgdGhpcy5ob3Jpem9udGFsID0gbmV3IEF1dG9Sb3V0ZXJFZGdlTGlzdCh0cnVlKTtcbiAgICB0aGlzLnZlcnRpY2FsID0gbmV3IEF1dG9Sb3V0ZXJFZGdlTGlzdChmYWxzZSk7XG4gICAgdGhpcy5ib3hlcyA9IHt9O1xuICAgIHRoaXMucGF0aHMgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlckJveGVzID0gW107XG4gICAgdGhpcy5ib3gyYnVmZmVyQm94ID0ge307IC8vIG1hcHMgYm94SWQgdG8gY29ycmVzcG9uZGluZyBidWZmZXJib3ggb2JqZWN0XG5cbiAgICB0aGlzLmhvcml6b250YWwub3duZXIgPSB0aGlzO1xuICAgIHRoaXMudmVydGljYWwub3duZXIgPSB0aGlzO1xuXG4gICAgLy9Jbml0aWFsaXppbmcgc2VsZlBvaW50c1xuICAgIHRoaXMuc2VsZlBvaW50cyA9IFtcbiAgICAgICAgbmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01JTkNPT1JELCBDT05TVEFOVFMuRURfTUlOQ09PUkQpLFxuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUFYQ09PUkQsIENPTlNUQU5UUy5FRF9NSU5DT09SRCksXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NQVhDT09SRCwgQ09OU1RBTlRTLkVEX01BWENPT1JEKSxcbiAgICAgICAgbmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01JTkNPT1JELCBDT05TVEFOVFMuRURfTUFYQ09PUkQpXG4gICAgXTtcblxuICAgIHRoaXMuX2FkZFNlbGZFZGdlcygpO1xufTtcblxuLy9GdW5jdGlvbnNcbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZUFsbEJveGVzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKTtcbiAgICBmb3IgKHZhciBpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmJveGVzW2lkc1tpXV0uZGVzdHJveSgpO1xuICAgICAgICBkZWxldGUgdGhpcy5ib3hlc1tpZHNbaV1dO1xuICAgIH1cbiAgICAvLyBDbGVhbiB1cCB0aGUgYnVmZmVyQm94ZXNcbiAgICB0aGlzLmJ1ZmZlckJveGVzID0gW107XG4gICAgdGhpcy5ib3gyYnVmZmVyQm94ID0ge307XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRCb3hBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yICh2YXIgaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKHRoaXMuYm94ZXNbaWRzW2ldXS5pc0JveEF0KHBvaW50LCBuZWFybmVzcykpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmJveGVzW2lkc1tpXV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3NldFBvcnRBdHRyID0gZnVuY3Rpb24gKHBvcnQsIGF0dHIpIHtcbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNGcm9tKHBvcnQpO1xuICAgIHBvcnQuYXR0cmlidXRlcyA9IGF0dHI7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9pc1JlY3RDbGlwQm94ZXMgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciBib3hSZWN0O1xuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKTtcbiAgICBmb3IgKHZhciBpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBib3hSZWN0ID0gdGhpcy5ib3hlc1tpZHNbaV1dLnJlY3Q7XG4gICAgICAgIGlmIChVdGlscy5pc1JlY3RDbGlwKHJlY3QsIGJveFJlY3QpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9pc1JlY3RDbGlwQnVmZmVyQm94ZXMgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciBpID0gdGhpcy5idWZmZXJCb3hlcy5sZW5ndGgsXG4gICAgICAgIGM7XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGMgPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoYy0tKSB7XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNSZWN0Q2xpcChyZWN0LCB0aGlzLmJ1ZmZlckJveGVzW2ldLmNoaWxkcmVuW2NdKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNMaW5lQ2xpcEJ1ZmZlckJveGVzID0gZnVuY3Rpb24gKHAxLCBwMikge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChwMSwgcDIpO1xuICAgIHJlY3Qubm9ybWFsaXplUmVjdCgpO1xuICAgIGFzc2VydChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQgfHwgcmVjdC5jZWlsID09PSByZWN0LmZsb29yLFxuICAgICAgICAnQVJHcmFwaC50aGlzLl9pc0xpbmVDbGlwQm94ZXM6IHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IgRkFJTEVEJyk7XG5cbiAgICBpZiAocmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0KSB7XG4gICAgICAgIHJlY3QucmlnaHQrKztcbiAgICB9XG4gICAgaWYgKHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vcikge1xuICAgICAgICByZWN0LmZsb29yKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2lzUmVjdENsaXBCdWZmZXJCb3hlcyhyZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzTGluZUNsaXBCb3hlcyA9IGZ1bmN0aW9uIChwMSwgcDIpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QocDEsIHAyKTtcbiAgICByZWN0Lm5vcm1hbGl6ZVJlY3QoKTtcbiAgICBhc3NlcnQocmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vcixcbiAgICAgICAgJ0FSR3JhcGguaXNMaW5lQ2xpcEJveGVzOiByZWN0LmxlZnQgPT09IHJlY3QucmlnaHQgfHwgcmVjdC5jZWlsID09PSByZWN0LmZsb29yIEZBSUxFRCcpO1xuXG4gICAgaWYgKHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCkge1xuICAgICAgICByZWN0LnJpZ2h0Kys7XG4gICAgfVxuICAgIGlmIChyZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmVjdC5mbG9vcisrO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pc1JlY3RDbGlwQm94ZXMocmVjdCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jYW5Cb3hBdCA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgcmV0dXJuICF0aGlzLl9pc1JlY3RDbGlwQm94ZXMuaW5mbGF0ZWRSZWN0KHJlY3QsIDEpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCwgJ0FSR3JhcGguYWRkOiBwYXRoICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghcGF0aC5oYXNPd25lcigpLCAnQVJHcmFwaC5hZGQ6ICFwYXRoLmhhc093bmVyKCkgRkFJTEVEJyk7XG5cbiAgICBwYXRoLm93bmVyID0gdGhpcztcblxuICAgIHRoaXMucGF0aHMucHVzaChwYXRoKTtcblxuICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuX2Fzc2VydFZhbGlkUGF0aChwYXRoKTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZUFsbFBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnBhdGhzW2ldLmRlc3Ryb3koKTsgIC8vIFJlbW92ZSBwb2ludCBmcm9tIHN0YXJ0L2VuZCBwb3J0XG4gICAgfVxuXG4gICAgdGhpcy5wYXRocyA9IFtdO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faGFzTm9QYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnBhdGhzLmxlbmd0aCA9PT0gMDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldFBhdGhDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXRocy5sZW5ndGg7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRMaXN0RWRnZUF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuXG4gICAgdmFyIGVkZ2UgPSB0aGlzLmhvcml6b250YWwuZ2V0RWRnZUF0KHBvaW50LCBuZWFybmVzcyk7XG4gICAgaWYgKGVkZ2UpIHtcbiAgICAgICAgcmV0dXJuIGVkZ2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudmVydGljYWwuZ2V0RWRnZUF0KHBvaW50LCBuZWFybmVzcyk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRTdXJyb3VuZFJlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KDAsIDAsIDAsIDApLFxuICAgICAgICBpO1xuXG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcmVjdC51bmlvbkFzc2lnbih0aGlzLmJveGVzW2lkc1tpXV0ucmVjdCk7XG4gICAgfVxuXG4gICAgZm9yIChpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcmVjdC51bmlvbkFzc2lnbih0aGlzLnBhdGhzW2ldLmdldFN1cnJvdW5kUmVjdCgpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVjdDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldE91dE9mQm94ID0gZnVuY3Rpb24gKGRldGFpbHMpIHtcbiAgICB2YXIgYnVmZmVyT2JqZWN0ID0gdGhpcy5ib3gyYnVmZmVyQm94W2RldGFpbHMuYm94LmlkXSxcbiAgICAgICAgY2hpbGRyZW4gPSBidWZmZXJPYmplY3QuY2hpbGRyZW4sXG4gICAgICAgIGkgPSBidWZmZXJPYmplY3QuY2hpbGRyZW4ubGVuZ3RoLFxuICAgICAgICBwb2ludCA9IGRldGFpbHMucG9pbnQsXG4gICAgICAgIGRpciA9IGRldGFpbHMuZGlyLFxuICAgICAgICBib3hSZWN0ID0gbmV3IEFyUmVjdChkZXRhaWxzLmJveC5yZWN0KTtcblxuICAgIGJveFJlY3QuaW5mbGF0ZVJlY3QoQ09OU1RBTlRTLkJVRkZFUik7IC8vQ3JlYXRlIGEgY29weSBvZiB0aGUgYnVmZmVyIGJveFxuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuXG4gICAgd2hpbGUgKGJveFJlY3QucHRJblJlY3QocG9pbnQpKSB7XG4gICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICAgICAgcG9pbnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJveFJlY3QsIGRpcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb2ludC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgZGlyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChjaGlsZHJlbltpXS5wdEluUmVjdChwb2ludCkpIHtcbiAgICAgICAgICAgICAgICBib3hSZWN0ID0gY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaSA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbi5sZW5ndGg7XG4gICAgfVxuXG4gICAgYXNzZXJ0KCFib3hSZWN0LnB0SW5SZWN0KHBvaW50KSwgJ0FSR3JhcGguZ2V0T3V0T2ZCb3g6ICFib3hSZWN0LnB0SW5SZWN0KCBwb2ludCkgRkFJTEVEJyk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nb1RvTmV4dEJ1ZmZlckJveCA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgdmFyIHBvaW50ID0gYXJncy5wb2ludCxcbiAgICAgICAgZW5kID0gYXJncy5lbmQsXG4gICAgICAgIGRpciA9IGFyZ3MuZGlyLFxuICAgICAgICBkaXIyID0gYXJncy5kaXIyID09PSB1bmRlZmluZWQgfHwgIVV0aWxzLmlzUmlnaHRBbmdsZShhcmdzLmRpcjIpID8gKGVuZCBpbnN0YW5jZW9mIEFyUG9pbnQgP1xuICAgICAgICAgICAgVXRpbHMuZXhHZXRNYWpvckRpcihlbmQubWludXMocG9pbnQpKSA6IENPTlNUQU5UUy5EaXJOb25lKSA6IGFyZ3MuZGlyMixcbiAgICAgICAgc3RvcGhlcmUgPSBhcmdzLmVuZCAhPT0gdW5kZWZpbmVkID8gYXJncy5lbmQgOlxuICAgICAgICAgICAgKGRpciA9PT0gMSB8fCBkaXIgPT09IDIgPyBDT05TVEFOVFMuRURfTUFYQ09PUkQgOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgKTtcblxuICAgIGlmIChkaXIyID09PSBkaXIpIHtcbiAgICAgICAgZGlyMiA9IFV0aWxzLmlzUmlnaHRBbmdsZShVdGlscy5leEdldE1pbm9yRGlyKGVuZC5taW51cyhwb2ludCkpKSA/XG4gICAgICAgICAgICBVdGlscy5leEdldE1pbm9yRGlyKGVuZC5taW51cyhwb2ludCkpIDogKGRpciArIDEpICUgNDtcbiAgICB9XG5cbiAgICBpZiAoZW5kIGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBzdG9waGVyZSA9IFV0aWxzLmdldFBvaW50Q29vcmQoc3RvcGhlcmUsIGRpcik7XG4gICAgfVxuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQXJHcmFwaC5nb1RvTmV4dEJ1ZmZlckJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuICAgIGFzc2VydChVdGlscy5nZXRQb2ludENvb3JkKHBvaW50LCBkaXIpICE9PSBzdG9waGVyZSxcbiAgICAgICAgJ0FyR3JhcGguZ29Ub05leHRCdWZmZXJCb3g6IFV0aWxzLmdldFBvaW50Q29vcmQgKHBvaW50LCBkaXIpICE9PSBzdG9waGVyZSBGQUlMRUQnKTtcblxuICAgIHZhciBib3hieSA9IG51bGwsXG4gICAgICAgIGkgPSAtMSxcbiAgICAgICAgYm94UmVjdDtcbiAgICAvL2pzY3M6ZGlzYWJsZSBtYXhpbXVtTGluZUxlbmd0aFxuICAgIHdoaWxlICgrK2kgPCB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCkge1xuICAgICAgICBib3hSZWN0ID0gdGhpcy5idWZmZXJCb3hlc1tpXS5ib3g7XG5cbiAgICAgICAgaWYgKCFVdGlscy5pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBib3hSZWN0LCBkaXIpICYmIC8vQWRkIHN1cHBvcnQgZm9yIGVudGVyaW5nIHRoZSBwYXJlbnQgYm94XG4gICAgICAgICAgICBVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKHBvaW50LCBib3hSZWN0LCBkaXIpICYmICAvLyBpZiBpdCB3aWxsIG5vdCBwdXQgdGhlIHBvaW50IGluIGEgY29ybmVyIChyZWxhdGl2ZSB0byBkaXIyKVxuICAgICAgICAgICAgVXRpbHMuaXNDb29yZEluRGlyRnJvbShzdG9waGVyZSxcbiAgICAgICAgICAgICAgICBVdGlscy5nZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbSh0aGlzLmJ1ZmZlckJveGVzW2ldLCBkaXIsIHBvaW50KS5jb29yZCwgZGlyKSkge1xuICAgICAgICAgICAgLy9SZXR1cm4gZXh0cmVtZSAocGFyZW50IGJveCkgZm9yIHRoaXMgY29tcGFyaXNvblxuICAgICAgICAgICAgc3RvcGhlcmUgPSBVdGlscy5nZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbSh0aGlzLmJ1ZmZlckJveGVzW2ldLCBkaXIsIHBvaW50KS5jb29yZDtcbiAgICAgICAgICAgIGJveGJ5ID0gdGhpcy5idWZmZXJCb3hlc1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvL2pzY3M6ZW5hYmxlIG1heGltdW1MaW5lTGVuZ3RoXG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgcG9pbnQueCA9IHN0b3BoZXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvaW50LnkgPSBzdG9waGVyZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYm94Ynk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9odWdDaGlsZHJlbiA9IGZ1bmN0aW9uIChidWZmZXJPYmplY3QsIHBvaW50LCBkaXIxLCBkaXIyLCBleGl0Q29uZGl0aW9uKSB7XG4gICAgLy8gVGhpcyBtZXRob2QgY3JlYXRlcyBhIHBhdGggdGhhdCBlbnRlcnMgdGhlIHBhcmVudCBib3ggYW5kICdodWdzJyB0aGUgY2hpbGRyZW4gYm94ZXNcbiAgICAvLyAocmVtYWlucyB3aXRoaW4gb25lIHBpeGVsIG9mIHRoZW0pIGFuZCBmb2xsb3dzIHRoZW0gb3V0LlxuICAgIGFzc2VydCgoZGlyMSArIGRpcjIpICUgMiA9PT0gMSwgJ0FSR3JhcGguaHVnQ2hpbGRyZW46IE9uZSBhbmQgb25seSBvbmUgZGlyZWN0aW9uIG11c3QgYmUgaG9yaXpvbnRhbCcpO1xuICAgIHZhciBjaGlsZHJlbiA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbixcbiAgICAgICAgcGFyZW50Qm94ID0gYnVmZmVyT2JqZWN0LmJveCxcbiAgICAgICAgaW5pdFBvaW50ID0gbmV3IEFyUG9pbnQocG9pbnQpLFxuICAgICAgICBjaGlsZCA9IHRoaXMuX2dvVG9OZXh0Qm94KHBvaW50LCBkaXIxLCAoZGlyMSA9PT0gMSB8fCBkaXIxID09PSAyID9cbiAgICAgICAgICAgIENPTlNUQU5UUy5FRF9NQVhDT09SRCA6IENPTlNUQU5UUy5FRF9NSU5DT09SRCApLCBjaGlsZHJlbiksXG4gICAgICAgIGZpbmFsUG9pbnQsXG4gICAgICAgIGRpciA9IGRpcjIsXG4gICAgICAgIG5leHREaXIgPSBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKGRpcjEpID09PSBkaXIyID8gVXRpbHMubmV4dENsb2Nrd2lzZURpciA6IFV0aWxzLnByZXZDbG9ja3dpc2VEaXIsXG4gICAgICAgIHBvaW50cyA9IFtuZXcgQXJQb2ludChwb2ludCldLFxuICAgICAgICBoYXNFeGl0ID0gdHJ1ZSxcbiAgICAgICAgbmV4dENoaWxkLFxuICAgICAgICBvbGQ7XG5cbiAgICBhc3NlcnQoY2hpbGQgIT09IG51bGwsICdBUkdyYXBoLmh1Z0NoaWxkcmVuOiBjaGlsZCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBleGl0Q29uZGl0aW9uID0gZXhpdENvbmRpdGlvbiA9PT0gdW5kZWZpbmVkID8gZnVuY3Rpb24gKHB0KSB7XG4gICAgICAgIHJldHVybiAhcGFyZW50Qm94LnB0SW5SZWN0KHB0KTtcbiAgICB9IDogZXhpdENvbmRpdGlvbjtcblxuICAgIF9sb2dnZXIuaW5mbygnQWJvdXQgdG8gaHVnIGNoaWxkIGJveGVzIHRvIGZpbmQgYSBwYXRoJyk7XG4gICAgd2hpbGUgKGhhc0V4aXQgJiYgIWV4aXRDb25kaXRpb24ocG9pbnQsIGJ1ZmZlck9iamVjdCkpIHtcbiAgICAgICAgb2xkID0gbmV3IEFyUG9pbnQocG9pbnQpO1xuICAgICAgICBuZXh0Q2hpbGQgPSB0aGlzLl9nb1RvTmV4dEJveChwb2ludCwgZGlyLCBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChjaGlsZCwgZGlyKSwgY2hpbGRyZW4pO1xuXG4gICAgICAgIGlmICghcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXS5lcXVhbHMob2xkKSkge1xuICAgICAgICAgICAgcG9pbnRzLnB1c2gobmV3IEFyUG9pbnQob2xkKSk7IC8vVGhlIHBvaW50cyBhcnJheSBzaG91bGQgbm90IGNvbnRhaW4gdGhlIG1vc3QgcmVjZW50IHBvaW50LlxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRDaGlsZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZGlyID0gVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpO1xuICAgICAgICB9IGVsc2UgaWYgKFV0aWxzLmlzQ29vcmRJbkRpckZyb20oVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQobmV4dENoaWxkLCBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSkpLFxuICAgICAgICAgICAgICAgIFV0aWxzLmdldFBvaW50Q29vcmQocG9pbnQsIFV0aWxzLnJldmVyc2VEaXIobmV4dERpcihkaXIpKSksIFV0aWxzLnJldmVyc2VEaXIobmV4dERpcihkaXIpKSkpIHtcbiAgICAgICAgICAgIGRpciA9IG5leHREaXIoZGlyKTtcbiAgICAgICAgICAgIGNoaWxkID0gbmV4dENoaWxkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbmFsUG9pbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZmluYWxQb2ludCA9IG5ldyBBclBvaW50KHBvaW50KTtcbiAgICAgICAgfSBlbHNlIGlmICghZmluYWxQb2ludC5lcXVhbHMob2xkKSkge1xuICAgICAgICAgICAgaGFzRXhpdCA9ICFwb2ludC5lcXVhbHMoZmluYWxQb2ludCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9pbnRzWzBdLmVxdWFscyhpbml0UG9pbnQpKSB7XG4gICAgICAgIHBvaW50cy5zcGxpY2UoMCwgMSk7XG4gICAgfVxuXG4gICAgaWYgKCFoYXNFeGl0KSB7XG4gICAgICAgIHBvaW50cyA9IG51bGw7XG4gICAgICAgIHBvaW50LmFzc2lnbihpbml0UG9pbnQpO1xuICAgIH1cblxuICAgIHJldHVybiBwb2ludHM7XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dvVG9OZXh0Qm94ID0gZnVuY3Rpb24gKHBvaW50LCBkaXIsIHN0b3AxLCBib3hMaXN0KSB7XG4gICAgdmFyIHN0b3BoZXJlID0gc3RvcDE7XG5cbiAgICAvKlxuICAgICBpZiAoc3RvcDIgIT09IHVuZGVmaW5lZCkge1xuICAgICBpZiAoc3RvcDIgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICBib3hMaXN0ID0gc3RvcDI7XG4gICAgIH0gZWxzZSB7XG4gICAgIHN0b3BoZXJlID0gc3RvcDEgaW5zdGFuY2VvZiBBclBvaW50ID9cbiAgICAgY2hvb3NlSW5EaXIuZ2V0UG9pbnRDb29yZCAoc3RvcDEsIGRpciksIFV0aWxzLmdldFBvaW50Q29vcmQgKHN0b3AyLCBkaXIpLCBVdGlscy5yZXZlcnNlRGlyIChkaXIpKSA6XG4gICAgIGNob29zZUluRGlyKHN0b3AxLCBzdG9wMiwgVXRpbHMucmV2ZXJzZURpciAoZGlyKSk7XG4gICAgIH1cblxuICAgICB9ZWxzZSAqL1xuICAgIGlmIChzdG9wMSBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgc3RvcGhlcmUgPSBVdGlscy5nZXRQb2ludENvb3JkKHN0b3BoZXJlLCBkaXIpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FyR3JhcGguZ29Ub05leHRCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoVXRpbHMuZ2V0UG9pbnRDb29yZChwb2ludCwgZGlyKSAhPT0gc3RvcGhlcmUsXG4gICAgICAgICdBckdyYXBoLmdvVG9OZXh0Qm94OiBVdGlscy5nZXRQb2ludENvb3JkIChwb2ludCwgZGlyKSAhPT0gc3RvcGhlcmUgRkFJTEVEJyk7XG5cbiAgICB2YXIgYm94YnkgPSBudWxsLFxuICAgICAgICBpdGVyID0gYm94TGlzdC5sZW5ndGgsXG4gICAgICAgIGJveFJlY3Q7XG5cbiAgICB3aGlsZSAoaXRlci0tKSB7XG4gICAgICAgIGJveFJlY3QgPSBib3hMaXN0W2l0ZXJdO1xuXG4gICAgICAgIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBib3hSZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcikpICYmXG4gICAgICAgICAgICBVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKHBvaW50LCBib3hSZWN0LCBkaXIpICYmXG4gICAgICAgICAgICBVdGlscy5pc0Nvb3JkSW5EaXJGcm9tKHN0b3BoZXJlLCBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcikpLCBkaXIpKSB7XG4gICAgICAgICAgICBzdG9waGVyZSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJveFJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyKSk7XG4gICAgICAgICAgICBib3hieSA9IGJveExpc3RbaXRlcl07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgcG9pbnQueCA9IHN0b3BoZXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvaW50LnkgPSBzdG9waGVyZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYm94Ynk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRMaW1pdHNPZkVkZ2UgPSBmdW5jdGlvbiAoc3RhcnRQdCwgZW5kUHQsIG1pbiwgbWF4KSB7XG4gICAgdmFyIHQsXG4gICAgICAgIHN0YXJ0ID0gKG5ldyBBclBvaW50KHN0YXJ0UHQpKSxcbiAgICAgICAgZW5kID0gKG5ldyBBclBvaW50KGVuZFB0KSksXG4gICAgICAgIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpLFxuICAgICAgICBpLFxuICAgICAgICByZWN0O1xuXG4gICAgaWYgKHN0YXJ0LnkgPT09IGVuZC55KSB7XG4gICAgICAgIGlmIChzdGFydC54ID4gZW5kLngpIHtcbiAgICAgICAgICAgIHQgPSBzdGFydC54O1xuICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgZW5kLnggPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgcmVjdCA9IHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0O1xuXG4gICAgICAgICAgICBpZiAoc3RhcnQueCA8IHJlY3QucmlnaHQgJiYgcmVjdC5sZWZ0IDw9IGVuZC54KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlY3QuZmxvb3IgPD0gc3RhcnQueSAmJiByZWN0LmZsb29yID4gbWluKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IHJlY3QuZmxvb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZWN0LmNlaWwgPiBzdGFydC55ICYmIHJlY3QuY2VpbCA8IG1heCkge1xuICAgICAgICAgICAgICAgICAgICBtYXggPSByZWN0LmNlaWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KHN0YXJ0LnggPT09IGVuZC54LCAnQVJHcmFwaC50aGlzLmdldExpbWl0c09mRWRnZTogc3RhcnQueCA9PT0gZW5kLnggRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKHN0YXJ0LnkgPiBlbmQueSkge1xuICAgICAgICAgICAgdCA9IHN0YXJ0Lnk7XG4gICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICBlbmQueSA9IHQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICByZWN0ID0gdGhpcy5ib3hlc1tpZHNbaV1dLnJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChzdGFydC55IDwgcmVjdC5mbG9vciAmJiByZWN0LmNlaWwgPD0gZW5kLnkpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVjdC5yaWdodCA8PSBzdGFydC54ICYmIHJlY3QucmlnaHQgPiBtaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgbWluID0gcmVjdC5yaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlY3QubGVmdCA+IHN0YXJ0LnggJiYgcmVjdC5sZWZ0IDwgbWF4KSB7XG4gICAgICAgICAgICAgICAgICAgIG1heCA9IHJlY3QubGVmdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtYXgtLTtcblxuICAgIHJldHVybiB7bWluOiBtaW4sIG1heDogbWF4fTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Nvbm5lY3QgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIHZhciBzdGFydHBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpLFxuICAgICAgICBlbmRwb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCksXG4gICAgICAgIHN0YXJ0cG9pbnQgPSBwYXRoLnN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZHBvaW50ID0gcGF0aC5lbmRwb2ludDtcblxuICAgIGFzc2VydChzdGFydHBvcnQuaGFzUG9pbnQoc3RhcnRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6IHN0YXJ0cG9ydC5oYXNQb2ludChzdGFydHBvaW50KSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZW5kcG9ydC5oYXNQb2ludChlbmRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6IGVuZHBvcnQuaGFzUG9pbnQoZW5kcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0Um9vdCA9IHN0YXJ0cG9ydC5vd25lci5nZXRSb290Qm94KCksXG4gICAgICAgIGVuZFJvb3QgPSBlbmRwb3J0Lm93bmVyLmdldFJvb3RCb3goKSxcbiAgICAgICAgc3RhcnRJZCA9IHN0YXJ0Um9vdC5pZCxcbiAgICAgICAgZW5kSWQgPSBlbmRSb290LmlkLFxuICAgICAgICBzdGFydGRpciA9IHN0YXJ0cG9ydC5wb3J0T25XaGljaEVkZ2Uoc3RhcnRwb2ludCksXG4gICAgICAgIGVuZGRpciA9IGVuZHBvcnQucG9ydE9uV2hpY2hFZGdlKGVuZHBvaW50KTtcblxuICAgIGlmIChzdGFydHBvaW50LmVxdWFscyhlbmRwb2ludCkpIHtcbiAgICAgICAgVXRpbHMuc3RlcE9uZUluRGlyKHN0YXJ0cG9pbnQsIFV0aWxzLm5leHRDbG9ja3dpc2VEaXIoc3RhcnRkaXIpKTtcbiAgICB9XG5cbiAgICBpZiAoIXBhdGguaXNBdXRvUm91dGVkKCkpIHtcbiAgICAgICAgcGF0aC5jcmVhdGVDdXN0b21QYXRoKCk7XG4gICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpICYmIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ib3gyYnVmZmVyQm94W3N0YXJ0SWRdID09PSB0aGlzLmJveDJidWZmZXJCb3hbZW5kSWRdICYmXG4gICAgICAgIHN0YXJ0ZGlyID09PSBVdGlscy5yZXZlcnNlRGlyKGVuZGRpcikgJiYgc3RhcnRSb290ICE9PSBlbmRSb290KSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvbm5lY3RQb2ludHNTaGFyaW5nUGFyZW50Qm94KHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50LCBzdGFydGRpcik7XG4gICAgfSBlbHNlIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5fY29ubmVjdFBhdGhXaXRoUG9pbnRzKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Nvbm5lY3RQYXRoV2l0aFBvaW50cyA9IGZ1bmN0aW9uIChwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCkge1xuICAgIGFzc2VydChzdGFydHBvaW50IGluc3RhbmNlb2YgQXJQb2ludCwgJ0FSR3JhcGguY29ubmVjdDogc3RhcnRwb2ludCBpbnN0YW5jZW9mIEFyUG9pbnQgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwgJiYgcGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguY29ubmVjdDogcGF0aCAhPT0gbnVsbCAmJiBwYXRoLm93bmVyID09PSBzZWxmIEZBSUxFRCcpO1xuICAgIGFzc2VydCghcGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5jb25uZWN0OiAhcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgIGFzc2VydCghc3RhcnRwb2ludC5lcXVhbHMoZW5kcG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiAhc3RhcnRwb2ludC5lcXVhbHMoZW5kcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0UG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCk7XG4gICAgYXNzZXJ0KHN0YXJ0UG9ydCAhPT0gbnVsbCwgJ0FSR3JhcGguY29ubmVjdDogc3RhcnRQb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0ZGlyID0gc3RhcnRQb3J0LnBvcnRPbldoaWNoRWRnZShzdGFydHBvaW50KSxcbiAgICAgICAgZW5kUG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpO1xuXG4gICAgYXNzZXJ0KGVuZFBvcnQgIT09IG51bGwsICdBUkdyYXBoLmNvbm5lY3Q6IGVuZFBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgdmFyIGVuZGRpciA9IGVuZFBvcnQucG9ydE9uV2hpY2hFZGdlKGVuZHBvaW50KTtcbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKHN0YXJ0ZGlyKSAmJiBVdGlscy5pc1JpZ2h0QW5nbGUoZW5kZGlyKSxcbiAgICAgICAgJ0FSR3JhcGguY29ubmVjdDogVXRpbHMuaXNSaWdodEFuZ2xlIChzdGFydGRpcikgJiYgVXRpbHMuaXNSaWdodEFuZ2xlIChlbmRkaXIpIEZBSUxFRCcpO1xuXG4gICAgLy9GaW5kIHRoZSBidWZmZXJib3ggY29udGFpbmluZyBzdGFydHBvaW50LCBlbmRwb2ludFxuICAgIHZhciBzdGFydCA9IG5ldyBBclBvaW50KHN0YXJ0cG9pbnQpO1xuICAgIHRoaXMuX2dldE91dE9mQm94KHtcbiAgICAgICAgcG9pbnQ6IHN0YXJ0LFxuICAgICAgICBkaXI6IHN0YXJ0ZGlyLFxuICAgICAgICBlbmQ6IGVuZHBvaW50LFxuICAgICAgICBib3g6IHN0YXJ0UG9ydC5vd25lclxuICAgIH0pO1xuICAgIGFzc2VydCghc3RhcnQuZXF1YWxzKHN0YXJ0cG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiAhc3RhcnQuZXF1YWxzKHN0YXJ0cG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGVuZCA9IG5ldyBBclBvaW50KGVuZHBvaW50KTtcbiAgICB0aGlzLl9nZXRPdXRPZkJveCh7XG4gICAgICAgIHBvaW50OiBlbmQsXG4gICAgICAgIGRpcjogZW5kZGlyLFxuICAgICAgICBlbmQ6IHN0YXJ0LFxuICAgICAgICBib3g6IGVuZFBvcnQub3duZXJcbiAgICB9KTtcbiAgICBhc3NlcnQoIWVuZC5lcXVhbHMoZW5kcG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiAhZW5kLmVxdWFscyhlbmRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgcG9pbnRzLFxuICAgICAgICBpc0F1dG9Sb3V0ZWQgPSBwYXRoLmlzQXV0b1JvdXRlZCgpO1xuICAgIGlmIChpc0F1dG9Sb3V0ZWQpIHtcbiAgICAgICAgcG9pbnRzID0gdGhpcy5fY29ubmVjdFBvaW50cyhzdGFydCwgZW5kLCBzdGFydGRpciwgZW5kZGlyKTtcbiAgICB9XG5cbiAgICBwYXRoLnBvaW50cyA9IHBvaW50cztcbiAgICBwYXRoLnBvaW50cy51bnNoaWZ0KHN0YXJ0cG9pbnQpO1xuICAgIHBhdGgucG9pbnRzLnB1c2goZW5kcG9pbnQpO1xuXG4gICAgaWYgKGlzQXV0b1JvdXRlZCkge1xuICAgICAgICB0aGlzLl9zaW1wbGlmeVBhdGhDdXJ2ZXMocGF0aCk7XG4gICAgICAgIHBhdGguc2ltcGxpZnlUcml2aWFsbHkoKTtcbiAgICAgICAgdGhpcy5fc2ltcGxpZnlQYXRoUG9pbnRzKHBhdGgpO1xuICAgICAgICB0aGlzLl9jZW50ZXJTdGFpcnNJblBhdGhQb2ludHMocGF0aCwgc3RhcnRkaXIsIGVuZGRpcik7XG4gICAgfVxuICAgIHBhdGguc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG5cbiAgICByZXR1cm4gdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyhwYXRoKSAmJiB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyhwYXRoKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Nvbm5lY3RQb2ludHNTaGFyaW5nUGFyZW50Qm94ID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50LCBzdGFydGRpcikge1xuICAgIC8vIENvbm5lY3QgcG9pbnRzIHRoYXQgc2hhcmUgYSBwYXJlbnQgYm94IGFuZCBmYWNlIGVhY2ggb3RoZXJcbiAgICAvLyBUaGVzZSB3aWxsIG5vdCBuZWVkIHRoZSBzaW1wbGlmaWNhdGlvbiBhbmQgY29tcGxpY2F0ZWQgcGF0aCBmaW5kaW5nXG4gICAgdmFyIHN0YXJ0ID0gbmV3IEFyUG9pbnQoc3RhcnRwb2ludCksXG4gICAgICAgIGR4ID0gZW5kcG9pbnQueCAtIHN0YXJ0LngsXG4gICAgICAgIGR5ID0gZW5kcG9pbnQueSAtIHN0YXJ0Lnk7XG5cbiAgICBwYXRoLmRlbGV0ZUFsbCgpO1xuXG4gICAgcGF0aC5hZGRUYWlsKHN0YXJ0cG9pbnQpO1xuICAgIGlmIChkeCAhPT0gMCAmJiBkeSAhPT0gMCkge1xuICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKHN0YXJ0ZGlyKSkge1xuICAgICAgICAgICAgc3RhcnQueCArPSBkeCAvIDI7XG4gICAgICAgICAgICBwYXRoLmFkZFRhaWwobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgICAgIHN0YXJ0LnkgKz0gZHk7XG4gICAgICAgICAgICBwYXRoLmFkZFRhaWwobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXJ0LnkgKz0gZHkgLyAyO1xuICAgICAgICAgICAgcGF0aC5hZGRUYWlsKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICBzdGFydC54ICs9IGR4O1xuICAgICAgICAgICAgcGF0aC5hZGRUYWlsKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcGF0aC5hZGRUYWlsKGVuZHBvaW50KTtcblxuICAgIHBhdGguc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG5cbiAgICByZXR1cm4gdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyhwYXRoKSAmJiB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyhwYXRoKTtcblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdFBvaW50cyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBoaW50c3RhcnRkaXIsIGhpbnRlbmRkaXIsIGZsaXBwZWQpIHtcbiAgICB2YXIgcmV0ID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpLFxuICAgICAgICB0aGVzdGFydCA9IG5ldyBBclBvaW50KHN0YXJ0KSxcbiAgICAgICAgYnVmZmVyT2JqZWN0LFxuICAgICAgICBib3gsXG4gICAgICAgIHJlY3QsXG4gICAgICAgIGRpcjEsXG4gICAgICAgIGRpcjIsXG4gICAgICAgIG9sZCxcbiAgICAgICAgb2xkRW5kLFxuICAgICAgICByZXQyLFxuICAgICAgICBwdHMsXG4gICAgICAgIHJldixcbiAgICAgICAgaSxcblxuICAgIC8vRXhpdCBjb25kaXRpb25zXG4gICAgLy9pZiB0aGVyZSBpcyBhIHN0cmFpZ2h0IGxpbmUgdG8gdGhlIGVuZCBwb2ludFxuICAgICAgICBmaW5kRXhpdFRvRW5kcG9pbnQgPSBmdW5jdGlvbiAocHQsIGJvKSB7XG4gICAgICAgICAgICByZXR1cm4gKHB0LnggPT09IGVuZC54IHx8IHB0LnkgPT09IGVuZC55KSAmJiAhVXRpbHMuaXNMaW5lQ2xpcFJlY3RzKHB0LCBlbmQsIGJvLmNoaWxkcmVuKTtcbiAgICAgICAgfSwgIC8vSWYgeW91IHBhc3MgdGhlIGVuZHBvaW50LCB5b3UgbmVlZCB0byBoYXZlIGEgd2F5IG91dC5cblxuICAgIC8vZXhpdENvbmRpdGlvbiBpcyB3aGVuIHlvdSBnZXQgdG8gdGhlIGRpcjEgc2lkZSBvZiB0aGUgYm94IG9yIHdoZW4geW91IHBhc3MgZW5kXG4gICAgICAgIGdldFRvRGlyMVNpZGUgPSBmdW5jdGlvbiAocHQsIGJvKSB7XG4gICAgICAgICAgICByZXR1cm4gVXRpbHMuZ2V0UG9pbnRDb29yZChwdCwgZGlyMSkgPT09IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJvLmJveCwgZGlyMSkgfHxcbiAgICAgICAgICAgICAgICAoIFV0aWxzLmlzUG9pbnRJbkRpckZyb20ocHQsIGVuZCwgZGlyMSkpO1xuICAgICAgICB9O1xuXG5cbiAgICAvL1RoaXMgaXMgd2hlcmUgd2UgY3JlYXRlIHRoZSBvcmlnaW5hbCBwYXRoIHRoYXQgd2Ugd2lsbCBsYXRlciBhZGp1c3RcbiAgICB3aGlsZSAoIXN0YXJ0LmVxdWFscyhlbmQpKSB7XG5cbiAgICAgICAgZGlyMSA9IFV0aWxzLmV4R2V0TWFqb3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSk7XG4gICAgICAgIGRpcjIgPSBVdGlscy5leEdldE1pbm9yRGlyKGVuZC5taW51cyhzdGFydCkpO1xuXG4gICAgICAgIGFzc2VydChkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMSAhPT0gQ09OU1RBTlRTLkRpck5vbmUgRkFJTEVEJyk7XG4gICAgICAgIGFzc2VydChkaXIxID09PSBVdGlscy5nZXRNYWpvckRpcihlbmQubWludXMoc3RhcnQpKSxcbiAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGRpcjEgPT09IFV0aWxzLmdldE1ham9yRGlyKGVuZC5taW51cyhzdGFydCkpIEZBSUxFRCcpO1xuICAgICAgICBhc3NlcnQoZGlyMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUgfHwgZGlyMiA9PT0gVXRpbHMuZ2V0TWlub3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSksXG4gICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fCAnICtcbiAgICAgICAgICAgICdkaXIyID09PSBVdGlscy5nZXRNaW5vckRpcihlbmQubWludXMoc3RhcnQpKSBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoZGlyMiA9PT0gaGludHN0YXJ0ZGlyICYmIGRpcjIgIT09IENPTlNUQU5UUy5EaXJOb25lKSB7XG4gICAgICAgICAgICAvLyBpLmUuIHN0ZDo6c3dhcChkaXIxLCBkaXIyKTtcbiAgICAgICAgICAgIGRpcjIgPSBkaXIxO1xuICAgICAgICAgICAgZGlyMSA9IGhpbnRzdGFydGRpcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG5cbiAgICAgICAgb2xkID0gbmV3IEFyUG9pbnQoc3RhcnQpO1xuXG4gICAgICAgIGJ1ZmZlck9iamVjdCA9IHRoaXMuX2dvVG9OZXh0QnVmZmVyQm94KHtcbiAgICAgICAgICAgIHBvaW50OiBzdGFydCxcbiAgICAgICAgICAgIGRpcjogZGlyMSxcbiAgICAgICAgICAgIGRpcjI6IGRpcjIsXG4gICAgICAgICAgICBlbmQ6IGVuZFxuICAgICAgICB9KTsgIC8vIE1vZGlmaWVkIGdvVG9OZXh0Qm94ICh0aGF0IGFsbG93cyBlbnRlcmluZyBwYXJlbnQgYnVmZmVyIGJveGVzIGhlcmVcbiAgICAgICAgYm94ID0gYnVmZmVyT2JqZWN0ID09PSBudWxsID8gbnVsbCA6IGJ1ZmZlck9iamVjdC5ib3g7XG5cbiAgICAgICAgLy9JZiBnb1RvTmV4dEJveCBkb2VzIG5vdCBtb2RpZnkgc3RhcnRcbiAgICAgICAgaWYgKHN0YXJ0LmVxdWFscyhvbGQpKSB7XG5cbiAgICAgICAgICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIHJlY3QgPSBib3ggaW5zdGFuY2VvZiBBclJlY3QgPyBib3ggOiBib3gucmVjdDtcblxuICAgICAgICAgICAgaWYgKGRpcjIgPT09IENPTlNUQU5UUy5EaXJOb25lKSB7XG4gICAgICAgICAgICAgICAgZGlyMiA9IFV0aWxzLm5leHRDbG9ja3dpc2VEaXIoZGlyMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydChkaXIxICE9PSBkaXIyICYmIGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lICYmIGRpcjIgIT09IENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGRpcjEgIT09IGRpcjIgJiYgZGlyMSAhPT0gQ09OU1RBTlRTLkRpck5vbmUgJiYgZGlyMiAhPT0gJyArXG4gICAgICAgICAgICAgICAgJ0NPTlNUQU5UUy5EaXJOb25lIEZBSUxFRCcpO1xuICAgICAgICAgICAgaWYgKGJ1ZmZlck9iamVjdC5ib3gucHRJblJlY3QoZW5kKSAmJiAhYnVmZmVyT2JqZWN0LmJveC5wdEluUmVjdChzdGFydCkgJiYgZmxpcHBlZCkge1xuICAgICAgICAgICAgICAgIC8vVW5mb3J0dW5hdGVseSwgaWYgcGFyZW50Ym94ZXMgYXJlIGEgcGl4ZWwgYXBhcnQsIHN0YXJ0L2VuZCBjYW4gZ2V0IHN0dWNrIGFuZCBub3QgY3Jvc3MgdGhlIGJvcmRlclxuICAgICAgICAgICAgICAgIC8vc2VwYXJhdGluZyB0aGVtLi4uLiBUaGlzIGlzIGEgbnVkZ2UgdG8gZ2V0IHRoZW0gdG8gY3Jvc3MgaXQuXG4gICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gZW5kLng7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYnVmZmVyT2JqZWN0LmJveC5wdEluUmVjdChlbmQpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmbGlwcGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQ291bGQgbm90IGZpbmQgcGF0aCBmcm9tJyxzdGFydCwndG8nLCBlbmQsJy4gRmxpcHBpbmcgc3RhcnQgYW5kIGVuZCBwb2ludHMnKTtcbiAgICAgICAgICAgICAgICAgICAgb2xkRW5kID0gbmV3IEFyUG9pbnQoZW5kKTtcblxuICAgICAgICAgICAgICAgICAgICByZXQyID0gdGhpcy5fY29ubmVjdFBvaW50cyhlbmQsIHN0YXJ0LCBoaW50ZW5kZGlyLCBkaXIxLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgaSA9IHJldDIubGVuZ3RoIC0gMTtcblxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaS0tID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2gocmV0MltpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoc3RhcnQuZXF1YWxzKGVuZCksICdBckdyYXBoLmNvbm5lY3RQb2ludHM6IHN0YXJ0LmVxdWFscyhlbmQpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICBvbGQgPSBDT05TVEFOVFMuRU1QVFlfUE9JTlQ7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0ID0gZW5kID0gb2xkRW5kO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7ICAvL0lmIHdlIGhhdmUgZmxpcHBlZCBhbmQgYm90aCBwb2ludHMgYXJlIGluIHRoZSBzYW1lIGJ1ZmZlcmJveFxuICAgICAgICAgICAgICAgICAgICAvLyBXZSB3aWxsIGh1Z2NoaWxkcmVuIHVudGlsIHdlIGNhbiBjb25uZWN0IGJvdGggcG9pbnRzLlxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB3ZSBjYW4ndCwgZm9yY2UgaXRcbiAgICAgICAgICAgICAgICAgICAgcHRzID0gdGhpcy5faHVnQ2hpbGRyZW4oYnVmZmVyT2JqZWN0LCBzdGFydCwgZGlyMSwgZGlyMiwgZmluZEV4aXRUb0VuZHBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHB0cyAhPT0gbnVsbCkgeyAgLy8gVGhlcmUgaXMgYSBwYXRoIGZyb20gc3RhcnQgLT4gZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHRzLmxlbmd0aCkgeyAgLy8gQWRkIG5ldyBwb2ludHMgdG8gdGhlIGN1cnJlbnQgbGlzdCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KHB0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQuYXNzaWduKGVuZCk7ICAvLyBUaGVzZSBzaG91bGQgbm90IGJlIHNrZXchIEZJWE1FXG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9Gb3JjZSB0byB0aGUgZW5kcG9pbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMSksICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyMSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gZW5kLng7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBlbmQueTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gZW5kLng7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBlbmQueTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHN0YXJ0LmVxdWFscyhlbmQpKTsgIC8vIFdlIGFyZSBmb3JjaW5nIG91dCBzbyB0aGVzZSBzaG91bGQgYmUgdGhlIHNhbWUgbm93XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhvbGQpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKFV0aWxzLmlzUG9pbnRJbkRpckZyb20oZW5kLCByZWN0LCBkaXIyKSkge1xuXG4gICAgICAgICAgICAgICAgYXNzZXJ0KCFVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCByZWN0LCBkaXIyKSxcbiAgICAgICAgICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogIVV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIGJveCA9IHRoaXMuX2dvVG9OZXh0QnVmZmVyQm94KHtcbiAgICAgICAgICAgICAgICAgICAgcG9pbnQ6IHN0YXJ0LFxuICAgICAgICAgICAgICAgICAgICBkaXI6IGRpcjIsXG4gICAgICAgICAgICAgICAgICAgIGRpcjI6IGRpcjEsXG4gICAgICAgICAgICAgICAgICAgIGVuZDogZW5kXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyB0aGlzIGFzc2VydCBmYWlscyBpZiB0d28gYm94ZXMgYXJlIGFkamFjZW50LCBhbmQgYSBjb25uZWN0aW9uIHdhbnRzIHRvIGdvIGJldHdlZW5cbiAgICAgICAgICAgICAgICAvL2Fzc2VydChVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCByZWN0LCBkaXIyKSxcbiAgICAgICAgICAgICAgICAvLyAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCByZWN0LCBkaXIyKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIG5vdCB0aGUgYmVzdCBjaGVjayB3aXRoIHBhcmVudCBib3hlc1xuICAgICAgICAgICAgICAgIGlmIChzdGFydC5lcXVhbHMob2xkKSkgeyAvL1RoZW4gd2UgYXJlIGluIGEgY29ybmVyXG4gICAgICAgICAgICAgICAgICAgIGlmIChib3guY2hpbGRyZW4ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHRzID0gdGhpcy5faHVnQ2hpbGRyZW4oYm94LCBzdGFydCwgZGlyMiwgZGlyMSwgZ2V0VG9EaXIxU2lkZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihidWZmZXJPYmplY3QsIHN0YXJ0LCBkaXIxLCBkaXIyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocHRzICE9PSBudWxsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQWRkIG5ldyBwb2ludHMgdG8gdGhlIGN1cnJlbnQgbGlzdCBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldCA9IHJldC5jb25jYXQocHRzKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL0dvIHRocm91Z2ggdGhlIGJsb2NraW5nIGJveFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIxKSwgJ0FSR3JhcGguZ2V0T3V0T2ZCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyMSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMoZW5kLCByZWN0LCBkaXIxKSxcbiAgICAgICAgICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhlbmQsIHJlY3QsIGRpcjEpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIGFzc2VydCghVXRpbHMuaXNQb2ludEluKGVuZCwgcmVjdCksICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6ICFVdGlscy5pc1BvaW50SW4oZW5kLCByZWN0KSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIHJldiA9IDA7XG5cbiAgICAgICAgICAgICAgICBpZiAoVXRpbHMucmV2ZXJzZURpcihkaXIyKSA9PT0gaGludGVuZGRpciAmJlxuICAgICAgICAgICAgICAgICAgICBVdGlscy5nZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbShidWZmZXJPYmplY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyMiksIHN0YXJ0KSA9PT1cbiAgICAgICAgICAgICAgICAgICAgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIyKSkpIHsgLy9BbmQgaWYgcG9pbnQgY2FuIGV4aXQgdGhhdCB3YXlcbiAgICAgICAgICAgICAgICAgICAgcmV2ID0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRpcjIgIT09IGhpbnRlbmRkaXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXModGhlc3RhcnQsIHJlY3QsIGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShyZWN0LmdldFRvcExlZnQoKS5wbHVzKHJlY3QuZ2V0Qm90dG9tUmlnaHQoKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnBsdXMoZW5kKSwgZGlyMikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXYgPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKFV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHRoZXN0YXJ0LCBkaXIyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV2ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChyZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlyMiA9IFV0aWxzLnJldmVyc2VEaXIoZGlyMik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy9JZiB0aGUgYm94IGluIHRoZSB3YXkgaGFzIG9uZSBjaGlsZFxuICAgICAgICAgICAgICAgIGlmIChidWZmZXJPYmplY3QuY2hpbGRyZW4ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBkaXIyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBkaXIyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCghc3RhcnQuZXF1YWxzKG9sZCksICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6ICFzdGFydC5lcXVhbHMob2xkKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgICAgICAgICAgICAgb2xkLmFzc2lnbihzdGFydCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUG9pbnRJbkRpckZyb20oZW5kLCBzdGFydCwgZGlyMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBVdGlscy5pc1BvaW50SW5EaXJGcm9tKGVuZCwgc3RhcnQsIGRpcjEpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuZ2V0UG9pbnRDb29yZChzdGFydCwgZGlyMSkgIT09IFV0aWxzLmdldFBvaW50Q29vcmQoZW5kLCBkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ29Ub05leHRCdWZmZXJCb3goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50OiBzdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXI6IGRpcjEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL0lmIHRoZSBib3ggaGFzIG11bHRpcGxlIGNoaWxkcmVuXG4gICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJ1ZmZlck9iamVjdCwgc3RhcnQsIGRpcjEsIGRpcjIsIGdldFRvRGlyMVNpZGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHRzICE9PSBudWxsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQWRkIG5ldyBwb2ludHMgdG8gdGhlIGN1cnJlbnQgbGlzdCBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldCA9IHJldC5jb25jYXQocHRzKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL0dvIHRocm91Z2ggdGhlIGJsb2NraW5nIGJveFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIxKSwgJ0FSR3JhcGguZ2V0T3V0T2ZCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyMSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMob2xkKSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogIXN0YXJ0LmVxdWFscyhvbGQpIEZBSUxFRCcpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICByZXQucHVzaChlbmQpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICByZXQuYXNzZXJ0VmFsaWQoKTsgIC8vIENoZWNrIHRoYXQgYWxsIGVkZ2VzIGFyZSBob3Jpem9udGFsIGFyZSB2ZXJ0aWNhbFxuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0QWxsID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmRpc2Nvbm5lY3QodGhpcy5wYXRoc1tpXSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBpZiAocGF0aC5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgIHRoaXMuZGVsZXRlRWRnZXMocGF0aCk7XG4gICAgfVxuXG4gICAgcGF0aC5kZWxldGVBbGwoKTtcbiAgICB0aGlzLmNvbXBsZXRlbHlDb25uZWN0ZWQgPSBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKHRoaXMucGF0aHNbaV0uaXNQYXRoQ2xpcChyZWN0KSkge1xuICAgICAgICAgICAgdGhpcy5kaXNjb25uZWN0KHRoaXMucGF0aHNbaV0pO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGlzY29ubmVjdFBhdGhzRnJvbSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgaXRlciA9IHRoaXMucGF0aHMubGVuZ3RoLFxuICAgICAgICBwYXRoLFxuICAgICAgICBzdGFydHBvcnQsXG4gICAgICAgIGVuZHBvcnQ7XG5cbiAgICBpZiAob2JqIGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCkge1xuICAgICAgICB2YXIgYm94ID0gb2JqLFxuICAgICAgICAgICAgc3RhcnRib3gsXG4gICAgICAgICAgICBlbmRib3g7XG4gICAgICAgIHdoaWxlIChpdGVyLS0pIHtcbiAgICAgICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2l0ZXJdO1xuXG4gICAgICAgICAgICBhc3NlcnQocGF0aC5zdGFydHBvcnRzICE9PSBudWxsLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBzdGFydHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBhc3NlcnQocGF0aC5zdGFydHBvcnRzLmxlbmd0aCA+IDAsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IFBhdGggaGFzIG5vIHN0YXJ0cG9ydHMnKTtcbiAgICAgICAgICAgIGFzc2VydChwYXRoLmVuZHBvcnRzICE9PSBudWxsLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBlbmRwb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGguZW5kcG9ydHMubGVuZ3RoID4gMCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogUGF0aCBoYXMgbm8gZW5kcG9ydHMnKTtcblxuICAgICAgICAgICAgLy8gQ2FuIHNpbXBseSBzZWxlY3QgYW55IHN0YXJ0L2VuZCBwb3J0IHRvIGNoZWNrIHRoZSBvd25lclxuICAgICAgICAgICAgc3RhcnRib3ggPSBwYXRoLnN0YXJ0cG9ydHNbMF0ub3duZXI7XG4gICAgICAgICAgICBlbmRib3ggPSBwYXRoLmVuZHBvcnRzWzBdLm93bmVyO1xuXG4gICAgICAgICAgICBhc3NlcnQoc3RhcnRib3ggIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IHN0YXJ0Ym94ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgYXNzZXJ0KGVuZGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogZW5kYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBpZiAoKHN0YXJ0Ym94ID09PSBib3ggfHwgZW5kYm94ID09PSBib3gpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNjb25uZWN0KHBhdGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9IGVsc2UgeyAgLy8gQXNzdW1pbmcgJ2JveCcgaXMgYSBwb3J0XG5cbiAgICAgICAgdmFyIHBvcnQgPSBvYmo7XG4gICAgICAgIHdoaWxlIChpdGVyLS0pIHtcbiAgICAgICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2l0ZXJdO1xuICAgICAgICAgICAgc3RhcnRwb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKTtcbiAgICAgICAgICAgIGVuZHBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKTtcblxuICAgICAgICAgICAgaWYgKChzdGFydHBvcnQgPT09IHBvcnQgfHwgZW5kcG9ydCA9PT0gcG9ydCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QocGF0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZFNlbGZFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmhvcml6b250YWwuYWRkRWRnZXModGhpcyk7XG4gICAgdGhpcy52ZXJ0aWNhbC5hZGRFZGdlcyh0aGlzKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZEVkZ2VzID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGFzc2VydCghKG9iaiBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJQYXRoKSwgJ05vIFBhdGhzIHNob3VsZCBiZSBoZXJlIScpO1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBBdXRvUm91dGVyUG9ydCkge1xuICAgICAgICB0aGlzLmhvcml6b250YWwuYWRkUG9ydEVkZ2VzKG9iaik7XG4gICAgICAgIHRoaXMudmVydGljYWwuYWRkUG9ydEVkZ2VzKG9iaik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ob3Jpem9udGFsLmFkZEVkZ2VzKG9iaik7XG4gICAgICAgIHRoaXMudmVydGljYWwuYWRkRWRnZXMob2JqKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlbGV0ZUVkZ2VzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5kZWxldGVFZGdlcyhvYmplY3QpO1xuICAgIHRoaXMudmVydGljYWwuZGVsZXRlRWRnZXMob2JqZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZEFsbEVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLmhvcml6b250YWwuaXNFbXB0eSgpICYmIHRoaXMudmVydGljYWwuaXNFbXB0eSgpLFxuICAgICAgICAnQVJHcmFwaC5hZGRBbGxFZGdlczogaG9yaXpvbnRhbC5pc0VtcHR5KCkgJiYgdmVydGljYWwuaXNFbXB0eSgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpLFxuICAgICAgICBpO1xuXG4gICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXModGhpcy5ib3hlc1tpZHNbaV1dKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHRoaXMucGF0aHNbaV0pO1xuICAgICAgICB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyh0aGlzLnBhdGhzW2ldKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVBbGxFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmhvcml6b250YWwuZGVsZXRlQWxsRWRnZXMoKTtcbiAgICB0aGlzLnZlcnRpY2FsLmRlbGV0ZUFsbEVkZ2VzKCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRCb3hBbmRQb3J0RWRnZXMgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguYWRkQm94QW5kUG9ydEVkZ2VzOiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLl9hZGRFZGdlcyhib3gpO1xuXG4gICAgZm9yICh2YXIgaSA9IGJveC5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fYWRkRWRnZXMoYm94LnBvcnRzW2ldKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdG8gYnVmZmVyYm94ZXNcbiAgICB0aGlzLl9hZGRUb0J1ZmZlckJveGVzKGJveCk7XG4gICAgdGhpcy5fdXBkYXRlQm94UG9ydEF2YWlsYWJpbGl0eShib3gpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZUJveEFuZFBvcnRFZGdlczogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdGhpcy5kZWxldGVFZGdlcyhib3gpO1xuXG4gICAgZm9yICh2YXIgaSA9IGJveC5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5kZWxldGVFZGdlcyhib3gucG9ydHNbaV0pO1xuICAgIH1cblxuICAgIHRoaXMuX3JlbW92ZUZyb21CdWZmZXJCb3hlcyhib3gpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0RWRnZUxpc3QgPSBmdW5jdGlvbiAoaXNob3Jpem9udGFsKSB7XG4gICAgcmV0dXJuIGlzaG9yaXpvbnRhbCA/IHRoaXMuaG9yaXpvbnRhbCA6IHRoaXMudmVydGljYWw7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jYW5kZWxldGVUd29FZGdlc0F0ID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cywgcG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgICAgICBhc3NlcnQocGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgICAgIHBvaW50cy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIGlmIChwb3MgKyAyID49IHBvaW50cy5sZW5ndGggfHwgcG9zIDwgMSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5wb2ludHBvcyA9IHBvcztcblxuICAgIHBvcyA9IHBvaW50cG9zO1xuICAgIHBvcy0tO1xuICAgIHZhciBwcG9pbnRwb3MgPSBwb3M7XG5cbiAgICB2YXIgcHBvaW50ID0gcG9pbnRzW3Bvcy0tXSxcbiAgICAgICAgcHBwb2ludHBvcyA9IHBvcztcblxuICAgIGlmIChucG9pbnQuZXF1YWxzKHBvaW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGRpcmVjdGlvbiBvZiB6ZXJvLWxlbmd0aCBlZGdlcyBjYW4ndCBiZSBkZXRlcm1pbmVkLCBzbyBkb24ndCBkZWxldGUgdGhlbVxuICAgIH1cblxuICAgIGFzc2VydChwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJlxuICAgICAgICBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoLFxuICAgICAgICAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmJyArXG4gICAgICAgICdwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHZhciBkaXIgPSBVdGlscy5nZXREaXIobnBvaW50Lm1pbnVzKHBvaW50KSk7XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcbiAgICB2YXIgaXNob3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKGRpcik7XG5cbiAgICB2YXIgbmV3cG9pbnQgPSBuZXcgQXJQb2ludCgpO1xuXG4gICAgaWYgKGlzaG9yaXpvbnRhbCkge1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHBwb2ludCwgIWlzaG9yaXpvbnRhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5nZXREaXIobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpcixcbiAgICAgICAgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuZ2V0RGlyIChuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgbnBvaW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIHBwb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlVHdvRWRnZXNBdCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMsIHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICAgICAgYXNzZXJ0KHBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgICAgICBwb2ludHMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICB2YXIgcG9pbnRwb3MgPSBwb3MsIC8vR2V0dGluZyB0aGUgbmV4dCwgYW5kIG5leHQtbmV4dCwgcG9pbnRzXG4gICAgICAgIHBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbnBvaW50cG9zID0gcG9zLFxuICAgICAgICBucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubnBvaW50cG9zID0gcG9zLFxuICAgICAgICBubnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5ucG9pbnRwb3MgPSBwb3M7XG5cbiAgICBwb3MgPSBwb2ludHBvcztcbiAgICBwb3MtLTtcblxuICAgIHZhciBwcG9pbnRwb3MgPSBwb3MsIC8vR2V0dGluZyB0aGUgcHJldiwgcHJldi1wcmV2IHBvaW50c1xuICAgICAgICBwcG9pbnQgPSBwb2ludHNbcG9zLS1dLFxuICAgICAgICBwcHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwcHBvaW50ID0gcG9pbnRzW3Bvcy0tXTtcblxuICAgIGFzc2VydChwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJlxuICAgIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcG9pbnRwb3MgPCAnICtcbiAgICAgICAgJ3BvaW50cy5sZW5ndGggJiYgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICBhc3NlcnQocHBwb2ludCAhPT0gbnVsbCAmJiBwcG9pbnQgIT09IG51bGwgJiYgcG9pbnQgIT09IG51bGwgJiYgbnBvaW50ICE9PSBudWxsICYmIG5ucG9pbnQgIT09IG51bGwsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBwcG9pbnQgIT09IG51bGwgJiYgcHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJicgK1xuICAgICAgICAnIG5ucG9pbnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZGlyID0gVXRpbHMuZ2V0RGlyKG5wb2ludC5taW51cyhwb2ludCkpO1xuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgdmFyIGlzaG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpO1xuXG4gICAgdmFyIG5ld3BvaW50ID0gbmV3IEFyUG9pbnQoKTtcbiAgICBpZiAoaXNob3Jpem9udGFsKSB7XG4gICAgICAgIG5ld3BvaW50LnggPSBVdGlscy5nZXRQb2ludENvb3JkKG5wb2ludCwgaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KFV0aWxzLmdldERpcihuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5nZXREaXIgKG5ld3BvaW50Lm1pbnVzKHBwb2ludCkpID09PSBkaXIgRkFJTEVEJyk7XG5cbiAgICBhc3NlcnQoIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgbnBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogIWlzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgbnBvaW50KSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgcHBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogIWlzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgcHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBobGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGlzaG9yaXpvbnRhbCksXG4gICAgICAgIHZsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoIWlzaG9yaXpvbnRhbCk7XG5cbiAgICB2YXIgcHBlZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwcHBvaW50KSxcbiAgICAgICAgcGVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwb2ludCksXG4gICAgICAgIG5lZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludCksXG4gICAgICAgIG5uZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIobnBvaW50KTtcblxuICAgIGFzc2VydChwcGVkZ2UgIT09IG51bGwgJiYgcGVkZ2UgIT09IG51bGwgJiYgbmVkZ2UgIT09IG51bGwgJiYgbm5lZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiAgcHBlZGdlICE9PSBudWxsICYmIHBlZGdlICE9PSBudWxsICYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZsaXN0LnJlbW92ZShwZWRnZSk7XG4gICAgaGxpc3QucmVtb3ZlKG5lZGdlKTtcblxuICAgIHBvaW50cy5zcGxpY2UocHBvaW50cG9zLCAzLCBuZXdwb2ludCk7XG4gICAgcHBlZGdlLmVuZHBvaW50TmV4dCA9IG5ucG9pbnQ7XG4gICAgcHBlZGdlLmVuZHBvaW50ID0gbmV3cG9pbnQ7XG5cbiAgICBubmVkZ2Uuc3RhcnRwb2ludCA9IG5ld3BvaW50O1xuICAgIG5uZWRnZS5zdGFydHBvaW50UHJldiA9IHBwcG9pbnQ7XG5cbiAgICBpZiAobm5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBubm5lZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihubnBvaW50LCAobm5ucG9pbnRwb3MpKTtcbiAgICAgICAgYXNzZXJ0KG5ubmVkZ2UgIT09IG51bGwsXG4gICAgICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBubm5lZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICBhc3NlcnQobm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KSAmJiBubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogbm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KScgK1xuICAgICAgICAgICAgJyYmIG5ubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobm5wb2ludCkgRkFJTEVEJyk7XG4gICAgICAgIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcG9pbnQ7XG4gICAgfVxuXG4gICAgaWYgKG5ucG9pbnQuZXF1YWxzKG5ld3BvaW50KSkge1xuICAgICAgICB0aGlzLl9kZWxldGVTYW1lUG9pbnRzQXQocGF0aCwgcG9pbnRzLCBwcG9pbnRwb3MpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlU2FtZVBvaW50c0F0ID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cywgcG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIGFzc2VydChwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgICAgICBwb2ludHMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICB2YXIgcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbnBvaW50cG9zID0gcG9zLFxuICAgICAgICBucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubnBvaW50cG9zID0gcG9zLFxuICAgICAgICBubnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5ucG9pbnRwb3MgPSBwb3M7XG5cbiAgICBwb3MgPSBwb2ludHBvcztcbiAgICBwb3MtLTtcblxuICAgIHZhciBwcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBwb2ludCA9IHBvaW50c1twb3MtLV0sXG4gICAgICAgIHBwcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBwcG9pbnQgPSBwb3MgPT09IHBvaW50cy5sZW5ndGggPyBudWxsIDogcG9pbnRzW3Bvcy0tXTtcblxuICAgIGFzc2VydChwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmXG4gICAgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpO1xuICAgIGFzc2VydChwcG9pbnQgIT09IG51bGwgJiYgcG9pbnQgIT09IG51bGwgJiYgbnBvaW50ICE9PSBudWxsICYmIG5ucG9pbnQgIT09IG51bGwsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJiAnICtcbiAgICAgICAgJ25ucG9pbnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHBvaW50LmVxdWFscyhucG9pbnQpICYmICFwb2ludC5lcXVhbHMocHBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwb2ludC5lcXVhbHMobnBvaW50KSAmJiAhcG9pbnQuZXF1YWxzKHBwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgZGlyID0gVXRpbHMuZ2V0RGlyKHBvaW50Lm1pbnVzKHBwb2ludCkpO1xuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG5cbiAgICB2YXIgaXNob3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKGRpciksXG4gICAgICAgIGhsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoaXNob3Jpem9udGFsKSxcbiAgICAgICAgdmxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdCghaXNob3Jpem9udGFsKSxcblxuICAgICAgICBwZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBvaW50LCBwb2ludCksXG4gICAgICAgIG5lZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludCwgbnBvaW50KSxcbiAgICAgICAgbm5lZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihucG9pbnQsIG5ucG9pbnQpO1xuXG4gICAgYXNzZXJ0KHBlZGdlICE9PSBudWxsICYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwZWRnZSAhPT0gbnVsbCAnICtcbiAgICAnJiYgbmVkZ2UgIT09IG51bGwgJiYgbm5lZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmxpc3QucmVtb3ZlKHBlZGdlKTtcbiAgICBobGlzdC5yZW1vdmUobmVkZ2UpO1xuXG4gICAgcG9pbnRzLnNwbGljZShwb2ludHBvcywgMik7XG5cbiAgICBpZiAocHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHBwZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBwb2ludCwgcHBvaW50KTtcbiAgICAgICAgYXNzZXJ0KHBwZWRnZSAhPT0gbnVsbCAmJiBwcGVkZ2UuZW5kcG9pbnQuZXF1YWxzKHBwb2ludCkgJiYgcHBlZGdlLmVuZHBvaW50TmV4dC5lcXVhbHMocG9pbnQpLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwcGVkZ2UgIT09IG51bGwgJiYgcHBlZGdlLmVuZHBvaW50LmVxdWFscyhwcG9pbnQpICYmICcgK1xuICAgICAgICAgICAgJ3BwZWRnZS5lbmRwb2ludE5leHQuZXF1YWxzKHBvaW50KSBGQUlMRUQnKTtcbiAgICAgICAgcHBlZGdlLmVuZHBvaW50TmV4dCA9IG5ucG9pbnQ7XG4gICAgfVxuXG4gICAgYXNzZXJ0KG5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhucG9pbnQpICYmIG5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMocG9pbnQpLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IG5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhucG9pbnQpICYmIG5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMocG9pbnQpJyArXG4gICAgICAgICcgRkFJTEVEJyk7XG4gICAgbm5lZGdlLnNldFN0YXJ0UG9pbnQocHBvaW50KTtcbiAgICBubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcHBvaW50O1xuXG4gICAgaWYgKG5ubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgbm5uZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIobm5wb2ludCwgKG5ubnBvaW50cG9zKSk7IC8vJipcbiAgICAgICAgYXNzZXJ0KG5ubmVkZ2UgIT09IG51bGwgJiYgbm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KSAmJiBubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBubm5lZGdlICE9PSBudWxsICYmIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCkgJiYgJyArXG4gICAgICAgICAgICAnbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSBGQUlMRUQnKTtcbiAgICAgICAgbm5uZWRnZS5zdGFydHBvaW50UHJldiA9IHBwb2ludDtcbiAgICB9XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHX0RFRVApIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3NpbXBsaWZ5UGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2UsXG4gICAgICAgIHBhdGgsXG4gICAgICAgIHBvaW50TGlzdCxcbiAgICAgICAgcG9pbnRwb3M7XG5cbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaV07XG5cbiAgICAgICAgaWYgKHBhdGguaXNBdXRvUm91dGVkKCkpIHtcbiAgICAgICAgICAgIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCk7XG4gICAgICAgICAgICBwb2ludHBvcyA9IDA7XG5cbiAgICAgICAgICAgIG1vZGlmaWVkID0gdGhpcy5fZml4U2hvcnRQYXRocyhwYXRoKSB8fCBtb2RpZmllZDtcblxuICAgICAgICAgICAgd2hpbGUgKHBvaW50cG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYW5kZWxldGVUd29FZGdlc0F0KHBhdGgsIHBvaW50TGlzdCwgcG9pbnRwb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RlbGV0ZVR3b0VkZ2VzQXQocGF0aCwgcG9pbnRMaXN0LCBwb2ludHBvcyk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBvaW50cG9zKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jZW50ZXJTdGFpcnNJblBhdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aCwgaGludHN0YXJ0ZGlyLCBoaW50ZW5kZGlyKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiAhcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCk7XG4gICAgYXNzZXJ0KHBvaW50TGlzdC5sZW5ndGggPj0gMiwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiBwb2ludExpc3QubGVuZ3RoID49IDIgRkFJTEVEJyk7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWRQb2ludHMoKTtcbiAgICB9XG5cbiAgICB2YXIgcDEsXG4gICAgICAgIHAyLFxuICAgICAgICBwMyxcbiAgICAgICAgcDQsXG5cbiAgICAgICAgcDFwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDJwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDNwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDRwID0gcG9pbnRMaXN0Lmxlbmd0aCxcblxuICAgICAgICBkMTIgPSBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgZDIzID0gQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIGQzNCA9IENPTlNUQU5UUy5EaXJOb25lLFxuXG4gICAgICAgIG91dE9mQm94U3RhcnRQb2ludCA9IHBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50KGhpbnRzdGFydGRpciksXG4gICAgICAgIG91dE9mQm94RW5kUG9pbnQgPSBwYXRoLmdldE91dE9mQm94RW5kUG9pbnQoaGludGVuZGRpciksXG5cbiAgICAgICAgcG9zID0gMDtcbiAgICBhc3NlcnQocG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzIHBvcyA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBwMXAgPSBwb3M7XG4gICAgcDEgPSAocG9pbnRMaXN0W3BvcysrXSk7XG5cbiAgICB2YXIgbnAyLFxuICAgICAgICBucDMsXG4gICAgICAgIGgsXG4gICAgICAgIHA0eCxcbiAgICAgICAgcDN4LFxuICAgICAgICBwMXgsXG4gICAgICAgIHRtcCxcbiAgICAgICAgdCxcbiAgICAgICAgbTtcblxuXG4gICAgd2hpbGUgKHBvcyA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgcDRwID0gcDNwO1xuICAgICAgICBwM3AgPSBwMnA7XG4gICAgICAgIHAycCA9IHAxcDtcbiAgICAgICAgcDFwID0gcG9zO1xuXG4gICAgICAgIHA0ID0gcDM7XG4gICAgICAgIHAzID0gcDI7XG4gICAgICAgIHAyID0gcDE7XG4gICAgICAgIHAxID0gKHBvaW50TGlzdFtwb3MrK10pO1xuXG4gICAgICAgIGQzNCA9IGQyMztcbiAgICAgICAgZDIzID0gZDEyO1xuXG4gICAgICAgIGlmIChwMnAgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICBkMTIgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKTtcbiAgICAgICAgICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQxMiksICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogJyArXG4gICAgICAgICAgICAgICAgJ1V0aWxzLmlzUmlnaHRBbmdsZSAoZDEyKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBpZiAocDNwICE9PSBwb2ludExpc3QuZW5kKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmFyZUluUmlnaHRBbmdsZShkMTIsIGQyMyksICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogJyArXG4gICAgICAgICAgICAgICAgICAgICdVdGlscy5hcmVJblJpZ2h0QW5nbGUgKGQxMiwgZDIzKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBkMTIgPT09IGQzNCkge1xuICAgICAgICAgICAgYXNzZXJ0KHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwM3AgPCBwb2ludExpc3QubGVuZ3RoICYmXG4gICAgICAgICAgICBwNHAgPCBwb2ludExpc3QubGVuZ3RoLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6IHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgJyArXG4gICAgICAgICAgICAncDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwM3AgPCBwb2ludExpc3QubGVuZ3RoICYmIHA0cCA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIG5wMiA9IG5ldyBBclBvaW50KHAyKTtcbiAgICAgICAgICAgIG5wMyA9IG5ldyBBclBvaW50KHAzKTtcbiAgICAgICAgICAgIGggPSBVdGlscy5pc0hvcml6b250YWwoZDEyKTtcblxuICAgICAgICAgICAgcDR4ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwNCwgaCk7XG4gICAgICAgICAgICBwM3ggPSBVdGlscy5nZXRQb2ludENvb3JkKHAzLCBoKTtcbiAgICAgICAgICAgIHAxeCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDEsIGgpO1xuXG4gICAgICAgICAgICAvLyBwMXggd2lsbCByZXByZXNlbnQgdGhlIGxhcmdlciB4IHZhbHVlIGluIHRoaXMgJ3N0ZXAnIHNpdHVhdGlvblxuICAgICAgICAgICAgaWYgKHAxeCA8IHA0eCkge1xuICAgICAgICAgICAgICAgIHQgPSBwMXg7XG4gICAgICAgICAgICAgICAgcDF4ID0gcDR4O1xuICAgICAgICAgICAgICAgIHA0eCA9IHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwNHggPCBwM3ggJiYgcDN4IDwgcDF4KSB7XG4gICAgICAgICAgICAgICAgbSA9IE1hdGgucm91bmQoKHA0eCArIHAxeCkgLyAyKTtcbiAgICAgICAgICAgICAgICBpZiAoaCkge1xuICAgICAgICAgICAgICAgICAgICBucDIueCA9IG07XG4gICAgICAgICAgICAgICAgICAgIG5wMy54ID0gbTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBucDIueSA9IG07XG4gICAgICAgICAgICAgICAgICAgIG5wMy55ID0gbTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0bXAgPSB0aGlzLl9nZXRMaW1pdHNPZkVkZ2UobnAyLCBucDMsIHA0eCwgcDF4KTtcbiAgICAgICAgICAgICAgICBwNHggPSB0bXAubWluO1xuICAgICAgICAgICAgICAgIHAxeCA9IHRtcC5tYXg7XG5cbiAgICAgICAgICAgICAgICBtID0gTWF0aC5yb3VuZCgocDR4ICsgcDF4KSAvIDIpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnggPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueCA9IG07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnkgPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueSA9IG07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobnAyLCBucDMpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDFwID09PSBwb2ludExpc3QubGVuZ3RoID9cbiAgICAgICAgICAgICAgICAgICAgICAgIG91dE9mQm94RW5kUG9pbnQgOiBwMSwgbnAyKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHA0cCA9PT0gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRPZkJveFN0YXJ0UG9pbnQgOiBwNCwgbnAzKSkge1xuICAgICAgICAgICAgICAgICAgICBwMiA9IG5wMjtcbiAgICAgICAgICAgICAgICAgICAgcDMgPSBucDM7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDJwLCAxLCBwMik7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDNwLCAxLCBwMyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBNYWtlIHN1cmUgaWYgYSBzdHJhaWdodCBsaW5lIGlzIHBvc3NpYmxlLCBjcmVhdGUgYSBzdHJhaWdodCBsaW5lIGZvclxuICogdGhlIHBhdGguXG4gKlxuICogQHBhcmFtIHtBdXRvUm91dGVyUGF0aH0gcGF0aFxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9maXhTaG9ydFBhdGhzID0gZnVuY3Rpb24gKHBhdGgpIHtcblxuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlLFxuICAgICAgICBzdGFydHBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpLFxuICAgICAgICBlbmRwb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCksXG4gICAgICAgIGxlbiA9IHBhdGguZ2V0UG9pbnRMaXN0KCkubGVuZ3RoO1xuXG4gICAgaWYgKGxlbiA9PT0gNCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gcGF0aC5nZXRQb2ludExpc3QoKSxcbiAgICAgICAgICAgIHN0YXJ0cG9pbnQgPSBwb2ludHNbMF0sXG4gICAgICAgICAgICBlbmRwb2ludCA9IHBvaW50c1tsZW4gLSAxXSxcbiAgICAgICAgICAgIHN0YXJ0RGlyID0gc3RhcnRwb3J0LnBvcnRPbldoaWNoRWRnZShzdGFydHBvaW50KSxcbiAgICAgICAgICAgIGVuZERpciA9IGVuZHBvcnQucG9ydE9uV2hpY2hFZGdlKGVuZHBvaW50KSxcbiAgICAgICAgICAgIHRzdFN0YXJ0LFxuICAgICAgICAgICAgdHN0RW5kO1xuXG4gICAgICAgIGlmIChzdGFydERpciA9PT0gVXRpbHMucmV2ZXJzZURpcihlbmREaXIpKSB7XG4gICAgICAgICAgICB2YXIgaXNIb3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKHN0YXJ0RGlyKSxcbiAgICAgICAgICAgICAgICBuZXdTdGFydCA9IG5ldyBBclBvaW50KHN0YXJ0cG9pbnQpLFxuICAgICAgICAgICAgICAgIG5ld0VuZCA9IG5ldyBBclBvaW50KGVuZHBvaW50KSxcbiAgICAgICAgICAgICAgICBzdGFydFJlY3QgPSBzdGFydHBvcnQucmVjdCxcbiAgICAgICAgICAgICAgICBlbmRSZWN0ID0gZW5kcG9ydC5yZWN0LFxuICAgICAgICAgICAgICAgIG1pbk92ZXJsYXAsXG4gICAgICAgICAgICAgICAgbWF4T3ZlcmxhcDtcblxuICAgICAgICAgICAgaWYgKGlzSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIG1pbk92ZXJsYXAgPSBNYXRoLm1pbihzdGFydFJlY3QuZmxvb3IsIGVuZFJlY3QuZmxvb3IpO1xuICAgICAgICAgICAgICAgIG1heE92ZXJsYXAgPSBNYXRoLm1heChzdGFydFJlY3QuY2VpbCwgZW5kUmVjdC5jZWlsKTtcblxuICAgICAgICAgICAgICAgIHZhciBuZXdZID0gKG1pbk92ZXJsYXAgKyBtYXhPdmVybGFwKSAvIDI7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQueSA9IG5ld1k7XG4gICAgICAgICAgICAgICAgbmV3RW5kLnkgPSBuZXdZO1xuXG4gICAgICAgICAgICAgICAgdHN0U3RhcnQgPSBuZXcgQXJQb2ludChVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChzdGFydHBvcnQub3duZXIucmVjdCwgc3RhcnREaXIpLCBuZXdTdGFydC55KTtcbiAgICAgICAgICAgICAgICB0c3RFbmQgPSBuZXcgQXJQb2ludChVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRwb3J0Lm93bmVyLnJlY3QsIGVuZERpciksIG5ld0VuZC55KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwID0gTWF0aC5taW4oc3RhcnRSZWN0LnJpZ2h0LCBlbmRSZWN0LnJpZ2h0KTtcbiAgICAgICAgICAgICAgICBtYXhPdmVybGFwID0gTWF0aC5tYXgoc3RhcnRSZWN0LmxlZnQsIGVuZFJlY3QubGVmdCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbmV3WCA9IChtaW5PdmVybGFwICsgbWF4T3ZlcmxhcCkgLyAyO1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0LnggPSBuZXdYO1xuICAgICAgICAgICAgICAgIG5ld0VuZC54ID0gbmV3WDtcblxuICAgICAgICAgICAgICAgIHRzdFN0YXJ0ID0gbmV3IEFyUG9pbnQobmV3U3RhcnQueCwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRwb3J0Lm93bmVyLnJlY3QsIHN0YXJ0RGlyKSk7XG4gICAgICAgICAgICAgICAgdHN0RW5kID0gbmV3IEFyUG9pbnQobmV3RW5kLngsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZHBvcnQub3duZXIucmVjdCwgZW5kRGlyKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB2YWxpZFBvaW50TG9jYXRpb24gPSBzdGFydFJlY3QucHRJblJlY3QobmV3U3RhcnQpICYmICFzdGFydFJlY3Qub25Db3JuZXIobmV3U3RhcnQpICYmXG4gICAgICAgICAgICAgICAgZW5kUmVjdC5wdEluUmVjdChuZXdFbmQpICYmICFlbmRSZWN0Lm9uQ29ybmVyKG5ld0VuZCk7XG5cbiAgICAgICAgICAgIGlmICh2YWxpZFBvaW50TG9jYXRpb24gJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyh0c3RTdGFydCwgdHN0RW5kKSkge1xuICAgICAgICAgICAgICAgIHZhciBobGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGlzSG9yaXpvbnRhbCksXG4gICAgICAgICAgICAgICAgICAgIHZsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoIWlzSG9yaXpvbnRhbCksXG4gICAgICAgICAgICAgICAgICAgIGVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHN0YXJ0cG9pbnQpLFxuICAgICAgICAgICAgICAgICAgICBlZGdlMiA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnRzWzFdKSxcbiAgICAgICAgICAgICAgICAgICAgZWRnZTMgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHBvaW50c1syXSk7XG5cbiAgICAgICAgICAgICAgICB2bGlzdC5yZW1vdmUoZWRnZTIpO1xuICAgICAgICAgICAgICAgIGhsaXN0LnJlbW92ZShlZGdlMyk7XG4gICAgICAgICAgICAgICAgaGxpc3QucmVtb3ZlKGVkZ2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVGhlIHZhbHVlcyBvZiBzdGFydHBvaW50IGlzIGNoYW5nZWQgYnV0IHdlIGRvbid0IGNoYW5nZSB0aGUgc3RhcnRwb2ludCBvZiB0aGUgZWRnZVxuICAgICAgICAgICAgICAgIHN0YXJ0cG9pbnQuYXNzaWduKG5ld1N0YXJ0KTtcbiAgICAgICAgICAgICAgICAvLyB0byBtYWludGFpbiB0aGUgcmVmZXJlbmNlIHRoYXQgdGhlIHBvcnQgaGFzIHRvIHRoZSBzdGFydHBvaW50XG4gICAgICAgICAgICAgICAgZW5kcG9pbnQuYXNzaWduKG5ld0VuZCk7XG4gICAgICAgICAgICAgICAgZWRnZS5zZXRFbmRQb2ludChlbmRwb2ludCk7XG5cbiAgICAgICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBlZGdlLnBvc2l0aW9uWSA9IFV0aWxzLmdldFBvaW50Q29vcmQobmV3U3RhcnQsIFV0aWxzLm5leHRDbG9ja3dpc2VEaXIoc3RhcnREaXIpKTtcbiAgICAgICAgICAgICAgICBobGlzdC5pbnNlcnQoZWRnZSk7XG5cbiAgICAgICAgICAgICAgICBwb2ludHMuc3BsaWNlKDEsIDIpO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHVubmVjZXNzYXJ5IGN1cnZlcyBpbnNlcnRlZCBpbnRvIHRoZSBwYXRoIGZyb20gdGhlXG4gKiB0cmFjaW5nIHRoZSBlZGdlcyBvZiBvdmVybGFwcGluZyBib3hlcy4gKGh1ZyBjaGlsZHJlbilcbiAqXG4gKiBAcGFyYW0ge0F1dG9Sb3V0ZXJQYXRofSBwYXRoXG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3NpbXBsaWZ5UGF0aEN1cnZlcyA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgLy8gSW5jaWRlbnRseSwgdGhpcyB3aWxsIGFsc28gY29udGFpbiB0aGUgZnVuY3Rpb25hbGl0eSBvZiBzaW1wbGlmeVRyaXZpYWxseVxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpLFxuICAgICAgICBwMSxcbiAgICAgICAgcDIsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBqO1xuXG4gICAgLy8gSSB3aWxsIGJlIHRha2luZyB0aGUgZmlyc3QgcG9pbnQgYW5kIGNoZWNraW5nIHRvIHNlZSBpZiBpdCBjYW4gY3JlYXRlIGEgc3RyYWlnaHQgbGluZVxuICAgIC8vIHRoYXQgZG9lcyBub3QgVXRpbHMuaW50ZXJzZWN0ICBhbnkgb3RoZXIgYm94ZXMgb24gdGhlIGdyYXBoIGZyb20gdGhlIHRlc3QgcG9pbnQgdG8gdGhlIG90aGVyIHBvaW50LlxuICAgIC8vIFRoZSAnb3RoZXIgcG9pbnQnIHdpbGwgYmUgdGhlIGVuZCBvZiB0aGUgcGF0aCBpdGVyYXRpbmcgYmFjayB0aWwgdGhlIHR3byBwb2ludHMgYmVmb3JlIHRoZSBcbiAgICAvLyBjdXJyZW50LlxuICAgIHdoaWxlIChpIDwgcG9pbnRMaXN0Lmxlbmd0aCAtIDMpIHtcbiAgICAgICAgcDEgPSBwb2ludExpc3RbaV07XG4gICAgICAgIGogPSBwb2ludExpc3QubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChqLS0gPiAwKSB7XG4gICAgICAgICAgICBwMiA9IHBvaW50TGlzdFtqXTtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZ2V0RGlyKHAxLm1pbnVzKHAyKSkpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDEsIHAyKSB8fFxuICAgICAgICAgICAgICAgIHAxLmVxdWFscyhwMikpIHtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKGkgKyAxLCBqIC0gaSAtIDEpOyAvLyBSZW1vdmUgYWxsIHBvaW50cyBiZXR3ZWVuIGksIGpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICArK2k7XG4gICAgfVxufTtcblxuLyogVGhlIGZvbGxvd2luZyBzaGFwZSBpbiBhIHBhdGhcbiAqIF9fX19fX19cbiAqICAgICAgIHwgICAgICAgX19fXG4gKiAgICAgICB8ICAgICAgfFxuICogICAgICAgfF9fX19fX3xcbiAqXG4gKiB3aWxsIGJlIHJlcGxhY2VkIHdpdGggXG4gKiBfX19fX19fXG4gKiAgICAgICB8X19fX19fXG4gKlxuICogaWYgcG9zc2libGUuXG4gKi9cbi8qKlxuICogUmVwbGFjZSA1IHBvaW50cyBmb3IgMyB3aGVyZSBwb3NzaWJsZS4gVGhpcyB3aWxsIHJlcGxhY2UgJ3UnLWxpa2Ugc2hhcGVzXG4gKiB3aXRoICd6JyBsaWtlIHNoYXBlcy5cbiAqXG4gKiBAcGFyYW0gcGF0aFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zaW1wbGlmeVBhdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogIXBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpO1xuICAgIGFzc2VydChwb2ludExpc3QubGVuZ3RoID49IDIsICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogcG9pbnRMaXN0Lmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxuXG4gICAgdmFyIHAxLFxuICAgICAgICBwMixcbiAgICAgICAgcDMsXG4gICAgICAgIHA0LFxuICAgICAgICBwNSxcblxuICAgICAgICBwMXAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwMnAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwM3AgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwNHAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwNXAgPSBwb2ludExpc3QubGVuZ3RoLFxuXG4gICAgICAgIHBvcyA9IDAsXG5cbiAgICAgICAgbnAzLFxuICAgICAgICBkLFxuICAgICAgICBoO1xuXG4gICAgYXNzZXJ0KHBvcyA8IHBvaW50TGlzdC5sZW5ndGgsICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogcG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHAxcCA9IHBvcztcbiAgICBwMSA9IHBvaW50TGlzdFtwb3MrK107XG5cbiAgICB3aGlsZSAocG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICBwNXAgPSBwNHA7XG4gICAgICAgIHA0cCA9IHAzcDtcbiAgICAgICAgcDNwID0gcDJwO1xuICAgICAgICBwMnAgPSBwMXA7XG4gICAgICAgIHAxcCA9IHBvcztcblxuICAgICAgICBwNSA9IHA0O1xuICAgICAgICBwNCA9IHAzO1xuICAgICAgICBwMyA9IHAyO1xuICAgICAgICBwMiA9IHAxO1xuICAgICAgICBwMSA9IHBvaW50TGlzdFtwb3MrK107XG5cbiAgICAgICAgaWYgKHA1cCA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFzc2VydChwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJlxuICAgICAgICAgICAgICAgIHA0cCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDVwIDwgcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiAnICtcbiAgICAgICAgICAgICAgICAncDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNHAgPCBwb2ludExpc3QubGVuZ3RoICYmIHA1cCA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGFzc2VydCghcDEuZXF1YWxzKHAyKSAmJiAhcDIuZXF1YWxzKHAzKSAmJiAhcDMuZXF1YWxzKHA0KSAmJiAhcDQuZXF1YWxzKHA1KSxcbiAgICAgICAgICAgICAgICAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6ICFwMS5lcXVhbHMocDIpICYmICFwMi5lcXVhbHMocDMpICYmICFwMy5lcXVhbHMocDQpICYmICcgK1xuICAgICAgICAgICAgICAgICchcDQuZXF1YWxzKHA1KSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgZCA9IFV0aWxzLmdldERpcihwMi5taW51cyhwMSkpO1xuICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGQpIEZBSUxFRCcpO1xuICAgICAgICAgICAgaCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkKTtcblxuICAgICAgICAgICAgbnAzID0gbmV3IEFyUG9pbnQoKTtcbiAgICAgICAgICAgIGlmIChoKSB7XG4gICAgICAgICAgICAgICAgbnAzLnggPSBVdGlscy5nZXRQb2ludENvb3JkKHA1LCBoKTtcbiAgICAgICAgICAgICAgICBucDMueSA9IFV0aWxzLmdldFBvaW50Q29vcmQocDEsICFoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbnAzLnggPSBVdGlscy5nZXRQb2ludENvb3JkKHAxLCAhaCk7XG4gICAgICAgICAgICAgICAgbnAzLnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHA1LCBoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDIsIG5wMykgJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhucDMsIHA0KSkge1xuICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDJwLCAxKTtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAzcCwgMSk7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwNHAsIDEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFucDMuZXF1YWxzKHAxKSAmJiAhbnAzLmVxdWFscyhwNSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwNHAsIDAsIG5wMyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcDFwID0gcG9pbnRMaXN0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwMnAgPSBwb2ludExpc3QubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHAzcCA9IHBvaW50TGlzdC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcDRwID0gcG9pbnRMaXN0Lmxlbmd0aDtcblxuICAgICAgICAgICAgICAgIHBvcyA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWRQb2ludHMoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0QWxsRGlzY29ubmVjdGVkUGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGksXG4gICAgICAgIGxlbiA9IHRoaXMucGF0aHMubGVuZ3RoLFxuICAgICAgICBzdWNjZXNzID0gZmFsc2UsXG4gICAgICAgIGdpdmV1cCA9IGZhbHNlLFxuICAgICAgICBwYXRoO1xuXG4gICAgd2hpbGUgKCFzdWNjZXNzICYmICFnaXZldXApIHtcbiAgICAgICAgc3VjY2VzcyA9IHRydWU7XG4gICAgICAgIGkgPSBsZW47XG4gICAgICAgIHdoaWxlIChpLS0gJiYgc3VjY2Vzcykge1xuICAgICAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaV07XG5cbiAgICAgICAgICAgIGlmICghcGF0aC5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IHRoaXMuX2Nvbm5lY3QocGF0aCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGlzIG1lc3NlZCB1cCwgcHJvYmFibHkgYW4gZXhpc3RpbmcgZWRnZSBjdXN0b21pemF0aW9uIHJlc3VsdHMgaW4gYSB6ZXJvIGxlbmd0aCBlZGdlXG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSB0cnkgdG8gZGVsZXRlIGFueSBjdXN0b21pemF0aW9uIGZvciB0aGlzIHBhdGggdG8gcmVjb3ZlciBmcm9tIHRoZSBwcm9ibGVtXG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXRoLmFyZVRoZXJlUGF0aEN1c3RvbWl6YXRpb25zKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgucmVtb3ZlUGF0aEN1c3RvbWl6YXRpb25zKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnaXZldXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghc3VjY2VzcyAmJiAhZ2l2ZXVwKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXNjb25uZWN0QWxsKCk7XHQvLyBUaGVyZSB3YXMgYW4gZXJyb3IsIGRlbGV0ZSBoYWxmd2F5IHJlc3VsdHMgdG8gYmUgYWJsZSB0byBzdGFydCBhIG5ldyBwYXNzXG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb21wbGV0ZWx5Q29ubmVjdGVkID0gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3VwZGF0ZUJveFBvcnRBdmFpbGFiaWxpdHkgPSBmdW5jdGlvbiAoaW5wdXRCb3gpIHtcbiAgICB2YXIgYnVmZmVyYm94LFxuICAgICAgICBzaWJsaW5ncyxcbiAgICAgICAgc2tpcEJveGVzID0ge30sXG4gICAgICAgIGJveCxcbiAgICAgICAgaWQ7XG5cbiAgICBidWZmZXJib3ggPSB0aGlzLmJveDJidWZmZXJCb3hbaW5wdXRCb3guaWRdO1xuICAgIGFzc2VydChidWZmZXJib3gsICdCdWZmZXJib3ggbm90IGZvdW5kIGZvciAnICsgaW5wdXRCb3guaWQpO1xuICAgIHNpYmxpbmdzID0gYnVmZmVyYm94LmNoaWxkcmVuO1xuICAgIC8vIElnbm9yZSBvdmVybGFwIGZyb20gYW5jZXN0b3IgYm94ZXMgaW4gdGhlIGJveCB0cmVlc1xuICAgIGJveCA9IGlucHV0Qm94O1xuICAgIGRvIHtcbiAgICAgICAgc2tpcEJveGVzW2JveC5pZF0gPSB0cnVlO1xuICAgICAgICBib3ggPSBib3gucGFyZW50O1xuICAgIH0gd2hpbGUgKGJveCk7XG5cbiAgICBmb3IgKHZhciBpID0gc2libGluZ3MubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlkID0gc2libGluZ3NbaV0uaWQ7XG4gICAgICAgIGlmIChza2lwQm94ZXNbaWRdKSB7ICAvLyBTa2lwIGJveGVzIG9uIHRoZSBib3ggdHJlZVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5wdXRCb3gucmVjdC50b3VjaGluZyhzaWJsaW5nc1tpXSkpIHtcbiAgICAgICAgICAgIGlucHV0Qm94LmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tzaWJsaW5nc1tpXS5pZF0pO1xuICAgICAgICAgICAgdGhpcy5ib3hlc1tzaWJsaW5nc1tpXS5pZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eShpbnB1dEJveCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRUb0J1ZmZlckJveGVzID0gZnVuY3Rpb24gKGlucHV0Qm94KSB7XG4gICAgdmFyIGJveCA9IHtyZWN0OiBuZXcgQXJSZWN0KGlucHV0Qm94LnJlY3QpLCBpZDogaW5wdXRCb3guaWR9LFxuICAgICAgICBvdmVybGFwQm94ZXNJbmRpY2VzID0gW10sXG4gICAgICAgIGJ1ZmZlckJveCxcbiAgICAgICAgY2hpbGRyZW4gPSBbXSxcbiAgICAgICAgcGFyZW50Qm94LFxuICAgICAgICBpZHMgPSBbaW5wdXRCb3guaWRdLFxuICAgICAgICBjaGlsZCxcbiAgICAgICAgaSxcbiAgICAgICAgajtcblxuICAgIGJveC5yZWN0LmluZmxhdGVSZWN0KENPTlNUQU5UUy5CVUZGRVIpO1xuICAgIGFzc2VydCghdGhpcy5ib3gyYnVmZmVyQm94W2lucHV0Qm94LmlkXSxcbiAgICAgICAgJ0NhblxcJ3QgYWRkIGJveCB0byAyIGJ1ZmZlcmJveGVzJyk7XG5cbiAgICAvLyBGb3IgZXZlcnkgYnVmZmVyIGJveCB0b3VjaGluZyB0aGUgaW5wdXQgYm94XG4gICAgLy8gUmVjb3JkIHRoZSBidWZmZXIgYm94ZXMgd2l0aCBjaGlsZHJlbiB0b3VjaGluZyBcbiAgICAvLyB0aGUgaW5wdXQgYm94XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJCb3hlcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKCFib3gucmVjdC50b3VjaGluZyh0aGlzLmJ1ZmZlckJveGVzW2ldLmJveCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaiA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICBjaGlsZCA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW5bal07XG4gICAgICAgICAgICBpZiAoYm94LnJlY3QudG91Y2hpbmcoY2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgaW5wdXRCb3guYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSh0aGlzLmJveGVzW2NoaWxkLmlkXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5ib3hlc1tjaGlsZC5pZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eShpbnB1dEJveCk7XG5cbiAgICAgICAgICAgICAgICBpZiAob3ZlcmxhcEJveGVzSW5kaWNlcy5pbmRleE9mKGkpID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBvdmVybGFwQm94ZXNJbmRpY2VzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXJlbnRCb3ggPSBuZXcgQXJSZWN0KGJveC5yZWN0KTtcbiAgICAvLyBJZiBvdmVybGFwcGVkIG90aGVyIGJveGVzLCBjcmVhdGUgdGhlIG5ldyBidWZmZXJib3ggcGFyZW50IHJlY3RcbiAgICBpZiAob3ZlcmxhcEJveGVzSW5kaWNlcy5sZW5ndGggIT09IDApIHtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3ZlcmxhcEJveGVzSW5kaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXJ0KG92ZXJsYXBCb3hlc0luZGljZXNbaV0gPCB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAnQXJHcmFwaC5hZGRUb0J1ZmZlckJveGVzOiBvdmVybGFwQm94ZXMgaW5kZXggb3V0IG9mIGJvdW5kcy4gKCcgK1xuICAgICAgICAgICAgICAgIG92ZXJsYXBCb3hlc0luZGljZXNbaV0gKyAnIDwgJyArIHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoICsgJyknKTtcblxuICAgICAgICAgICAgYnVmZmVyQm94ID0gdGhpcy5idWZmZXJCb3hlcy5zcGxpY2Uob3ZlcmxhcEJveGVzSW5kaWNlc1tpXSwgMSlbMF07XG5cbiAgICAgICAgICAgIGZvciAoaiA9IGJ1ZmZlckJveC5jaGlsZHJlbi5sZW5ndGg7IGotLTspIHtcbiAgICAgICAgICAgICAgICBjaGlsZHJlbi5wdXNoKGJ1ZmZlckJveC5jaGlsZHJlbltqXSk7XG4gICAgICAgICAgICAgICAgaWRzLnB1c2goYnVmZmVyQm94LmNoaWxkcmVuW2pdLmlkKTsgIC8vIFN0b3JlIHRoZSBpZHMgb2YgdGhlIGNoaWxkcmVuIHRoYXQgbmVlZCB0byBiZSBhZGp1c3RlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwYXJlbnRCb3gudW5pb25Bc3NpZ24oYnVmZmVyQm94LmJveCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBib3gucmVjdC5pZCA9IGlucHV0Qm94LmlkO1xuICAgIGNoaWxkcmVuLnB1c2goYm94LnJlY3QpO1xuXG4gICAgdGhpcy5idWZmZXJCb3hlcy5wdXNoKHtib3g6IHBhcmVudEJveCwgY2hpbGRyZW46IGNoaWxkcmVufSk7XG5cbiAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuYm94MmJ1ZmZlckJveFtpZHNbaV1dID0gdGhpcy5idWZmZXJCb3hlc1t0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCAtIDFdO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3JlbW92ZUZyb21CdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICAvLyBHZXQgdGhlIGNoaWxkcmVuIG9mIHRoZSBwYXJlbnRCb3ggKG5vdCBpbmNsdWRpbmcgdGhlIGJveCB0byByZW1vdmUpXG4gICAgLy8gQ3JlYXRlIGJ1ZmZlcmJveGVzIGZyb20gdGhlc2UgY2hpbGRyZW5cbiAgICB2YXIgYnVmZmVyQm94ID0gdGhpcy5ib3gyYnVmZmVyQm94W2JveC5pZF0sXG4gICAgICAgIGkgPSB0aGlzLmJ1ZmZlckJveGVzLmluZGV4T2YoYnVmZmVyQm94KSxcbiAgICAgICAgY2hpbGRyZW4gPSBidWZmZXJCb3guY2hpbGRyZW4sXG4gICAgICAgIGdyb3VwcyA9IFtdLFxuICAgICAgICBhZGQgPSBmYWxzZSxcbiAgICAgICAgcGFyZW50Qm94LFxuICAgICAgICBjaGlsZCxcbiAgICAgICAgZ3JvdXAsXG4gICAgICAgIGlkcyxcbiAgICAgICAgaWQsXG4gICAgICAgIGosXG4gICAgICAgIGc7XG5cbiAgICBhc3NlcnQoaSAhPT0gLTEsICdBUkdyYXBoLnJlbW92ZUZyb21CdWZmZXJCb3hlczogQ2FuXFwndCBmaW5kIHRoZSBjb3JyZWN0IGJ1ZmZlcmJveC4nKTtcblxuICAgIC8vIFJlbW92ZSByZWNvcmQgb2YgcmVtb3ZlZCBib3hcbiAgICB0aGlzLmJ1ZmZlckJveGVzLnNwbGljZShpLCAxKTtcbiAgICB0aGlzLmJveDJidWZmZXJCb3hbYm94LmlkXSA9IHVuZGVmaW5lZDtcblxuICAgIC8vQ3JlYXRlIGdyb3VwcyBvZiBvdmVybGFwIGZyb20gY2hpbGRyZW5cbiAgICBpID0gY2hpbGRyZW4ubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgZyA9IGdyb3Vwcy5sZW5ndGg7XG4gICAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XG4gICAgICAgIGdyb3VwID0gW2NoaWxkXTtcbiAgICAgICAgYWRkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5ib3hlc1tjaGlsZC5pZF0ucmVzZXRQb3J0QXZhaWxhYmlsaXR5KCk7ICAvLyBSZXNldCBib3gncyBwb3J0cyBhdmFpbGFibGVBcmVhc1xuXG4gICAgICAgIGlmIChjaGlsZC5pZCA9PT0gYm94LmlkKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChnLS0pIHtcbiAgICAgICAgICAgIGogPSBncm91cHNbZ10ubGVuZ3RoO1xuXG4gICAgICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICAgICAgaWYgKGdyb3Vwc1tnXVtqXS50b3VjaGluZyhjaGlsZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWQgPSBncm91cHNbZ11bal0uaWQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYm94ZXNbY2hpbGQuaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJveGVzW2lkXS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbY2hpbGQuaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgYWRkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhZGQpIHtcbiAgICAgICAgICAgICAgICAvLyBncm91cCB3aWxsIGFjY3VtdWxhdGUgYWxsIHRoaW5ncyBvdmVybGFwcGluZyB0aGUgY2hpbGRcbiAgICAgICAgICAgICAgICBncm91cCA9IGdyb3VwLmNvbmNhdChncm91cHMuc3BsaWNlKGcsIDEpWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGdyb3Vwcy5wdXNoKGdyb3VwKTsgIC8vIEFkZCBncm91cCB0byBncm91cHNcbiAgICB9XG5cbiAgICBpID0gZ3JvdXBzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGogPSBncm91cHNbaV0ubGVuZ3RoO1xuICAgICAgICBwYXJlbnRCb3ggPSBuZXcgQXJSZWN0KGdyb3Vwc1tpXVswXSk7XG4gICAgICAgIGlkcyA9IFtdO1xuXG4gICAgICAgIHdoaWxlIChqLS0pIHtcbiAgICAgICAgICAgIHBhcmVudEJveC51bmlvbkFzc2lnbihncm91cHNbaV1bal0pO1xuICAgICAgICAgICAgaWRzLnB1c2goZ3JvdXBzW2ldW2pdLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYnVmZmVyQm94ZXMucHVzaCh7Ym94OiBwYXJlbnRCb3gsIGNoaWxkcmVuOiBncm91cHNbaV19KTtcblxuICAgICAgICBqID0gaWRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgdGhpcy5ib3gyYnVmZmVyQm94W2lkc1tqXV0gPSB0aGlzLmJ1ZmZlckJveGVzW3RoaXMuYnVmZmVyQm94ZXMubGVuZ3RoIC0gMV07XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG5cbi8vUHVibGljIEZ1bmN0aW9uc1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnNldEJ1ZmZlciA9IGZ1bmN0aW9uIChuZXdCdWZmZXIpIHtcbiAgICBDT05TVEFOVFMuQlVGRkVSID0gbmV3QnVmZmVyO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5jYWxjdWxhdGVTZWxmUG9pbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2VsZlBvaW50cyA9IFtdO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUlOQ09PUkQpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUFYQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01BWENPT1JEKSk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmNyZWF0ZUJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYm94ID0gbmV3IEF1dG9Sb3V0ZXJCb3goKTtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5jcmVhdGVCb3g6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBib3g7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFkZEJveCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5hZGRCb3g6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYm94IGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCxcbiAgICAgICAgJ0FSR3JhcGguYWRkQm94OiBib3ggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94IEZBSUxFRCcpO1xuXG4gICAgdmFyIHJlY3QgPSBib3gucmVjdDtcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nKHJlY3QpO1xuXG4gICAgYm94Lm93bmVyID0gdGhpcztcbiAgICB2YXIgYm94SWQgPSAoQ09VTlRFUisrKS50b1N0cmluZygpO1xuICAgIHdoaWxlIChib3hJZC5sZW5ndGggPCA2KSB7XG4gICAgICAgIGJveElkID0gJzAnICsgYm94SWQ7XG4gICAgfVxuICAgIGJveElkID0gJ0JPWF8nICsgYm94SWQ7XG4gICAgYm94LmlkID0gYm94SWQ7XG5cbiAgICB0aGlzLmJveGVzW2JveElkXSA9IGJveDtcblxuICAgIHRoaXMuX2FkZEJveEFuZFBvcnRFZGdlcyhib3gpO1xuXG4gICAgLy8gYWRkIGNoaWxkcmVuIG9mIHRoZSBib3hcbiAgICB2YXIgY2hpbGRyZW4gPSBib3guY2hpbGRCb3hlcyxcbiAgICAgICAgaSA9IGNoaWxkcmVuLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMuYWRkQm94KGNoaWxkcmVuW2ldKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlbGV0ZUJveCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5kZWxldGVCb3g6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGlmIChib3guaGFzT3duZXIoKSkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYm94LnBhcmVudCxcbiAgICAgICAgICAgIGNoaWxkcmVuID0gYm94LmNoaWxkQm94ZXMsXG4gICAgICAgICAgICBpID0gY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIC8vIG5vdGlmeSB0aGUgcGFyZW50IG9mIHRoZSBkZWxldGlvblxuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoYm94KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBjaGlsZHJlblxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZUJveChjaGlsZHJlbltpXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMoYm94KTtcbiAgICAgICAgYm94Lm93bmVyID0gbnVsbDtcbiAgICAgICAgYXNzZXJ0KHRoaXMuYm94ZXNbYm94LmlkXSAhPT0gdW5kZWZpbmVkLCAnQVJHcmFwaC5yZW1vdmU6IEJveCBkb2VzIG5vdCBleGlzdCcpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLmJveGVzW2JveC5pZF07XG4gICAgfVxuXG4gICAgYm94LmRlc3Ryb3koKTtcbiAgICBib3ggPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5zaGlmdEJveEJ5ID0gZnVuY3Rpb24gKGJveCwgb2Zmc2V0KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguc2hpZnRCb3hCeTogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghIXRoaXMuYm94ZXNbYm94LmlkXSwgJ0FSR3JhcGguc2hpZnRCb3hCeTogQm94IGRvZXMgbm90IGV4aXN0IScpO1xuXG4gICAgdmFyIHJlY3QgPSB0aGlzLmJveDJidWZmZXJCb3hbYm94LmlkXS5ib3gsXG4gICAgICAgIGNoaWxkcmVuID0gYm94LmNoaWxkQm94ZXM7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTsgLy8gcmVkcmF3IGFsbCBwYXRocyBjbGlwcGluZyBwYXJlbnQgYm94LlxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0Zyb20oYm94KTtcblxuICAgIHRoaXMuX2RlbGV0ZUJveEFuZFBvcnRFZGdlcyhib3gpO1xuXG4gICAgYm94LnNoaWZ0Qnkob2Zmc2V0KTtcbiAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIHJlY3QgPSBib3gucmVjdDtcbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTtcblxuICAgIGZvciAodmFyIGkgPSBjaGlsZHJlbi5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5zaGlmdEJveEJ5KGNoaWxkcmVuW2ldLCBvZmZzZXQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuc2V0Qm94UmVjdCA9IGZ1bmN0aW9uIChib3gsIHJlY3QpIHtcbiAgICBpZiAoYm94ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMoYm94KTtcbiAgICBib3guc2V0UmVjdChyZWN0KTtcbiAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nKHJlY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5yb3V0ZVN5bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXRlID0ge2ZpbmlzaGVkOiBmYWxzZX07XG5cbiAgICB0aGlzLl9jb25uZWN0QWxsRGlzY29ubmVjdGVkUGF0aHMoKTtcblxuICAgIHdoaWxlICghc3RhdGUuZmluaXNoZWQpIHtcbiAgICAgICAgc3RhdGUgPSB0aGlzLl9vcHRpbWl6ZShzdGF0ZSk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnJvdXRlQXN5bmMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgdXBkYXRlRm4gPSBvcHRpb25zLnVwZGF0ZSB8fCBVdGlscy5ub3AsXG4gICAgICAgIGZpcnN0Rm4gPSBvcHRpb25zLmZpcnN0IHx8IFV0aWxzLm5vcCxcbiAgICAgICAgY2FsbGJhY2tGbiA9IG9wdGlvbnMuY2FsbGJhY2sgfHwgVXRpbHMubm9wLFxuICAgICAgICB0aW1lID0gb3B0aW9ucy50aW1lIHx8IDUsXG4gICAgICAgIG9wdGltaXplRm4gPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgb3B0aW1pemF0aW9uIGN5Y2xlIHN0YXJ0ZWQnKTtcblxuICAgICAgICAgICAgLy8gSWYgYSBwYXRoIGhhcyBiZWVuIGRpc2Nvbm5lY3RlZCwgc3RhcnQgdGhlIHJvdXRpbmcgb3ZlclxuICAgICAgICAgICAgaWYgKCFzZWxmLmNvbXBsZXRlbHlDb25uZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIG9wdGltaXphdGlvbiBpbnRlcnJ1cHRlZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KHN0YXJ0Um91dGluZywgdGltZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVwZGF0ZUZuKHNlbGYucGF0aHMpO1xuICAgICAgICAgICAgaWYgKHN0YXRlLmZpbmlzaGVkKSB7XG4gICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyByb3V0aW5nIGZpbmlzaGVkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrRm4oc2VsZi5wYXRocyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gc2VsZi5fb3B0aW1pemUoc3RhdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KG9wdGltaXplRm4sIHRpbWUsIHN0YXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc3RhcnRSb3V0aW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyByb3V0aW5nIHN0YXJ0ZWQnKTtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHtmaW5pc2hlZDogZmFsc2V9O1xuICAgICAgICAgICAgc2VsZi5fY29ubmVjdEFsbERpc2Nvbm5lY3RlZFBhdGhzKCk7XG5cbiAgICAgICAgICAgIC8vIFN0YXJ0IHRoZSBvcHRpbWl6YXRpb25cbiAgICAgICAgICAgIHNldFRpbWVvdXQob3B0aW1pemVGbiwgdGltZSwgc3RhdGUpO1xuICAgICAgICB9O1xuXG4gICAgX2xvZ2dlci5pbmZvKCdBc3luYyByb3V0aW5nIHRyaWdnZXJlZCcpO1xuICAgIC8vIENvbm5lY3QgYWxsIGRpc2Nvbm5lY3RlZCBwYXRocyB3aXRoIGEgc3RyYWlnaHQgbGluZVxuICAgIHZhciBkaXNjb25uZWN0ZWQgPSB0aGlzLl9xdWlja0Nvbm5lY3REaXNjb25uZWN0ZWRQYXRocygpO1xuICAgIGZpcnN0Rm4oZGlzY29ubmVjdGVkKTtcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RUZW1wUGF0aHMoZGlzY29ubmVjdGVkKTtcblxuICAgIHNldFRpbWVvdXQoc3RhcnRSb3V0aW5nLCB0aW1lKTtcbn07XG5cbi8qKlxuICogQ29ubmVjdCBhbGwgZGlzY29ubmVjdGVkIHBhdGhzIGluIGEgcXVpY2sgd2F5IHdoaWxlIGEgYmV0dGVyIGxheW91dCBpc1xuICogYmVpbmcgY2FsY3VsYXRlZC5cbiAqXG4gKiBAcmV0dXJuIHtBcnJheTxQYXRoPn0gZGlzY29ubmVjdGVkIHBhdGhzXG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3F1aWNrQ29ubmVjdERpc2Nvbm5lY3RlZFBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwYXRoLFxuICAgICAgICBkaXNjb25uZWN0ZWQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaV07XG4gICAgICAgIGlmICghcGF0aC5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgICAgICBwYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMoKTtcbiAgICAgICAgICAgIHBhdGgucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aChwYXRoLnN0YXJ0cG9pbnQsIHBhdGguZW5kcG9pbnQpO1xuICAgICAgICAgICAgZGlzY29ubmVjdGVkLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRpc2Nvbm5lY3RlZDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RUZW1wUGF0aHMgPSBmdW5jdGlvbiAocGF0aHMpIHtcbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBhdGhzW2ldLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFBlcmZvcm1zIG9uZSBzZXQgb2Ygb3B0aW1pemF0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gY291bnQgVGhpcyBzdG9yZXMgdGhlIG1heCBudW1iZXIgb2Ygb3B0aW1pemF0aW9ucyBhbGxvd2VkXG4gKiBAcGFyYW0ge051bWJlcn0gbGFzdCBUaGlzIHN0b3JlcyB0aGUgbGFzdCBvcHRpbWl6YXRpb24gdHlwZSBtYWRlXG4gKlxuICogQHJldHVybiB7T2JqZWN0fSBDdXJyZW50IGNvdW50LCBsYXN0IHZhbHVlc1xuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9vcHRpbWl6ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIG1heE9wZXJhdGlvbnMgPSBvcHRpb25zLm1heE9wZXJhdGlvbnMgfHwgMTAwLFxuICAgICAgICBsYXN0ID0gb3B0aW9ucy5sYXN0IHx8IDAsXG4gICAgICAgIGRtID0gb3B0aW9ucy5kbSB8fCAxMCxcdFx0Ly8gbWF4ICMgb2YgZGlzdHJpYnV0aW9uIG9wXG4gICAgICAgIGQgPSBvcHRpb25zLmQgfHwgMCxcbiAgICAgICAgZ2V0U3RhdGUgPSBmdW5jdGlvbiAoZmluaXNoZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZmluaXNoZWQ6IGZpbmlzaGVkIHx8ICFtYXhPcGVyYXRpb25zLFxuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnM6IG1heE9wZXJhdGlvbnMsXG4gICAgICAgICAgICAgICAgbGFzdDogbGFzdCxcbiAgICAgICAgICAgICAgICBkbTogZG0sXG4gICAgICAgICAgICAgICAgZDogZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuXG4gICAgICAgIGlmIChsYXN0ID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLl9zaW1wbGlmeVBhdGhzKCkpIHtcbiAgICAgICAgICAgIGxhc3QgPSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLmhvcml6b250YWwuYmxvY2tTY2FuQmFja3dhcmQoKSkge1xuXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkJhY2t3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gMjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gMykge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkZvcndhcmQoKSkge1xuXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkZvcndhcmQoKSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0IDwgMiB8fCBsYXN0ID4gNSkge1xuICAgICAgICAgICAgICAgIGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgrK2QgPj0gZG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxhc3QgPSAzO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSA0KSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkJhY2t3YXJkKCkpIHtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgICAgICB9IHdoaWxlIChtYXhPcGVyYXRpb25zID4gMCAmJiB0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkJhY2t3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gNDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNSkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpIHtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMudmVydGljYWwuYmxvY2tTY2FuRm9yd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDYpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMuaG9yaXpvbnRhbC5ibG9ja1N3aXRjaFdyb25ncygpKSB7XG4gICAgICAgICAgICBsYXN0ID0gNjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNykge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy52ZXJ0aWNhbC5ibG9ja1N3aXRjaFdyb25ncygpKSB7XG4gICAgICAgICAgICBsYXN0ID0gNztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsYXN0ID09PSAwKSB7XG4gICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZ2V0U3RhdGUoZmFsc2UpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZWxldGVQYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlUGF0aDogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGlmIChwYXRoLmhhc093bmVyKCkpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmRlbGV0ZVBhdGg6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG5cbiAgICAgICAgdGhpcy5kZWxldGVFZGdlcyhwYXRoKTtcbiAgICAgICAgcGF0aC5vd25lciA9IG51bGw7XG4gICAgICAgIHZhciBpbmRleCA9IHRoaXMucGF0aHMuaW5kZXhPZihwYXRoKTtcblxuICAgICAgICBhc3NlcnQoaW5kZXggPiAtMSwgJ0FSR3JhcGgucmVtb3ZlOiBQYXRoIGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgIHRoaXMucGF0aHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG5cbiAgICBwYXRoLmRlc3Ryb3koKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoYWRkQmFja1NlbGZFZGdlcykge1xuICAgIHRoaXMuX2RlbGV0ZUFsbFBhdGhzKCk7XG4gICAgdGhpcy5fZGVsZXRlQWxsQm94ZXMoKTtcbiAgICB0aGlzLl9kZWxldGVBbGxFZGdlcygpO1xuICAgIGlmIChhZGRCYWNrU2VsZkVkZ2VzKSB7XG4gICAgICAgIHRoaXMuX2FkZFNlbGZFZGdlcygpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuYWRkUGF0aCA9IGZ1bmN0aW9uIChpc0F1dG9Sb3V0ZWQsIHN0YXJ0cG9ydHMsIGVuZHBvcnRzKSB7XG4gICAgdmFyIHBhdGggPSBuZXcgQXV0b1JvdXRlclBhdGgoKTtcblxuICAgIHBhdGguc2V0QXV0b1JvdXRpbmcoaXNBdXRvUm91dGVkKTtcbiAgICBwYXRoLnNldFN0YXJ0UG9ydHMoc3RhcnRwb3J0cyk7XG4gICAgcGF0aC5zZXRFbmRQb3J0cyhlbmRwb3J0cyk7XG4gICAgdGhpcy5fYWRkKHBhdGgpO1xuXG4gICAgcmV0dXJuIHBhdGg7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmlzRWRnZUZpeGVkID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50KSB7XG4gICAgdmFyIGQgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpLFxuICAgICAgICBoID0gVXRpbHMuaXNIb3Jpem9udGFsKGQpLFxuXG4gICAgICAgIGVsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoaCksXG5cbiAgICAgICAgZWRnZSA9IGVsaXN0LmdldEVkZ2UocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgIGlmIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBlZGdlLmdldEVkZ2VGaXhlZCgpICYmICFlZGdlLmdldEVkZ2VDdXN0b21GaXhlZCgpO1xuICAgIH1cblxuICAgIGFzc2VydChmYWxzZSwgJ0FSR3JhcGguaXNFZGdlRml4ZWQ6IEZBSUxFRCcpO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZGVsZXRlQWxsKGZhbHNlKTtcblxuICAgIHRoaXMuaG9yaXpvbnRhbC5TZXRPd25lcihudWxsKTtcbiAgICB0aGlzLnZlcnRpY2FsLlNldE93bmVyKG51bGwpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSB0aGlzLmJveGVzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmFzc2VydFZhbGlkQm94KHRoaXMuYm94ZXNbaWRzW2ldXSk7XG4gICAgfVxuXG4gICAgZm9yIChpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fYXNzZXJ0VmFsaWRQYXRoKHRoaXMucGF0aHNbaV0pO1xuICAgIH1cblxuICAgIHRoaXMuaG9yaXpvbnRhbC5hc3NlcnRWYWxpZCgpO1xuICAgIHRoaXMudmVydGljYWwuYXNzZXJ0VmFsaWQoKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRCb3ggPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYm94LmFzc2VydFZhbGlkKCk7XG4gICAgYXNzZXJ0KGJveC5vd25lciA9PT0gdGhpcyxcbiAgICAgICAgJ0FSR3JhcGguYXNzZXJ0VmFsaWRCb3g6IGJveC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICBhc3NlcnQodGhpcy5ib3hlc1tib3guaWRdICE9PSB1bmRlZmluZWQsXG4gICAgICAgICdBUkdyYXBoLmFzc2VydFZhbGlkQm94OiB0aGlzLmJveGVzW2JveC5pZF0gIT09IHVuZGVmaW5lZCBGQUlMRUQnKTtcblxuICAgIC8vIFZlcmlmeSB0aGF0IHRoZSBib3ggKGFuZCBwb3J0KSBlZGdlcyBhcmUgb24gdGhlIGdyYXBoXG4gICAgYXNzZXJ0KHRoaXMuX2NvbnRhaW5zUmVjdEVkZ2VzKGJveC5yZWN0KSxcbiAgICAgICAgJ0dyYXBoIGRvZXMgbm90IGNvbnRhaW4gZWRnZXMgZm9yIGJveCAnICsgYm94LmlkKTtcblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29udGFpbnNSZWN0RWRnZXMgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciB0b3BMZWZ0ID0gcmVjdC5nZXRUb3BMZWZ0KCksXG4gICAgICAgIGJvdHRvbVJpZ2h0ID0gcmVjdC5nZXRCb3R0b21SaWdodCgpLFxuICAgICAgICBwb2ludHMgPSBbXSxcbiAgICAgICAgcmVzdWx0ID0gdHJ1ZSxcbiAgICAgICAgbGVuLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kO1xuXG4gICAgcG9pbnRzLnB1c2godG9wTGVmdCk7XG4gICAgcG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoYm90dG9tUmlnaHQueCwgdG9wTGVmdC55KSk7ICAvLyB0b3AgcmlnaHRcbiAgICBwb2ludHMucHVzaChib3R0b21SaWdodCk7XG4gICAgcG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodG9wTGVmdC54LCBib3R0b21SaWdodC55KSk7ICAvLyBib3R0b20gbGVmdFxuXG4gICAgbGVuID0gcG9pbnRzLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHN0YXJ0ID0gcG9pbnRzW2ldO1xuICAgICAgICBlbmQgPSBwb2ludHNbKGkgKyAxKSAlIGxlbl07XG4gICAgICAgIHJlc3VsdCA9IHJlc3VsdCAmJiB0aGlzLl9jb250YWluc0VkZ2Uoc3RhcnQsIGVuZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogVGhpcyBjaGVja3MgZm9yIGFuIGVkZ2Ugd2l0aCB0aGUgZ2l2ZW4gc3RhcnQvZW5kIHBvaW50cy4gVGhpcyB3aWxsIG9ubHlcbiAqIHdvcmsgZm9yIGZpeGVkIGVkZ2VzIHN1Y2ggYXMgYm94ZXMgb3IgcG9ydHMuXG4gKlxuICogQHBhcmFtIHN0YXJ0XG4gKiBAcGFyYW0gZW5kXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NvbnRhaW5zRWRnZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gICAgdmFyIGRpcjtcblxuICAgIGRpciA9IFV0aWxzLmdldERpcihzdGFydC5taW51cyhlbmQpKTtcbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICdFZGdlIGlzIGludmFsaWQ6ICcgKyBVdGlscy5zdHJpbmdpZnkoc3RhcnQpICsgJyBhbmQgJyArIFV0aWxzLnN0cmluZ2lmeShlbmQpKTtcblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5ob3Jpem9udGFsLmNvbnRhaW5zKHN0YXJ0LCBlbmQpIHx8IHRoaXMuaG9yaXpvbnRhbC5jb250YWlucyhlbmQsIHN0YXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy52ZXJ0aWNhbC5jb250YWlucyhzdGFydCwgZW5kKSB8fCB0aGlzLnZlcnRpY2FsLmNvbnRhaW5zKGVuZCwgc3RhcnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Fzc2VydFZhbGlkUGF0aCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsXG4gICAgICAgICdBUkdyYXBoLmFzc2VydFZhbGlkQm94OiBib3gub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kdW1wUGF0aHMgPSBmdW5jdGlvbiAocG9zLCBjKSB7XG4gICAgX2xvZ2dlci5kZWJ1ZygnUGF0aHMgZHVtcCBwb3MgJyArIHBvcyArICcsIGMgJyArIGMpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBhdGhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoaSArICcuIFBhdGg6ICcpO1xuICAgICAgICB0aGlzLnBhdGhzW2ldLmdldFBvaW50TGlzdCgpLmR1bXBQb2ludHMoJ0R1bXBQYXRocycpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kdW1wRWRnZUxpc3RzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5kdW1wRWRnZXMoJ0hvcml6b250YWwgZWRnZXM6Jyk7XG4gICAgdGhpcy52ZXJ0aWNhbC5kdW1wRWRnZXMoJ1ZlcnRpY2FsIGVkZ2VzOicpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyR3JhcGg7XG4iLCIndXNlIHN0cmljdCc7XG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICAgIExFVkVMUyA9IFsnd2FybicsICdkZWJ1ZycsICdpbmZvJ107XG5cbnZhciBMb2dnZXIgPSBmdW5jdGlvbihuYW1lKXtcbiAgICBmb3IgKHZhciBpID0gTEVWRUxTLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzW0xFVkVMU1tpXV0gPSBkZWJ1ZyhuYW1lICsgJzonICsgTEVWRUxTW2ldKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExvZ2dlcjtcbiIsIi8qZ2xvYmFscyBkZWZpbmUqL1xuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEFyUG9pbnRMaXN0UGF0aCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludExpc3QnKTtcblxuLy8gQXV0b1JvdXRlclBhdGhcbnZhciBBdXRvUm91dGVyUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmlkID0gJ05vbmUnO1xuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvcnRzID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvcnRzID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9ydCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb3J0ID0gbnVsbDtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBDT05TVEFOVFMuUGF0aERlZmF1bHQ7XG4gICAgdGhpcy5zdGF0ZSA9IENPTlNUQU5UUy5QYXRoU3RhdGVEZWZhdWx0O1xuICAgIHRoaXMuaXNBdXRvUm91dGluZ09uID0gdHJ1ZTtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gW107XG4gICAgdGhpcy5jdXN0b21pemF0aW9uVHlwZSA9ICdQb2ludHMnO1xuICAgIHRoaXMucGF0aERhdGFUb0RlbGV0ZSA9IFtdO1xuICAgIHRoaXMucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpO1xufTtcblxuXG4vLy0tLS1Qb2ludHNcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmhhc093bmVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLm93bmVyICE9PSBudWxsO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldFN0YXJ0UG9ydHMgPSBmdW5jdGlvbiAobmV3UG9ydHMpIHtcbiAgICB0aGlzLnN0YXJ0cG9ydHMgPSBuZXdQb3J0cztcblxuICAgIGlmICh0aGlzLnN0YXJ0cG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0UG9ydHMoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0RW5kUG9ydHMgPSBmdW5jdGlvbiAobmV3UG9ydHMpIHtcbiAgICB0aGlzLmVuZHBvcnRzID0gbmV3UG9ydHM7XG5cbiAgICBpZiAodGhpcy5lbmRwb3J0KSB7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlRW5kUG9ydHMoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2xlYXJQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyByZW1vdmUgdGhlIHN0YXJ0L2VuZHBvaW50cyBmcm9tIHRoZSBnaXZlbiBwb3J0c1xuICAgIGlmICh0aGlzLnN0YXJ0cG9pbnQpIHtcbiAgICAgICAgdGhpcy5zdGFydHBvcnQucmVtb3ZlUG9pbnQodGhpcy5zdGFydHBvaW50KTtcbiAgICAgICAgdGhpcy5zdGFydHBvaW50ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZW5kcG9pbnQpIHtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgICAgICB0aGlzLmVuZHBvaW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGFydHBvcnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9ydCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0U3RhcnRQb3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoLCBcbiAgICAgICAgJ0FSUG9ydC5nZXRTdGFydFBvcnQ6IENhblxcJ3QgcmV0cmlldmUgc3RhcnQgcG9ydC4gZnJvbSAnK3RoaXMuaWQpO1xuXG4gICAgaWYgKCF0aGlzLnN0YXJ0cG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0UG9ydHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb3J0O1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldEVuZFBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoLCBcbiAgICAgICAgJ0FSUG9ydC5nZXRFbmRQb3J0OiBDYW5cXCd0IHJldHJpZXZlIGVuZCBwb3J0IGZyb20gJyt0aGlzLmlkKTtcbiAgICBpZiAoIXRoaXMuZW5kcG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZUVuZFBvcnRzKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmVuZHBvcnQ7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBwb3J0IGZyb20gc3RhcnQvZW5kIHBvcnQgbGlzdHMuXG4gKlxuICogQHBhcmFtIHBvcnRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnJlbW92ZVBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIHZhciByZW1vdmVkID0gVXRpbHMucmVtb3ZlRnJvbUFycmF5cyhwb3J0LCB0aGlzLnN0YXJ0cG9ydHMsIHRoaXMuZW5kcG9ydHMpO1xuICAgIGFzc2VydChyZW1vdmVkLCAnUG9ydCB3YXMgbm90IHJlbW92ZWQgZnJvbSBwYXRoIHN0YXJ0L2VuZCBwb3J0cycpO1xuXG4gICAgLy8gSWYgbm8gbW9yZSBzdGFydC9lbmQgcG9ydHMsIHJlbW92ZSB0aGUgcGF0aFxuICAgIC8vIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoICYmIHRoaXMuZW5kcG9ydHMubGVuZ3RoLCAnUmVtb3ZlZCBhbGwgc3RhcnQvZW5kcG9ydHMgb2YgcGF0aCAnICsgdGhpcy5pZCk7XG4gICAgdGhpcy5vd25lci5kaXNjb25uZWN0KHRoaXMpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtzcmM6IHRoaXMuY2FsY3VsYXRlU3RhcnRQb3J0cygpLCBkc3Q6IHRoaXMuY2FsY3VsYXRlRW5kUG9ydHMoKX07XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlU3RhcnRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3JjUG9ydHMgPSBbXSxcbiAgICAgICAgdGd0LFxuICAgICAgICBpO1xuXG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnQXJQYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHM6IHRoaXMuc3RhcnRwb3J0cyBjYW5ub3QgYmUgZW1wdHkhJyk7XG5cbiAgICAvL1JlbW92ZSB0aGlzLnN0YXJ0cG9pbnRcbiAgICBpZiAodGhpcy5zdGFydHBvcnQgJiYgdGhpcy5zdGFydHBvcnQuaGFzUG9pbnQodGhpcy5zdGFydHBvaW50KSkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIH1cblxuICAgIC8vR2V0IGF2YWlsYWJsZSBwb3J0c1xuICAgIGZvciAoaSA9IHRoaXMuc3RhcnRwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0c1tpXS5vd25lcixcbiAgICAgICAgICAgICdBUlBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogcG9ydCAnICsgdGhpcy5zdGFydHBvcnRzW2ldLmlkICsgJyBoYXMgaW52YWxpZCB0aGlzLm93bmVyIScpO1xuICAgICAgICBpZiAodGhpcy5zdGFydHBvcnRzW2ldLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgIHNyY1BvcnRzLnB1c2godGhpcy5zdGFydHBvcnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzcmNQb3J0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgc3JjUG9ydHMgPSB0aGlzLnN0YXJ0cG9ydHM7XG4gICAgfVxuXG4gICAgLy9QcmV2ZW50aW5nIHNhbWUgc3RhcnQvZW5kcG9ydFxuICAgIGlmICh0aGlzLmVuZHBvcnQgJiYgc3JjUG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBpID0gc3JjUG9ydHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoc3JjUG9ydHNbaV0gPT09IHRoaXMuZW5kcG9ydCkge1xuICAgICAgICAgICAgICAgIHNyY1BvcnRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gR2V0dGluZyB0YXJnZXRcbiAgICBpZiAodGhpcy5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICB2YXIgYWNjdW11bGF0ZVBvcnRDZW50ZXJzID0gZnVuY3Rpb24gKHByZXYsIGN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSBjdXJyZW50LnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgICAgICBwcmV2LnggKz0gY2VudGVyLng7XG4gICAgICAgICAgICBwcmV2LnkgKz0gY2VudGVyLnk7XG4gICAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgfTtcbiAgICAgICAgdGd0ID0gdGhpcy5lbmRwb3J0cy5yZWR1Y2UoYWNjdW11bGF0ZVBvcnRDZW50ZXJzLCBuZXcgQXJQb2ludCgwLCAwKSk7XG5cbiAgICAgICAgdGd0LnggLz0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG4gICAgICAgIHRndC55IC89IHRoaXMuZW5kcG9ydHMubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRndCA9IHRoaXMuY3VzdG9tUGF0aERhdGFbMF07XG4gICAgfVxuICAgIC8vIEdldCB0aGUgb3B0aW1hbCBwb3J0IHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLnN0YXJ0cG9ydCA9IFV0aWxzLmdldE9wdGltYWxQb3J0cyhzcmNQb3J0cywgdGd0KTtcblxuICAgIC8vIENyZWF0ZSBhIHRoaXMuc3RhcnRwb2ludCBhdCB0aGUgcG9ydFxuICAgIHZhciBzdGFydGRpciA9IHRoaXMuZ2V0U3RhcnREaXIoKSxcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCA9IGZhbHNlLFxuICAgICAgICBzdGFydHBvcnRDYW5IYXZlID0gdHJ1ZTtcblxuICAgIGlmIChzdGFydGRpciAhPT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCA9IHRoaXMuc3RhcnRwb3J0Lmhhc0xpbWl0ZWREaXJzKCk7XG4gICAgICAgIHN0YXJ0cG9ydENhbkhhdmUgPSB0aGlzLnN0YXJ0cG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKHN0YXJ0ZGlyLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0ZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fFx0XHRcdFx0XHRcdFx0Ly8gcmVjYWxjIHN0YXJ0ZGlyIGlmIGVtcHR5XG4gICAgICAgIHN0YXJ0cG9ydEhhc0xpbWl0ZWQgJiYgIXN0YXJ0cG9ydENhbkhhdmUpIHtcdFx0Ly8gb3IgaXMgbGltaXRlZCBhbmQgdXNlcnByZWYgaXMgaW52YWxpZFxuICAgICAgICBzdGFydGRpciA9IHRoaXMuc3RhcnRwb3J0LmdldFN0YXJ0RW5kRGlyVG8odGd0LCB0cnVlKTtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSB0aGlzLnN0YXJ0cG9ydC5jcmVhdGVTdGFydEVuZFBvaW50VG8odGd0LCBzdGFydGRpcik7XG4gICAgdGhpcy5zdGFydHBvaW50Lm93bmVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlRW5kUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGRzdFBvcnRzID0gW10sXG4gICAgICAgIHRndCxcbiAgICAgICAgaSA9IHRoaXMuZW5kcG9ydHMubGVuZ3RoO1xuXG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoID4gMCwgJ0FyUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiB0aGlzLmVuZHBvcnRzIGNhbm5vdCBiZSBlbXB0eSEnKTtcblxuICAgIC8vUmVtb3ZlIG9sZCB0aGlzLmVuZHBvaW50XG4gICAgaWYgKHRoaXMuZW5kcG9ydCAmJiB0aGlzLmVuZHBvcnQuaGFzUG9pbnQodGhpcy5lbmRwb2ludCkpIHtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgIH1cblxuICAgIC8vR2V0IGF2YWlsYWJsZSBwb3J0c1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHNbaV0ub3duZXIsICdBUlBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogdGhpcy5lbmRwb3J0IGhhcyBpbnZhbGlkIHRoaXMub3duZXIhJyk7XG4gICAgICAgIGlmICh0aGlzLmVuZHBvcnRzW2ldLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgIGRzdFBvcnRzLnB1c2godGhpcy5lbmRwb3J0c1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZHN0UG9ydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRzdFBvcnRzID0gdGhpcy5lbmRwb3J0cztcbiAgICB9XG5cbiAgICAvL1ByZXZlbnRpbmcgc2FtZSBzdGFydC90aGlzLmVuZHBvcnRcbiAgICBpZiAodGhpcy5zdGFydHBvcnQgJiYgZHN0UG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBpID0gZHN0UG9ydHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoZHN0UG9ydHNbaV0gPT09IHRoaXMuc3RhcnRwb3J0KSB7XG4gICAgICAgICAgICAgICAgZHN0UG9ydHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9HZXR0aW5nIHRhcmdldFxuICAgIGlmICh0aGlzLmlzQXV0b1JvdXRlZCgpKSB7XG5cbiAgICAgICAgdmFyIGFjY3VtdWxhdGVQb3J0Q2VudGVycyA9IGZ1bmN0aW9uIChwcmV2LCBjdXJyZW50KSB7XG4gICAgICAgICAgICB2YXIgY2VudGVyID0gY3VycmVudC5yZWN0LmdldENlbnRlcigpO1xuICAgICAgICAgICAgcHJldi54ICs9IGNlbnRlci54O1xuICAgICAgICAgICAgcHJldi55ICs9IGNlbnRlci55O1xuICAgICAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICAgIH07XG4gICAgICAgIHRndCA9IHRoaXMuc3RhcnRwb3J0cy5yZWR1Y2UoYWNjdW11bGF0ZVBvcnRDZW50ZXJzLCBuZXcgQXJQb2ludCgwLCAwKSk7XG5cbiAgICAgICAgdGd0LnggLz0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDtcbiAgICAgICAgdGd0LnkgLz0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRndCA9IHRoaXMuY3VzdG9tUGF0aERhdGFbdGhpcy5jdXN0b21QYXRoRGF0YS5sZW5ndGggLSAxXTtcbiAgICB9XG5cbiAgICAvL0dldCB0aGUgb3B0aW1hbCBwb3J0IHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLmVuZHBvcnQgPSBVdGlscy5nZXRPcHRpbWFsUG9ydHMoZHN0UG9ydHMsIHRndCk7XG5cbiAgICAvL0NyZWF0ZSB0aGlzLmVuZHBvaW50IGF0IHRoZSBwb3J0XG4gICAgdmFyIGVuZGRpciA9IHRoaXMuZ2V0RW5kRGlyKCksXG4gICAgICAgIHN0YXJ0ZGlyID0gdGhpcy5nZXRTdGFydERpcigpLFxuICAgICAgICBlbmRwb3J0SGFzTGltaXRlZCA9IGZhbHNlLFxuICAgICAgICBlbmRwb3J0Q2FuSGF2ZSA9IHRydWU7XG5cbiAgICBpZiAoZW5kZGlyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICBlbmRwb3J0SGFzTGltaXRlZCA9IHRoaXMuZW5kcG9ydC5oYXNMaW1pdGVkRGlycygpO1xuICAgICAgICBlbmRwb3J0Q2FuSGF2ZSA9IHRoaXMuZW5kcG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGVuZGRpciwgZmFsc2UpO1xuICAgIH1cbiAgICBpZiAoZW5kZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fCAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsaWtlIGFib3ZlXG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkICYmICFlbmRwb3J0Q2FuSGF2ZSkge1xuICAgICAgICBlbmRkaXIgPSB0aGlzLmVuZHBvcnQuZ2V0U3RhcnRFbmREaXJUbyh0Z3QsIGZhbHNlLCB0aGlzLnN0YXJ0cG9ydCA9PT0gdGhpcy5lbmRwb3J0ID9cbiAgICAgICAgICAgIHN0YXJ0ZGlyIDogQ09OU1RBTlRTLkRpck5vbmUpO1xuICAgIH1cblxuICAgIHRoaXMuZW5kcG9pbnQgPSB0aGlzLmVuZHBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvKHRndCwgZW5kZGlyKTtcbiAgICB0aGlzLmVuZHBvaW50Lm93bmVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5lbmRwb3J0O1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzQ29ubmVjdGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0ZSAmIENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmFkZFRhaWwgPSBmdW5jdGlvbiAocHQpIHtcbiAgICBhc3NlcnQoIXRoaXMuaXNDb25uZWN0ZWQoKSxcbiAgICAgICAgJ0FSUGF0aC5hZGRUYWlsOiAhdGhpcy5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgIHRoaXMucG9pbnRzLnB1c2gocHQpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmRlbGV0ZUFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKTtcbiAgICB0aGlzLnN0YXRlID0gQ09OU1RBTlRTLlBhdGhTdGF0ZURlZmF1bHQ7XG4gICAgdGhpcy5jbGVhclBvcnRzKCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0U3RhcnRCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBvcnQgPSB0aGlzLnN0YXJ0cG9ydCB8fCB0aGlzLnN0YXJ0cG9ydHNbMF07XG4gICAgcmV0dXJuIHBvcnQub3duZXIuZ2V0Um9vdEJveCgpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldEVuZEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IHRoaXMuZW5kcG9ydCB8fCB0aGlzLmVuZHBvcnRzWzBdO1xuICAgIHJldHVybiBwb3J0Lm93bmVyLmdldFJvb3RCb3goKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRPdXRPZkJveFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAoaGludERpcikge1xuICAgIHZhciBzdGFydEJveFJlY3QgPSB0aGlzLmdldFN0YXJ0Qm94KCk7XG5cbiAgICBhc3NlcnQoaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcsICdBUlBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50OiBoaW50RGlyICE9PSBDT05TVEFOVFMuRGlyU2tldyBGQUlMRUQnKTtcbiAgICBhc3NlcnQodGhpcy5wb2ludHMubGVuZ3RoID49IDIsICdBUlBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50OiB0aGlzLnBvaW50cy5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIHZhciBwb3MgPSAwLFxuICAgICAgICBwID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbcG9zKytdKSxcbiAgICAgICAgZCA9IFV0aWxzLmdldERpcih0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKTtcblxuICAgIGlmIChkID09PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICBkID0gaGludERpcjtcbiAgICB9XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZCkgRkFJTEVEJyk7XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGQpKSB7XG4gICAgICAgIHAueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHN0YXJ0Qm94UmVjdCwgZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRCb3hSZWN0LCBkKTtcbiAgICB9XG5cbiAgICAvL2Fzc2VydChVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8XG4gICAgLy8gVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCwgJ1V0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09XG4gICAgLy8gVXRpbHMucmV2ZXJzZURpciAoIGQgKSB8fCBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0T3V0T2ZCb3hFbmRQb2ludCA9IGZ1bmN0aW9uIChoaW50RGlyKSB7XG4gICAgdmFyIGVuZEJveFJlY3QgPSB0aGlzLmdldEVuZEJveCgpO1xuXG4gICAgYXNzZXJ0KGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3LCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3IEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLnBvaW50cy5sZW5ndGggPj0gMiwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiB0aGlzLnBvaW50cy5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIHZhciBwb3MgPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxLFxuICAgICAgICBwID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbcG9zLS1dKSxcbiAgICAgICAgZCA9IFV0aWxzLmdldERpcih0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKTtcblxuICAgIGlmIChkID09PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICBkID0gaGludERpcjtcbiAgICB9XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGQpIEZBSUxFRCcpO1xuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkKSkge1xuICAgICAgICBwLnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRCb3hSZWN0LCBkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwLnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRCb3hSZWN0LCBkKTtcbiAgICB9XG5cbiAgICAvL2Fzc2VydChVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8XG4gICAgLy8gVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiBVdGlscy5nZXREaXJcbiAgICAvLyAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IGQgfHwgVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNpbXBsaWZ5VHJpdmlhbGx5ID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCghdGhpcy5pc0Nvbm5lY3RlZCgpLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiAhaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLnBvaW50cy5sZW5ndGggPD0gMikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIHBvczEgPSBwb3M7XG5cbiAgICBhc3NlcnQocG9zMSAhPT0gdGhpcy5wb2ludHMubGVuZ3RoLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiBwb3MxICE9PSB0aGlzLnBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgdmFyIHAxID0gdGhpcy5wb2ludHNbcG9zKytdLFxuICAgICAgICBwb3MyID0gcG9zO1xuXG4gICAgYXNzZXJ0KHBvczIgIT09IHRoaXMucG9pbnRzLmxlbmd0aCwgJ0FSUGF0aC5zaW1wbGlmeVRyaXZpYWxseTogcG9zMiAhPT0gdGhpcy5wb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuICAgIHZhciBwMiA9IHRoaXMucG9pbnRzW3BvcysrXSxcbiAgICAgICAgZGlyMTIgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKSxcbiAgICAgICAgcG9zMyA9IHBvcztcblxuICAgIGFzc2VydChwb3MzICE9PSB0aGlzLnBvaW50cy5sZW5ndGgsICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6IHBvczMgIT09IHRoaXMucG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICB2YXIgcDMgPSB0aGlzLnBvaW50c1twb3MrK10sXG4gICAgICAgIGRpcjIzID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAyKSk7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBpZiAoZGlyMTIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8IGRpcjIzID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fFxuICAgICAgICAgICAgKGRpcjEyICE9PSBDT05TVEFOVFMuRGlyU2tldyAmJiBkaXIyMyAhPT0gQ09OU1RBTlRTLkRpclNrZXcgJiZcbiAgICAgICAgICAgIChkaXIxMiA9PT0gZGlyMjMgfHwgZGlyMTIgPT09IFV0aWxzLnJldmVyc2VEaXIoZGlyMjMpKSApKSB7XG4gICAgICAgICAgICB0aGlzLnBvaW50cy5zcGxpY2UocG9zMiwgMSk7XG4gICAgICAgICAgICBwb3MtLTtcbiAgICAgICAgICAgIHBvczMtLTtcbiAgICAgICAgICAgIGRpcjEyID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3MxID0gcG9zMjtcbiAgICAgICAgICAgIHAxID0gcDI7XG4gICAgICAgICAgICBkaXIxMiA9IGRpcjIzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvcyA9PT0gdGhpcy5wb2ludHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBwb3MyID0gcG9zMztcbiAgICAgICAgcDIgPSBwMztcblxuICAgICAgICBwb3MzID0gcG9zO1xuICAgICAgICBwMyA9IHRoaXMucG9pbnRzW3BvcysrXTtcblxuICAgICAgICBkaXIyMyA9IFV0aWxzLmdldERpcihwMy5taW51cyhwMikpO1xuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRQb2ludExpc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucG9pbnRzO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzUGF0aENsaXAgPSBmdW5jdGlvbiAociwgaXNTdGFydE9yRW5kUmVjdCkge1xuICAgIHZhciB0bXAgPSB0aGlzLnBvaW50cy5nZXRUYWlsRWRnZSgpLFxuICAgICAgICBhID0gdG1wLnN0YXJ0LFxuICAgICAgICBiID0gdG1wLmVuZCxcbiAgICAgICAgcG9zID0gdG1wLnBvcyxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIG51bUVkZ2VzID0gdGhpcy5wb2ludHMubGVuZ3RoIC0gMTtcblxuICAgIHdoaWxlIChwb3MgPj0gMCkge1xuICAgICAgICBpZiAoaXNTdGFydE9yRW5kUmVjdCAmJiAoIGkgPT09IDAgfHwgaSA9PT0gbnVtRWRnZXMgLSAxICkpIHtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50SW4oYSwgciwgMSkgJiZcbiAgICAgICAgICAgICAgICBVdGlscy5pc1BvaW50SW4oYiwgciwgMSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc0xpbmVDbGlwUmVjdChhLCBiLCByKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSB0aGlzLnBvaW50cy5nZXRQcmV2RWRnZShwb3MsIGEsIGIpO1xuICAgICAgICBhID0gdG1wLnN0YXJ0O1xuICAgICAgICBiID0gdG1wLmVuZDtcbiAgICAgICAgcG9zID0gdG1wLnBvcztcbiAgICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5pc0ZpeGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoRml4ZWQpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5pc01vdmVhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoRml4ZWQpID09PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgYXNzZXJ0KHRoaXMub3duZXIgIT09IG51bGwsICdBUlBhdGguc2V0U3RhdGU6IHRoaXMub3duZXIgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLnN0YXRlID0gcztcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kRGlyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhID0gdGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhFbmRNYXNrO1xuICAgIHJldHVybiBhICYgQ09OU1RBTlRTLlBhdGhFbmRPblRvcCA/IENPTlNUQU5UUy5EaXJUb3AgOlxuICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhFbmRPblJpZ2h0ID8gQ09OU1RBTlRTLkRpclJpZ2h0IDpcbiAgICAgICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uQm90dG9tID8gQ09OU1RBTlRTLkRpckJvdHRvbSA6XG4gICAgICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoRW5kT25MZWZ0ID8gQ09OU1RBTlRTLkRpckxlZnQgOiBDT05TVEFOVFMuRGlyTm9uZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydERpciA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYSA9IHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoU3RhcnRNYXNrO1xuICAgIHJldHVybiBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uVG9wID8gQ09OU1RBTlRTLkRpclRvcCA6XG4gICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25SaWdodCA/IENPTlNUQU5UUy5EaXJSaWdodCA6XG4gICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uQm90dG9tID8gQ09OU1RBTlRTLkRpckJvdHRvbSA6XG4gICAgICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoU3RhcnRPbkxlZnQgPyBDT05TVEFOVFMuRGlyTGVmdCA6IENPTlNUQU5UUy5EaXJOb25lO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldEVuZERpciA9IGZ1bmN0aW9uIChwYXRoRW5kKSB7XG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gKHRoaXMuYXR0cmlidXRlcyAmIH5DT05TVEFOVFMuUGF0aEVuZE1hc2spICsgcGF0aEVuZDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGFydERpciA9IGZ1bmN0aW9uIChwYXRoU3RhcnQpIHtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSAodGhpcy5hdHRyaWJ1dGVzICYgfkNPTlNUQU5UUy5QYXRoU3RhcnRNYXNrKSArIHBhdGhTdGFydDtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjdXN0b20gcG9pbnRzIG9mIHRoZSBwYXRoIGFuZCBkZXRlcm1pbmUgc3RhcnQvZW5kIHBvaW50cy9wb3J0cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5PEFyUG9pbnQ+fSBwb2ludHNcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldEN1c3RvbVBhdGhQb2ludHMgPSBmdW5jdGlvbiAocG9pbnRzKSB7XG4gICAgdGhpcy5jdXN0b21QYXRoRGF0YSA9IHBvaW50cztcblxuICAgIC8vIEZpbmQgdGhlIHN0YXJ0L2VuZHBvcnRzXG4gICAgdGhpcy5jYWxjdWxhdGVTdGFydEVuZFBvcnRzKCk7XG5cbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKS5jb25jYXQocG9pbnRzKTtcblxuICAgIC8vIEFkZCB0aGUgc3RhcnQvZW5kIHBvaW50cyB0byB0aGUgbGlzdFxuICAgIHRoaXMucG9pbnRzLnVuc2hpZnQodGhpcy5zdGFydHBvaW50KTtcbiAgICB0aGlzLnBvaW50cy5wdXNoKHRoaXMuZW5kcG9pbnQpO1xuXG4gICAgLy8gU2V0IGFzIGNvbm5lY3RlZFxuICAgIHRoaXMuc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY3JlYXRlQ3VzdG9tUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnBvaW50cy5zaGlmdCgpO1xuICAgIHRoaXMucG9pbnRzLnBvcCgpO1xuXG4gICAgdGhpcy5wb2ludHMudW5zaGlmdCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIHRoaXMucG9pbnRzLnB1c2godGhpcy5lbmRwb2ludCk7XG5cbiAgICB0aGlzLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnJlbW92ZVBhdGhDdXN0b21pemF0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gW107XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYXJlVGhlcmVQYXRoQ3VzdG9taXphdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tUGF0aERhdGEubGVuZ3RoICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzQXV0b1JvdXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pc0F1dG9Sb3V0aW5nT247XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0QXV0b1JvdXRpbmcgPSBmdW5jdGlvbiAoYXJTdGF0ZSkge1xuICAgIHRoaXMuaXNBdXRvUm91dGluZ09uID0gYXJTdGF0ZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgdGhpcy5zdGFydHBvcnQucmVtb3ZlUG9pbnQodGhpcy5zdGFydHBvaW50KTtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaTtcblxuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoID4gMCwgJ1BhdGggaGFzIG5vIHN0YXJ0cG9ydHMhJyk7XG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoID4gMCwgJ1BhdGggaGFzIG5vIGVuZHBvcnRzIScpO1xuXG4gICAgZm9yIChpID0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydHNbaV0uYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLmVuZHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmVuZHBvcnRzW2ldLmFzc2VydFZhbGlkKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNBdXRvUm91dGVkKCkpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgYXNzZXJ0KHRoaXMucG9pbnRzLmxlbmd0aCAhPT0gMCxcbiAgICAgICAgICAgICAgICAnQVJQYXRoLmFzc2VydFZhbGlkOiB0aGlzLnBvaW50cy5sZW5ndGggIT09IDAgRkFJTEVEJyk7XG4gICAgICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5nZXRQb2ludExpc3QoKTtcbiAgICAgICAgICAgIHBvaW50cy5hc3NlcnRWYWxpZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgaXQgaGFzIGEgc3RhcnRwb2ludCwgbXVzdCBhbHNvIGhhdmUgYSBzdGFydHBvcnRcbiAgICBpZiAodGhpcy5zdGFydHBvaW50KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydCwgJ1BhdGggaGFzIGEgc3RhcnRwb2ludCB3aXRob3V0IGEgc3RhcnRwb3J0Jyk7XG4gICAgfVxuICAgIGlmICh0aGlzLmVuZHBvaW50KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLmVuZHBvcnQsICdQYXRoIGhhcyBhIGVuZHBvaW50IHdpdGhvdXQgYSBlbmRwb3J0Jyk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMub3duZXIsICdQYXRoIGRvZXMgbm90IGhhdmUgb3duZXIhJyk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJQYXRoO1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpO1xuXG52YXIgQXJQb2ludCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgLy8gTXVsdGlwbGUgQ29uc3RydWN0b3JzXG4gICAgaWYgKHggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB4ID0gMDtcbiAgICAgICAgeSA9IDA7XG4gICAgfSBlbHNlIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHgueTtcbiAgICAgICAgeCA9IHgueDtcbiAgICB9XG5cbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBwb2ludHMgaGF2ZSB0aGUgc2FtZSBjb29yZGluYXRlcy5cbiAqXG4gKiBAcGFyYW0ge0FyUG9pbnR9IG90aGVyUG9pbnRcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkFyUG9pbnQucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlclBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMueCA9PT0gb3RoZXJQb2ludC54ICYmIHRoaXMueSA9PT0gb3RoZXJQb2ludC55O1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgdGhpcy54ICs9IG90aGVyT2JqZWN0LmR4O1xuICAgIHRoaXMueSArPSBvdGhlck9iamVjdC5keTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKG90aGVyT2JqZWN0KSB7IC8vZXF1aXZhbGVudCB0byArPVxuICAgIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QuY3g7XG4gICAgICAgIHRoaXMueSArPSBvdGhlck9iamVjdC5jeTtcbiAgICB9IGVsc2UgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QueDtcbiAgICAgICAgdGhpcy55ICs9IG90aGVyT2JqZWN0Lnk7XG4gICAgfVxufTtcblxuQXJQb2ludC5wcm90b3R5cGUuc3VidHJhY3QgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMueCAtPSBvdGhlck9iamVjdC5jeDtcbiAgICAgICAgdGhpcy55IC09IG90aGVyT2JqZWN0LmN5O1xuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMueCAtPSBvdGhlck9iamVjdC54O1xuICAgICAgICB0aGlzLnkgLT0gb3RoZXJPYmplY3QueTtcbiAgICB9XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5wbHVzID0gZnVuY3Rpb24gKG90aGVyT2JqZWN0KSB7IC8vZXF1aXZhbGVudCB0byArXG4gICAgdmFyIG9iamVjdENvcHkgPSBudWxsO1xuXG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIG9iamVjdENvcHkgPSBuZXcgQXJQb2ludCh0aGlzKTtcbiAgICAgICAgb2JqZWN0Q29weS5hZGQob3RoZXJPYmplY3QpO1xuXG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KG90aGVyT2JqZWN0KTtcbiAgICAgICAgb2JqZWN0Q29weS54ICs9IHRoaXMueDtcbiAgICAgICAgb2JqZWN0Q29weS55ICs9IHRoaXMueTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdENvcHkgfHwgdW5kZWZpbmVkO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUubWludXMgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHtcbiAgICB2YXIgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KG90aGVyT2JqZWN0KTtcblxuICAgIGlmIChvdGhlck9iamVjdC5jeCAhPT0gdW5kZWZpbmVkICYmIG90aGVyT2JqZWN0LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb2JqZWN0Q29weS5zdWJ0cmFjdCh0aGlzKTtcblxuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QueCAhPT0gdW5kZWZpbmVkICYmIG90aGVyT2JqZWN0LnkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvYmplY3RDb3B5ID0gbmV3IEFyU2l6ZSgpO1xuICAgICAgICBvYmplY3RDb3B5LmN4ID0gdGhpcy54IC0gb3RoZXJPYmplY3QueDtcbiAgICAgICAgb2JqZWN0Q29weS5jeSA9IHRoaXMueSAtIG90aGVyT2JqZWN0Lnk7XG5cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdENvcHk7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAob3RoZXJQb2ludCkge1xuICAgIHRoaXMueCA9IG90aGVyUG9pbnQueDtcbiAgICB0aGlzLnkgPSBvdGhlclBvaW50Lnk7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAnKCcgKyB0aGlzLnggKyAnLCAnICsgdGhpcy55ICsgJyknO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclBvaW50O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLCAgLy8gRklYTUVcbiAgICBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuUG9pbnRMaXN0Jyk7XG5cbnZhciBBclBvaW50TGlzdFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy51bnNoaWZ0KGFyZ3VtZW50c1tpXSk7XG4gICAgfVxufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZSA9IFtdO1xuXG4vLyBXcmFwcGVyIEZ1bmN0aW9uc1xuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCkge1xuICAgIHZhciBuZXdQb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBuZXdQb2ludHMucHVzaCh0aGlzW2ldKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICBuZXdQb2ludHMucHVzaChsaXN0W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1BvaW50cztcbn07XG5cbi8vIEZ1bmN0aW9uc1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpc1t0aGlzLmxlbmd0aCAtIDFdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRUYWlsRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxlbmd0aDtcbiAgICB9XG5cbiAgICB2YXIgcG9zID0gdGhpcy5sZW5ndGggLSAxLFxuICAgICAgICBlbmQgPSB0aGlzW3Bvcy0tXSxcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG5cbiAgICByZXR1cm4geydwb3MnOiBwb3MsICdzdGFydCc6IHN0YXJ0LCAnZW5kJzogZW5kfTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0UHJldkVkZ2UgPSBmdW5jdGlvbiAocG9zLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgZW5kID0gdGhpc1twb3MtLV07XG4gICAgaWYgKHBvcyAhPT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG4gICAgfVxuXG4gICAgcmV0dXJuIHsncG9zJzogcG9zLCAnc3RhcnQnOiBzdGFydCwgJ2VuZCc6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldEVkZ2UgPSBmdW5jdGlvbiAocG9zLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgc3RhcnQgPSB0aGlzW3BvcysrXTtcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0RWRnZTogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBlbmQgPSB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFRhaWxFZGdlUHRycyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9zID0gdGhpcy5sZW5ndGgsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBpZiAodGhpcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiB7J3Bvcyc6IHBvc307XG4gICAgfVxuXG4gICAgYXNzZXJ0KC0tcG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0VGFpbEVkZ2VQdHJzOiAtLXBvcyA8IHRoaXMubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgZW5kID0gdGhpc1twb3MtLV07XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLCAnQXJQb2ludExpc3RQYXRoLmdldFRhaWxFZGdlUHRyczogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBzdGFydCA9IHRoaXNbcG9zXTtcblxuICAgIHJldHVybiB7J3Bvcyc6IHBvcywgJ3N0YXJ0Jzogc3RhcnQsICdlbmQnOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQcmV2RWRnZVB0cnMgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgdmFyIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBlbmQgPSB0aGlzW3Bvc107XG5cbiAgICBpZiAocG9zLS0gPiAwKSB7XG4gICAgICAgIHN0YXJ0ID0gdGhpc1twb3NdO1xuICAgIH1cblxuICAgIHJldHVybiB7cG9zOiBwb3MsIHN0YXJ0OiBzdGFydCwgZW5kOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldEVuZFBvaW50ID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHBvcysrO1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCxcbiAgICAgICAgJ0FyUG9pbnRMaXN0UGF0aC5nZXRFbmRQb2ludDogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gdGhpc1twb3NdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQb2ludEJlZm9yZUVkZ2UgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zLS07XG4gICAgaWYgKHBvcyA9PT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0UG9pbnRBZnRlckVkZ2UgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zKys7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLFxuICAgICAgICAnQXJQb2ludExpc3RQYXRoLmdldFBvaW50QWZ0ZXJFZGdlOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHBvcysrO1xuICAgIGlmIChwb3MgPT09IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKG1zZykge1xuICAgIC8vIENoZWNrIHRvIG1ha2Ugc3VyZSBlYWNoIHBvaW50IG1ha2VzIGEgaG9yaXpvbnRhbC92ZXJ0aWNhbCBsaW5lIHdpdGggaXQncyBuZWlnaGJvcnNcbiAgICBtc2cgPSBtc2cgfHwgJyc7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgICBhc3NlcnQoISF0aGlzW2ldLm1pbnVzLCAnQmFkIHZhbHVlIGF0IHBvc2l0aW9uICcgKyBpICsgJyAoJyArIFV0aWxzLnN0cmluZ2lmeSh0aGlzW2ldKSArICcpJyk7XG4gICAgICAgIGFzc2VydCghIXRoaXNbaSAtIDFdLm1pbnVzLCAnQmFkIHZhbHVlIGF0IHBvc2l0aW9uICcgKyAoaSAtIDEpICsgJyAoJyArIFV0aWxzLnN0cmluZ2lmeSh0aGlzW2kgLSAxXSkgKyAnKScpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZ2V0RGlyKHRoaXNbaSAtIDFdLm1pbnVzKHRoaXNbaV0pKSksXG4gICAgICAgICAgICBtc2cgKyAnXFxuXFx0QXJQb2ludExpc3RQYXRoIGNvbnRhaW5zIHNrZXcgZWRnZTpcXG4nICsgVXRpbHMuc3RyaW5naWZ5KHRoaXMpKTtcbiAgICB9XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkUG9zID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5hc3NlcnRWYWxpZFBvczogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmR1bXBQb2ludHMgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgbXNnICs9ICcsIHBvaW50cyBkdW1wIGJlZ2luOlxcbic7XG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBwO1xuICAgIHdoaWxlIChwb3MgPCB0aGlzLmxlbmd0aCkge1xuICAgICAgICBwID0gdGhpc1twb3MrK107XG4gICAgICAgIG1zZyArPSBpICsgJy46ICgnICsgcC54ICsgJywgJyArIHAueSArICcpXFxuJztcbiAgICAgICAgaSsrO1xuICAgIH1cbiAgICBtc2cgKz0gJ3BvaW50cyBkdW1wIGVuZC4nO1xuICAgIF9sb2dnZXIuZGVidWcobXNnKTtcbiAgICByZXR1cm4gbXNnO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclBvaW50TGlzdFBhdGg7XG5cbiIsIi8qanNoaW50IG5vZGU6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJTaXplID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlNpemUnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpO1xuXG52YXIgQXV0b1JvdXRlclBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5pZCA9IG51bGw7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5saW1pdGVkRGlyZWN0aW9ucyA9IHRydWU7XG4gICAgdGhpcy5yZWN0ID0gbmV3IEFyUmVjdCgpO1xuICAgIHRoaXMuYXR0cmlidXRlcyA9IENPTlNUQU5UUy5Qb3J0RGVmYXVsdDtcblxuICAgIC8vIEZvciB0aGlzLnBvaW50cyBvbiBDT05TVEFOVFMuRGlyVG9wLCBDT05TVEFOVFMuRGlyTGVmdCwgQ09OU1RBTlRTLkRpclJpZ2h0LCBldGNcbiAgICB0aGlzLnBvaW50cyA9IFtbXSwgW10sIFtdLCBbXV07XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5hdmFpbGFibGVBcmVhID0gW107ICAvLyBhdmFpbGFibGVBcmVhcyBrZWVwcyB0cmFjayBvZiB2aXNpYmxlIChub3Qgb3ZlcmxhcHBlZCkgcG9ydGlvbnMgb2YgdGhlIHBvcnRcblxuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbGN1bGF0ZVNlbGZQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmdldFRvcExlZnQoKSkpO1xuXG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmZsb29yKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmxlZnQsIHRoaXMucmVjdC5mbG9vcikpO1xuICAgIHRoaXMucmVzZXRBdmFpbGFibGVBcmVhKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVjdC5pc1JlY3RFbXB0eSgpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWN0LmdldENlbnRlclBvaW50KCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgYXNzZXJ0KHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyxcbiAgICAgICAgJ0FSUG9ydC5zZXRSZWN0OiByLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFzc2lnbihyKTtcbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbiAgICB0aGlzLnJlc2V0QXZhaWxhYmxlQXJlYSgpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnNoaWZ0QnkgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgYXNzZXJ0KCF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSwgJ0FSUG9ydC5zaGlmdEJ5OiAhdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCkgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFkZChvZmZzZXQpO1xuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG4gICAgLy8gU2hpZnQgcG9pbnRzXG4gICAgdGhpcy5zaGlmdFBvaW50cyhvZmZzZXQpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmlzQ29ubmVjdFRvQ2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBvcnRDb25uZWN0VG9DZW50ZXIpICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmhhc0xpbWl0ZWREaXJzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmxpbWl0ZWREaXJlY3Rpb25zO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnNldExpbWl0ZWREaXJzID0gZnVuY3Rpb24gKGx0ZCkge1xuICAgIHRoaXMubGltaXRlZERpcmVjdGlvbnMgPSBsdGQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucG9ydE9uV2hpY2hFZGdlID0gZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgcmV0dXJuIFV0aWxzLm9uV2hpY2hFZGdlKHRoaXMucmVjdCwgcG9pbnQpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50T24gPSBmdW5jdGlvbiAoZGlyLCBpc1N0YXJ0KSB7XG4gICAgYXNzZXJ0KDAgPD0gZGlyICYmIGRpciA8PSAzLCAnQVJQb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T246IDAgPD0gZGlyICYmIGRpciA8PSAzIEZBSUxFRCEnKTtcblxuICAgIGlmIChpc1N0YXJ0KSB7XG4gICAgICAgIGRpciArPSA0O1xuICAgIH1cblxuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmICgxIDw8IGRpcikpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5jYW5IYXZlU3RhcnRFbmRQb2ludCA9IGZ1bmN0aW9uIChpc1N0YXJ0KSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgKGlzU3RhcnQgPyBDT05TVEFOVFMuUG9ydFN0YXJ0T25BbGwgOiBDT05TVEFOVFMuUG9ydEVuZE9uQWxsKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCA9IGZ1bmN0aW9uIChpc0hvcml6b250YWwpIHtcbiAgICByZXR1cm4gKCh0aGlzLmF0dHJpYnV0ZXMgJlxuICAgIChpc0hvcml6b250YWwgPyBDT05TVEFOVFMuUG9ydFN0YXJ0RW5kSG9yaXpvbnRhbCA6IENPTlNUQU5UUy5Qb3J0U3RhcnRFbmRWZXJ0aWNhbCkpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5nZXRTdGFydEVuZERpclRvID0gZnVuY3Rpb24gKHBvaW50LCBpc1N0YXJ0LCBub3R0aGlzKSB7XG4gICAgYXNzZXJ0KCF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSwgJ0FSUG9ydC5nZXRTdGFydEVuZERpclRvOiAhdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCkgRkFJTEVEIScpO1xuXG4gICAgbm90dGhpcyA9IG5vdHRoaXMgPyBub3R0aGlzIDogQ09OU1RBTlRTLkRpck5vbmU7IC8vIGlmIG5vdHRoaXMgaXMgdW5kZWZpbmVkLCBzZXQgaXQgdG8gQ09OU1RBTlRTLkRpck5vbmUgKC0xKVxuXG4gICAgdmFyIG9mZnNldCA9IHBvaW50Lm1pbnVzKHRoaXMucmVjdC5nZXRDZW50ZXJQb2ludCgpKSxcbiAgICAgICAgZGlyMSA9IFV0aWxzLmdldE1ham9yRGlyKG9mZnNldCk7XG5cbiAgICBpZiAoZGlyMSAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMSwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjE7XG4gICAgfVxuXG4gICAgdmFyIGRpcjIgPSBVdGlscy5nZXRNaW5vckRpcihvZmZzZXQpO1xuXG4gICAgaWYgKGRpcjIgIT09IG5vdHRoaXMgJiYgdGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjIsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIyO1xuICAgIH1cblxuICAgIHZhciBkaXIzID0gVXRpbHMucmV2ZXJzZURpcihkaXIyKTtcblxuICAgIGlmIChkaXIzICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIzLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMztcbiAgICB9XG5cbiAgICB2YXIgZGlyNCA9IFV0aWxzLnJldmVyc2VEaXIoZGlyMSk7XG5cbiAgICBpZiAoZGlyNCAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyNCwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIxLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjIsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIyO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMywgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXI0LCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyNDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yb3VuZFRvSGFsZkdyaWQgPSBmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICB2YXIgYnR3biA9IChsZWZ0ICsgcmlnaHQpIC8gMjtcbiAgICBhc3NlcnQoYnR3biA8IE1hdGgubWF4KGxlZnQsIHJpZ2h0KSAmJiBidHduID4gTWF0aC5taW4obGVmdCwgcmlnaHQpLFxuICAgICAgICAncm91bmRUb0hhbGZHcmlkOiBidHduIHZhcmlhYmxlIG5vdCBiZXR3ZWVuIGxlZnQsIHJpZ2h0IHZhbHVlcy4gUGVyaGFwcyBib3gvY29ubmVjdGlvbkFyZWEgaXMgdG9vIHNtYWxsPycpO1xuICAgIHJldHVybiBidHduO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbyA9IGZ1bmN0aW9uIChwb2ludCwgZGlyKSB7XG4gICAgLy8gY2FsY3VsYXRlIHBhdGhBbmdsZVxuICAgIHZhciBkeCA9IHBvaW50LnggLSB0aGlzLmdldENlbnRlcigpLngsXG4gICAgICAgIGR5ID0gcG9pbnQueSAtIHRoaXMuZ2V0Q2VudGVyKCkueSxcbiAgICAgICAgcGF0aEFuZ2xlID0gTWF0aC5hdGFuMigtZHksIGR4KSxcbiAgICAgICAgayA9IDAsXG4gICAgICAgIG1heFggPSB0aGlzLnJlY3QucmlnaHQsXG4gICAgICAgIG1heFkgPSB0aGlzLnJlY3QuZmxvb3IsXG4gICAgICAgIG1pblggPSB0aGlzLnJlY3QubGVmdCxcbiAgICAgICAgbWluWSA9IHRoaXMucmVjdC5jZWlsLFxuICAgICAgICByZXN1bHRQb2ludCxcbiAgICAgICAgc21hbGxlclB0ID0gbmV3IEFyUG9pbnQobWluWCwgbWluWSksICAvLyBUaGUgdGhpcy5wb2ludHMgdGhhdCB0aGUgcmVzdWx0UG9pbnQgaXMgY2VudGVyZWQgYmV0d2VlblxuICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KG1heFgsIG1heFkpO1xuXG4gICAgLy8gRmluZCB0aGUgc21hbGxlciBhbmQgbGFyZ2VyIHBvaW50c1xuICAgIC8vIEFzIHRoZSBwb2ludHMgY2Fubm90IGJlIG9uIHRoZSBjb3JuZXIgb2YgYW4gZWRnZSAoYW1iaWd1b3VzIGRpcmVjdGlvbiksIFxuICAgIC8vIHdlIHdpbGwgc2hpZnQgdGhlIG1pbiwgbWF4IGluIG9uZSBwaXhlbFxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkgeyAgLy8gc2hpZnQgeCBjb29yZGluYXRlc1xuICAgICAgICBtaW5YKys7XG4gICAgICAgIG1heFgtLTtcbiAgICB9IGVsc2UgeyAvLyBzaGlmdCB5IGNvb3JkaW5hdGVzXG4gICAgICAgIG1pblkrKztcbiAgICAgICAgbWF4WS0tO1xuICAgIH1cblxuICAgIC8vIEFkanVzdCBhbmdsZSBiYXNlZCBvbiBwYXJ0IG9mIHBvcnQgdG8gd2hpY2ggaXQgaXMgY29ubmVjdGluZ1xuICAgIHN3aXRjaCAoZGlyKSB7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgcGF0aEFuZ2xlID0gMiAqIE1hdGguUEkgLSAocGF0aEFuZ2xlICsgTWF0aC5QSSAvIDIpO1xuICAgICAgICAgICAgbGFyZ2VyUHQueSA9IHRoaXMucmVjdC5jZWlsO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICBwYXRoQW5nbGUgPSAyICogTWF0aC5QSSAtIHBhdGhBbmdsZTtcbiAgICAgICAgICAgIHNtYWxsZXJQdC54ID0gdGhpcy5yZWN0LnJpZ2h0O1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcGF0aEFuZ2xlIC09IE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgc21hbGxlclB0LnkgPSB0aGlzLnJlY3QuZmxvb3I7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgbGFyZ2VyUHQueCA9IHRoaXMucmVjdC5sZWZ0O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhBbmdsZSA8IDApIHtcbiAgICAgICAgcGF0aEFuZ2xlICs9IDIgKiBNYXRoLlBJO1xuICAgIH1cblxuICAgIHBhdGhBbmdsZSAqPSAxODAgLyBNYXRoLlBJOyAgLy8gVXNpbmcgZGVncmVlcyBmb3IgZWFzaWVyIGRlYnVnZ2luZ1xuXG4gICAgLy8gRmluZGluZyB0aGlzLnBvaW50cyBvcmRlcmluZ1xuICAgIHdoaWxlIChrIDwgdGhpcy5wb2ludHNbZGlyXS5sZW5ndGggJiYgcGF0aEFuZ2xlID4gdGhpcy5wb2ludHNbZGlyXVtrXS5wYXRoQW5nbGUpIHtcbiAgICAgICAgaysrO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnBvaW50c1tkaXJdLmxlbmd0aCkge1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgICAgbGFyZ2VyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2tdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGsgIT09IHRoaXMucG9pbnRzW2Rpcl0ubGVuZ3RoKSB7XG4gICAgICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2sgLSAxXSk7XG4gICAgICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1ba10pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2sgLSAxXSk7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3VsdFBvaW50ID0gbmV3IEFyUG9pbnQoKGxhcmdlclB0LnggKyBzbWFsbGVyUHQueCkgLyAyLCAobGFyZ2VyUHQueSArIHNtYWxsZXJQdC55KSAvIDIpO1xuICAgIHJlc3VsdFBvaW50LnBhdGhBbmdsZSA9IHBhdGhBbmdsZTtcblxuICAgIC8vIE1vdmUgdGhlIHBvaW50IG92ZXIgdG8gYW4gJ3RoaXMuYXZhaWxhYmxlQXJlYScgaWYgYXBwcm9wcmlhdGVcbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGNsb3Nlc3RBcmVhID0gMCxcbiAgICAgICAgZGlzdGFuY2UgPSBJbmZpbml0eSxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIC8vIEZpbmQgZGlzdGFuY2UgZnJvbSBlYWNoIHRoaXMuYXZhaWxhYmxlQXJlYSBhbmQgc3RvcmUgY2xvc2VzdCBpbmRleFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMF07XG4gICAgICAgIGVuZCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtpXVsxXTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNPbkVkZ2Uoc3RhcnQsIGVuZCwgcmVzdWx0UG9pbnQpKSB7XG4gICAgICAgICAgICBjbG9zZXN0QXJlYSA9IC0xO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuZGlzdGFuY2VGcm9tTGluZShyZXN1bHRQb2ludCwgc3RhcnQsIGVuZCkgPCBkaXN0YW5jZSkge1xuICAgICAgICAgICAgY2xvc2VzdEFyZWEgPSBpO1xuICAgICAgICAgICAgZGlzdGFuY2UgPSBVdGlscy5kaXN0YW5jZUZyb21MaW5lKHJlc3VsdFBvaW50LCBzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjbG9zZXN0QXJlYSAhPT0gLTEgJiYgdGhpcy5pc0F2YWlsYWJsZSgpKSB7IC8vIHJlc3VsdFBvaW50IG5lZWRzIHRvIGJlIG1vdmVkIHRvIHRoZSBjbG9zZXN0IGF2YWlsYWJsZSBhcmVhXG4gICAgICAgIHZhciBkaXIyID0gVXRpbHMuZ2V0RGlyKHRoaXMuYXZhaWxhYmxlQXJlYVtjbG9zZXN0QXJlYV1bMF0ubWludXMocmVzdWx0UG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjIpLFxuICAgICAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjIpIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChkaXIyID09PSBDT05TVEFOVFMuRGlyTGVmdCB8fCBkaXIyID09PSBDT05TVEFOVFMuRGlyVG9wKSB7IC8vIFRoZW4gcmVzdWx0UG9pbnQgbXVzdCBiZSBtb3ZlZCB1cFxuICAgICAgICAgICAgbGFyZ2VyUHQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbY2xvc2VzdEFyZWFdWzFdO1xuICAgICAgICB9IGVsc2UgeyAvLyBUaGVuIHJlc3VsdFBvaW50IG11c3QgYmUgbW92ZWQgZG93blxuICAgICAgICAgICAgc21hbGxlclB0ID0gdGhpcy5hdmFpbGFibGVBcmVhW2Nsb3Nlc3RBcmVhXVswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdFBvaW50ID0gbmV3IEFyUG9pbnQoKGxhcmdlclB0LnggKyBzbWFsbGVyUHQueCkgLyAyLCAobGFyZ2VyUHQueSArIHNtYWxsZXJQdC55KSAvIDIpO1xuICAgIH1cblxuICAgIHRoaXMucG9pbnRzW2Rpcl0uc3BsaWNlKGssIDAsIHJlc3VsdFBvaW50KTtcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKSxcbiAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHJlc3VsdFBvaW50KSkgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcmVzdWx0UG9pbnQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucmVtb3ZlUG9pbnQgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB2YXIgcmVtb3ZlZDtcblxuICAgIHJlbW92ZWQgPSBVdGlscy5yZW1vdmVGcm9tQXJyYXlzLmFwcGx5KG51bGwsIFtwdF0uY29uY2F0KHRoaXMucG9pbnRzKSk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzUG9pbnQgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGs7XG5cbiAgICB3aGlsZSAoaSA8IDQpIHsgLy9DaGVjayBhbGwgc2lkZXMgZm9yIHRoZSBwb2ludFxuICAgICAgICBrID0gdGhpcy5wb2ludHNbaV0uaW5kZXhPZihwdCk7XG5cbiAgICAgICAgaWYgKGsgPiAtMSkgeyAvL0lmIHRoZSBwb2ludCBpcyBvbiB0aGlzIHNpZGUgb2YgdGhlIHBvcnRcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2hpZnRQb2ludHMgPSBmdW5jdGlvbiAoc2hpZnQpIHtcbiAgICBmb3IgKHZhciBzID0gdGhpcy5wb2ludHMubGVuZ3RoOyBzLS07KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50c1tzXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIC8vIFNoaWZ0IHRoaXMgcG9pbnRcbiAgICAgICAgICAgIHRoaXMucG9pbnRzW3NdW2ldLmFkZChzaGlmdCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0UG9pbnRDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGNvdW50ID0gMDtcblxuICAgIHdoaWxlIChpIDwgNCkgeyAvLyBDaGVjayBhbGwgc2lkZXMgZm9yIHRoZSBwb2ludFxuICAgICAgICBjb3VudCArPSB0aGlzLnBvaW50c1tpKytdLmxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gY291bnQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucmVzZXRBdmFpbGFibGVBcmVhID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXZhaWxhYmxlQXJlYSA9IFtdO1xuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyVG9wKSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbdGhpcy5yZWN0LmdldFRvcExlZnQoKSwgbmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCldKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKENPTlNUQU5UUy5EaXJSaWdodCkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW25ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmNlaWwpLCB0aGlzLnJlY3QuZ2V0Qm90dG9tUmlnaHQoKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpckJvdHRvbSkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW25ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpLCB0aGlzLnJlY3QuZ2V0Qm90dG9tUmlnaHQoKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpckxlZnQpKSB7XG4gICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFt0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpLCBuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKV0pO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmFkanVzdEF2YWlsYWJsZUFyZWEgPSBmdW5jdGlvbiAocikge1xuICAgIC8vRm9yIGFsbCBsaW5lcyBzcGVjaWZpZWQgaW4gYXZhaWxhYmxlQXJlYXMsIGNoZWNrIGlmIHRoZSBsaW5lIFV0aWxzLmludGVyc2VjdCBzIHRoZSByZWN0YW5nbGVcbiAgICAvL0lmIGl0IGRvZXMsIHJlbW92ZSB0aGUgcGFydCBvZiB0aGUgbGluZSB0aGF0IFV0aWxzLmludGVyc2VjdCBzIHRoZSByZWN0YW5nbGVcbiAgICBpZiAoIXRoaXMucmVjdC50b3VjaGluZyhyKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGkgPSB0aGlzLmF2YWlsYWJsZUFyZWEubGVuZ3RoLFxuICAgICAgICBpbnRlcnNlY3Rpb24sXG4gICAgICAgIGxpbmU7XG5cbiAgICB3aGlsZSAoaS0tKSB7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzTGluZUNsaXBSZWN0KHRoaXMuYXZhaWxhYmxlQXJlYVtpXVswXSwgdGhpcy5hdmFpbGFibGVBcmVhW2ldWzFdLCByKSkge1xuICAgICAgICAgICAgbGluZSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5zcGxpY2UoaSwgMSlbMF07XG4gICAgICAgICAgICBpbnRlcnNlY3Rpb24gPSBVdGlscy5nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3QobGluZVswXSwgbGluZVsxXSwgcik7XG5cbiAgICAgICAgICAgIGlmICghaW50ZXJzZWN0aW9uWzBdLmVxdWFscyhsaW5lWzBdKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFtsaW5lWzBdLCBpbnRlcnNlY3Rpb25bMF1dKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpbnRlcnNlY3Rpb25bMV0uZXF1YWxzKGxpbmVbMV0pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW2ludGVyc2VjdGlvblsxXSwgbGluZVsxXV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldFRvdGFsQXZhaWxhYmxlQXJlYSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGxlbmd0aCA9IG5ldyBBclNpemUoKTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgbGVuZ3RoLmFkZCh0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMV0ubWludXModGhpcy5hdmFpbGFibGVBcmVhW2ldWzBdKSk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGxlbmd0aC5jeCA9PT0gMCB8fCBsZW5ndGguY3kgPT09IDAsXG4gICAgICAgICdBUlBvcnQuZ2V0VG90YWxBdmFpbGFibGVBcmVhOiBsZW5ndGhbMF0gPT09IDAgfHwgbGVuZ3RoWzFdID09PSAwIEZBSUxFRCcpO1xuICAgIHJldHVybiBsZW5ndGguY3ggfHwgbGVuZ3RoLmN5O1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmF2YWlsYWJsZUFyZWEubGVuZ3RoID4gMDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBDaGVjayB0aGF0IGFsbCBwb2ludHMgYXJlIG9uIGEgc2lkZSBvZiB0aGUgcG9ydFxuICAgIHZhciBwb2ludDtcblxuICAgIGFzc2VydCh0aGlzLm93bmVyLCAnUG9ydCAnICsgdGhpcy5pZCArICcgZG9lcyBub3QgaGF2ZSB2YWxpZCBvd25lciEnKTtcbiAgICBmb3IgKHZhciBzID0gdGhpcy5wb2ludHMubGVuZ3RoOyBzLS07KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50c1tzXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHBvaW50ID0gdGhpcy5wb2ludHNbc11baV07XG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHBvaW50KSksXG4gICAgICAgICAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHJlc3VsdFBvaW50KSknICtcbiAgICAgICAgICAgICAgICAnIEZBSUxFRCcpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gUmVtb3ZlIGFsbCBwb2ludHNcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcblxuICAgIC8vIFJlbW92ZSBhbGwgcG9pbnRzIGFuZCBzZWxmIGZyb20gYWxsIHBhdGhzXG4gICAgdmFyIHBvaW50LFxuICAgICAgICBwYXRoO1xuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucG9pbnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBmb3IgKHZhciBqID0gdGhpcy5wb2ludHNbaV0ubGVuZ3RoOyBqLS07KSB7XG4gICAgICAgICAgICBwb2ludCA9IHRoaXMucG9pbnRzW2ldW2pdO1xuICAgICAgICAgICAgcGF0aCA9IHBvaW50Lm93bmVyO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGgsICdzdGFydC9lbmQgcG9pbnQgZG9lcyBub3QgaGF2ZSBhbiBvd25lciEnKTtcbiAgICAgICAgICAgIHBhdGgucmVtb3ZlUG9ydCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMucG9pbnRzID0gW1tdLCBbXSwgW10sIFtdXTtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyUG9ydDtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpLFxuICAgIExvZ2dlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Mb2dnZXInKSxcbiAgICBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5SZWN0Jyk7XG5cbnZhciBBclJlY3QgPSBmdW5jdGlvbiAoTGVmdCwgQ2VpbCwgUmlnaHQsIEZsb29yKSB7XG4gICAgaWYgKExlZnQgPT09IHVuZGVmaW5lZCkgeyAvL05vIGFyZ3VtZW50c1xuICAgICAgICBMZWZ0ID0gMDtcbiAgICAgICAgQ2VpbCA9IDA7XG4gICAgICAgIFJpZ2h0ID0gMDtcbiAgICAgICAgRmxvb3IgPSAwO1xuXG4gICAgfSBlbHNlIGlmIChDZWlsID09PSB1bmRlZmluZWQgJiYgTGVmdCBpbnN0YW5jZW9mIEFyUmVjdCkgeyAvLyBPbmUgYXJndW1lbnRcbiAgICAgICAgLy8gTGVmdCBpcyBhbiBBclJlY3RcbiAgICAgICAgQ2VpbCA9IExlZnQuY2VpbDtcbiAgICAgICAgUmlnaHQgPSBMZWZ0LnJpZ2h0O1xuICAgICAgICBGbG9vciA9IExlZnQuZmxvb3I7XG4gICAgICAgIExlZnQgPSBMZWZ0LmxlZnQ7XG5cbiAgICB9IGVsc2UgaWYgKFJpZ2h0ID09PSB1bmRlZmluZWQgJiYgTGVmdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHsgLy8gVHdvIGFyZ3VtZW50c1xuICAgICAgICAvLyBDcmVhdGluZyBBclJlY3Qgd2l0aCBBclBvaW50IGFuZCBlaXRoZXIgYW5vdGhlciBBclBvaW50IG9yIEFyU2l6ZVxuICAgICAgICBpZiAoQ2VpbCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICAgICAgUmlnaHQgPSBMZWZ0LnggKyBDZWlsLmN4O1xuICAgICAgICAgICAgRmxvb3IgPSBMZWZ0LnkgKyBDZWlsLmN5O1xuICAgICAgICAgICAgQ2VpbCA9IExlZnQueTtcbiAgICAgICAgICAgIExlZnQgPSBMZWZ0Lng7XG5cbiAgICAgICAgfSBlbHNlIGlmIChMZWZ0IGluc3RhbmNlb2YgQXJQb2ludCAmJiBDZWlsIGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICAgICAgUmlnaHQgPSBNYXRoLnJvdW5kKENlaWwueCk7XG4gICAgICAgICAgICBGbG9vciA9IE1hdGgucm91bmQoQ2VpbC55KTtcbiAgICAgICAgICAgIENlaWwgPSBNYXRoLnJvdW5kKExlZnQueSk7XG4gICAgICAgICAgICBMZWZ0ID0gTWF0aC5yb3VuZChMZWZ0LngpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEFyUmVjdCBDb25zdHJ1Y3RvcicpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKEZsb29yID09PSB1bmRlZmluZWQpIHsgLy8gSW52YWxpZFxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQXJSZWN0IENvbnN0cnVjdG9yJyk7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0ID0gTWF0aC5yb3VuZChMZWZ0KTtcbiAgICB0aGlzLmNlaWwgPSBNYXRoLnJvdW5kKENlaWwpO1xuICAgIHRoaXMuZmxvb3IgPSBNYXRoLnJvdW5kKEZsb29yKTtcbiAgICB0aGlzLnJpZ2h0ID0gTWF0aC5yb3VuZChSaWdodCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4geyd4JzogKHRoaXMubGVmdCArIHRoaXMucmlnaHQpIC8gMiwgJ3knOiAodGhpcy5jZWlsICsgdGhpcy5mbG9vcikgLyAyfTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0V2lkdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnJpZ2h0IC0gdGhpcy5sZWZ0KTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0SGVpZ2h0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5mbG9vciAtIHRoaXMuY2VpbCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldFNpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBBclNpemUodGhpcy5nZXRXaWR0aCgpLCB0aGlzLmdldEhlaWdodCgpKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0VG9wTGVmdCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyUG9pbnQodGhpcy5sZWZ0LCB0aGlzLmNlaWwpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRCb3R0b21SaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyUG9pbnQodGhpcy5yaWdodCwgdGhpcy5mbG9vcik7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldENlbnRlclBvaW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJQb2ludCh0aGlzLmxlZnQgKyB0aGlzLmdldFdpZHRoKCkgLyAyLCB0aGlzLmNlaWwgKyB0aGlzLmdldEhlaWdodCgpIC8gMik7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmlzUmVjdEVtcHR5ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICgodGhpcy5sZWZ0ID49IHRoaXMucmlnaHQpICYmICh0aGlzLmNlaWwgPj0gdGhpcy5mbG9vcikpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuXG5BclJlY3QucHJvdG90eXBlLmlzUmVjdE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMubGVmdCA9PT0gMCAmJlxuICAgICAgICB0aGlzLnJpZ2h0ID09PSAwICYmXG4gICAgICAgIHRoaXMuY2VpbCA9PT0gMCAmJlxuICAgICAgICB0aGlzLmZsb29yID09PSAwKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUucHRJblJlY3QgPSBmdW5jdGlvbiAocHQpIHtcbiAgICBpZiAocHQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBwdCA9IHB0WzBdO1xuICAgIH1cblxuICAgIGlmIChwdC54ID49IHRoaXMubGVmdCAmJlxuICAgICAgICBwdC54IDw9IHRoaXMucmlnaHQgJiZcbiAgICAgICAgcHQueSA+PSB0aGlzLmNlaWwgJiZcbiAgICAgICAgcHQueSA8PSB0aGlzLmZsb29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChuTGVmdCwgbkNlaWwsIG5SaWdodCwgbkZsb29yKSB7XG4gICAgaWYgKG5DZWlsID09PSB1bmRlZmluZWQgJiYgbkxlZnQgaW5zdGFuY2VvZiBBclJlY3QpIHsgLy9cbiAgICAgICAgdGhpcy5hc3NpZ24obkxlZnQpO1xuXG4gICAgfSBlbHNlIGlmIChuUmlnaHQgPT09IHVuZGVmaW5lZCB8fCBuRmxvb3IgPT09IHVuZGVmaW5lZCkgeyAvL2ludmFsaWRcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZygnSW52YWxpZCBhcmdzIGZvciBbQXJSZWN0XS5zZXRSZWN0Jyk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxlZnQgPSBuTGVmdDtcbiAgICAgICAgdGhpcy5jZWlsID0gbkNlaWw7XG4gICAgICAgIHRoaXMucmlnaHQgPSBuUmlnaHQ7XG4gICAgICAgIHRoaXMuZmxvb3IgPSBuRmxvb3I7XG4gICAgfVxuXG59O1xuXG5BclJlY3QucHJvdG90eXBlLnNldFJlY3RFbXB0eSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHRoaXMuY2VpbCA9IDA7XG4gICAgdGhpcy5yaWdodCA9IDA7XG4gICAgdGhpcy5mbG9vciA9IDA7XG4gICAgdGhpcy5sZWZ0ID0gMDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaW5mbGF0ZVJlY3QgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIGlmICh4ICE9PSB1bmRlZmluZWQgJiYgeC5jeCAhPT0gdW5kZWZpbmVkICYmIHguY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geC5jeTtcbiAgICAgICAgeCA9IHguY3g7XG4gICAgfSBlbHNlIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHg7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0IC09IHg7XG4gICAgdGhpcy5yaWdodCArPSB4O1xuICAgIHRoaXMuY2VpbCAtPSB5O1xuICAgIHRoaXMuZmxvb3IgKz0geTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZGVmbGF0ZVJlY3QgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIGlmICh4ICE9PSB1bmRlZmluZWQgJiYgeC5jeCAhPT0gdW5kZWZpbmVkICYmIHguY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geC5jeTtcbiAgICAgICAgeCA9IHguY3g7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0ICs9IHg7XG4gICAgdGhpcy5yaWdodCAtPSB4O1xuICAgIHRoaXMuY2VpbCArPSB5O1xuICAgIHRoaXMuZmxvb3IgLT0geTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUubm9ybWFsaXplUmVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGVtcDtcblxuICAgIGlmICh0aGlzLmxlZnQgPiB0aGlzLnJpZ2h0KSB7XG4gICAgICAgIHRlbXAgPSB0aGlzLmxlZnQ7XG4gICAgICAgIHRoaXMubGVmdCA9IHRoaXMucmlnaHQ7XG4gICAgICAgIHRoaXMucmlnaHQgPSB0ZW1wO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNlaWwgPiB0aGlzLmZsb29yKSB7XG4gICAgICAgIHRlbXAgPSB0aGlzLmNlaWw7XG4gICAgICAgIHRoaXMuY2VpbCA9IHRoaXMuZmxvb3I7XG4gICAgICAgIHRoaXMuZmxvb3IgPSB0ZW1wO1xuICAgIH1cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuYXNzaWduID0gZnVuY3Rpb24gKHJlY3QpIHtcblxuICAgIHRoaXMuY2VpbCA9IHJlY3QuY2VpbDtcbiAgICB0aGlzLnJpZ2h0ID0gcmVjdC5yaWdodDtcbiAgICB0aGlzLmZsb29yID0gcmVjdC5mbG9vcjtcbiAgICB0aGlzLmxlZnQgPSByZWN0LmxlZnQ7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgaWYgKHRoaXMubGVmdCA9PT0gcmVjdC5sZWZ0ICYmXG4gICAgICAgIHRoaXMucmlnaHQgPT09IHJlY3QucmlnaHQgJiZcbiAgICAgICAgdGhpcy5jZWlsID09PSByZWN0LmNlaWwgJiZcbiAgICAgICAgdGhpcy5mbG9vciA9PT0gcmVjdC5mbG9vcikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG5cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgdmFyIGR4LFxuICAgICAgICBkeTtcbiAgICBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIGR4ID0gQXJPYmplY3QueDtcbiAgICAgICAgZHkgPSBBck9iamVjdC55O1xuXG4gICAgfSBlbHNlIGlmIChBck9iamVjdC5jeCAhPT0gdW5kZWZpbmVkICYmIEFyT2JqZWN0LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZHggPSBBck9iamVjdC5jeDtcbiAgICAgICAgZHkgPSBBck9iamVjdC5jeTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoJ0ludmFsaWQgYXJnIGZvciBbQXJSZWN0XS5hZGQgbWV0aG9kJyk7XG4gICAgfVxuXG4gICAgdGhpcy5sZWZ0ICs9IGR4O1xuICAgIHRoaXMucmlnaHQgKz0gZHg7XG4gICAgdGhpcy5jZWlsICs9IGR5O1xuICAgIHRoaXMuZmxvb3IgKz0gZHk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnN1YnRyYWN0ID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgaWYgKEFyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICB0aGlzLmRlZmxhdGVSZWN0KEFyT2JqZWN0LngsIEFyT2JqZWN0LnkpO1xuXG4gICAgfSBlbHNlIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICB0aGlzLmRlZmxhdGVSZWN0KEFyT2JqZWN0KTtcblxuICAgIH0gZWxzZSBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclJlY3QpIHtcbiAgICAgICAgdGhpcy5sZWZ0ICs9IEFyT2JqZWN0LmxlZnQ7XG4gICAgICAgIHRoaXMucmlnaHQgLT0gQXJPYmplY3QucmlnaHQ7XG4gICAgICAgIHRoaXMuY2VpbCArPSBBck9iamVjdC5jZWlsO1xuICAgICAgICB0aGlzLmZsb29yIC09IEFyT2JqZWN0LmZsb29yO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZygnSW52YWxpZCBhcmcgZm9yIFtBclJlY3RdLnN1YnRyYWN0IG1ldGhvZCcpO1xuICAgIH1cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUucGx1cyA9IGZ1bmN0aW9uIChBck9iamVjdCkge1xuICAgIHZhciByZXNPYmplY3QgPSBuZXcgQXJSZWN0KHRoaXMpO1xuICAgIHJlc09iamVjdC5hZGQoQXJPYmplY3QpO1xuXG4gICAgcmV0dXJuIHJlc09iamVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUubWludXMgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICB2YXIgcmVzT2JqZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcbiAgICByZXNPYmplY3Quc3VidHJhY3QoQXJPYmplY3QpO1xuXG4gICAgcmV0dXJuIHJlc09iamVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudW5pb25Bc3NpZ24gPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIGlmIChyZWN0LmlzUmVjdEVtcHR5KCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc1JlY3RFbXB0eSgpKSB7XG4gICAgICAgIHRoaXMuYXNzaWduKHJlY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy9UYWtlIHRoZSBvdXRlcm1vc3QgZGltZW5zaW9uXG4gICAgdGhpcy5sZWZ0ID0gTWF0aC5taW4odGhpcy5sZWZ0LCByZWN0LmxlZnQpO1xuICAgIHRoaXMucmlnaHQgPSBNYXRoLm1heCh0aGlzLnJpZ2h0LCByZWN0LnJpZ2h0KTtcbiAgICB0aGlzLmNlaWwgPSBNYXRoLm1pbih0aGlzLmNlaWwsIHJlY3QuY2VpbCk7XG4gICAgdGhpcy5mbG9vciA9IE1hdGgubWF4KHRoaXMuZmxvb3IsIHJlY3QuZmxvb3IpO1xuXG59O1xuXG5BclJlY3QucHJvdG90eXBlLnVuaW9uID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgcmVzUmVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG4gICAgcmVzUmVjdC51bmlvbkFzc2lnbihyZWN0KTtcblxuICAgIHJldHVybiByZXNSZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pbnRlcnNlY3RBc3NpZ24gPSBmdW5jdGlvbiAocmVjdDEsIHJlY3QyKSB7XG4gICAgcmVjdDIgPSByZWN0MiA/IHJlY3QyIDogdGhpcztcbiAgICAvL1NldHMgdGhpcyByZWN0IHRvIHRoZSBpbnRlcnNlY3Rpb24gcmVjdFxuICAgIHRoaXMubGVmdCA9IE1hdGgubWF4KHJlY3QxLmxlZnQsIHJlY3QyLmxlZnQpO1xuICAgIHRoaXMucmlnaHQgPSBNYXRoLm1pbihyZWN0MS5yaWdodCwgcmVjdDIucmlnaHQpO1xuICAgIHRoaXMuY2VpbCA9IE1hdGgubWF4KHJlY3QxLmNlaWwsIHJlY3QyLmNlaWwpO1xuICAgIHRoaXMuZmxvb3IgPSBNYXRoLm1pbihyZWN0MS5mbG9vciwgcmVjdDIuZmxvb3IpO1xuXG4gICAgaWYgKHRoaXMubGVmdCA+PSB0aGlzLnJpZ2h0IHx8IHRoaXMuY2VpbCA+PSB0aGlzLmZsb29yKSB7XG4gICAgICAgIHRoaXMuc2V0UmVjdEVtcHR5KCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaW50ZXJzZWN0ID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgcmVzUmVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG5cbiAgICByZXNSZWN0LmludGVyc2VjdEFzc2lnbihyZWN0KTtcbiAgICByZXR1cm4gcmVzUmVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudG91Y2hpbmcgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIC8vT25lIHBpeGVsIGlzIGFkZGVkIHRvIHRoZSBtaW5pbXVtcyBzbywgaWYgdGhleSBhcmUgbm90IGRlZW1lZCB0byBiZSB0b3VjaGluZ1xuICAgIC8vdGhlcmUgaXMgZ3VhcmFudGVlZCB0byBiZSBhdCBsZWFzZSBhIG9uZSBwaXhlbCBwYXRoIGJldHdlZW4gdGhlbVxuICAgIHJldHVybiBNYXRoLm1heChyZWN0LmxlZnQsIHRoaXMubGVmdCkgPD0gTWF0aC5taW4ocmVjdC5yaWdodCwgdGhpcy5yaWdodCkgKyAxICYmXG4gICAgICAgIE1hdGgubWF4KHJlY3QuY2VpbCwgdGhpcy5jZWlsKSA8PSBNYXRoLm1pbihyZWN0LmZsb29yLCB0aGlzLmZsb29yKSArIDE7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gcG9pbnQgaXMgb24gb25lIG9mIHRoZSBjb3JuZXJzIG9mIHRoZSByZWN0YW5nbGUuXG4gKlxuICogQHBhcmFtIHBvaW50XG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkFyUmVjdC5wcm90b3R5cGUub25Db3JuZXIgPSBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICB2YXIgb25Ib3Jpem9udGFsU2lkZSxcbiAgICAgICAgb25WZXJ0aWNhbFNpZGU7XG5cbiAgICBvbkhvcml6b250YWxTaWRlID0gcG9pbnQueCA9PT0gdGhpcy5sZWZ0IHx8IHBvaW50LnggPT09IHRoaXMucmlnaHQ7XG4gICAgb25WZXJ0aWNhbFNpZGUgPSBwb2ludC55ID09PSB0aGlzLmNlaWwgfHwgcG9pbnQueSA9PT0gdGhpcy5mbG9vcjtcblxuICAgIHJldHVybiBvbkhvcml6b250YWxTaWRlICYmIG9uVmVydGljYWxTaWRlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRUb3BMZWZ0KCkudG9TdHJpbmcoKSArICcgJyArIHRoaXMuZ2V0Qm90dG9tUmlnaHQoKS50b1N0cmluZygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclJlY3Q7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEFyU2l6ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgLy9NdWx0aXBsZSBDb25zdHJ1Y3RvcnNcbiAgICBpZiAoeCA9PT0gdW5kZWZpbmVkKSB7IC8vTm8gYXJndW1lbnRzIHdlcmUgcGFzc2VkIHRvIGNvbnN0cnVjdG9yXG4gICAgICAgIHggPSAwO1xuICAgICAgICB5ID0gMDtcbiAgICB9IGVsc2UgaWYgKHkgPT09IHVuZGVmaW5lZCkgeyAvL09uZSBhcmd1bWVudCBwYXNzZWQgdG8gY29uc3RydWN0b3JcbiAgICAgICAgeSA9IHguY3k7XG4gICAgICAgIHggPSB4LmN4O1xuICAgIH1cblxuICAgIHRoaXMuY3ggPSB4O1xuICAgIHRoaXMuY3kgPSB5O1xufTtcblxuQXJTaXplLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAob3RoZXJTaXplKSB7XG4gICAgaWYgKHRoaXMuY3ggPT09IG90aGVyU2l6ZS5jeCAmJiB0aGlzLmN5ID09PSBvdGhlclNpemUuY3kpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJTaXplLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob3RoZXJTaXplKSB7IC8vZXF1aXZhbGVudCB0byArPVxuICAgIGlmIChvdGhlclNpemUuY3ggfHwgb3RoZXJTaXplLmN5KSB7XG4gICAgICAgIHRoaXMuY3ggKz0gb3RoZXJTaXplLmN4O1xuICAgICAgICB0aGlzLmN5ICs9IG90aGVyU2l6ZS5jeTtcbiAgICB9XG4gICAgaWYgKG90aGVyU2l6ZS54IHx8IG90aGVyU2l6ZS55KSB7XG4gICAgICAgIHRoaXMuY3ggKz0gb3RoZXJTaXplLng7XG4gICAgICAgIHRoaXMuY3kgKz0gb3RoZXJTaXplLnk7XG4gICAgfVxufTtcblxuQXJTaXplLnByb3RvdHlwZS5nZXRBcnJheSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzID0gW107XG4gICAgcmVzLnB1c2godGhpcy5jeCk7XG4gICAgcmVzLnB1c2godGhpcy5jeSk7XG4gICAgcmV0dXJuIHJlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXJTaXplO1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBhc3NlcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKS5hc3NlcnQsXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50Jyk7XG5cbnZhciBfZ2V0T3B0aW1hbFBvcnRzID0gZnVuY3Rpb24gKHBvcnRzLCB0Z3QpIHtcbiAgICAvL0kgd2lsbCBnZXQgdGhlIGR4LCBkeSB0aGF0IHRvIHRoZSBzcmMvZHN0IHRhcmdldCBhbmQgdGhlbiBJIHdpbGwgY2FsY3VsYXRlXG4gICAgLy8gYSBwcmlvcml0eSB2YWx1ZSB0aGF0IHdpbGwgcmF0ZSB0aGUgcG9ydHMgYXMgY2FuZGlkYXRlcyBmb3IgdGhlIFxuICAgIC8vZ2l2ZW4gcGF0aFxuICAgIHZhciBzcmNDID0gbmV3IEFyUG9pbnQoKSwgLy9zcmMgY2VudGVyXG4gICAgICAgIHZlY3RvcixcbiAgICAgICAgcG9ydCwgLy9yZXN1bHRcbiAgICAgICAgbWF4UCA9IC1JbmZpbml0eSxcbiAgICAgICAgbWF4QXJlYSA9IDAsXG4gICAgICAgIHNQb2ludCxcbiAgICAgICAgaTtcblxuICAgIC8vR2V0IHRoZSBjZW50ZXIgcG9pbnRzIG9mIHRoZSBzcmMsZHN0IHBvcnRzXG4gICAgZm9yIChpID0gMDsgaSA8IHBvcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHNQb2ludCA9IHBvcnRzW2ldLnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgIHNyY0MueCArPSBzUG9pbnQueDtcbiAgICAgICAgc3JjQy55ICs9IHNQb2ludC55O1xuXG4gICAgICAgIC8vYWRqdXN0IG1heEFyZWFcbiAgICAgICAgaWYgKG1heEFyZWEgPCBwb3J0c1tpXS5nZXRUb3RhbEF2YWlsYWJsZUFyZWEoKSkge1xuICAgICAgICAgICAgbWF4QXJlYSA9IHBvcnRzW2ldLmdldFRvdGFsQXZhaWxhYmxlQXJlYSgpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvL0dldCB0aGUgYXZlcmFnZSBjZW50ZXIgcG9pbnQgb2Ygc3JjXG4gICAgc3JjQy54ID0gc3JjQy54IC8gcG9ydHMubGVuZ3RoO1xuICAgIHNyY0MueSA9IHNyY0MueSAvIHBvcnRzLmxlbmd0aDtcblxuICAgIC8vR2V0IHRoZSBkaXJlY3Rpb25zXG4gICAgdmVjdG9yID0gKHRndC5taW51cyhzcmNDKS5nZXRBcnJheSgpKTtcblxuICAgIC8vQ3JlYXRlIHByaW9yaXR5IGZ1bmN0aW9uXG4gICAgZnVuY3Rpb24gY3JlYXRlUHJpb3JpdHkocG9ydCwgY2VudGVyKSB7XG4gICAgICAgIHZhciBwcmlvcml0eSA9IDAsXG4gICAgICAgIC8vcG9pbnQgPSBbICBjZW50ZXIueCAtIHBvcnQucmVjdC5nZXRDZW50ZXIoKS54LCBjZW50ZXIueSAtIHBvcnQucmVjdC5nZXRDZW50ZXIoKS55XSxcbiAgICAgICAgICAgIHBvaW50ID0gW3BvcnQucmVjdC5nZXRDZW50ZXIoKS54IC0gY2VudGVyLngsIHBvcnQucmVjdC5nZXRDZW50ZXIoKS55IC0gY2VudGVyLnldLFxuICAgICAgICAgICAgbGluZUNvdW50ID0gKHBvcnQuZ2V0UG9pbnRDb3VudCgpIHx8IDEpLFxuICAgICAgICAgICAgLy9JZiB0aGVyZSBpcyBhIHByb2JsZW0gd2l0aCBtYXhBcmVhLCBqdXN0IGlnbm9yZSBkZW5zaXR5XG4gICAgICAgICAgICBkZW5zaXR5ID0gKHBvcnQuZ2V0VG90YWxBdmFpbGFibGVBcmVhKCkgLyBsaW5lQ291bnQpIC8gbWF4QXJlYSB8fCAxLFxuICAgICAgICAgICAgbWFqb3IgPSBNYXRoLmFicyh2ZWN0b3JbMF0pID4gTWF0aC5hYnModmVjdG9yWzFdKSA/IDAgOiAxLFxuICAgICAgICAgICAgbWlub3IgPSAobWFqb3IgKyAxKSAlIDI7XG5cbiAgICAgICAgaWYgKHBvaW50W21ham9yXSA+IDAgPT09IHZlY3RvclttYWpvcl0gPiAwICYmIChwb2ludFttYWpvcl0gPT09IDApID09PSAodmVjdG9yW21ham9yXSA9PT0gMCkpIHtcbiAgICAgICAgICAgIC8vaGFuZGxpbmcgdGhlID09PSAwIGVycm9yXG4gICAgICAgICAgICAvL0lmIHRoZXkgaGF2ZSB0aGUgc2FtZSBwYXJpdHksIGFzc2lnbiB0aGUgcHJpb3JpdHkgdG8gbWF4aW1pemUgdGhhdCBpcyA+IDFcbiAgICAgICAgICAgIHByaW9yaXR5ID0gKE1hdGguYWJzKHZlY3RvclttYWpvcl0pIC8gTWF0aC5hYnModmVjdG9yW21ham9yXSAtIHBvaW50W21ham9yXSkpICogMjU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9pbnRbbWlub3JdID4gMCA9PT0gdmVjdG9yW21pbm9yXSA+IDAgJiYgKHBvaW50W21pbm9yXSA9PT0gMCkgPT09ICh2ZWN0b3JbbWlub3JdID09PSAwKSkge1xuICAgICAgICAgICAgLy9oYW5kbGluZyB0aGUgPT09IDAgZXJyb3JcbiAgICAgICAgICAgIC8vSWYgdGhleSBoYXZlIHRoZSBzYW1lIHBhcml0eSwgYXNzaWduIHRoZSBwcmlvcml0eSB0byBtYXhpbWl6ZSB0aGF0IGlzIDwgMVxuICAgICAgICAgICAgcHJpb3JpdHkgKz0gdmVjdG9yW21pbm9yXSAhPT0gcG9pbnRbbWlub3JdID9cbiAgICAgICAgICAgIChNYXRoLmFicyh2ZWN0b3JbbWlub3JdKSAvIE1hdGguYWJzKHZlY3RvclttaW5vcl0gLSBwb2ludFttaW5vcl0pKSAqIDEgOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9BZGp1c3QgcHJpb3JpdHkgYmFzZWQgb24gdGhlIGRlbnNpdHkgb2YgdGhlIGxpbmVzLi4uXG4gICAgICAgIHByaW9yaXR5ICo9IGRlbnNpdHk7XG5cbiAgICAgICAgcmV0dXJuIHByaW9yaXR5O1xuICAgIH1cblxuICAgIC8vQ3JlYXRlIHByaW9yaXR5IHZhbHVlcyBmb3IgZWFjaCBwb3J0LlxuICAgIHZhciBwcmlvcml0eTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcHJpb3JpdHkgPSBjcmVhdGVQcmlvcml0eShwb3J0c1tpXSwgc3JjQykgfHwgMDtcbiAgICAgICAgaWYgKHByaW9yaXR5ID49IG1heFApIHtcbiAgICAgICAgICAgIHBvcnQgPSBwb3J0c1tpXTtcbiAgICAgICAgICAgIG1heFAgPSBwcmlvcml0eTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzc2VydChwb3J0Lm93bmVyLCAnQVJHcmFwaC5nZXRPcHRpbWFsUG9ydHM6IHBvcnQgaGFzIGludmFsaWQgb3duZXInKTtcblxuICAgIHJldHVybiBwb3J0O1xufTtcblxudmFyIF9nZXRQb2ludENvb3JkID0gZnVuY3Rpb24gKHBvaW50LCBob3JEaXIpIHtcbiAgICBpZiAoaG9yRGlyID09PSB0cnVlIHx8IF9pc0hvcml6b250YWwoaG9yRGlyKSkge1xuICAgICAgICByZXR1cm4gcG9pbnQueDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcG9pbnQueTtcbiAgICB9XG59O1xuXG52YXIgX2luZmxhdGVkUmVjdCA9IGZ1bmN0aW9uIChyZWN0LCBhKSB7XG4gICAgdmFyIHIgPSByZWN0O1xuICAgIHIuaW5mbGF0ZVJlY3QoYSwgYSk7XG4gICAgcmV0dXJuIHI7XG59O1xuXG52YXIgX2lzUG9pbnROZWFyID0gZnVuY3Rpb24gKHAxLCBwMiwgbmVhcm5lc3MpIHtcbiAgICByZXR1cm4gcDIueCAtIG5lYXJuZXNzIDw9IHAxLnggJiYgcDEueCA8PSBwMi54ICsgbmVhcm5lc3MgJiZcbiAgICAgICAgcDIueSAtIG5lYXJuZXNzIDw9IHAxLnkgJiYgcDEueSA8PSBwMi55ICsgbmVhcm5lc3M7XG59O1xuXG52YXIgX2lzUG9pbnRJbiA9IGZ1bmN0aW9uIChwb2ludCwgcmVjdCwgbmVhcm5lc3MpIHtcbiAgICB2YXIgdG1wUiA9IG5ldyBBclJlY3QocmVjdCk7XG4gICAgdG1wUi5pbmZsYXRlUmVjdChuZWFybmVzcywgbmVhcm5lc3MpO1xuICAgIHJldHVybiB0bXBSLnB0SW5SZWN0KHBvaW50KSA9PT0gdHJ1ZTtcbn07XG5cbnZhciBfaXNSZWN0SW4gPSBmdW5jdGlvbiAocjEsIHIyKSB7XG4gICAgcmV0dXJuIHIyLmxlZnQgPD0gcjEubGVmdCAmJiByMS5yaWdodCA8PSByMi5yaWdodCAmJlxuICAgICAgICByMi5jZWlsIDw9IHIxLmNlaWwgJiYgcjEuZmxvb3IgPD0gcjIuZmxvb3I7XG59O1xuXG52YXIgX2lzUmVjdENsaXAgPSBmdW5jdGlvbiAocjEsIHIyKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KCk7XG4gICAgcmV0dXJuIHJlY3QuaW50ZXJzZWN0QXNzaWduKHIxLCByMikgPT09IHRydWU7XG59O1xuXG52YXIgX2Rpc3RhbmNlRnJvbUhMaW5lID0gZnVuY3Rpb24gKHAsIHgxLCB4MiwgeSkge1xuICAgIGFzc2VydCh4MSA8PSB4MiwgJ0FySGVscGVyLmRpc3RhbmNlRnJvbUhMaW5lOiB4MSA8PSB4MiBGQUlMRUQnKTtcblxuICAgIHJldHVybiBNYXRoLm1heChNYXRoLmFicyhwLnkgLSB5KSwgTWF0aC5tYXgoeDEgLSBwLngsIHAueCAtIHgyKSk7XG59O1xuXG52YXIgX2Rpc3RhbmNlRnJvbVZMaW5lID0gZnVuY3Rpb24gKHAsIHkxLCB5MiwgeCkge1xuICAgIGFzc2VydCh5MSA8PSB5MiwgJ0FySGVscGVyLmRpc3RhbmNlRnJvbVZMaW5lOiB5MSA8PSB5MiBGQUlMRUQnKTtcblxuICAgIHJldHVybiBNYXRoLm1heChNYXRoLmFicyhwLnggLSB4KSwgTWF0aC5tYXgoeTEgLSBwLnksIHAueSAtIHkyKSk7XG59O1xuXG52YXIgX2Rpc3RhbmNlRnJvbUxpbmUgPSBmdW5jdGlvbiAocHQsIHN0YXJ0LCBlbmQpIHtcbiAgICB2YXIgZGlyID0gX2dldERpcihlbmQubWludXMoc3RhcnQpKTtcblxuICAgIGlmIChfaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgcmV0dXJuIF9kaXN0YW5jZUZyb21WTGluZShwdCwgc3RhcnQueSwgZW5kLnksIHN0YXJ0LngpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBfZGlzdGFuY2VGcm9tSExpbmUocHQsIHN0YXJ0LngsIGVuZC54LCBzdGFydC55KTtcbiAgICB9XG59O1xuXG52YXIgX2lzT25FZGdlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHB0KSB7XG4gICAgaWYgKHN0YXJ0LnggPT09IGVuZC54KSB7XHRcdFx0Ly8gdmVydGljYWwgZWRnZSwgaG9yaXpvbnRhbCBtb3ZlXG4gICAgICAgIGlmIChlbmQueCA9PT0gcHQueCAmJiBwdC55IDw9IE1hdGgubWF4KGVuZC55LCBzdGFydC55KSAmJiBwdC55ID49IE1hdGgubWluKGVuZC55LCBzdGFydC55KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0LnkgPT09IGVuZC55KSB7XHQvLyBob3Jpem9udGFsIGxpbmUsIHZlcnRpY2FsIG1vdmVcbiAgICAgICAgaWYgKHN0YXJ0LnkgPT09IHB0LnkgJiYgcHQueCA8PSBNYXRoLm1heChlbmQueCwgc3RhcnQueCkgJiYgcHQueCA+PSBNYXRoLm1pbihlbmQueCwgc3RhcnQueCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxudmFyIF9pc1BvaW50TmVhckxpbmUgPSBmdW5jdGlvbiAocG9pbnQsIHN0YXJ0LCBlbmQsIG5lYXJuZXNzKSB7XG4gICAgYXNzZXJ0KDAgPD0gbmVhcm5lc3MsICdBckhlbHBlci5pc1BvaW50TmVhckxpbmU6IDAgPD0gbmVhcm5lc3MgRkFJTEVEJyk7XG5cbiAgICAvLyBiZWdpbiBab2xtb2xcbiAgICAvLyB0aGUgcm91dGluZyBtYXkgY3JlYXRlIGVkZ2VzIHRoYXQgaGF2ZSBzdGFydD09ZW5kXG4gICAgLy8gdGh1cyBjb25mdXNpbmcgdGhpcyBhbGdvcml0aG1cbiAgICBpZiAoZW5kLnggPT09IHN0YXJ0LnggJiYgZW5kLnkgPT09IHN0YXJ0LnkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBlbmQgWm9sbW9sXG5cbiAgICB2YXIgcG9pbnQyID0gcG9pbnQ7XG5cbiAgICBwb2ludDIuc3VidHJhY3Qoc3RhcnQpO1xuXG4gICAgdmFyIGVuZDIgPSBlbmQ7XG4gICAgZW5kMi5zdWJ0cmFjdChzdGFydCk7XG5cbiAgICB2YXIgeCA9IGVuZDIueCxcbiAgICAgICAgeSA9IGVuZDIueSxcbiAgICAgICAgdSA9IHBvaW50Mi54LFxuICAgICAgICB2ID0gcG9pbnQyLnksXG4gICAgICAgIHh1eXYgPSB4ICogdSArIHkgKiB2LFxuICAgICAgICB4MnkyID0geCAqIHggKyB5ICogeTtcblxuICAgIGlmICh4dXl2IDwgMCB8fCB4dXl2ID4geDJ5Mikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGV4cHIxID0gKHggKiB2IC0geSAqIHUpO1xuICAgIGV4cHIxICo9IGV4cHIxO1xuICAgIHZhciBleHByMiA9IG5lYXJuZXNzICogbmVhcm5lc3MgKiB4MnkyO1xuXG4gICAgcmV0dXJuIGV4cHIxIDw9IGV4cHIyO1xufTtcblxudmFyIF9pc0xpbmVNZWV0SExpbmUgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgeDEsIHgyLCB5KSB7XG4gICAgYXNzZXJ0KHgxIDw9IHgyLCAnQXJIZWxwZXIuaXNMaW5lTWVldEhMaW5lOiB4MSA8PSB4MiBGQUlMRUQnKTtcbiAgICBpZiAoc3RhcnQgaW5zdGFuY2VvZiBBcnJheSkgey8vQ29udmVydGluZyBmcm9tICdwb2ludGVyJ1xuICAgICAgICBzdGFydCA9IHN0YXJ0WzBdO1xuICAgIH1cbiAgICBpZiAoZW5kIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgZW5kID0gZW5kWzBdO1xuICAgIH1cblxuICAgIGlmICghKChzdGFydC55IDw9IHkgJiYgeSA8PSBlbmQueSkgfHwgKGVuZC55IDw9IHkgJiYgeSA8PSBzdGFydC55ICkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZW5kMiA9IG5ldyBBclBvaW50KGVuZCk7XG4gICAgZW5kMi5zdWJ0cmFjdChzdGFydCk7XG4gICAgeDEgLT0gc3RhcnQueDtcbiAgICB4MiAtPSBzdGFydC54O1xuICAgIHkgLT0gc3RhcnQueTtcblxuICAgIGlmIChlbmQyLnkgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHkgPT09IDAgJiYgKCggeDEgPD0gMCAmJiAwIDw9IHgyICkgfHwgKHgxIDw9IGVuZDIueCAmJiBlbmQyLnggPD0geDIpKTtcbiAgICB9XG5cbiAgICB2YXIgeCA9ICgoZW5kMi54KSAvIGVuZDIueSkgKiB5O1xuICAgIHJldHVybiB4MSA8PSB4ICYmIHggPD0geDI7XG59O1xuXG52YXIgX2lzTGluZU1lZXRWTGluZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCB5MSwgeTIsIHgpIHtcbiAgICBhc3NlcnQoeTEgPD0geTIsICdBckhlbHBlci5pc0xpbmVNZWV0VkxpbmU6IHkxIDw9IHkyICBGQUlMRUQnKTtcbiAgICBpZiAoc3RhcnQgaW5zdGFuY2VvZiBBcnJheSkgey8vQ29udmVydGluZyBmcm9tICdwb2ludGVyJ1xuICAgICAgICBzdGFydCA9IHN0YXJ0WzBdO1xuICAgIH1cbiAgICBpZiAoZW5kIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgZW5kID0gZW5kWzBdO1xuICAgIH1cblxuICAgIGlmICghKChzdGFydC54IDw9IHggJiYgeCA8PSBlbmQueCkgfHwgKGVuZC54IDw9IHggJiYgeCA8PSBzdGFydC54ICkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZW5kMiA9IG5ldyBBclBvaW50KGVuZCk7XG4gICAgZW5kMi5zdWJ0cmFjdChzdGFydCk7XG4gICAgeTEgLT0gc3RhcnQueTtcbiAgICB5MiAtPSBzdGFydC55O1xuICAgIHggLT0gc3RhcnQueDtcblxuICAgIGlmIChlbmQyLnggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHggPT09IDAgJiYgKCggeTEgPD0gMCAmJiAwIDw9IHkyICkgfHwgKHkxIDw9IGVuZDIueSAmJiBlbmQyLnkgPD0geTIpKTtcbiAgICB9XG5cbiAgICB2YXIgeSA9ICgoZW5kMi55KSAvIGVuZDIueCkgKiB4O1xuICAgIHJldHVybiB5MSA8PSB5ICYmIHkgPD0geTI7XG59O1xuXG52YXIgX2lzTGluZUNsaXBSZWN0cyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCByZWN0cykge1xuICAgIHZhciBpID0gcmVjdHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgaWYgKF9pc0xpbmVDbGlwUmVjdChzdGFydCwgZW5kLCByZWN0c1tpXSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBfaXNMaW5lQ2xpcFJlY3QgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcmVjdCkge1xuICAgIGlmIChyZWN0LnB0SW5SZWN0KHN0YXJ0KSB8fCByZWN0LnB0SW5SZWN0KGVuZCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9pc0xpbmVNZWV0SExpbmUoc3RhcnQsIGVuZCwgcmVjdC5sZWZ0LCByZWN0LnJpZ2h0LCByZWN0LmNlaWwpIHx8XG4gICAgICAgIF9pc0xpbmVNZWV0SExpbmUoc3RhcnQsIGVuZCwgcmVjdC5sZWZ0LCByZWN0LnJpZ2h0LCByZWN0LmZsb29yKSB8fFxuICAgICAgICBfaXNMaW5lTWVldFZMaW5lKHN0YXJ0LCBlbmQsIHJlY3QuY2VpbCwgcmVjdC5mbG9vciwgcmVjdC5sZWZ0KSB8fFxuICAgICAgICBfaXNMaW5lTWVldFZMaW5lKHN0YXJ0LCBlbmQsIHJlY3QuY2VpbCwgcmVjdC5mbG9vciwgcmVjdC5yaWdodCk7XG59O1xuXG52YXIgX2dldExpbmVDbGlwUmVjdEludGVyc2VjdCA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCByZWN0KSB7XG4gICAgLy9yZXR1cm4gdGhlIGVuZHBvaW50cyBvZiB0aGUgaW50ZXJzZWN0aW9uIGxpbmVcbiAgICB2YXIgZGlyID0gX2dldERpcihlbmQubWludXMoc3RhcnQpKSxcbiAgICAgICAgZW5kcG9pbnRzID0gW25ldyBBclBvaW50KHN0YXJ0KSwgbmV3IEFyUG9pbnQoZW5kKV07XG5cbiAgICBpZiAoIV9pc0xpbmVDbGlwUmVjdChzdGFydCwgZW5kLCByZWN0KSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0OiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICAvL01ha2Ugc3VyZSB3ZSBhcmUgd29ya2luZyBsZWZ0IHRvIHJpZ2h0IG9yIHRvcCBkb3duXG4gICAgaWYgKGRpciA9PT0gQ09OU1RBTlRTLkRpckxlZnQgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyVG9wKSB7XG4gICAgICAgIGRpciA9IF9yZXZlcnNlRGlyKGRpcik7XG4gICAgICAgIGVuZHBvaW50cy5wdXNoKGVuZHBvaW50cy5zcGxpY2UoMCwgMSlbMF0pOyAvL1N3YXAgcG9pbnQgMCBhbmQgcG9pbnQgMVxuICAgIH1cblxuICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShlbmRwb2ludHNbMF0sIHJlY3QuZ2V0VG9wTGVmdCgpLCBfcmV2ZXJzZURpcihkaXIpKSkge1xuICAgICAgICBlbmRwb2ludHNbMF0uYXNzaWduKHJlY3QuZ2V0VG9wTGVmdCgpKTtcbiAgICB9XG5cbiAgICBpZiAoX2lzUG9pbnRJbkRpckZyb20oZW5kcG9pbnRzWzFdLCByZWN0LmdldEJvdHRvbVJpZ2h0KCksIGRpcikpIHtcbiAgICAgICAgZW5kcG9pbnRzWzFdLmFzc2lnbihyZWN0LmdldEJvdHRvbVJpZ2h0KCkpO1xuICAgIH1cblxuICAgIGlmIChfaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgZW5kcG9pbnRzWzBdLnkgPSBzdGFydC55O1xuICAgICAgICBlbmRwb2ludHNbMV0ueSA9IGVuZC55O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVuZHBvaW50c1swXS54ID0gc3RhcnQueDtcbiAgICAgICAgZW5kcG9pbnRzWzFdLnggPSBlbmQueDtcbiAgICB9XG5cbiAgICByZXR1cm4gZW5kcG9pbnRzO1xuXG59O1xuXG52YXIgX2ludGVyc2VjdCA9IGZ1bmN0aW9uIChhMSwgYTIsIGIxLCBiMikge1xuICAgIHJldHVybiBNYXRoLm1pbihhMSwgYTIpIDw9IE1hdGgubWF4KGIxLCBiMikgJiYgTWF0aC5taW4oYjEsIGIyKSA8PSBNYXRoLm1heChhMSwgYTIpO1xufTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFJvdXRpbmdEaXJlY3Rpb25cblxudmFyIF9pc0hvcml6b250YWwgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgcmV0dXJuIGRpciA9PT0gQ09OU1RBTlRTLkRpclJpZ2h0IHx8IGRpciA9PT0gQ09OU1RBTlRTLkRpckxlZnQ7XG59O1xuXG52YXIgX2lzVmVydGljYWwgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgcmV0dXJuIGRpciA9PT0gQ09OU1RBTlRTLkRpclRvcCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJCb3R0b207XG59O1xuXG52YXIgX2lzUmlnaHRBbmdsZSA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcCA8PSBkaXIgJiYgZGlyIDw9IENPTlNUQU5UUy5EaXJMZWZ0O1xufTtcblxudmFyIF9hcmVJblJpZ2h0QW5nbGUgPSBmdW5jdGlvbiAoZGlyMSwgZGlyMikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpcjEpICYmIF9pc1JpZ2h0QW5nbGUoZGlyMiksXG4gICAgICAgICdBckhlbHBlci5hcmVJblJpZ2h0QW5nbGU6IF9pc1JpZ2h0QW5nbGUoZGlyMSkgJiYgX2lzUmlnaHRBbmdsZShkaXIyKSBGQUlMRUQnKTtcbiAgICByZXR1cm4gX2lzSG9yaXpvbnRhbChkaXIxKSA9PT0gX2lzVmVydGljYWwoZGlyMik7XG59O1xuXG52YXIgX25leHRDbG9ja3dpc2VEaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgaWYgKF9pc1JpZ2h0QW5nbGUoZGlyKSkge1xuICAgICAgICByZXR1cm4gKChkaXIgKyAxKSAlIDQpO1xuICAgIH1cblxuICAgIHJldHVybiBkaXI7XG59O1xuXG52YXIgX3ByZXZDbG9ja3dpc2VEaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgaWYgKF9pc1JpZ2h0QW5nbGUoZGlyKSkge1xuICAgICAgICByZXR1cm4gKChkaXIgKyAzKSAlIDQpO1xuICAgIH1cblxuICAgIHJldHVybiBkaXI7XG59O1xuXG52YXIgX3JldmVyc2VEaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgaWYgKF9pc1JpZ2h0QW5nbGUoZGlyKSkge1xuICAgICAgICByZXR1cm4gKChkaXIgKyAyKSAlIDQpO1xuICAgIH1cblxuICAgIHJldHVybiBkaXI7XG59O1xuXG52YXIgX3N0ZXBPbmVJbkRpciA9IGZ1bmN0aW9uIChwb2ludCwgZGlyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLnN0ZXBPbkluRGlyOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICBwb2ludC55LS07XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgIHBvaW50LngrKztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgIHBvaW50LnkrKztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckxlZnQ6XG4gICAgICAgICAgICBwb2ludC54LS07XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbn07XG5cbnZhciBfZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20gPSBmdW5jdGlvbiAoYnVmZmVyT2JqZWN0LCBpbkRpciwgcG9pbnQpIHsgLy9Qb2ludCB0cmF2ZWxzIGluRGlyIHVudGlsIGhpdHMgY2hpbGQgYm94XG4gICAgdmFyIGNoaWxkcmVuID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLFxuICAgICAgICBpID0gLTEsXG4gICAgICAgIGJveCA9IG51bGwsXG4gICAgICAgIHJlcyA9IF9nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBpbkRpcik7XG5cbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShpbkRpciksICdnZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbTogX2lzUmlnaHRBbmdsZShpbkRpcikgRkFJTEVEJyk7XG4gICAgLy9UaGUgbmV4dCBhc3NlcnQgZmFpbHMgaWYgdGhlIHBvaW50IGlzIGluIHRoZSBvcHBvc2l0ZSBkaXJlY3Rpb24gb2YgdGhlIHJlY3RhbmdsZSB0aGF0IGl0IGlzIGNoZWNraW5nLlxuICAgIC8vIGUuZy4gVGhlIHBvaW50IGlzIGNoZWNraW5nIHdoZW4gaXQgd2lsbCBoaXQgdGhlIGJveCBmcm9tIHRoZSByaWdodCBidXQgdGhlIHBvaW50IGlzIG9uIHRoZSBsZWZ0XG4gICAgYXNzZXJ0KCFfaXNQb2ludEluRGlyRnJvbShwb2ludCwgYnVmZmVyT2JqZWN0LmJveCwgaW5EaXIpLFxuICAgICAgICAnZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb206ICFpc1BvaW50SW5EaXJGcm9tKHBvaW50LCBidWZmZXJPYmplY3QuYm94LnJlY3QsIChpbkRpcikpIEZBSUxFRCcpO1xuXG4gICAgd2hpbGUgKCsraSA8IGNoaWxkcmVuLmxlbmd0aCkge1xuXG4gICAgICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShwb2ludCwgY2hpbGRyZW5baV0sIF9yZXZlcnNlRGlyKGluRGlyKSkgJiZcbiAgICAgICAgICAgIF9pc1BvaW50QmV0d2VlblNpZGVzKHBvaW50LCBjaGlsZHJlbltpXSwgaW5EaXIpICYmXG4gICAgICAgICAgICBfaXNDb29yZEluRGlyRnJvbShyZXMsIF9nZXRSZWN0T3V0ZXJDb29yZChjaGlsZHJlbltpXSwgX3JldmVyc2VEaXIoaW5EaXIpKSwgKGluRGlyKSkpIHtcblxuICAgICAgICAgICAgcmVzID0gX2dldFJlY3RPdXRlckNvb3JkKGNoaWxkcmVuW2ldLCBfcmV2ZXJzZURpcihpbkRpcikpO1xuICAgICAgICAgICAgYm94ID0gY2hpbGRyZW5baV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geydib3gnOiBib3gsICdjb29yZCc6IHJlc307XG59O1xuXG52YXIgX2dldFJlY3RPdXRlckNvb3JkID0gZnVuY3Rpb24gKHJlY3QsIGRpcikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdVdGlscy5nZXRSZWN0T3V0ZXJDb29yZDogaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG4gICAgdmFyIHQgPSByZWN0LmNlaWwgLSAxLFxuICAgICAgICByID0gcmVjdC5yaWdodCArIDEsXG4gICAgICAgIGIgPSByZWN0LmZsb29yICsgMSxcbiAgICAgICAgbCA9IHJlY3QubGVmdCAtIDE7XG5cbiAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICByZXR1cm4gdDtcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgIHJldHVybiByO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgIHJldHVybiBiO1xuICAgIH1cblxuICAgIHJldHVybiBsO1xufTtcblxuLy9cdEluZGV4ZXM6XG4vL1x0XHRcdFx0IDA0XG4vL1x0XHRcdFx0MSAgNVxuLy9cdFx0XHRcdDMgIDdcbi8vXHRcdFx0XHQgMjZcblxudmFyIGdldERpclRhYmxlSW5kZXggPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIChvZmZzZXQuY3ggPj0gMCkgKiA0ICsgKG9mZnNldC5jeSA+PSAwKSAqIDIgKyAoTWF0aC5hYnMob2Zmc2V0LmN4KSA+PSBNYXRoLmFicyhvZmZzZXQuY3kpKTtcbn07XG5cbnZhciBtYWpvckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHRcbiAgICBdO1xuXG52YXIgX2dldE1ham9yRGlyID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiBtYWpvckRpclRhYmxlW2dldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG52YXIgbWlub3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tXG4gICAgXTtcblxudmFyIF9nZXRNaW5vckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gbWlub3JEaXJUYWJsZVtnZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxuLy9cdEZHMTIzXG4vL1x0RSAgIDRcbi8vXHREIDAgNVxuLy9cdEMgICA2XG4vLyAgQkE5ODdcblxuXG52YXIgX2V4R2V0RGlyVGFibGVJbmRleCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAvL1RoaXMgcmVxdWlyZWQgYSB2YXJpYWJsZSBhc3NpZ25tZW50OyBvdGhlcndpc2UgdGhpcyBmdW5jdGlvblxuICAgIC8vcmV0dXJuZWQgdW5kZWZpbmVkLi4uXG4gICAgdmFyIHJlcyA9XG4gICAgICAgIG9mZnNldC5jeCA+IDAgP1xuICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgIG9mZnNldC5jeSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3ggPiBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3ggPCBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA3XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN5IDwgMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN4ID4gLW9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3ggPCAtb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgNVxuICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgKG9mZnNldC5jeCA8IDAgP1xuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN5ID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLW9mZnNldC5jeCA+IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoLW9mZnNldC5jeCA8IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDExXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN5IDwgMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3ggPCBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDE0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3ggPiBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDE1XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDlcbiAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeSA8IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgKSk7XG5cbiAgICByZXR1cm4gcmVzO1xufTtcbnZhciBleE1ham9yRGlyVGFibGUgPVxuICAgIFtcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3BcbiAgICBdO1xuXG52YXIgX2V4R2V0TWFqb3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIGV4TWFqb3JEaXJUYWJsZVtfZXhHZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxudmFyIGV4TWlub3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnRcbiAgICBdO1xuXG52YXIgX2V4R2V0TWlub3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIGV4TWlub3JEaXJUYWJsZVtfZXhHZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxudmFyIF9nZXREaXIgPSBmdW5jdGlvbiAob2Zmc2V0LCBub2Rpcikge1xuICAgIGlmIChvZmZzZXQuY3ggPT09IDApIHtcbiAgICAgICAgaWYgKG9mZnNldC5jeSA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGlyO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9mZnNldC5jeSA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJCb3R0b207XG4gICAgfVxuXG4gICAgaWYgKG9mZnNldC5jeSA9PT0gMCkge1xuICAgICAgICBpZiAob2Zmc2V0LmN4ID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJSaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyTGVmdDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclNrZXc7XG59O1xuXG52YXIgX2lzUG9pbnRJbkRpckZyb21DaGlsZHJlbiA9IGZ1bmN0aW9uIChwb2ludCwgZnJvbVBhcmVudCwgZGlyKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gZnJvbVBhcmVudC5jaGlsZHJlbixcbiAgICAgICAgaSA9IDA7XG5cbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnaXNQb2ludEluRGlyRnJvbUNoaWxkcmVuOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICB3aGlsZSAoaSA8IGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICBpZiAoX2lzUG9pbnRJbkRpckZyb20ocG9pbnQsIGNoaWxkcmVuW2ldLnJlY3QsIGRpcikpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgICsraTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgX2lzUG9pbnRJbkRpckZyb20gPSBmdW5jdGlvbiAocG9pbnQsIGZyb20sIGRpcikge1xuICAgIGlmIChmcm9tIGluc3RhbmNlb2YgQXJSZWN0KSB7XG4gICAgICAgIHZhciByZWN0ID0gZnJvbTtcbiAgICAgICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmlzUG9pbnRJbkRpckZyb206IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgICAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55IDwgcmVjdC5jZWlsO1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA+PSByZWN0LnJpZ2h0O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPj0gcmVjdC5mbG9vcjtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyTGVmdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA8IHJlY3QubGVmdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5pc1BvaW50SW5EaXJGcm9tOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICAgICAgc3dpdGNoIChkaXIpIHtcbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueSA8PSBmcm9tLnk7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54ID49IGZyb20ueDtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55ID49IGZyb20ueTtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyTGVmdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA8PSBmcm9tLng7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICB9XG59O1xuXG52YXIgX2lzUG9pbnRCZXR3ZWVuU2lkZXMgPSBmdW5jdGlvbiAocG9pbnQsIHJlY3QsIGlzaG9yaXpvbnRhbCkge1xuICAgIGlmIChpc2hvcml6b250YWwgPT09IHRydWUgfHwgX2lzSG9yaXpvbnRhbChpc2hvcml6b250YWwpKSB7XG4gICAgICAgIHJldHVybiByZWN0LmNlaWwgPD0gcG9pbnQueSAmJiBwb2ludC55IDwgcmVjdC5mbG9vcjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVjdC5sZWZ0IDw9IHBvaW50LnggJiYgcG9pbnQueCA8IHJlY3QucmlnaHQ7XG59O1xuXG52YXIgX2lzQ29vcmRJbkRpckZyb20gPSBmdW5jdGlvbiAoY29vcmQsIGZyb20sIGRpcikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5pc0Nvb3JkSW5EaXJGcm9tOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG4gICAgaWYgKGZyb20gaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIGZyb20gPSBfZ2V0UG9pbnRDb29yZChmcm9tLCBkaXIpO1xuICAgIH1cblxuICAgIGlmIChkaXIgPT09IENPTlNUQU5UUy5EaXJUb3AgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyTGVmdCkge1xuICAgICAgICByZXR1cm4gY29vcmQgPD0gZnJvbTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29vcmQgPj0gZnJvbTtcbn07XG5cbi8vIFRoaXMgbmV4dCBtZXRob2Qgb25seSBzdXBwb3J0cyB1bmFtYmlndW91cyBvcmllbnRhdGlvbnMuIFRoYXQgaXMsIHRoZSBwb2ludFxuLy8gY2Fubm90IGJlIGluIGEgY29ybmVyIG9mIHRoZSByZWN0YW5nbGUuXG4vLyBOT1RFOiB0aGUgcmlnaHQgYW5kIGZsb29yIHVzZWQgdG8gYmUgLSAxLiBcbnZhciBfb25XaGljaEVkZ2UgPSBmdW5jdGlvbiAocmVjdCwgcG9pbnQpIHtcbiAgICBpZiAocG9pbnQueSA9PT0gcmVjdC5jZWlsICYmIHJlY3QubGVmdCA8IHBvaW50LnggJiYgcG9pbnQueCA8IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJUb3A7XG4gICAgfVxuXG4gICAgaWYgKHBvaW50LnkgPT09IHJlY3QuZmxvb3IgJiYgcmVjdC5sZWZ0IDwgcG9pbnQueCAmJiBwb2ludC54IDwgcmVjdC5yaWdodCkge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckJvdHRvbTtcbiAgICB9XG5cbiAgICBpZiAocG9pbnQueCA9PT0gcmVjdC5sZWZ0ICYmIHJlY3QuY2VpbCA8IHBvaW50LnkgJiYgcG9pbnQueSA8IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJMZWZ0O1xuICAgIH1cblxuICAgIGlmIChwb2ludC54ID09PSByZWN0LnJpZ2h0ICYmIHJlY3QuY2VpbCA8IHBvaW50LnkgJiYgcG9pbnQueSA8IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJSaWdodDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpck5vbmU7XG59O1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIENBckZpbmROZWFyZXN0TGluZVxuXG52YXIgQXJGaW5kTmVhcmVzdExpbmUgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB0aGlzLnBvaW50ID0gcHQ7XG4gICAgdGhpcy5kaXN0MSA9IEluZmluaXR5O1xuICAgIHRoaXMuZGlzdDIgPSBJbmZpbml0eTtcbn07XG5cbkFyRmluZE5lYXJlc3RMaW5lLnByb3RvdHlwZS5oTGluZSA9IGZ1bmN0aW9uICh4MSwgeDIsIHkpIHtcbiAgICBhc3NlcnQoeDEgPD0geDIsICdBckZpbmROZWFyZXN0TGluZS5oTGluZTogeDEgPD0geDIgIEZBSUxFRCcpO1xuXG4gICAgdmFyIGQxID0gX2Rpc3RhbmNlRnJvbUhMaW5lKHRoaXMucG9pbnQsIHgxLCB4MiwgeSksXG4gICAgICAgIGQyID0gTWF0aC5hYnModGhpcy5wb2ludC55IC0geSk7XG5cbiAgICBpZiAoZDEgPCB0aGlzLmRpc3QxIHx8IChkMSA9PT0gdGhpcy5kaXN0MSAmJiBkMiA8IHRoaXMuZGlzdDIpKSB7XG4gICAgICAgIHRoaXMuZGlzdDEgPSBkMTtcbiAgICAgICAgdGhpcy5kaXN0MiA9IGQyO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BckZpbmROZWFyZXN0TGluZS5wcm90b3R5cGUudkxpbmUgPSBmdW5jdGlvbiAoeTEsIHkyLCB4KSB7XG4gICAgYXNzZXJ0KHkxIDw9IHkyLCAnQXJGaW5kTmVhcmVzdExpbmUuaExpbmU6IHkxIDw9IHkyIEZBSUxFRCcpO1xuXG4gICAgdmFyIGQxID0gX2Rpc3RhbmNlRnJvbVZMaW5lKHRoaXMucG9pbnQsIHkxLCB5MiwgeCksXG4gICAgICAgIGQyID0gTWF0aC5hYnModGhpcy5wb2ludC54IC0geCk7XG5cbiAgICBpZiAoZDEgPCB0aGlzLmRpc3QxIHx8IChkMSA9PT0gdGhpcy5kaXN0MSAmJiBkMiA8IHRoaXMuZGlzdDIpKSB7XG4gICAgICAgIHRoaXMuZGlzdDEgPSBkMTtcbiAgICAgICAgdGhpcy5kaXN0MiA9IGQyO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BckZpbmROZWFyZXN0TGluZS5wcm90b3R5cGUud2FzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmRpc3QxIDwgSW5maW5pdHkgJiYgdGhpcy5kaXN0MiA8IEluZmluaXR5O1xufTtcblxuLy8gQ29udmVuaWVuY2UgRnVuY3Rpb25zXG52YXIgcmVtb3ZlRnJvbUFycmF5cyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHZhciBpbmRleCxcbiAgICAgICAgcmVtb3ZlZCA9IGZhbHNlLFxuICAgICAgICBhcnJheTtcblxuICAgIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgICBhcnJheSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaW5kZXggPSBhcnJheS5pbmRleE9mKHZhbHVlKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlbW92ZWQ7XG59O1xuXG52YXIgc3RyaW5naWZ5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlLCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICBpZiAoa2V5ID09PSAnb3duZXInICYmIHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUuaWQgfHwgdHlwZW9mIHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICogUm91bmQgdGhlIG51bWJlciB0byB0aGUgZ2l2ZW4gZGVjaW1hbCBwbGFjZXMuIFRydW5jYXRlIGZvbGxvd2luZyBkaWdpdHMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcGFyYW0ge051bWJlcn0gcGxhY2VzXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHJlc3VsdFxuICovXG52YXIgcm91bmRUcnVuYyA9IGZ1bmN0aW9uICh2YWx1ZSwgcGxhY2VzKSB7XG4gICAgdmFsdWUgPSArdmFsdWU7XG4gICAgdmFyIHNjYWxlID0gTWF0aC5wb3coMTAsICtwbGFjZXMpLFxuICAgICAgICBmbiA9ICdmbG9vcic7XG5cbiAgICBpZiAodmFsdWUgPCAwKSB7XG4gICAgICAgIGZuID0gJ2NlaWwnO1xuICAgIH1cblxuICAgIHJldHVybiBNYXRoW2ZuXSh2YWx1ZSAqIHNjYWxlKSAvIHNjYWxlO1xufTtcblxuLy9GbG9hdCBlcXVhbHNcbnZhciBmbG9hdEVxdWFscyA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgcmV0dXJuICgoYSAtIDAuMSkgPCBiKSAmJiAoYiA8IChhICsgMC4xKSk7XG59O1xuXG4vKipcbiAqIENvbnZlcnQgYW4gb2JqZWN0IHdpdGggaW5jcmVhc2luZyBpbnRlZ2VyIGtleXMgdG8gYW4gYXJyYXkuXG4gKiBVc2luZyBtZXRob2QgZnJvbSBodHRwOi8vanNwZXJmLmNvbS9hcmd1bWVudHMtcGVyZm9ybWFuY2UvNlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge0FycmF5fVxuICovXG52YXIgdG9BcnJheSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG9iai5sZW5ndGh8fDApLFxuICAgICAgICBpID0gMDtcbiAgICB3aGlsZSAob2JqW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzdWx0W2ldID0gb2JqW2krK107XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG52YXIgcGljayA9IGZ1bmN0aW9uKGtleXMsIG9iaikge1xuICAgIHZhciByZXMgPSB7fTtcbiAgICBmb3IgKHZhciBpID0ga2V5cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcmVzW2tleXNbaV1dID0gb2JqW2tleXNbaV1dO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufTtcblxudmFyIG5vcCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIG5vcFxufTtcblxudmFyIGFzc2VydCA9IGZ1bmN0aW9uKGNvbmQsIG1zZykge1xuICAgIGlmICghY29uZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnIHx8ICdBc3NlcnQgZmFpbGVkJyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgb25XaGljaEVkZ2U6IF9vbldoaWNoRWRnZSxcbiAgICBpc0Nvb3JkSW5EaXJGcm9tOiBfaXNDb29yZEluRGlyRnJvbSxcbiAgICBpc1BvaW50QmV0d2VlblNpZGVzOiBfaXNQb2ludEJldHdlZW5TaWRlcyxcbiAgICBpc1BvaW50SW5EaXJGcm9tOiBfaXNQb2ludEluRGlyRnJvbSxcbiAgICBpc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW46IF9pc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW4sXG4gICAgaXNQb2ludEluOiBfaXNQb2ludEluLFxuICAgIGlzUG9pbnROZWFyOiBfaXNQb2ludE5lYXIsXG4gICAgZ2V0RGlyOiBfZ2V0RGlyLFxuICAgIGV4R2V0TWlub3JEaXI6IF9leEdldE1pbm9yRGlyLFxuICAgIGV4R2V0TWFqb3JEaXI6IF9leEdldE1ham9yRGlyLFxuICAgIGV4R2V0RGlyVGFibGVJbmRleDogX2V4R2V0RGlyVGFibGVJbmRleCxcbiAgICBnZXRNaW5vckRpcjogX2dldE1pbm9yRGlyLFxuICAgIGdldE1ham9yRGlyOiBfZ2V0TWFqb3JEaXIsXG4gICAgZ2V0UmVjdE91dGVyQ29vcmQ6IF9nZXRSZWN0T3V0ZXJDb29yZCxcbiAgICBnZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbTogX2dldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tLFxuICAgIHN0ZXBPbmVJbkRpcjogX3N0ZXBPbmVJbkRpcixcbiAgICByZXZlcnNlRGlyOiBfcmV2ZXJzZURpcixcbiAgICBwcmV2Q2xvY2t3aXNlRGlyOiBfcHJldkNsb2Nrd2lzZURpcixcbiAgICBuZXh0Q2xvY2t3aXNlRGlyOiBfbmV4dENsb2Nrd2lzZURpcixcbiAgICBhcmVJblJpZ2h0QW5nbGU6IF9hcmVJblJpZ2h0QW5nbGUsXG4gICAgaXNSaWdodEFuZ2xlOiBfaXNSaWdodEFuZ2xlLFxuICAgIGlzSG9yaXpvbnRhbDogX2lzSG9yaXpvbnRhbCxcbiAgICBpbnRlcnNlY3Q6IF9pbnRlcnNlY3QsXG4gICAgZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0OiBfZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0LFxuICAgIGlzTGluZUNsaXBSZWN0OiBfaXNMaW5lQ2xpcFJlY3QsXG4gICAgaXNMaW5lQ2xpcFJlY3RzOiBfaXNMaW5lQ2xpcFJlY3RzLFxuICAgIGlzUG9pbnROZWFyTGluZTogX2lzUG9pbnROZWFyTGluZSxcbiAgICBpc09uRWRnZTogX2lzT25FZGdlLFxuICAgIGRpc3RhbmNlRnJvbUxpbmU6IF9kaXN0YW5jZUZyb21MaW5lLFxuICAgIGlzUmVjdENsaXA6IF9pc1JlY3RDbGlwLFxuICAgIGlzUmVjdEluOiBfaXNSZWN0SW4sXG4gICAgaW5mbGF0ZWRSZWN0OiBfaW5mbGF0ZWRSZWN0LFxuICAgIGdldFBvaW50Q29vcmQ6IF9nZXRQb2ludENvb3JkLFxuICAgIGdldE9wdGltYWxQb3J0czogX2dldE9wdGltYWxQb3J0cyxcbiAgICBBckZpbmROZWFyZXN0TGluZTogQXJGaW5kTmVhcmVzdExpbmUsXG5cbiAgICByZW1vdmVGcm9tQXJyYXlzOiByZW1vdmVGcm9tQXJyYXlzLFxuICAgIHN0cmluZ2lmeTogc3RyaW5naWZ5LFxuICAgIGZsb2F0RXF1YWxzOiBmbG9hdEVxdWFscyxcbiAgICByb3VuZFRydW5jOiByb3VuZFRydW5jLFxuICAgIHRvQXJyYXk6IHRvQXJyYXksXG4gICAgbm9wOiBub3AsXG4gICAgYXNzZXJ0OiBhc3NlcnQsXG4gICAgcGljazogcGljayBcbn07XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IGJyb3dzZXI6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIGFzc2VydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBdXRvUm91dGVyR3JhcGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuR3JhcGgnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0Jyk7XG5cbnZhciBBdXRvUm91dGVyID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIGludGVybmFsIHRvIGV4dGVybmFsIGlkc1xuICAgIHRoaXMuX2JveElkcyA9IHt9O1xuICAgIHRoaXMuX3BvcnRJZHMgPSB7fTtcbiAgICB0aGlzLl9wYXRoSWRzID0ge307XG5cbiAgICB0aGlzLl9ncmFwaCA9IG5ldyBBdXRvUm91dGVyR3JhcGgoKTtcbn07XG5cbi8qICogKiAqICogKiAqIFB1YmxpYyBBUEkgKiAqICogKiAqICogKi9cblxuQXV0b1JvdXRlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fZ3JhcGguY2xlYXIodHJ1ZSk7XG4gICAgdGhpcy5fYm94SWRzID0ge307XG4gICAgdGhpcy5fcG9ydElkcyA9IHt9O1xuICAgIHRoaXMuX3BhdGhJZHMgPSB7fTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldEJveCA9IGZ1bmN0aW9uKGlkLCByZWN0KSB7XG4gICAgdmFyIGJveDtcbiAgICBpZiAocmVjdCA9PT0gbnVsbCkgeyAgLy8gUmVtb3ZlIHRoZSBib3hcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZUJveChpZCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9ib3hJZHNbaWRdKSB7XG4gICAgICAgIGJveCA9IHRoaXMuX2NyZWF0ZUJveChyZWN0KTtcbiAgICAgICAgLy8gVXBkYXRlIHJlY29yZHNcbiAgICAgICAgdGhpcy5fYm94SWRzW2lkXSA9IGJveC5pZDtcbiAgICAgICAgdGhpcy5fcG9ydElkc1tpZF0gPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91cGRhdGVCb3goaWQsIHJlY3QpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldERlcGVuZGVudEJveCA9IGZ1bmN0aW9uKHBhcmVudElkLCBjaGlsZElkKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMuX2JveChwYXJlbnRJZCksXG4gICAgICAgIGNoaWxkID0gdGhpcy5fYm94KGNoaWxkSWQpO1xuXG4gICAgYXNzZXJ0KHBhcmVudCAmJiBjaGlsZCwgJ0NvdWxkIG5vdCBmaW5kIHBhcmVudCBvciBjaGlsZCcpO1xuICAgIHBhcmVudC5hZGRDaGlsZChjaGlsZCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRQb3J0ID0gZnVuY3Rpb24oYm94SWQsIHBvcnRJZCwgYXJlYSkge1xuICAgIGlmIChhcmVhID09PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3JlbW92ZVBvcnQoYm94SWQsIHBvcnRJZCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMuX2JveChib3hJZCksICdCb3ggXCInICsgYm94SWQgKyAnXCIgZG9lcyBub3QgZXhpc3QnKTtcbiAgICBpZiAoIXRoaXMuX3BvcnRJZHNbYm94SWRdIHx8ICF0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRdKSB7XG4gICAgICAgIHRoaXMuX2NyZWF0ZVBvcnQoYm94SWQsIHBvcnRJZCwgYXJlYSk7XG4gICAgICAgIGFzc2VydCh0aGlzLl9wb3J0KGJveElkLCBwb3J0SWQpLCAnUG9ydCBub3QgYWRkZWQhJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlUG9ydChib3hJZCwgcG9ydElkLCBhcmVhKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRQYXRoID0gZnVuY3Rpb24oaWQsIHNyY0lkLCBkc3RJZCkge1xuICAgIGlmIChzcmNJZCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVtb3ZlUGF0aChpZCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9wYXRoSWRzW2lkXSkge1xuICAgICAgICB0aGlzLl9jcmVhdGVQYXRoKGlkLCBzcmNJZCwgZHN0SWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVBhdGgoaWQsIHNyY0lkLCBkc3RJZCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0Q3VzdG9tUm91dGluZyA9IGZ1bmN0aW9uKGlkLCBwb2ludHMpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGgoaWQpO1xuXG4gICAgaWYgKHBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyAnQXV0b1JvdXRlcjogTmVlZCB0byBoYXZlIGFuIEF1dG9Sb3V0ZXJQYXRoIHR5cGUgdG8gc2V0IGN1c3RvbSBwYXRoIHBvaW50cyc7XG4gICAgfVxuXG4gICAgaWYgKHBvaW50cyA9PT0gbnVsbCkge1xuICAgICAgICBwYXRoLnNldEF1dG9Sb3V0aW5nKHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3NldEN1c3RvbVBhdGgocGF0aCwgcG9pbnRzKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5yb3V0ZVN5bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fZ3JhcGgucm91dGVTeW5jKCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5yb3V0ZUFzeW5jID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB0aGlzLl9ncmFwaC5yb3V0ZUFzeW5jKG9wdGlvbnMpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuYm94ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBCb3ggPSB0aGlzLl9ib3goaWQpOyAgLy8gcHJpdmF0ZSBib3hcbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIHgxOiBwQm94LnJlY3QubGVmdCxcbiAgICAgICAgeDI6IHBCb3gucmVjdC5yaWdodCxcbiAgICAgICAgeTE6IHBCb3gucmVjdC5jZWlsLFxuICAgICAgICB5MjogcEJveC5yZWN0LmZsb29yXG4gICAgfTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBvcnQgPSBmdW5jdGlvbiAoYm94SWQsIGlkKSB7XG4gICAgdmFyIHBQb3J0ID0gdGhpcy5fcG9ydChib3hJZCwgaWQpOyAgLy8gcHJpdmF0ZSBib3hcbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIHgxOiBwUG9ydC5yZWN0LmxlZnQsXG4gICAgICAgIHgyOiBwUG9ydC5yZWN0LnJpZ2h0LFxuICAgICAgICB5MTogcFBvcnQucmVjdC5jZWlsLFxuICAgICAgICB5MjogcFBvcnQucmVjdC5mbG9vclxuICAgIH07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5wYXRoID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoKGlkKTtcbiAgICByZXR1cm4geyAgLy8gVE9ETzogQ29uc2lkZXIgYWRkaW5nIHNyYywgZHN0XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgcG9pbnRzOiBwYXRoLnBvaW50cy5tYXAoZnVuY3Rpb24ocHQpIHtcbiAgICAgICAgICAgIHJldHVybiBbcHQueCwgcHQueV07XG4gICAgICAgIH0pXG4gICAgfTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLmJveGVzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9ib3hJZHMpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucG9ydHMgPSBmdW5jdGlvbiAoYm94SWQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fcG9ydElkc1tib3hJZF0pO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BhdGhJZHMpO1xufTtcblxuLyogKiAqICogKiAqICogUHJpdmF0ZSBBUEkgKiAqICogKiAqICogKi9cblxuLy8gR2V0dGVyc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fYm94ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBJZCA9IHRoaXMuX2JveElkc1tpZF07XG4gICAgcmV0dXJuIHRoaXMuX2dyYXBoLmJveGVzW3BJZF0gfHwgbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9wb3J0ID0gZnVuY3Rpb24gKGJveElkLCBpZCkge1xuICAgIGFzc2VydChib3hJZCAhPT0gdW5kZWZpbmVkICYmIGlkICE9PSB1bmRlZmluZWQsICdNaXNzaW5nICcgKyAoYm94SWQgPyAnYm94SWQnIDogJ2lkJykpO1xuICAgIHJldHVybiB0aGlzLl9wb3J0SWRzW2JveElkXVtpZF07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcGF0aCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwSWQgPSB0aGlzLl9wYXRoSWRzW2lkXTtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fZ3JhcGgucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICh0aGlzLl9ncmFwaC5wYXRoc1tpXS5pZCA9PT0gcElkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZ3JhcGgucGF0aHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyBCb3hlc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fY3JlYXRlQm94ID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgIHZhciB4MSA9IHBhcmFtcy54MSxcbiAgICAgICAgeDIgPSBwYXJhbXMueDIsXG4gICAgICAgIHkxID0gcGFyYW1zLnkxLFxuICAgICAgICB5MiA9IHBhcmFtcy55MixcbiAgICAgICAgYm94ID0gdGhpcy5fZ3JhcGguY3JlYXRlQm94KCksXG4gICAgICAgIHJlY3QgPSBuZXcgQXJSZWN0KHgxLCB5MSwgeDIsIHkyKTtcblxuICAgIGFzc2VydCghaXNOYU4oeDEgKyB4MiArIHkxICsgeTIpLCAnTWlzc2luZyBzaXplIGluZm8gZm9yIGJveCcpO1xuXG4gICAgdGhpcy5fc2V0VmFsaWRSZWN0U2l6ZShyZWN0KTtcbiAgICBib3guc2V0UmVjdChyZWN0KTtcblxuICAgIC8vIEFkZCB0aGUgYm94IHRvIHRoZSBncmFwaFxuICAgIHRoaXMuX2dyYXBoLmFkZEJveChib3gpO1xuICAgIC8vIFJlY29yZCBrZWVwaW5nIGlzIG5vdCBkb25lIGluIHRoaXMgZnVuY3Rpb24gYmMgdGhpcyBmdW5jdGlvblxuICAgIC8vIGlzIHJldXNlZCBmb3IgdGhlIHBvcnQgY29udGFpbmVyc1xuICAgIHJldHVybiBib3g7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fdXBkYXRlQm94ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMpIHsgIC8vIHB1YmxpYyBpZFxuICAgIHZhciBib3ggPSB0aGlzLl9ib3goaWQpLFxuICAgICAgICByZWN0ID0gYm94LnJlY3QsXG4gICAgICAgIG5ld1dpZHRoID0gcGFyYW1zLngyIC0gcGFyYW1zLngxLFxuICAgICAgICBuZXdIZWlnaHQgPSBwYXJhbXMueTIgLSBwYXJhbXMueTEsXG4gICAgICAgIGR4LFxuICAgICAgICBkeSxcbiAgICAgICAgbmV3UmVjdDtcblxuICAgIC8vIFNoaWZ0XG4gICAgaWYgKG5ld0hlaWdodCA9PT0gcmVjdC5nZXRIZWlnaHQoKSAmJiBuZXdXaWR0aCA9PT0gcmVjdC5nZXRXaWR0aCgpKSB7XG4gICAgICAgIGR4ID0gcGFyYW1zLngxIC0gcmVjdC5sZWZ0O1xuICAgICAgICBkeSA9IHBhcmFtcy55MSAtIHJlY3QuY2VpbDtcbiAgICAgICAgdGhpcy5fZ3JhcGguc2hpZnRCb3hCeShib3gsIHtjeDogZHgsIGN5OiBkeX0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1JlY3QgPSBuZXcgQXJSZWN0KHBhcmFtcy54MSwgcGFyYW1zLnkxLCBwYXJhbXMueDIsIHBhcmFtcy55Mik7XG4gICAgICAgIHRoaXMuX2dyYXBoLnNldEJveFJlY3QoYm94LCBuZXdSZWN0KTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9yZW1vdmVCb3ggPSBmdW5jdGlvbiAoaWQpIHsgIC8vIHB1YmxpYyBpZFxuICAgIHZhciBib3ggPSB0aGlzLl9ib3goaWQpLFxuICAgICAgICBwb3J0cyA9IE9iamVjdC5rZXlzKHRoaXMuX3BvcnRJZHNbaWRdKTtcblxuICAgIC8vIFJlbW92ZSBhbGwgcG9ydHNcbiAgICBmb3IgKHZhciBpID0gcG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuX3JlbW92ZVBvcnQoaWQsIHBvcnRzW2ldKTtcbiAgICB9XG5cbiAgICB0aGlzLl9ncmFwaC5kZWxldGVCb3goYm94KTtcbiAgICBkZWxldGUgdGhpcy5fYm94SWRzW2lkXTtcbiAgICBkZWxldGUgdGhpcy5fcG9ydElkc1tpZF07XG59O1xuXG4vLyBQYXRoc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fY3JlYXRlUGF0aCA9IGZ1bmN0aW9uIChpZCwgc3JjSWQsIGRzdElkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgc3JjUG9ydHMgPSB0aGlzLl9nZXRQb3J0c0ZvcihzcmNJZCksXG4gICAgICAgIGRzdFBvcnRzID0gdGhpcy5fZ2V0UG9ydHNGb3IoZHN0SWQpLFxuICAgICAgICBwYXRoO1xuXG4gICAgYXNzZXJ0KHNyY1BvcnRzLCAnTWlzc2luZyBzcmNQb3J0cyAoJyArIHNyY1BvcnRzICsgJyknKTtcbiAgICBhc3NlcnQoZHN0UG9ydHMsICdNaXNzaW5nIGRzdFBvcnRzICgnICsgZHN0UG9ydHMgKyAnKScpO1xuICAgIHBhdGggPSB0aGlzLl9ncmFwaC5hZGRQYXRoKHRydWUsIHNyY1BvcnRzLCBkc3RQb3J0cyk7XG4gICAgcGF0aC5pZCA9IGlkO1xuXG4gICAgdGhpcy5fcGF0aElkc1tpZF0gPSBwYXRoLmlkO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2dldFBvcnRzRm9yID0gZnVuY3Rpb24gKGJveElkKSB7XG4gICAgaWYgKGJveElkIGluc3RhbmNlb2YgQXJyYXkpIHsgIC8vIGxpc3Qgb2YgcG9ydHMgLT4gbm90IGEgYm94SWRcbiAgICAgICAgLy8gRklYTUU6IFRoZXNlIHBvcnRzIHdvdWxkIGFsc28gbmVlZCB0byBiZSByZXNvbHZlZCFcbiAgICAgICAgcmV0dXJuIGJveElkO1xuICAgIH0gZWxzZSB7ICAvLyBib3hJZCBpcyBhIGJveCBpZCAtPiBnZXQgdGhlIHBvcnRzXG4gICAgICAgIHZhciBwb3J0SWRzID0gT2JqZWN0LmtleXModGhpcy5fcG9ydElkc1tib3hJZF0pLFxuICAgICAgICAgICAgcG9ydHMgPSBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gcG9ydElkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIGFzc2VydCh0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRzW2ldXS5wb3J0cy5sZW5ndGggPT09IDEpO1xuICAgICAgICAgICAgcG9ydHMucHVzaCh0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRzW2ldXS5wb3J0c1swXSk7XG4gICAgICAgIH1cbiAgICAgICAgYXNzZXJ0KHBvcnRzLCAnbm8gcG9ydHMgZm91bmQgKCcgKyBwb3J0cyArICcpJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSBwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIGFzc2VydCAocG9ydHNbaV0ub3duZXIsICdJbnZhbGlkIG93bmVyJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvcnRzO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQYXRoID0gZnVuY3Rpb24gKGlkLCBzcmNJZCwgZHN0SWQpIHsgIC8vIHB1YmxpYyBpZFxuICAgIHRoaXMuX3JlbW92ZVBhdGgoaWQpO1xuICAgIHRoaXMuX2NyZWF0ZVBhdGgoaWQsIHNyY0lkLCBkc3RJZCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlUGF0aCA9IGZ1bmN0aW9uIChpZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoKGlkKTtcbiAgICB0aGlzLl9ncmFwaC5kZWxldGVQYXRoKHBhdGgpO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoSWRzW2lkXTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9zZXRDdXN0b21QYXRoID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cykgeyAgLy8gcHVibGljIGlkXG4gICAgcGF0aC5zZXRBdXRvUm91dGluZyh0cnVlKTtcblxuICAgIC8vIENvbnZlcnQgcG9pbnRzIHRvIGFycmF5IG9mIEFyUG9pbnRzXG4gICAgcG9pbnRzID0gcG9pbnRzLm1hcChmdW5jdGlvbiAocG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBclBvaW50KHBvaW50WzBdLCBwb2ludFsxXSk7XG4gICAgfSk7XG5cbiAgICBwYXRoLnNldEN1c3RvbVBhdGhQb2ludHMocG9pbnRzKTtcbn07XG5cbi8vIFBvcnRzXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQsIGFyZWEpIHsgIC8vIGFyZWE6IHt4MSwgeDIsIHkxLCB5Mn1cbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyLFxuICAgICAgICBjUmVjdCA9IG5ldyBBclJlY3QoKSxcbiAgICAgICAgcG9ydCA9IG5ldyBBdXRvUm91dGVyUG9ydCgpLFxuICAgICAgICByZWN0ID0gdGhpcy5fY3JlYXRlUmVjdEZyb21BcmVhKGFyZWEpLFxuICAgICAgICBhdHRyO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBwb3J0XG4gICAgYXR0ciA9IHRoaXMuX2dldFBvcnRBdHRyaWJ1dGVzKGJveC5yZWN0LCBhcmVhKTtcbiAgICBwb3J0LnNldExpbWl0ZWREaXJzKGZhbHNlKTtcbiAgICBwb3J0LmF0dHJpYnV0ZXMgPSBhdHRyO1xuICAgIHRoaXMuX3NldFZhbGlkUmVjdFNpemUocmVjdCk7XG4gICAgcG9ydC5zZXRSZWN0KHJlY3QpO1xuXG4gICAgLy8gQ3JlYXRlIGEgY29udGFpbmVyIHJlY3RcbiAgICBjUmVjdC5hc3NpZ24ocmVjdCk7XG4gICAgY1JlY3QuaW5mbGF0ZVJlY3QoMSk7XG4gICAgY29udGFpbmVyID0gdGhpcy5fY3JlYXRlQm94KHtcbiAgICAgICAgeDE6IGNSZWN0LmxlZnQsXG4gICAgICAgIHkxOiBjUmVjdC5jZWlsLFxuICAgICAgICB4MjogY1JlY3QucmlnaHQsXG4gICAgICAgIHkyOiBjUmVjdC5mbG9vclxuICAgIH0pO1xuXG4gICAgYm94LmFkZENoaWxkKGNvbnRhaW5lcik7XG4gICAgY29udGFpbmVyLmFkZFBvcnQocG9ydCk7XG4gICAgdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXSA9IGNvbnRhaW5lcjtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVSZWN0RnJvbUFyZWEgPSBmdW5jdGlvbiAoYXJlYSkge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChhcmVhLngxLCBhcmVhLnkxLCBhcmVhLngyLCBhcmVhLnkyKTtcbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIHJldHVybiByZWN0O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2dldFBvcnRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKHJlY3QsIGFyZWEpIHtcbiAgICB2YXIgYXR0ciA9IDAsXG4gICAgICAgIHgxID0gYXJlYS54MSxcbiAgICAgICAgeDIgPSBhcmVhLngyLFxuICAgICAgICB5MSA9IGFyZWEueTEsXG4gICAgICAgIHkyID0gYXJlYS55MixcbiAgICAgICAgaG9yaXpvbnRhbCA9IHkxID09PSB5MjtcblxuICAgIGlmIChob3Jpem9udGFsKSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh5MSAtIHJlY3QuY2VpbCkgPCBNYXRoLmFicyh5MSAtIHJlY3QuZmxvb3IpKSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcFxuICAgICAgICAgICAgYXR0ciA9IENPTlNUQU5UUy5Qb3J0U3RhcnRPblRvcCArIENPTlNUQU5UUy5Qb3J0RW5kT25Ub3A7XG4gICAgICAgIH0gZWxzZSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcCAoaG9yaXpvbnRhbClcbiAgICAgICAgICAgIGF0dHIgPSBDT05TVEFOVFMuUG9ydFN0YXJ0T25Cb3R0b20gKyBDT05TVEFOVFMuUG9ydEVuZE9uQm90dG9tO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTWF0aC5hYnMoeDEgLSByZWN0LmxlZnQpIDwgTWF0aC5hYnMoeDEgLSByZWN0LnJpZ2h0KSkgeyAgLy8gQ2xvc2VyIHRvIHRoZSBsZWZ0XG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uTGVmdCArIENPTlNUQU5UUy5Qb3J0RW5kT25MZWZ0O1xuICAgICAgICB9IGVsc2UgeyAgLy8gQ2xvc2VyIHRvIHRoZSByaWdodCAodmVydGljYWwpXG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uUmlnaHQgKyBDT05TVEFOVFMuUG9ydEVuZE9uUmlnaHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYXR0cjtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQsIGFyZWEpIHtcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyID0gdGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSxcbiAgICAgICAgY1JlY3QgPSBjb250YWluZXIucmVjdCxcbiAgICAgICAgcG9ydCA9IGNvbnRhaW5lci5wb3J0c1swXSxcbiAgICAgICAgcmVjdCA9IHRoaXMuX2NyZWF0ZVJlY3RGcm9tQXJlYShhcmVhKSxcbiAgICAgICAgYXR0cjtcblxuICAgIC8vIFVwZGF0ZSB0aGUgcG9ydCdzIHJlY3RcbiAgICBhdHRyID0gdGhpcy5fZ2V0UG9ydEF0dHJpYnV0ZXMoYm94LnJlY3QsIGFyZWEpO1xuICAgIHBvcnQuc2V0TGltaXRlZERpcnMoZmFsc2UpO1xuICAgIHBvcnQuYXR0cmlidXRlcyA9IGF0dHI7XG4gICAgdGhpcy5fc2V0VmFsaWRSZWN0U2l6ZShyZWN0KTtcbiAgICBwb3J0LnNldFJlY3QocmVjdCk7XG5cbiAgICBjUmVjdC5hc3NpZ24ocG9ydC5yZWN0KTtcbiAgICBjUmVjdC5pbmZsYXRlUmVjdCgxKTtcbiAgICBjb250YWluZXIuc2V0UmVjdChjUmVjdCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlUG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgcG9ydElkKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuX3BvcnQoYm94SWQsIHBvcnRJZCk7XG5cbiAgICB0aGlzLl9ncmFwaC5kZWxldGVCb3goY29udGFpbmVyKTtcbiAgICBkZWxldGUgdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXTtcbn07XG5cbi8vIFNoYXJlZCB1dGlsaXRpZXNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3NldFZhbGlkUmVjdFNpemUgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgcmVjdCBpcyBhdCBsZWFzdCAzeDNcbiAgICB2YXIgaGVpZ2h0ID0gcmVjdC5nZXRIZWlnaHQoKSxcbiAgICAgICAgd2lkdGggPSByZWN0LmdldFdpZHRoKCksXG4gICAgICAgIGR4ID0gTWF0aC5tYXgoKDMgLSB3aWR0aCkgLyAyLCAwKSxcbiAgICAgICAgZHkgPSBNYXRoLm1heCgoMyAtIGhlaWdodCkgLyAyLCAwKTtcblxuICAgIHJlY3QuaW5mbGF0ZVJlY3QoZHgsIGR5KTtcbiAgICByZXR1cm4gcmVjdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlcjtcbiJdfQ==
