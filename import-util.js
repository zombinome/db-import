'use strict';

const version = '0.1.0';
const mode = process.argv[2];

let logging = require('./lib/console-logger');
let logger = logging.createLogger();

if (mode == '--version') {
    logger.info('db-import, v. ' + version);
    process.exit();
}

let fs = require('fs');
let path = require('path');


/** @type {String} */
let configStr = fs.readFileSync(process.argv[3] || './cfg/config.json');

/** @type {ImportConfig} */
let config = JSON.parse(configStr);


let provider = require('./storage-adapters/' + config.provider);
let storageAdapter = provider.getAdapter(config.connections[config.provider], logger);

switch (mode) {
    case '--create-storage': {
        let cfg = config.actions['create-storage'];
        let replaceExisting = !!cfg['replace-existing'];
        let storageDefinition = loadDefinition(cfg, 'storage-definition');

        storageAdapter
            .createStorage(storageDefinition, replaceExisting)
            .then(function (adapter) {
                adapter.dispose();
            });

        break;
    }

    case '--import-data': {
        let cfg = config.actions['import-data'],
            storageDefinition = loadDefinition(cfg, 'storage-definition'),
            importDefinition = loadDefinition(cfg, 'import-definition');

        importData(storageDefinition, importDefinition, storageAdapter, logger);
        break;
    }
}


function loadDefinition(cfg, property) {
    let pathToDefinition = cfg[property];

    if (typeof pathToDefinition != 'string')
        return pathToDefinition;

    pathToDefinition = path.join('./', pathToDefinition);
    let definitionStr = fs.readFileSync(pathToDefinition, 'utf8');

    return JSON.parse(definitionStr);
}

/**
 * Imports data into table according to import definition
 * @param storageDefinition {StorageDefinition} Storage definition
 * @param importDefinition
 * @param storageAdapter {IStorageAdapter}
 * @param logger {ILogger}
 */
function importData(storageDefinition, importDefinition, storageAdapter, logger) {
    var batch = storageAdapter.createBatch();
    batch.open();

    for(let i = 0; i < importDefinition.import.length; i++) {
        let entry = importDefinition.import[i];

        if (!storageDefinition.tables.hasOwnProperty(entry.table)) {
            logger.error('Failed to import data into table \'' + entry.table + '\'. No table with specified name is present in storage definition.');
            continue;
        }

        if (entry.values)
            for (let j = 0; j < entry.values.length; j++)
                batch.insert(entry.table, entry.columns, entry.values[j]);

        else if (entry.hasOwnProperty('fromFile') && entry.hasOwnProperty('format')) {
            var importer = require('')
        }
        else {
            logger.error('Invalid format of import entry ', JSON.stringify(entry));
        }
    }

    batch.commit();
}

/**
 * @typedef {Object} ImportConfig
 * @property provider {String}
 * @property connections {Dictionary.<String, {*}>}
 * @property actions {*}
 */