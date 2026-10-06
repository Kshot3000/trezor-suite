import {
    CALL_SOURCE_DEEPLINK,
    type ConnectPopupCallWithState,
    connectPopupInitialState,
} from '@suite-common/connect-popup';
import {
    Feature,
    type MessageSystemState,
    messageSystemInitialState,
} from '@suite-common/message-system';
import { renderWithStoreProvider, screen } from '@suite-native/test-utils-store';

import { PermissionConfirmation } from './PermissionConfirmation';

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ canGoBack: () => true, goBack: () => {} }),
}));

const NOTICE_TEST_ID = '@popup/connect-v9-notice';
const NOTICE_MESSAGE_ID = 'connect-v9-notice-test-message';
const NOTICE_TEXT = 'Notice from the config';

const NOTICE_ON: MessageSystemState = {
    ...messageSystemInitialState,
    validMessages: {
        ...messageSystemInitialState.validMessages,
        feature: [NOTICE_MESSAGE_ID],
    },
    config: {
        version: 1,
        timestamp: '1970-01-01T00:00:00Z',
        sequence: 1,
        actions: [
            {
                conditions: [],
                message: {
                    id: NOTICE_MESSAGE_ID,
                    priority: 1,
                    dismissible: false,
                    variant: 'warning',
                    category: 'feature',
                    content: {
                        en: NOTICE_TEXT,
                        es: NOTICE_TEXT,
                        cs: NOTICE_TEXT,
                        de: NOTICE_TEXT,
                        fr: NOTICE_TEXT,
                        pt: NOTICE_TEXT,
                    },
                    feature: [{ domain: Feature.connectV9.warning, flag: true }],
                },
            },
        ],
    },
};

const getPermissionRequest = (
    isConnectV9: boolean,
): ConnectPopupCallWithState<'permission-request'> => ({
    state: 'permission-request',
    method: 'getAddress',
    payload: { path: "m/84'/0'/0'/0/0", coin: 'btc' },
    source: {
        type: CALL_SOURCE_DEEPLINK,
        origin: 'exampleapp://callback',
        manifest: { appName: 'Example', appIcon: '' },
        isConnectV9,
    },
    methodInfo: { methodTitle: 'Export address', permissionTypes: [], useUi: true },
});

const renderPermissionConfirmation = (isConnectV9: boolean) =>
    renderWithStoreProvider(<PermissionConfirmation />, {
        preloadedState: {
            connectPopup: {
                ...connectPopupInitialState,
                activeCall: getPermissionRequest(isConnectV9),
            },
            messageSystem: NOTICE_ON,
        },
    });

describe('PermissionConfirmation', () => {
    it('shows the note for a deeplink call from a Connect 9 app', async () => {
        await renderPermissionConfirmation(true);

        expect(screen.getByTestId(NOTICE_TEST_ID)).toBeTruthy();
        expect(screen.getByText(NOTICE_TEXT)).toBeTruthy();
    });

    it('shows no note for other deeplink calls', async () => {
        await renderPermissionConfirmation(false);

        expect(screen.getByTestId('@popup/deeplink-info')).toBeTruthy();
        expect(screen.queryByTestId(NOTICE_TEST_ID)).toBeNull();
    });
});
