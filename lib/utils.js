/**
 * Utils module
 * @module lib/utils
 */

'use strict';

var arrProto = Array.prototype,
    hasOwnProperty = Object.hasOwnProperty;

/**
 * @callback {NodeCallback}
 * @param {*} err error
 * @param {Function} success success callback
 */

/**
 * @callback PromiseResolveCallback
 * @param [result] {*}
 */

/**
 * @callback PromiseRejectCallback
 * @param [reason] {*}
 */

/**
 * @callback PromiseOnResolve
 * @param args {...*}
 */

/**
 * @callback PromiseOnReject
 * @param args {...*}
 */

/**
 * @callback PromiseThenCallback
 * @param success PromiseOnResolve
 * @param [error] PromiseOnReject
 */

/**
 * typedef {Object} Promise
 * @property length {number=1}
 * @property then {PromiseThenCallback}
 * @property catch {PromiseOnResolve}
 */