import {
    CALL_SOURCE_DEEPLINK,
    type ConnectCallSource,
    type ConnectPopupCallWithState,
    type ConnectSerializedError,
    connectPopupActions,
    connectPopupInitialState,
    prepareConnectPopupReducer,
    selectConnectPopupCall,
} from '@suite-common/connect-popup';
import { deviceInitialState } from '@suite-common/device';
import { mockActionType } from '@suite-common/redux-utils/mocks';
import { initialWalletSettingsState } from '@suite-common/wallet-core';
import { getTranslation, localeInitialState } from '@suite-native/intl';
import {
    act,
    createLightStore,
    createStaticReducer,
    renderWithStoreProvider,
    screen,
    userEvent,
} from '@suite-native/test-utils-store';

import { ConnectErrorMessage } from './ConnectErrorMessage';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ canGoBack: () => true, goBack: mockGoBack }),
}));

const DECLINED_TEXT = 'Declined by the config';
const CALLBACK_URL = 'exampleapp://callback?id=1&response=%7B%22success%22%3Afalse%7D';
const NOT_ALLOWED_ERROR: ConnectSerializedError = {
    code: 'Method_NotAllowed',
    message: 'Method not allowed for this configuration',
};

const V9_DEEPLINK_SOURCE: ConnectCallSource = {
    type: CALL_SOURCE_DEEPLINK,
    origin: 'exampleapp://callback',
    manifest: { appName: 'Example', appIcon: '' },
    isConnectV9: true,
};

type GetCallErrorParams = Partial<
    Pick<ConnectPopupCallWithState<'call-error'>, 'error' | 'isConnectV9Refusal' | 'callbackUrl'>
>;

const getCallError = ({
    error = { code: 'Method_NotAllowed', message: DECLINED_TEXT },
    isConnectV9Refusal,
    callbackUrl,
}: GetCallErrorParams): ConnectPopupCallWithState<'call-error'> => ({
    state: 'call-error',
    method: 'getAddress',
    payload: { path: "m/84'/0'/0'/0/0", coin: 'btc' },
    source: V9_DEEPLINK_SOURCE,
    methodInfo: { methodTitle: 'getAddress', permissionTypes: [], useUi: false },
    error,
    isConnectV9Refusal,
    callbackUrl,
});

const renderErrorMessage = async (activeCall: ConnectPopupCallWithState<'call-error'>) => {
    const store = createLightStore({
        reducer: {
            connectPopup: prepareConnectPopupReducer({
                actionTypes: { storageLoad: mockActionType('storageLoad') },
            }),
            device: createStaticReducer(deviceInitialState),
            locale: createStaticReducer(localeInitialState),
            wallet: createStaticReducer({ settings: initialWalletSettingsState }),
        },
        preloadedState: { connectPopup: { ...connectPopupInitialState, activeCall } },
    });

    await renderWithStoreProvider(<ConnectErrorMessage />, { services: { store } });

    return store;
};

describe('ConnectErrorMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows the reason of a declined call from a Connect 9 app', async () => {
        await renderErrorMessage(
            getCallError({ isConnectV9Refusal: true, callbackUrl: CALLBACK_URL }),
        );

        expect(screen.getByText(DECLINED_TEXT)).toBeTruthy();
        expect(
            screen.queryByText(getTranslation('moduleConnectPopup.errors.methodNotAllowed')),
        ).toBeNull();
    });

    it('keeps the generic text for a method that is not allowed for other reasons', async () => {
        await renderErrorMessage(getCallError({ error: NOT_ALLOWED_ERROR }));

        expect(
            screen.getByText(getTranslation('moduleConnectPopup.errors.methodNotAllowed')),
        ).toBeTruthy();
        expect(screen.queryByText(NOT_ALLOWED_ERROR.message)).toBeNull();
    });

    it('keeps the generic text and answers no app for an error that follows a declined call', async () => {
        const store = await renderErrorMessage(
            getCallError({ isConnectV9Refusal: true, callbackUrl: CALLBACK_URL }),
        );

        // Another call fails before it starts while the declined call is still shown.
        await act(() => {
            store.dispatch(connectPopupActions.setError(NOT_ALLOWED_ERROR));
        });

        expect(
            screen.getByText(getTranslation('moduleConnectPopup.errors.methodNotAllowed')),
        ).toBeTruthy();
        expect(screen.queryByText(DECLINED_TEXT)).toBeNull();

        await userEvent.press(screen.getByTestId('@popup/close'));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({ state: 'call-error', error: NOT_ALLOWED_ERROR }),
        );
        expect(mockGoBack).toHaveBeenCalled();
    });

    it('answers the app of a declined call when the error is closed', async () => {
        const store = await renderErrorMessage(
            getCallError({ isConnectV9Refusal: true, callbackUrl: CALLBACK_URL }),
        );

        await userEvent.press(screen.getByTestId('@popup/close'));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({ state: 'deeplink-callback', callbackUrl: CALLBACK_URL }),
        );
        expect(mockGoBack).toHaveBeenCalled();
    });

    it('only leaves the screen when another error is closed', async () => {
        const callError = getCallError({
            error: { code: 'Device_InvalidState', message: 'Invalid state' },
        });
        const store = await renderErrorMessage(callError);

        await userEvent.press(screen.getByTestId('@popup/close'));

        expect(selectConnectPopupCall(store.getState())).toEqual(callError);
        expect(mockGoBack).toHaveBeenCalled();
    });
});
