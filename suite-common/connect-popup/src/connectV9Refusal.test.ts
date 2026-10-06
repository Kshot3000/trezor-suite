import { combineReducers } from '@reduxjs/toolkit';

import { events } from '@suite-common/analytics';
import { mock } from '@suite-common/dependency-injection';
import { deviceInitialState } from '@suite-common/device';
import {
    Feature,
    type MessageSystemRootState,
    type MessageSystemState,
    messageSystemInitialState,
} from '@suite-common/message-system';
import { mockMessageSystemStateWithFeatureFlags } from '@suite-common/message-system/mocks';
import { createMockDispatch, mockActionType } from '@suite-common/redux-utils/mocks';
import { type Localization, type LockDevice } from '@suite-common/suite-types';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import TrezorConnect, { type CallMethodKeys } from '@trezor/connect';

import { connectPopupActions } from './connectPopupActions';
import {
    type ConnectPopupState,
    connectPopupInitialState,
    prepareConnectPopupReducer,
    selectConnectPopupCall,
} from './connectPopupReducer';
import {
    type ConnectPopupCallInnerThunkDeps,
    type ConnectPopupCallInnerThunkState,
    connectPopupCallInnerThunk,
} from './connectPopupThunks';
import {
    CALL_SOURCE_DESKTOP_WS,
    CALL_SOURCE_MCP,
    CALL_SOURCE_WALLETCONNECT,
    type ConnectCallSource,
    type ConnectPopupCallWithState,
} from './connectPopupTypes';
import { selectConnectV9RefusalMessage } from './connectV9Refusal';

const REFUSAL_MESSAGE_ID = 'connect-v9-refusal-test-message';
const CONFIGURED_TEXT = 'Declined by the config';
const DEFAULT_TEXT =
    'Trezor Suite declined this request from an app that uses Trezor Connect 9. Ask the app developer to update to Trezor Connect 10.';

const getLocalization = (en: string, cs = en): Localization => ({
    en,
    es: en,
    cs,
    de: en,
    fr: en,
    pt: en,
});

type MockRefusalMessageSystemStateParams = {
    flag: boolean;
    content?: Localization;
};

const mockRefusalMessageSystemState = ({
    flag,
    content = getLocalization(CONFIGURED_TEXT, 'Odmítnuto konfigurací'),
}: MockRefusalMessageSystemStateParams): MessageSystemState => ({
    ...messageSystemInitialState,
    validMessages: {
        ...messageSystemInitialState.validMessages,
        feature: [REFUSAL_MESSAGE_ID],
    },
    config: {
        version: 1,
        timestamp: '1970-01-01T00:00:00Z',
        sequence: 1,
        actions: [
            {
                conditions: [],
                message: {
                    id: REFUSAL_MESSAGE_ID,
                    priority: 1,
                    dismissible: false,
                    variant: 'warning',
                    category: 'feature',
                    content,
                    feature: [{ domain: Feature.connectV9.refuse, flag }],
                },
            },
        ],
    },
});

const REFUSAL_ON = mockRefusalMessageSystemState({ flag: true });

type GetDesktopSourceParams = {
    npmVersion?: string;
    origin?: string;
    processPath?: string;
};

const getDesktopSource = ({
    npmVersion = '9.7.3',
    origin = 'https://example.com',
    processPath = '/usr/bin/browser',
}: GetDesktopSourceParams = {}): ConnectCallSource => ({
    type: CALL_SOURCE_DESKTOP_WS,
    origin,
    process: { name: 'Browser', fullPath: processPath, warning: false },
    manifest: { appName: 'Example', npmVersion },
});

const V9_SOURCE = getDesktopSource();

const MCP_SOURCE: ConnectCallSource = {
    type: CALL_SOURCE_MCP,
    origin: 'http://localhost',
    process: { name: 'Agent', fullPath: '/usr/bin/agent', warning: false },
    manifest: { appName: 'MCP Agent', appUrl: 'http://localhost', email: 'mcp@localhost' },
};

const WALLETCONNECT_SOURCE: ConnectCallSource = {
    type: CALL_SOURCE_WALLETCONNECT,
    origin: 'https://example.com',
    manifest: { appName: 'Example' },
};

const GET_ADDRESS_PAYLOAD = { path: "m/84'/0'/0'/0/0", coin: 'btc' };

const getAddressCall = (source: ConnectCallSource) => ({
    method: 'getAddress' as const,
    payload: GET_ADDRESS_PAYLOAD,
    source,
});

type ConnectPopupCallServices = ConnectPopupCallInnerThunkDeps['services'];

// createMockDeps does not accept the Analytics interface, so the services are built by hand.
const createServices = () => {
    const report = mock<ConnectPopupCallServices['analytics']['report']>();
    const lockDevice = mock<LockDevice>();
    const services: ConnectPopupCallServices = {
        analytics: {
            init: () => {},
            enable: () => {},
            disable: () => {},
            isEnabled: () => true,
            setUrl: () => {},
            setLoggerEnabled: () => {},
            report,
        },
        lockDevice,
    };

    return { services, report, lockDevice };
};

const mockConnectCall = () =>
    // Any answer ends a call that was not declined, so a plain failure is enough here.
    jest.spyOn(TrezorConnect, 'call').mockResolvedValue({
        success: false,
        error: { message: 'Stopped by the test', code: 'Method_Interrupted' },
    });

describe('selectConnectV9RefusalMessage', () => {
    it('returns the English text of the configured message for an app on 9.7.3', () => {
        const state = { messageSystem: REFUSAL_ON };

        expect(selectConnectV9RefusalMessage(state, V9_SOURCE)).toBe(CONFIGURED_TEXT);
    });

    it.each(['9.7.3', '9.6.0', '9.0.0'])('declines an app on %s', npmVersion => {
        const state = { messageSystem: REFUSAL_ON };

        expect(selectConnectV9RefusalMessage(state, getDesktopSource({ npmVersion }))).toBe(
            CONFIGURED_TEXT,
        );
    });

    it('returns the default text when the configured message has no text', () => {
        const state = {
            messageSystem: mockRefusalMessageSystemState({
                flag: true,
                content: getLocalization(' '),
            }),
        };

        expect(selectConnectV9RefusalMessage(state, V9_SOURCE)).toBe(DEFAULT_TEXT);
    });

    it.each([
        ['the config has no message for the domain', messageSystemInitialState],
        ['the flag is false', mockRefusalMessageSystemState({ flag: false })],
        [
            'only the note flag is on',
            mockMessageSystemStateWithFeatureFlags({ [Feature.connectV9.warning]: true }),
        ],
    ])('declines nothing when %s', (_description, messageSystem) => {
        expect(selectConnectV9RefusalMessage({ messageSystem }, V9_SOURCE)).toBeUndefined();
    });

    it('declines nothing when the store has no message system', () => {
        expect(selectConnectV9RefusalMessage({}, V9_SOURCE)).toBeUndefined();
    });

    it.each([
        ['an app on 10.0.1', getDesktopSource({ npmVersion: '10.0.1' })],
        ['the MCP server', MCP_SOURCE],
        ['a WalletConnect app', WALLETCONNECT_SOURCE],
    ])('never declines %s', (_description, source) => {
        expect(
            selectConnectV9RefusalMessage({ messageSystem: REFUSAL_ON }, source),
        ).toBeUndefined();
    });
});

describe('connectPopupCallInnerThunk with the connect.v9.refuse flag', () => {
    type CreateThunkDepsParams = {
        messageSystem?: MessageSystemState;
        connectPopup?: ConnectPopupState;
    };

    const createThunkDeps = ({
        messageSystem,
        connectPopup = connectPopupInitialState,
    }: CreateThunkDepsParams) => {
        const { services, report, lockDevice } = createServices();
        const state: ConnectPopupCallInnerThunkState = {
            device: deviceInitialState,
            connectPopup,
            messageSystem,
        };
        const getState = () => state;
        const extra: ConnectPopupCallInnerThunkDeps = { services };
        const { actions, dispatch } = createMockDispatch({ getState, extra });

        return { actions, dispatch, getState, extra, report, lockDevice };
    };

    beforeEach(() => {
        // The thunk logs every failed call.
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('declines a call from an app on 9.7.3 with Method_NotAllowed and the configured text', async () => {
        const connectCall = mockConnectCall();
        const { actions, dispatch, getState, extra, report, lockDevice } = createThunkDeps({
            messageSystem: REFUSAL_ON,
        });

        await connectPopupCallInnerThunk(getAddressCall(V9_SOURCE))(dispatch, getState, extra);

        expect(actions).toContainEqual(
            connectPopupActions.refuseConnectV9Call({
                method: 'getAddress',
                payload: GET_ADDRESS_PAYLOAD,
                source: V9_SOURCE,
                error: { code: 'Method_NotAllowed', message: CONFIGURED_TEXT },
            }),
        );
        expect(actions).not.toContainEqual(
            expect.objectContaining({ type: connectPopupActions.setError.type }),
        );
        expect(connectCall).not.toHaveBeenCalled();
        expect(report).toHaveBeenCalledWith({
            type: events.connectPopupErrorEvent.name,
            payload: expect.objectContaining({
                method: 'getAddress',
                error: 'Method_NotAllowed',
                npmVersion: '9.7.3',
                origin: V9_SOURCE.origin,
            }),
        });
        expect(lockDevice).toHaveBeenCalledWith(false);
    });

    it('declines a method that Suite does not support with Method_NotAllowed, not Method_Unsupported', async () => {
        const connectCall = mockConnectCall();
        const { actions, dispatch, getState, extra, report } = createThunkDeps({
            messageSystem: REFUSAL_ON,
        });

        await connectPopupCallInnerThunk({
            // Apps send any method name, the desktop listener casts it the same way.
            method: 'eosGetPublicKey' as CallMethodKeys,
            payload: {},
            source: V9_SOURCE,
        })(dispatch, getState, extra);

        expect(actions).toContainEqual(
            expect.objectContaining({
                type: connectPopupActions.refuseConnectV9Call.type,
                payload: expect.objectContaining({
                    error: { code: 'Method_NotAllowed', message: CONFIGURED_TEXT },
                }),
            }),
        );
        expect(actions).not.toContainEqual(connectPopupActions.finishCall());
        expect(connectCall).not.toHaveBeenCalled();
        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({ error: 'Method_NotAllowed' }),
            }),
        );
    });

    it('declines a call from an app whose permissions were remembered', async () => {
        const connectCall = mockConnectCall();
        const { actions, dispatch, getState, extra } = createThunkDeps({
            messageSystem: REFUSAL_ON,
            connectPopup: {
                ...connectPopupInitialState,
                permissions: [
                    { ...V9_SOURCE, allowedPermissions: [{ permission: 'read_address' }] },
                ],
            },
        });

        await connectPopupCallInnerThunk(getAddressCall(V9_SOURCE))(dispatch, getState, extra);

        expect(actions).toContainEqual(
            expect.objectContaining({ type: connectPopupActions.refuseConnectV9Call.type }),
        );
        expect(connectCall).not.toHaveBeenCalled();
    });

    it.each([
        ['the config has no message for the domain', messageSystemInitialState, V9_SOURCE],
        ['the flag is false', mockRefusalMessageSystemState({ flag: false }), V9_SOURCE],
        ['the store has no message system', undefined, V9_SOURCE],
        ['the app is on 10.0.1', REFUSAL_ON, getDesktopSource({ npmVersion: '10.0.1' })],
        ['the call comes from the MCP server', REFUSAL_ON, MCP_SOURCE],
        ['the call comes from a WalletConnect app', REFUSAL_ON, WALLETCONNECT_SOURCE],
    ])('goes on as usual when %s', async (_description, messageSystem, source) => {
        const connectCall = mockConnectCall();
        const { actions, dispatch, getState, extra } = createThunkDeps({ messageSystem });

        await connectPopupCallInnerThunk(getAddressCall(source))(dispatch, getState, extra);

        expect(connectCall).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'getAddress', __info: true }),
        );
        expect(actions).not.toContainEqual(
            expect.objectContaining({ type: connectPopupActions.refuseConnectV9Call.type }),
        );
    });
});

describe('declined Connect 9 calls in the popup state', () => {
    // The state of the call thunk, with the message system present.
    type DeclinedCallStoreState = ConnectPopupCallInnerThunkState & MessageSystemRootState;

    const connectPopupReducer = prepareConnectPopupReducer({
        actionTypes: { storageLoad: mockActionType('storageLoad') },
    });

    const initStore = (connectPopup: ConnectPopupState = connectPopupInitialState) => {
        const { services, report } = createServices();
        const { store } = createTestCompositionRoot<
            ConnectPopupCallInnerThunkDeps,
            DeclinedCallStoreState
        >({
            services: () => services,
            reducer: combineReducers({
                connectPopup: connectPopupReducer,
                device: (state = deviceInitialState) => state,
                messageSystem: (state = REFUSAL_ON) => state,
            }),
            preloadedState: {
                connectPopup,
                device: deviceInitialState,
                messageSystem: REFUSAL_ON,
            },
        }).services;

        return { store, report };
    };

    // How a call ends: Close in the error modal, or the call thunk, finishes it, and
    // useConnectPopupModals clears it right after.
    const finishAndClearCall = ({ store }: ReturnType<typeof initStore>) => {
        store.dispatch(connectPopupActions.finishCall());
        store.dispatch(connectPopupActions.clearCall());
    };

    const declinedCallError = { code: 'Method_NotAllowed', message: CONFIGURED_TEXT };

    const OTHER_APP_SOURCE = getDesktopSource({
        npmVersion: '10.0.1',
        origin: 'https://other.example.com',
    });
    const OTHER_APP_METHOD_INFO = {
        methodTitle: 'Export address',
        permissionTypes: [{ permission: 'read_address' as const }],
        useUi: true,
    };

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockConnectCall();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows the first declined call of an app together with the app', async () => {
        const { store } = initStore();

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({
                state: 'call-error',
                method: 'getAddress',
                source: V9_SOURCE,
                error: declinedCallError,
            }),
        );
    });

    it('declines later calls of the same app without showing them', async () => {
        const root = initStore();
        const { store, report } = root;

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));
        finishAndClearCall(root);
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toBeUndefined();
        // Both calls were answered.
        expect(report).toHaveBeenCalledTimes(2);
        expect(report).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: events.connectPopupErrorEvent.name }),
        );
    });

    it('keeps the modal of the first declined call while the same app calls again', async () => {
        const { store } = initStore();

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));
        const shownCall = selectConnectPopupCall(store.getState());
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toBe(shownCall);
    });

    it.each([
        ['another origin', getDesktopSource({ origin: 'https://other.example.com' })],
        ['the same origin in another process', getDesktopSource({ processPath: '/usr/bin/other' })],
    ])('shows a declined call of an app from %s', async (_description, otherSource) => {
        const root = initStore();
        const { store } = root;

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));
        finishAndClearCall(root);
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(otherSource)));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({
                state: 'call-error',
                source: otherSource,
                error: declinedCallError,
            }),
        );
    });

    it('shows a declined call again when a call of another app replaced it before it was closed', async () => {
        const root = initStore();
        const { store } = root;

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));
        store.dispatch(
            connectPopupActions.initiateCall({
                method: 'getAddress',
                payload: GET_ADDRESS_PAYLOAD,
                source: OTHER_APP_SOURCE,
                methodInfo: OTHER_APP_METHOD_INFO,
            }),
        );
        finishAndClearCall(root);
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({
                state: 'call-error',
                source: V9_SOURCE,
                error: declinedCallError,
            }),
        );

        finishAndClearCall(root);
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toBeUndefined();
    });

    it('shows a declined call again when a declined call of another app replaced it before it was closed', async () => {
        const root = initStore();
        const { store } = root;
        const otherV9Source = getDesktopSource({ origin: 'https://other.example.com' });

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(otherV9Source)));
        finishAndClearCall(root);
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(otherV9Source)));

        expect(selectConnectPopupCall(store.getState())).toBeUndefined();

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({ state: 'call-error', source: V9_SOURCE }),
        );
    });

    it('leaves a call that has just finished to be cleared and shows the next declined call', async () => {
        const finishedCall: ConnectPopupCallWithState<'finished'> = {
            state: 'finished',
            method: 'getAddress',
            payload: GET_ADDRESS_PAYLOAD,
            source: OTHER_APP_SOURCE,
            methodInfo: OTHER_APP_METHOD_INFO,
        };
        const { store } = initStore({ ...connectPopupInitialState, activeCall: finishedCall });

        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toEqual(finishedCall);

        store.dispatch(connectPopupActions.clearCall());
        await store.dispatch(connectPopupCallInnerThunk(getAddressCall(V9_SOURCE)));

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({ state: 'call-error', source: V9_SOURCE }),
        );
    });
});
