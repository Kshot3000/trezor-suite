import { type HomeAssetsTableRootState, homeAssetsTableInitialState } from '@suite-common/assets';
import { type WithServices } from '@suite-common/redux-utils';
import { createTestCompositionRoot } from '@suite-common/test-utils';

import { setHomeAssetGroupingThunk } from 'src/actions/suite/homeAssetsTableThunks';
import homeAssetsTableReducer from 'src/reducers/suite/homeAssetsTableReducer';
import { type Db, type DbDep } from 'src/storage/createDb';

import { createInMemoryDbMock } from '../../../mocks/createInMemoryDbMock';

const mockStore = (db: Db) =>
    createTestCompositionRoot<WithServices<DbDep>, HomeAssetsTableRootState>({
        reducer: { homeAssetsTable: homeAssetsTableReducer },
        preloadedState: { homeAssetsTable: homeAssetsTableInitialState },
        services: () => ({ db }),
    }).services.store;

describe('how the home asset table was left arranged', () => {
    let db: Db;

    beforeEach(() => {
        db = createInMemoryDbMock({ dispatch: jest.fn(), reloadApp: jest.fn() });
    });

    afterEach(async () => {
        await db.removeDatabase();
    });

    it('keeps the chosen grouping, and writes it where a later run will find it', async () => {
        const store = mockStore(db);

        await store.dispatch(setHomeAssetGroupingThunk({ grouping: 'networks' }));

        expect(store.getState().homeAssetsTable.grouping).toBe('networks');
        expect(await db.getItemByPK('homeAssetsTable', 'homeAssetsTable')).toEqual({
            grouping: 'networks',
        });
    });

    it('writes the grouping the user went back to', async () => {
        const store = mockStore(db);

        await store.dispatch(setHomeAssetGroupingThunk({ grouping: 'networks' }));
        await store.dispatch(setHomeAssetGroupingThunk({ grouping: 'default' }));

        expect(store.getState().homeAssetsTable.grouping).toBe('default');
        expect(await db.getItemByPK('homeAssetsTable', 'homeAssetsTable')).toEqual({
            grouping: 'default',
        });
    });
});
