import { useState } from 'react';

import { Translation } from '@suite/intl';
import {
    type HomeAssetGrouping,
    selectShownNetworkSymbols,
    selectShownWalletAssetKeys,
} from '@suite-common/assets';
import { type NetworkSymbol } from '@suite-common/wallet-config';
import { Card, Table } from '@trezor/components';

import { useSelector } from 'src/hooks/suite';

import { HomeAssetNetworkSection } from './HomeAssetNetworkSection';
import { HomeAssetRow } from './HomeAssetRow';
import { HomeAssetTableFilterHeader } from './HomeAssetTableFilter';
import { HOME_ASSET_CELL_PADDING } from './homeAssetTableLayout';

const NO_NETWORKS: readonly NetworkSymbol[] = [];

export const HomeAssetTable = () => {
    const [grouping, setGrouping] = useState<HomeAssetGrouping>('default');
    const assetKeys = useSelector(selectShownWalletAssetKeys);
    // Grouping by networks is work the default arrangement must not pay for.
    const networkSymbols = useSelector(state =>
        grouping === 'networks' ? selectShownNetworkSymbols(state) : NO_NETWORKS,
    );

    if (assetKeys.length === 0) {
        return null;
    }

    return (
        <Card paddingType="none" data-testid="@dashboard/home-asset-table">
            <Table isRowHighlightedOnHover colWidths={[{ minWidth: '200px' }, {}, {}]}>
                <Table.Header>
                    <Table.Row>
                        <Table.Cell padding={HOME_ASSET_CELL_PADDING.first}>
                            <HomeAssetTableFilterHeader
                                grouping={grouping}
                                onChange={setGrouping}
                            />
                        </Table.Cell>
                        <Table.Cell align="end">
                            <Translation id="TR_EXCHANGE_RATE" />
                        </Table.Cell>
                        <Table.Cell align="end" padding={HOME_ASSET_CELL_PADDING.last}>
                            <Translation id="TR_BALANCE" />
                        </Table.Cell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {grouping === 'networks'
                        ? networkSymbols.map(symbol => (
                              <HomeAssetNetworkSection key={symbol} symbol={symbol} />
                          ))
                        : assetKeys.map(assetKey => (
                              <HomeAssetRow key={assetKey} assetKey={assetKey} />
                          ))}
                </Table.Body>
            </Table>
        </Card>
    );
};
