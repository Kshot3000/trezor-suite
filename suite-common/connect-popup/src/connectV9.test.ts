import {
    CALL_SOURCE_DEEPLINK,
    CALL_SOURCE_DESKTOP_WS,
    type ConnectCallSource,
} from './connectPopupTypes';
import { getConnectAnalyticsNpmVersion, isConnectV9Deeplink, isConnectV9Source } from './connectV9';

const CALL_UUID = '5f0c2a8e-3b1d-4c47-9a6e-2d8f1b7c4e90';

const getDesktopSource = (npmVersion?: string): ConnectCallSource => ({
    type: CALL_SOURCE_DESKTOP_WS,
    origin: 'https://example.com',
    process: { name: 'Browser', fullPath: '/usr/bin/browser', warning: false },
    manifest: { appName: 'Example', npmVersion },
});

const getDeeplinkSource = (isConnectV9?: boolean): ConnectCallSource => ({
    type: CALL_SOURCE_DEEPLINK,
    origin: 'exampleapp://callback',
    manifest: { appName: 'Example', appIcon: '' },
    isConnectV9,
});

describe('isConnectV9Source', () => {
    it.each(['9.7.3', '9.0.0'])('returns true for an app on %s', npmVersion => {
        expect(isConnectV9Source(getDesktopSource(npmVersion))).toBe(true);
    });

    it('returns false for an app on 10.0.1', () => {
        expect(isConnectV9Source(getDesktopSource('10.0.1'))).toBe(false);
    });

    it('returns false when the app sends no version', () => {
        expect(isConnectV9Source(getDesktopSource())).toBe(false);
    });

    it('returns true for a deeplink call marked as Connect 9', () => {
        expect(isConnectV9Source(getDeeplinkSource(true))).toBe(true);
    });

    it.each([false, undefined])('returns false for a deeplink call marked as %s', isConnectV9 => {
        expect(isConnectV9Source(getDeeplinkSource(isConnectV9))).toBe(false);
    });
});

describe('isConnectV9Deeplink', () => {
    const getParams = (deeplinkUrl: string, callbackUrl: string) => ({
        deeplinkUrl: new URL(deeplinkUrl),
        callbackUrl: new URL(callbackUrl),
    });

    it('returns true for /9/deeplink/ with a numeric id', () => {
        expect(
            isConnectV9Deeplink(
                getParams(
                    'https://connect.trezor.io/9/deeplink/1/?method=getAddress',
                    'exampleapp://callback?id=1',
                ),
            ),
        ).toBe(true);
    });

    it('returns false for /10/deeplink/ with a UUID', () => {
        expect(
            isConnectV9Deeplink(
                getParams(
                    'https://connect.trezor.io/10/deeplink/1/?method=getAddress',
                    `exampleapp://callback?id=${CALL_UUID}`,
                ),
            ),
        ).toBe(false);
    });

    it('returns false for /9/deeplink/ with a UUID', () => {
        expect(
            isConnectV9Deeplink(
                getParams(
                    'https://connect.trezor.io/9/deeplink/1/?method=getAddress',
                    `exampleapp://callback?id=${CALL_UUID}`,
                ),
            ),
        ).toBe(false);
    });

    it('returns false for /10/deeplink/ with a numeric id', () => {
        expect(
            isConnectV9Deeplink(
                getParams(
                    'https://connect.trezor.io/10/deeplink/1/?method=getAddress',
                    'exampleapp://callback?id=12',
                ),
            ),
        ).toBe(false);
    });

    it('returns false when the callback URL has no id', () => {
        expect(
            isConnectV9Deeplink(
                getParams(
                    'https://connect.trezor.io/9/deeplink/1/?method=getAddress',
                    'exampleapp://callback',
                ),
            ),
        ).toBe(false);
    });

    it.each([
        ['trezorsuite://connect/deeplink/1/?method=getAddress'],
        ['https://dev.suite.sldev.cz/connect/develop/deeplink/1/?method=getAddress'],
    ])('decides by the id alone for %s, which has no major', deeplinkUrl => {
        expect(isConnectV9Deeplink(getParams(deeplinkUrl, 'exampleapp://callback?id=3'))).toBe(
            true,
        );
        expect(
            isConnectV9Deeplink(getParams(deeplinkUrl, `exampleapp://callback?id=${CALL_UUID}`)),
        ).toBe(false);
    });
});

describe('getConnectAnalyticsNpmVersion', () => {
    it.each(['9.7.3', '10.0.1'])('reports %s from the manifest', npmVersion => {
        expect(getConnectAnalyticsNpmVersion(getDesktopSource(npmVersion))).toBe(npmVersion);
    });

    it('reports 9.x for a deeplink call marked as Connect 9', () => {
        expect(getConnectAnalyticsNpmVersion(getDeeplinkSource(true))).toBe('9.x');
    });

    it('reports no version for other deeplink calls', () => {
        expect(getConnectAnalyticsNpmVersion(getDeeplinkSource(false))).toBeUndefined();
    });
});
