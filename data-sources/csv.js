/**
 * CSV data import module
 * @module data-sources/csv
 */
'use strict';

/**
 * CSV file data source
 * @param filename
 * @param [delimiter=','] {String}
 * @param logger {ILogger}
 * @constructor
 */
function CSVSource(filename, delimiter, logger) {
    this._filename = filename;
    this._logger = logger;
    this._reader = null;
}

CSVSource.prototype = {
    /**
     * @returns {String[]} List of read values
     */
    readNext: function () {},
    dispose: function () {}
};