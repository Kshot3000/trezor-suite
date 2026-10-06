import { type IDBPDatabase, openDB } from 'idb';

import { installFakeIndexedDb } from '@suite-common/test-utils/fakeIndexedDb';

import { type SuiteDBSchema } from 'src/storage/definitions';

import migration from './26.10.0.2';

const DB_NAME = 'suite-idb-test-26.10.0.2';
const INITIAL_VERSION = 1;

const runMigration = () =>
    openDB(DB_NAME, INITIAL_VERSION + 1, {
        upgrade(db: IDBPDatabase<SuiteDBSchema>, _oldVersion, _newVersion, tx) {
            migration.migrate(db, tx);
        },
    });

const createDBWithoutHomeAssetsTable = async () => {
    const db = await openDB<SuiteDBSchema>(DB_NAME, INITIAL_VERSION, {
        upgrade(upgradeDb) {
            upgradeDb.createObjectStore('suiteSettings');
        },
    });

    db.close();
};

describe('migration 26.10.0.2', () => {
    beforeEach(() => {
        installFakeIndexedDb();
    });

    test('adds the store the asset table keeps how it was left arranged in', async () => {
        await createDBWithoutHomeAssetsTable();

        const db = await runMigration();

        expect([...db.objectStoreNames]).toContain('homeAssetsTable');
        expect(await db.get('homeAssetsTable', 'homeAssetsTable')).toBeUndefined();

        db.close();
    });

    test('keeps what the stores it does not touch already held', async () => {
        await createDBWithoutHomeAssetsTable();

        const db = await runMigration();

        expect([...db.objectStoreNames]).toContain('suiteSettings');

        db.close();
    });
});
