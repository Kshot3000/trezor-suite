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
import { createMockDispatch, mockActionType } from '@suite-common/redux-utils/mocks';
import { type LockDevice } from '@suite-common/suite-types';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import TrezorConnect, { type MethodInfo } from '@trezor/connect';
import { TypedError } from '@trezor/connect-common/src/constants/errors';

import { connectPopupActions } from './connectPopupActions';
import {
    connectPopupInitialState,
    prepareConnectPopupReducer,
    selectConnectPopupCall,
} from './connectPopupReducer';
import {
    type ConnectPopupDeeplinkThunkDeps,
    type ConnectPopupDeeplinkThunkState,
    connectPopupDeeplinkThunk,
} from './connectPopupThunks';
import {
    CALL_SOURCE_DEEPLINK,
    type ConnectCallSource,
    type ConnectPopupCall,
    type ConnectSerializedError,
} from './connectPopupTypes';

const REFUSAL_MESSAGE_ID = 'connect-v9-deeplink-test-message';
const CONFIGURED_TEXT = 'Declined by the config';
const CALL_UUID = '5f0c2a8e-3b1d-4c47-9a6e-2d8f1b7c4e90';

const mockRefusalMessageSystemState = (flag: boolean): MessageSystemState => ({
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
                    content: {
                        en: CONFIGURED_TEXT,
                        es: CONFIGURED_TEXT,
                        cs: CONFIGURED_TEXT,
                        de: CONFIGURED_TEXT,
                        fr: CONFIGURED_TEXT,
                        pt: CONFIGURED_TEXT,
                    },
                    feature: [{ domain: Feature.connectV9.refuse, flag }],
                },
            },
        ],
    },
});

const REFUSAL_ON = mockRefusalMessageSystemState(true);
const REFUSAL_OFF = mockRefusalMessageSystemState(false);

const GET_ADDRESS_PAYLOAD = { path: "m/84'/0'/0'/0/0", coin: 'btc' };
const GET_PUBLIC_KEY_PAYLOAD = { path: "m/44'/60'/0'", coin: 'eth' };

type GetDeeplinkUrlParams = {
    connectMajor: number;
    callbackUrl: string;
    deeplinkVersion?: number;
    method?: string;
    params?: object;
};

// The deeplink that @trezor/connect-mobile builds for a call.
const getDeeplinkUrl = ({
    connectMajor,
    callbackUrl,
    deeplinkVersion = 1,
    method = 'getAddress',
    params = GET_ADDRESS_PAYLOAD,
}: GetDeeplinkUrlParams) =>
    `https://connect.trezor.io/${connectMajor}/deeplink/${deeplinkVersion}/` +
    `?method=${method}` +
    `&params=${encodeURIComponent(JSON.stringify(params))}` +
    `&callback=${encodeURIComponent(callbackUrl)}` +
    `&appName=Example`;

// Connect 9 numbers its calls, Connect 10 uses UUIDs.
const CONNECT_9_DEEPLINK_URL = getDeeplinkUrl({
    connectMajor: 9,
    callbackUrl: 'exampleapp://callback?id=1',
});
const CONNECT_10_CALLBACK_URL = `exampleapp://callback?id=${CALL_UUID}`;
const CONNECT_10_DEEPLINK_URL = getDeeplinkUrl({
    connectMajor: 10,
    callbackUrl: CONNECT_10_CALLBACK_URL,
});

// No npm version in the manifest, so the method hooks that check it stay off.
const V9_DEEPLINK_SOURCE: ConnectCallSource = {
    type: CALL_SOURCE_DEEPLINK,
    origin: 'exampleapp://callback',
    manifest: { appName: 'Example', appIcon: '' },
    isConnectV9: true,
};

const DECLINED_ERROR: ConnectSerializedError = {
    code: 'Method_NotAllowed',
    message: CONFIGURED_TEXT,
};
const STOPPED_ERROR: ConnectSerializedError = {
    code: 'Method_Interrupted',
    message: 'Stopped by the test',
};
const CANCELED_ERROR: ConnectSerializedError = {
    code: 'Method_Cancel',
    message: 'Canceled',
};
const NOT_ALLOWED_ERROR: ConnectSerializedError = {
    code: 'Method_NotAllowed',
    message: 'Method not allowed for this configuration',
};

const GET_ADDRESS_INFO: MethodInfo = {
    useUi: true,
    useDevice: true,
    useDeviceState: true,
    name: 'getAddress',
    requiredPermissions: [{ permission: 'read_address' }],
    info: 'Export address',
};
// Deeplink calls never get the management permission.
const WIPE_DEVICE_INFO: MethodInfo = {
    useUi: true,
    useDevice: true,
    useDeviceState: false,
    name: 'wipeDevice',
    requiredPermissions: [{ permission: 'management' }],
    info: 'Wipe device',
};

type ConnectPopupDeeplinkServices = ConnectPopupDeeplinkThunkDeps['services'];

// createMockDeps does not accept the Analytics interface, so the services are built by hand.
const createServices = () => {
    const report = mock<ConnectPopupDeeplinkServices['analytics']['report']>();
    const services: ConnectPopupDeeplinkServices = {
        analytics: {
            init: () => {},
            enable: () => {},
            disable: () => {},
            isEnabled: () => true,
            setUrl: () => {},
            setLoggerEnabled: () => {},
            report,
        },
        lockDevice: mock<LockDevice>(),
    };

    return { services, report };
};

const mockConnectCall = () =>
    // Any answer ends a call that was not declined, so a plain failure is enough here.
    jest.spyOn(TrezorConnect, 'call').mockResolvedValue({ success: false, error: STOPPED_ERROR });

const getCallbackUrl = (actions: unknown[]) => {
    const callbackAction = actions.find(connectPopupActions.deeplinkCallback.match);
    if (!callbackAction) throw new Error('The app was not called back.');

    return new URL(callbackAction.payload.callbackUrl);
};

const getCallbackResponse = (actions: unknown[]) =>
    JSON.parse(getCallbackUrl(actions).searchParams.get('response') ?? 'null');

// The method description that Connect returns for the first call of every method.
const mockMethodInfo = (methodInfo: MethodInfo) =>
    jest.spyOn(TrezorConnect, 'call').mockResolvedValue({ success: true, payload: methodInfo });

describe('connectPopupDeeplinkThunk with Connect 9 apps', () => {
    const createThunkDeps = (messageSystem: MessageSystemState) => {
        const { services, report } = createServices();
        // The call thunk that the deeplink thunk dispatches reads the message system.
        const state: ConnectPopupDeeplinkThunkState & Partial<MessageSystemRootState> = {
            device: deviceInitialState,
            connectPopup: connectPopupInitialState,
            messageSystem,
        };
        const getState = () => state;
        const extra: ConnectPopupDeeplinkThunkDeps = { services };
        const { actions, dispatch } = createMockDispatch({ getState, extra });

        return { actions, dispatch, getState, extra, report };
    };

    beforeEach(() => {
        // The call thunk logs every failed call.
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('marks a call to /9/deeplink/ with a numeric id as Connect 9 and declines it while the switch is on', async () => {
        const connectCall = mockConnectCall();
        const { actions, dispatch, getState, extra, report } = createThunkDeps(REFUSAL_ON);

        await connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL })(dispatch, getState, extra);

        expect(actions).toContainEqual(
            connectPopupActions.refuseConnectV9Call({
                method: 'getAddress',
                payload: GET_ADDRESS_PAYLOAD,
                source: V9_DEEPLINK_SOURCE,
                error: DECLINED_ERROR,
            }),
        );
        expect(connectCall).not.toHaveBeenCalled();
        expect(report).toHaveBeenCalledWith({
            type: events.connectPopupErrorEvent.name,
            payload: expect.objectContaining({
                error: 'Method_NotAllowed',
                npmVersion: '9.x',
                connectionType: CALL_SOURCE_DEEPLINK,
            }),
        });
    });

    it('answers a declined call with the error in the payload, which Connect 9 apps read', async () => {
        mockConnectCall();
        const { actions, dispatch, getState, extra } = createThunkDeps(REFUSAL_ON);

        await connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL })(dispatch, getState, extra);

        expect(getCallbackUrl(actions).searchParams.get('id')).toBe('1');
        expect(getCallbackResponse(actions)).toEqual({
            success: false,
            error: DECLINED_ERROR,
            payload: { ...DECLINED_ERROR, error: CONFIGURED_TEXT },
        });
    });

    it('does not mark or decline a call to /10/deeplink/ with a UUID', async () => {
        const connectCall = mockConnectCall();
        const { actions, dispatch, getState, extra, report } = createThunkDeps(REFUSAL_ON);

        await connectPopupDeeplinkThunk({ url: CONNECT_10_DEEPLINK_URL })(
            dispatch,
            getState,
            extra,
        );

        expect(connectCall).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'getAddress', __info: true }),
        );
        expect(actions).not.toContainEqual(
            expect.objectContaining({ type: connectPopupActions.refuseConnectV9Call.type }),
        );
        expect(report).toHaveBeenCalledWith({
            type: events.connectPopupErrorEvent.name,
            payload: expect.objectContaining({
                npmVersion: undefined,
                connectionType: CALL_SOURCE_DEEPLINK,
            }),
        });
        // Connect 10 apps keep the answer they get today.
        expect(getCallbackResponse(actions)).toEqual({ success: false, error: STOPPED_ERROR });
    });

    it('passes on the answer of a Connect 10 call that ends before its first await', async () => {
        // on is a property of the TrezorConnect object, but apps cannot call it through Suite, so
        // the call ends with Method_Unsupported before it awaits anything.
        const { actions, dispatch, getState, extra } = createThunkDeps(REFUSAL_OFF);

        await connectPopupDeeplinkThunk({
            url: getDeeplinkUrl({
                connectMajor: 10,
                callbackUrl: CONNECT_10_CALLBACK_URL,
                method: 'on',
                params: {},
            }),
        })(dispatch, getState, extra);

        expect(getCallbackResponse(actions)).toEqual({
            success: false,
            error: expect.objectContaining({ code: 'Method_Unsupported' }),
        });
    });

    it('does not turn on the getPublicKey compatibility hook for a Connect 9 deeplink call', async () => {
        const connectCall = mockConnectCall();
        const { dispatch, getState, extra, report } = createThunkDeps(REFUSAL_OFF);

        await connectPopupDeeplinkThunk({
            url: getDeeplinkUrl({
                connectMajor: 9,
                callbackUrl: 'exampleapp://callback?id=2',
                method: 'getPublicKey',
                params: GET_PUBLIC_KEY_PAYLOAD,
            }),
        })(dispatch, getState, extra);

        // The call is marked, yet the payload goes to Connect as the app sent it.
        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({ npmVersion: '9.x' }),
            }),
        );
        expect(connectCall).toHaveBeenCalledWith({
            ...GET_PUBLIC_KEY_PAYLOAD,
            method: 'getPublicKey',
            __info: true,
            __precomposed: true,
        });
    });
});

describe('Connect 9 deeplink calls in the popup state', () => {
    // The state of the deeplink thunk and of the call thunk that it dispatches.
    type DeeplinkCallStoreState = ConnectPopupDeeplinkThunkState & MessageSystemRootState;

    const connectPopupReducer = prepareConnectPopupReducer({
        actionTypes: { storageLoad: mockActionType('storageLoad') },
    });

    const initStore = (messageSystem = REFUSAL_ON) => {
        const { services } = createServices();
        const { store } = createTestCompositionRoot<
            ConnectPopupDeeplinkThunkDeps,
            DeeplinkCallStoreState
        >({
            services: () => services,
            reducer: combineReducers({
                connectPopup: connectPopupReducer,
                device: (state = deviceInitialState) => state,
                messageSystem: (state = messageSystem) => state,
            }),
            preloadedState: {
                connectPopup: connectPopupInitialState,
                device: deviceInitialState,
                messageSystem,
            },
        }).services;

        return store;
    };

    type DeeplinkCallStore = ReturnType<typeof initStore>;

    const waitForCallState = (store: DeeplinkCallStore, callState: ConnectPopupCall['state']) =>
        new Promise<void>(resolve => {
            const unsubscribe = store.subscribe(() => {
                if (selectConnectPopupCall(store.getState())?.state !== callState) return;

                unsubscribe();
                resolve();
            });
        });

    const getCallError = (store: DeeplinkCallStore) => {
        const call = selectConnectPopupCall(store.getState());
        if (call?.state !== 'call-error') throw new Error('No call error.');

        return call;
    };

    // The answer that Suite mobile sends to the app by opening the callback URL.
    const getAppAnswer = (store: DeeplinkCallStore) => {
        const call = selectConnectPopupCall(store.getState());
        if (call?.state !== 'deeplink-callback') throw new Error('The app was not called back.');

        return JSON.parse(new URL(call.callbackUrl).searchParams.get('response') ?? 'null');
    };

    // What Suite mobile does when the user closes the error of a declined call.
    const closeDeclinedCall = (store: DeeplinkCallStore) => {
        const call = selectConnectPopupCall(store.getState());
        if (call?.state !== 'call-error' || !call.callbackUrl) {
            throw new Error('No declined call to close.');
        }

        store.dispatch(connectPopupActions.finishCall());
        store.dispatch(connectPopupActions.deeplinkCallback({ callbackUrl: call.callbackUrl }));
    };

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockConnectCall();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows a declined call and keeps the answer for the app until it is closed', async () => {
        const store = initStore();

        await store.dispatch(connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL }));

        const declinedCall = selectConnectPopupCall(store.getState());
        expect(declinedCall).toEqual(
            expect.objectContaining({
                state: 'call-error',
                source: V9_DEEPLINK_SOURCE,
                error: DECLINED_ERROR,
                isConnectV9Refusal: true,
                callbackUrl: expect.stringMatching(/^exampleapp:\/\/callback\?id=1&response=/),
            }),
        );

        closeDeclinedCall(store);

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({
                state: 'deeplink-callback',
                callbackUrl:
                    declinedCall?.state === 'call-error' ? declinedCall.callbackUrl : undefined,
            }),
        );
    });

    it('shows every declined call of an app, unlike calls from Suite desktop', async () => {
        const store = initStore();

        await store.dispatch(connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL }));
        closeDeclinedCall(store);
        await store.dispatch(
            connectPopupDeeplinkThunk({
                url: getDeeplinkUrl({
                    connectMajor: 9,
                    callbackUrl: 'exampleapp://callback?id=2',
                }),
            }),
        );

        expect(selectConnectPopupCall(store.getState())).toEqual(
            expect.objectContaining({
                state: 'call-error',
                isConnectV9Refusal: true,
                callbackUrl: expect.stringMatching(/^exampleapp:\/\/callback\?id=2&response=/),
            }),
        );
    });

    it('answers a rejected call of a Connect 9 app with the error in the payload', async () => {
        mockMethodInfo(GET_ADDRESS_INFO);
        const store = initStore(REFUSAL_OFF);
        const permissionRequest = waitForCallState(store, 'permission-request');

        const deeplinkCall = store.dispatch(
            connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL }),
        );
        await permissionRequest;
        store.dispatch(connectPopupActions.rejectPermissions(TypedError('Method_Cancel')));
        await deeplinkCall;

        expect(getAppAnswer(store)).toEqual({
            success: false,
            error: CANCELED_ERROR,
            payload: { ...CANCELED_ERROR, error: CANCELED_ERROR.message },
        });
    });

    it('does not carry a closed declined call over to the error of the next call', async () => {
        const store = initStore();

        await store.dispatch(connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL }));
        closeDeclinedCall(store);
        mockMethodInfo(WIPE_DEVICE_INFO);
        await store.dispatch(
            connectPopupDeeplinkThunk({
                url: getDeeplinkUrl({
                    connectMajor: 10,
                    callbackUrl: CONNECT_10_CALLBACK_URL,
                    method: 'wipeDevice',
                    params: {},
                }),
            }),
        );

        const callError = getCallError(store);
        expect(callError.error).toEqual(NOT_ALLOWED_ERROR);
        expect(callError.isConnectV9Refusal).toBeUndefined();
        // Closing this error must not open the callback URL of the declined call again.
        expect(callError.callbackUrl).toBeUndefined();
    });

    it('does not carry a declined call that is still shown over to the error of the next call', async () => {
        const store = initStore();

        await store.dispatch(connectPopupDeeplinkThunk({ url: CONNECT_9_DEEPLINK_URL }));
        // The user has left the declined call without closing it.
        await store.dispatch(
            connectPopupDeeplinkThunk({
                url: getDeeplinkUrl({
                    connectMajor: 10,
                    callbackUrl: CONNECT_10_CALLBACK_URL,
                    deeplinkVersion: 99,
                }),
            }),
        );

        const callError = getCallError(store);
        expect(callError.error.code).toBe('Deeplink_VersionMismatch');
        expect(callError.isConnectV9Refusal).toBeUndefined();
        expect(callError.callbackUrl).toBeUndefined();
    });

    it('does not mark the error of another call as declined', () => {
        const store = initStore();

        store.dispatch(connectPopupActions.setError(NOT_ALLOWED_ERROR));
        store.dispatch(
            connectPopupActions.deeplinkCallback({ callbackUrl: 'exampleapp://callback?id=3' }),
        );

        expect(selectConnectPopupCall(store.getState())).toEqual({
            state: 'error',
            error: NOT_ALLOWED_ERROR,
        });
    });
});
