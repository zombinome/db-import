'use strict';

/**
 * @typedef {Object} StorageDefinition
 * @property tables {Dictionary.<String, TableDefinition>}
 * @property options {*}
 */

/**
 * @typedef {Object} TableDefinition
 * @property columns {ColumnDefinition[]}
 * @property primaryKey {String|String[]} Name of column (or columns) to create primary key
 * @property [foreignKeys] {ForeignKeyDefinition[]}
 * @property [indexes] {Dictionary.<String, IndexDefinition>} Table indexes
 */

/**
 * @typedef {Object} ColumnDefinition
 * @property name {String} Column name
 * @property type {String} Column type
 * @property [length] {Number} Column length (for string & binary columns)
 * @property nullable {Boolean} Is column nullable
 * @property defaultValue {*} Default column value
 * @property [autoincrement] {Boolean} Marks column as autoincrement
 */

/**
 * @typedef {Object} ForeignKeyDefinition
 * @property foreignTable {String}
 * @property foreignField {String}
 */

/**
 * @typedef {Object} IndexDefinition
 * @property [name] {String}
 * @property columns {String, String[]}
 * @property [unique] {Boolean}
 */

/**
 * @interface IStorageAdapter
 * @property createStorage {Function}
 * @property createBatch {Function}
 * @property dispose {Function}
 */

/**
 * @typedef {Object} ImportDefinition
 * @property import {TableImportDefinition[]}
 */

/**
 * @typedef {Object} TableImportDefinition
 * @property table {String} Table to import data
 * @property columns {String[]} List of columns to import from data
 * @property [values] {*[][]} Values to be imported
 * @property [fromFile] {String} Path tp file to import data
 * @property [format] {String} Format of data in file
 */

/**
 * @namespace
 */
exports.enums = {
    /**
     * @readonly
     * @enum {String}
     */
    storageTypes: {
        'string': 'string',
        'int': 'int',
        'float': 'float',
        'decimal': 'decimal',
        'boolean': 'boolean',
        'byteArray': 'byteArray',
        'datetime': 'datetime',
        'date': 'date',
        'time': 'time'
    }
};

exports.errors = {
    /**
     * @param expectedType {String}
     * @param actualType {String}
     * @param providedValue {*}
     * @returns {{message: string, value: *}}
     */
    invalidValueType: function (expectedType, actualType, providedValue) {
        return {
            message: 'Invalid value type (actual: ' + actualType + ', expected: ' + expectedType + ').',
            value: providedValue
        };
    },

    typeNotSupported: function(type) {
        return {
            message: 'Provided column type not recognized && not supported by current provider.',
            type: type
        };
    },

    defaultValueNotSupported: function (type) {
        return {
            message: 'Default value not supported by storage for text and blob column types.',
            type: type
        };
    }
};