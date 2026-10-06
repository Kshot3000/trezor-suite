import { type HomeAssetsTableState, createHomeAssetsTableSlice } from '@suite-common/assets';

import { storageLoad } from 'src/actions/suite/storageLifecycleActions';

const homeAssetsTableSlice = createHomeAssetsTableSlice({
    extraReducers: builder =>
        builder.addCase(storageLoad, (state: HomeAssetsTableState, { payload }) =>
            payload.homeAssetsTable ? { ...state, ...payload.homeAssetsTable } : state,
        ),
});

export const homeAssetsTableActions = homeAssetsTableSlice.actions;

export default homeAssetsTableSlice.reducer;
