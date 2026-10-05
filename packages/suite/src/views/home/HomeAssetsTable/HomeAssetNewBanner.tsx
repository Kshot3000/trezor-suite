import { selectIsHomeAssetTableNewBannerClosed, setFlag } from '@suite/flags';
import { Translation } from '@suite/intl';
import { useServices } from '@suite-common/dependency-injection';
import { injectDispatch } from '@suite-common/redux-utils';
import { Box, Column, GhostContainer, Icon, IconCircle, Row, Text } from '@trezor/components';
import { LightningIcon, XIcon } from '@trezor/icons';

import { useSelector } from 'src/hooks/suite';

export const HomeAssetNewBanner = () => {
    const isClosed = useSelector(selectIsHomeAssetTableNewBannerClosed);
    const { dispatch } = useServices(injectDispatch);

    if (isClosed) {
        return null;
    }

    return (
        <Box
            backgroundColor="elementFillBrandSofter"
            padding={{ vertical: 16, horizontal: 20 }}
            data-testid="@dashboard/home-asset/banner"
        >
            <Row gap={12} alignItems="center">
                <IconCircle icon={LightningIcon} size={32} intent="brand" />

                <Column gap={2} alignItems="flex-start" flex="1">
                    <Text typographyStyle="body-md-strong">
                        <Translation id="TR_HOME_ASSET_BANNER_TITLE" />
                    </Text>
                    <Text typographyStyle="body-sm" intent="neutral" priority="secondary">
                        <Translation id="TR_HOME_ASSET_BANNER_TEXT" />
                    </Text>
                </Column>

                <GhostContainer
                    padding={4}
                    borderRadius={6}
                    onClick={() =>
                        dispatch(setFlag({ key: 'homeAssetTableNewBannerClosed', value: true }))
                    }
                    data-testid="@dashboard/home-asset/banner/dismiss"
                >
                    <Icon as={XIcon} size={16} intent="neutral" priority="secondary" />
                </GhostContainer>
            </Row>
        </Box>
    );
};
