/**
 * Console logger module
 * @module lib/logger
 */

'use strict';

var colors = require('colors/safe'),
    aProto = Array.prototype;

colors.setTheme({
    sql: 'gray',
    trace: ['gray', 'dim'],
    debug: 'green',
    info: ['blue', 'bold'],
    warn: 'yellow',
    error: ['white', 'bgRed']
});

/**
 * Console logger
 * @param console
 * @constructor
 * @implements ILogger
 */
function ConsoleLogger(console) {
    var target = console;

    let methods = ['trace', 'debug', 'info', 'warn', 'error'];
    for(let i = 0; i < methods.length; i++) {
        let fn = methods[i];

        this[fn] = function (spec) {

            let useSpecialScheme = spec == 'sql';
            let scheme = useSpecialScheme ? spec : fn;

            let args =  Array.prototype.slice.call(arguments, useSpecialScheme ? 1 : 0);
            args = args.map(colors[scheme]);
            //console.log(args);
            target[fn].apply(target, args);
        }

    }
}

exports.createLogger = function () {

    return new ConsoleLogger(console);

};

/**
 * Generic logger interface
 * @interface ILogger
 * @property trace {Function}
 * @property debug {Function}
 * @property info {Function}
 * @property warn {Function}
 * @property error {Function}
 */