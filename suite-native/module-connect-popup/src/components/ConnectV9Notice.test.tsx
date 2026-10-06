import { CALL_SOURCE_DEEPLINK, type ConnectCallSource } from '@suite-common/connect-popup';
import {
    Feature,
    type MessageSystemState,
    messageSystemInitialState,
} from '@suite-common/message-system';
import { mockMessageSystemStateWithFeatureFlags } from '@suite-common/message-system/mocks';
import { renderWithStoreProvider, screen } from '@suite-native/test-utils-store';

import { ConnectV9Notice } from './ConnectV9Notice';

const NOTICE_TEST_ID = '@popup/connect-v9-notice';
const NOTICE_MESSAGE_ID = 'connect-v9-notice-test-message';
const NOTICE_TEXT = 'Notice from the config';
const NOTICE_TEXT_CS = 'Upozornění z konfigurace';
const LINK_LABEL = 'Open link';

type MockNoticeMessageSystemStateParams = {
    flag: boolean;
    ctaAction?: 'external-link' | 'internal-link';
};

const mockNoticeMessageSystemState = ({
    flag,
    ctaAction = 'external-link',
}: MockNoticeMessageSystemStateParams): MessageSystemState => ({
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
                        cs: NOTICE_TEXT_CS,
                        de: NOTICE_TEXT,
                        fr: NOTICE_TEXT,
                        pt: NOTICE_TEXT,
                    },
                    cta: {
                        action: ctaAction,
                        link: 'https://example.com/notice',
                        label: {
                            en: LINK_LABEL,
                            es: LINK_LABEL,
                            cs: LINK_LABEL,
                            de: LINK_LABEL,
                            fr: LINK_LABEL,
                            pt: LINK_LABEL,
                        },
                    },
                    feature: [{ domain: Feature.connectV9.warning, flag }],
                },
            },
        ],
    },
});

const getDeeplinkSource = (isConnectV9: boolean): ConnectCallSource => ({
    type: CALL_SOURCE_DEEPLINK,
    origin: 'exampleapp://callback',
    manifest: { appName: 'Example', appIcon: '' },
    isConnectV9,
});

type RenderNoticeParams = {
    messageSystem: MessageSystemState;
    source?: ConnectCallSource;
    localeCode?: string;
};

const renderNotice = ({
    messageSystem,
    source = getDeeplinkSource(true),
    localeCode = 'en-US',
}: RenderNoticeParams) =>
    renderWithStoreProvider(<ConnectV9Notice source={source} />, {
        preloadedState: {
            messageSystem,
            locale: { appLocaleCode: localeCode, systemLocaleCode: localeCode },
        },
    });

describe('ConnectV9Notice', () => {
    it('shows the configured content and link for a Connect 9 deeplink call when the flag is on', async () => {
        await renderNotice({ messageSystem: mockNoticeMessageSystemState({ flag: true }) });

        expect(screen.getByTestId(NOTICE_TEST_ID)).toBeTruthy();
        expect(screen.getByText(NOTICE_TEXT, { exact: false })).toBeTruthy();
        expect(screen.getByText(LINK_LABEL)).toBeTruthy();
    });

    it('shows the content in the language of the user', async () => {
        await renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true }),
            localeCode: 'cs-CZ',
        });

        expect(screen.getByText(NOTICE_TEXT_CS, { exact: false })).toBeTruthy();
    });

    it('leaves out a link to a Suite desktop route', async () => {
        await renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true, ctaAction: 'internal-link' }),
        });

        expect(screen.getByText(NOTICE_TEXT, { exact: false })).toBeTruthy();
        expect(screen.queryByText(LINK_LABEL)).toBeNull();
    });

    it('shows nothing when the flag is off', async () => {
        await renderNotice({ messageSystem: mockNoticeMessageSystemState({ flag: false }) });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).toBeNull();
    });

    it('shows nothing when the config has no message for the domain', async () => {
        await renderNotice({
            messageSystem: mockMessageSystemStateWithFeatureFlags({ [Feature.suiteSync]: true }),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).toBeNull();
    });

    it('shows nothing when the message content is empty', async () => {
        await renderNotice({
            messageSystem: mockMessageSystemStateWithFeatureFlags({
                [Feature.connectV9.warning]: true,
            }),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).toBeNull();
    });

    it('shows nothing for a deeplink call that is not from Connect 9', async () => {
        await renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true }),
            source: getDeeplinkSource(false),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).toBeNull();
    });
});
