import { type ReactNode } from 'react';

import {
    CALL_SOURCE_DEEPLINK,
    type ConnectPopupCallWithState,
    connectPopupInitialState,
} from '@suite-common/connect-popup';
import { deviceInitialState } from '@suite-common/device';
import { getTranslation } from '@suite-native/intl';
import { renderWithStoreProvider, screen } from '@suite-native/test-utils-store';

import { ConnectPopupScreen } from './ConnectPopupScreen';

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ canGoBack: () => true, goBack: () => {} }),
}));

type ScreenMockProps = {
    children: ReactNode;
};

// The screen frame and the device manager are not under test.
jest.mock('@suite-native/navigation', () => ({
    ...jest.requireActual('@suite-native/navigation'),
    Screen: ({ children }: ScreenMockProps) => children,
}));

jest.mock('@suite-native/device-manager', () => ({
    DeviceManager: () => null,
}));

const DECLINED_TEXT = 'Declined by the config';

type GetCallErrorParams = Pick<ConnectPopupCallWithState<'call-error'>, 'error'> &
    Partial<Pick<ConnectPopupCallWithState<'call-error'>, 'isConnectV9Refusal'>>;

const getCallError = ({
    error,
    isConnectV9Refusal,
}: GetCallErrorParams): ConnectPopupCallWithState<'call-error'> => ({
    state: 'call-error',
    method: 'getAddress',
    payload: { path: "m/84'/0'/0'/0/0", coin: 'btc' },
    source: {
        type: CALL_SOURCE_DEEPLINK,
        origin: 'exampleapp://callback',
        manifest: { appName: 'Example', appIcon: '' },
        isConnectV9: true,
    },
    methodInfo: { methodTitle: 'getAddress', permissionTypes: [], useUi: false },
    error,
    isConnectV9Refusal,
});

// No device is connected.
const renderScreen = (activeCall: ConnectPopupCallWithState<'call-error'>) =>
    renderWithStoreProvider(<ConnectPopupScreen />, {
        preloadedState: {
            connectPopup: { ...connectPopupInitialState, activeCall },
            device: deviceInitialState,
            wallet: { discovery: [] },
        },
    });

describe('ConnectPopupScreen', () => {
    it('shows the reason of a declined call without waiting for the device', async () => {
        await renderScreen(
            getCallError({
                error: { code: 'Method_NotAllowed', message: DECLINED_TEXT },
                isConnectV9Refusal: true,
            }),
        );

        expect(screen.getByText(DECLINED_TEXT)).toBeTruthy();
        expect(
            screen.queryByText(getTranslation('moduleConnectPopup.errors.deviceNotConnected')),
        ).toBeNull();
    });

    it('waits for the device before it shows other errors', async () => {
        await renderScreen(
            getCallError({ error: { code: 'Device_InvalidState', message: 'Invalid state' } }),
        );

        expect(
            screen.getByText(getTranslation('moduleConnectPopup.errors.deviceNotConnected')),
        ).toBeTruthy();
        expect(screen.queryByTestId('@popup/connect-error')).toBeNull();
    });
});
