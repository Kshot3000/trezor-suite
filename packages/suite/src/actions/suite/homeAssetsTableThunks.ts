import { type HomeAssetGrouping, type HomeAssetsTableRootState } from '@suite-common/assets';
import { type WithServices, createThunk } from '@suite-common/redux-utils';

import * as storageActions from 'src/actions/suite/storageActions';
import { homeAssetsTableActions } from 'src/reducers/suite/homeAssetsTableReducer';
import { type DbDep } from 'src/storage/createDb';

const HOME_ASSETS_TABLE_PREFIX = '@suite/homeAssetsTable';

type SetHomeAssetGroupingThunkProps = { grouping: HomeAssetGrouping };

type SetHomeAssetGroupingThunkState = HomeAssetsTableRootState;

type SetHomeAssetGroupingThunkDeps = WithServices<DbDep>;

export const setHomeAssetGroupingThunk = createThunk<
    void,
    SetHomeAssetGroupingThunkProps,
    { state: SetHomeAssetGroupingThunkState; extra: SetHomeAssetGroupingThunkDeps }
>(`${HOME_ASSETS_TABLE_PREFIX}/setGrouping`, async ({ grouping }, { dispatch }) => {
    dispatch(homeAssetsTableActions.setGrouping(grouping));

    await dispatch(storageActions.saveHomeAssetsTableThunk());
});
