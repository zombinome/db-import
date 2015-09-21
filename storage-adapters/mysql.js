// MySQL storage import module
'use strict';

var Q = require('q'),
    mysql = require('mysql'),
    common = require('./common'),
    utils = require('../lib/utils');

/**
 * @typedef {Object} MySqlConnectionConfiguration
 * @property host {String=localhost} MySQL host
 * @property port {Number=3306} port used to connect on host
 * @property user {String} User login
 * @property password {String} User password
 * @property database {String} Database
 */

/**
 * @readonly
 * @enum {String}
 */
var tableTypes = {
    string: 'varchar',
    int: 'int',
    float: 'double',
    decimal: 'decimal',
    boolean: 'bit',
    byteArray: 'longblob',
    datetime: 'datetime',
    date: 'date',
    time: 'time'
};

var tableValues = {
    'true': '1',
    'false': '0'
};

Q.longStackSupport = true;

/**
 * Creates new instance of storage adapter
 * @param connectionConfig
 * @param logger
 * @constructor
 * @implements IStorageAdapter
 */
function MySqlAdapter(connectionConfig, logger) {

    /** @access private */
    this._logger = logger;

    /** @access private */
    this._connCfg = connectionConfig;

    /** @access private */
    this._batches = [];
}

MySqlAdapter.prototype = {

    /**
     * Creates new storage
     * @param storageDefinition {StorageDefinition} Storage structure definition
     * @param dropExisting {Boolean} Drop existing storage with that name
     * @returns {Promise}
     */
    createStorage: function (storageDefinition, dropExisting) {
        let connectionConfig = this._connCfg;

        if (!connectionConfig.user) {
            throw new Error('Database connection settings are missing user login')
        }

        if (!connectionConfig.database) {
            throw new Error('Database name are not specified in connection parameters');
        }

        let logger = this._logger;

        logger.info('Creating new storage \'' + connectionConfig.database + '\':');
        logger.info('  drop existing storage:', dropExisting);
        logger.info('');

        let promise,
            dropOrCreateDbConfig = {
                user: connectionConfig.user,
                password: connectionConfig.password,
                timezone: 'utc',
                multipleStatements: true
            },
            self = this;

        if (dropExisting) {
            promise = dropDatabase(dropOrCreateDbConfig, connectionConfig.database, logger)
        }
        else {
            promise = Q.fulfill();
        }

        promise
            .then(createDatabase.bind(null, dropOrCreateDbConfig, connectionConfig.database, logger))
            .then(createTables.bind(null, connectionConfig, storageDefinition, logger))
            .then(function () {
                return self;
            })
            .catch(function (err) {
                logger.error(err);
                logger.info('');
            });

        return promise;
    },

    /**
     * Creates new batch
     * @returns {Promise}
     */
    createBatch: function () {
        let connectionConfig = this._connCfg;

        if (!connectionConfig.user) {
            throw new Error('Database connection settings are missing user login')
        }

        if (!connectionConfig.database) {
            throw new Error('Database name are not specified in connection parameters');
        }

        let logger = this._logger;

        logger.info('Creating new batch for database \'' + connectionConfig.database + '\':');
        logger.info('');

        var batch = new MySqlBatch(connectionConfig, logger);
        this._batches.push(batch);

        return batch();
    },

    /**
     * Disposes MySqlAdapter object and frees all external acquired resources
     */
    dispose: function () {
        if (this._batches) {
            for (let i = 0; i < this._batches.length; i++) this._batches[i].dispose();
            this._batches = null;
        }
    }
};

function MySqlBatch(adapter) {

    /** @access private */
    this._adapter = adapter;

    /** @access private */
    this._connection = null;
}

MySqlBatch.prototype = {
    open: function () {
        var logger = this._adapter._logger,
            self = this;

        if (this._connection) {
            logger.warn('Batch already opened');
            return Q.fulfill();
        }

        let connection = mysql.createConnection(this._adapter._connCfg);
        let promise = Q.ninvoke(connection, 'connect');

        promise = promise.then(function () {
            self._connection = connection;

            return Q.ninvoke(connection, 'beginTransaction');
        });

        return promise;
    },

    commit: function () {
        if (!this._connection) {
            logger.error('Batch is not open, nothing to commit');
            return Q.reject();
        }

        var self = this;
        return Q.ninvoke(this._connection, 'commit')
            .then(function () { return Q.ninvoke(self._connection, 'close'); })
            .then(function () { self._connection = null; });
    },

    dispose: function () {
        var self = this;
        if (this._connection) {
            this._connection.rollback(function (err) {
                if (err)
                    logger.err('Failed to rollback transaction');

                self._connection.close();
                self._connection = null;
            });
        }

        var idx = this._adapter._batches.indexOf(this);
        if (idx >= 0) this._adapter._batches.splice(idx, 1);
    },

    /**
     * Inserts one or many values into storage
     * @param table {String} table name
     * @param fields {String[] | {}.<String, {*}>} Array of table columns | Object to insert
     * @param values
     */
    insert: function(table, fields, values) {
        if (arguments.length === 2) {
            let fieldMap = fields;
            fields = [];
            values = [];
            for(let fieldName in fieldMap) {
                if (!fieldMap.hasOwnProperty(fieldName)) continue;
                fields.push(fieldName);
                values.push(fieldMap[fieldName]);
            }
        }

        //let tableDefinition = this._adapter._storageDefinition.tables[table];
        const sql = 'INSERT INTO ?? (??) VALUES (?)';
        return Q.ninvoke(this._connection, 'query', sql, [table, fields, values]);
    },

    update: function(table, fields, values) {
        var fieldMap = fields;
        if (arguments.length === 3) {

            fieldMap = {};
            for(let i = 0; i < fields.length; i++)
                fieldMap[fields[i]] = values[i];
        }

        const sql = 'UPDATE  ?? SET ?';
        return Q.ninvoke(this._connection, 'query', sql, [table, fields, values]);
    },

    'delete': function(table, key) {

    }
};



/**
 * Creates new database
 * @param connectionConfig
 * @param dbName {String}
 * @param logger
 * @returns {Promise}
 */
function createDatabase(connectionConfig, dbName, logger) {
    const sql = 'create database ??;';

    logger.info('  Creating new storage \'' + dbName + '\'...');

    let connection = mysql.createConnection(connectionConfig);

    let promise = Q.ninvoke(connection, 'connect');

    promise
        .then(function () {
            return Q.ninvoke(connection, 'query', sql, [dbName]);
        })
        .then(function () {
            return Q.ninvoke(connection, 'end');
        });

    promise.done(function () {
        logger.info('  New storage \'' + dbName + '\' created.');
        logger.info('');
    });

    promise.fail(function (err) {
        logger.error('  Failed to create new storage \'' + dbName + '\'.');
        logger.error(err);
        logger.error('');
    });

    return promise;
}

/**
 * Drops database
 * @param connectionConfig
 * @param dbName {String}
 * @param logger
 * @returns {Promise}
 */
function dropDatabase(connectionConfig, dbName, logger) {
    const sql = 'drop database if exists ??;';

    logger.info('  Dropping storage \'' + dbName + '\'...');
    let connection = mysql.createConnection(connectionConfig);

    let promise = Q.ninvoke(connection, 'connect');

    promise
        .then(function () {
            return Q.ninvoke(connection, 'query', sql, [dbName]);
        })
        .then(function () {
            return Q.ninvoke(connection, 'end');
        });

    promise.done(function () {
        logger.info('  Existing database \'' + dbName + '\' dropped.');
        logger.info('');
    });

    promise.fail(function (err) {
        logger.error('  Failed to drop existing storage \'' + dbName + '\'');
        logger.error(err);
        logger.error('');
    });

    return promise;
}

function createTables(connectionConfig, storageDefinition, logger) {
    logger.info('  Creating tables...');

    let connection = mysql.createConnection(connectionConfig);
    let query = connection.query.bind(connection);

    let tableCount = 0;

    let promise = Q.ninvoke(connection, 'connect');
    promise
        .then(function () { return Q.ninvoke(connection, 'beginTransaction'); })
        .then(function () {

            var tablePromise = Q();

            for(let tableName in storageDefinition.tables) {
                if (!storageDefinition.tables.hasOwnProperty(tableName)) continue;

                tableCount++;
                let tableDefinition = storageDefinition.tables[tableName];

                tablePromise = tablePromise.then(createTable.bind(null, query, tableName, tableDefinition, logger));
            }

            return tablePromise;
        })
        .then(function () { return Q.ninvoke(connection, 'commit'); })
        .then(function () { return Q.ninvoke(connection, 'end');    });

    promise.done(function () {
        logger.info('  ' + tableCount, 'tables created.')
    });

    return promise;
}

/**
 * Creates new table
 * @param query {Function}
 * @param tableName {String} Table name
 * @param tableDefinition {TableDefinition} Table definition
 * @param logger
 * @returns {Promise}
 */
function createTable(query, tableName, tableDefinition, logger) {
    logger.info('    Creating new table \'' + tableName + '\'...');

    let sql = 'create table if not exists ?? (\n    ';

    let tableDefRows = [];
    for (let columnName in tableDefinition.columns) {
        if (!tableDefinition.columns.hasOwnProperty(columnName)) continue;

        /** @type {ColumnDefinition} */
        var columnDef = tableDefinition.columns[columnName];

        let colSql = columnName + ' ' + tableTypes[columnDef.type];
        if (columnDef.hasOwnProperty('length'))
            colSql += '(' + columnDef.length + ')';

        if (columnDef.type == 'string')
            colSql += ' charset utf8';

        colSql += (columnDef.nullable ? ' null ' : ' not null ');
        if (columnDef.hasOwnProperty('defaultValue'))
            colSql += defaultValueToString(columnDef.type, columnDef.defaultValue);

        if (columnDef.autoincrement)
            colSql += ' auto_increment';

        tableDefRows.push(colSql);
    }

    if (tableDefinition.primaryKey) {
        let pkDef = tableDefinition.primaryKey;
        let pkSql = 'primary key (';

        if (typeof pkDef == 'string')
            pkSql += pkDef;
        else {
            pkSql += pkDef.map(toString).join(', ');
        }

        pkSql += ')';
        tableDefRows.push(pkSql);
    }

    sql += tableDefRows.join(',\n    ') + '\n);';
    logger.info('sql', sql);

    let promise = Q.denodeify(query)(sql, [tableName]);
    promise.done(function () {
        logger.info('Table \'' + tableName + '\' created.');
        logger.info('');
    });

    promise.fail(function (err) {
        logger.error('    Failed to create table \'' + tableName + '\'');
        logger.error(err);
        logger.error('');
    });

    return promise;
}


function defaultValueToString(type, value){
    var ct = common.enums.storageTypes,
        valType = typeof value;

    if (value === null) return null;

    switch (type) {
        case ct.boolean:
            if (valType == 'string')
                return value == '1' || value.toLowerCase() == 'true' ? tableValues[true] : tableValues[false];

            return !!value ? tableValues[true] : tableValues[false];

        case ct.string:
            return '\'' + mysql.escape(valType == 'string' ? value : value.toString()) + '\'';

        case ct.decimal:
        case ct.float:
            if (valType == 'number') return value;
            if (valType == 'string') return parseFloat(value);

            throw common.errors.invalidValueType('number', valType, value);

        case ct.int:
            if (valType == 'number') return value;
            if (valType == 'string') return parseInt(value);

            throw common.errors.invalidValueType('number', valType, value);

        case ct.date:
            if (value instanceof Date)
                return '\'' + dateToSqlStr(value) + '\'';

            throw common.errors.invalidValueType('datetime', valType, value);

        case ct.time:
            if (value instanceof Date)
                return '\'' + timeToSqlStr(value) + '\'';

            throw common.errors.invalidValueType('datetime', valType, value);

        case ct.dateTime:
            if (value instanceof Date)
                return '\'' + dateToSqlStr(value) + ' ' + timeToSqlStr(value) + '\'';

            throw common.errors.invalidValueType('datetime', valType, value);

        case ct.byteArray:
            throw common.errors.defaultValueNotSupported();
            break;
    }

    throw common.errors.typeNotSupported(type);
}

/**
 * Converts JS Date object to string representation of date
 * @param value {Date} JS Date object
 * @returns {String}
 */
function dateToSqlStr(value) {
    return value.getDate() + '-' + padNumber(value.getMonth()) + '-' + padNumber(value.getDate());
}

/**
 * Converts JS Date object to string representation of time
 * @param value {Date}
 * @returns {String}
 */
function timeToSqlStr(value) {
    return padNumber(value.getHours()) + ':' + padNumber(value.getMinutes()) + ':' + padNumber(value.getSeconds());
}

/**
 * Pads number with leading zero if needed
 * @param value {Number}
 * @returns {String}
 */
function padNumber(value) {
    return value < 10 ? value.toString() : ('0' + value);
}

exports.MySqlAdapter = MySqlAdapter;
exports.getAdapter = function(config, logger) { return new MySqlAdapter(config, logger); };