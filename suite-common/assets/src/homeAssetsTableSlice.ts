import { type ActionReducerMapBuilder, type PayloadAction, createSlice } from '@reduxjs/toolkit';

import { type HomeAssetGrouping } from './homeAssetTableSelectors';

export type HomeAssetsTableState = {
    grouping: HomeAssetGrouping;
};

export type HomeAssetsTableRootState = {
    homeAssetsTable: HomeAssetsTableState;
};

export const homeAssetsTableInitialState: HomeAssetsTableState = {
    grouping: 'default',
};

/**
 * How the user left the home asset table arranged. Each platform persists it the way it persists
 * everything else, so the slice takes the reducers that restore it rather than reaching for a
 * store of its own.
 */
export const createHomeAssetsTableSlice = (options?: {
    extraReducers?: (builder: ActionReducerMapBuilder<HomeAssetsTableState>) => void;
}) =>
    createSlice({
        name: 'homeAssetsTable',
        initialState: homeAssetsTableInitialState,
        reducers: {
            setGrouping: (state, { payload }: PayloadAction<HomeAssetGrouping>) => {
                state.grouping = payload;
            },
        },
        ...(options?.extraReducers !== undefined ? { extraReducers: options.extraReducers } : {}),
    });

export const selectHomeAssetsTable = (state: HomeAssetsTableRootState) => state.homeAssetsTable;

export const selectHomeAssetGrouping = (state: HomeAssetsTableRootState) =>
    state.homeAssetsTable.grouping;
