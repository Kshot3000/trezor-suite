import { CALL_SOURCE_DESKTOP_WS, type ConnectCallSource } from './connectPopupTypes';
import { isConnectV9Source } from './connectV9';

const getDesktopSource = (npmVersion?: string): ConnectCallSource => ({
    type: CALL_SOURCE_DESKTOP_WS,
    origin: 'https://example.com',
    process: { name: 'Browser', fullPath: '/usr/bin/browser', warning: false },
    manifest: { appName: 'Example', npmVersion },
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
});
