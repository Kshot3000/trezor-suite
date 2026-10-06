import '@suite-common/test-utils/globalOverrides';

import { fireEvent, screen } from '@testing-library/react';

import { CALL_SOURCE_DESKTOP_WS, type ConnectCallSource } from '@suite-common/connect-popup';
import {
    Feature,
    type MessageSystemState,
    messageSystemInitialState,
    selectIsFeatureEnabled,
} from '@suite-common/message-system';
import { mockMessageSystemStateWithFeatureFlags } from '@suite-common/message-system/mocks';
import { type CTA, type Locale, type Localization } from '@suite-common/suite-types';
import { createTestCompositionRoot } from '@suite-common/test-utils';

import { type AppState } from 'src/reducers/store';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { ConnectV9Notice } from './ConnectV9Notice';
import { mockInitialAppState } from '../../../mocks/mockInitialAppState';

const NOTICE_TEST_ID = '@connect-permissions-modal/connect-v9-notice';
const NOTICE_MESSAGE_ID = 'connect-v9-notice-test-message';
const NOTICE_CTA_TEST_ID = `@message-system/${NOTICE_MESSAGE_ID}/cta`;

const getLocalization = (en: string, cs = en): Localization => ({
    en,
    es: en,
    cs,
    de: en,
    fr: en,
    pt: en,
});

const NOTICE_CONTENT = getLocalization('Notice from the config', 'Upozornění z konfigurace');
const NOTICE_CTA: CTA = {
    action: 'external-link',
    link: 'https://example.com/notice',
    label: getLocalization('Open link'),
};

type MockNoticeMessageSystemStateParams = {
    flag: boolean;
    content?: Localization;
    hasCTA?: boolean;
};

const mockNoticeMessageSystemState = ({
    flag,
    content = NOTICE_CONTENT,
    hasCTA = true,
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
                    content,
                    cta: hasCTA ? NOTICE_CTA : undefined,
                    feature: [{ domain: Feature.connectV9.warning, flag }],
                },
            },
        ],
    },
});

const getDesktopSource = (npmVersion?: string): ConnectCallSource => ({
    type: CALL_SOURCE_DESKTOP_WS,
    origin: 'https://example.com',
    process: { name: 'Browser', fullPath: '/usr/bin/browser', warning: false },
    manifest: { appName: 'Example', npmVersion },
});

const V9_SOURCE = getDesktopSource('9.7.3');

type RenderNoticeParams = {
    messageSystem: MessageSystemState;
    source?: ConnectCallSource;
    language?: Locale;
};

const renderNotice = ({
    messageSystem,
    source = V9_SOURCE,
    language = mockInitialAppState.suiteSettings.language,
}: RenderNoticeParams) => {
    const { services } = createTestCompositionRoot<void, AppState>({
        preloadedState: {
            ...mockInitialAppState,
            suiteSettings: { ...mockInitialAppState.suiteSettings, language },
            messageSystem,
        },
    });

    renderWithProviders(services, <ConnectV9Notice source={source} />);
};

describe('ConnectV9Notice', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows the configured content and link for an app on 9.7.3 when the flag is on', () => {
        renderNotice({ messageSystem: mockNoticeMessageSystemState({ flag: true }) });

        expect(screen.getByTestId(NOTICE_TEST_ID)).toHaveTextContent('Notice from the config');
        expect(screen.getByTestId(NOTICE_CTA_TEST_ID)).toHaveTextContent('Open link');
    });

    it('opens the configured link from the button', () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

        renderNotice({ messageSystem: mockNoticeMessageSystemState({ flag: true }) });
        fireEvent.click(screen.getByTestId(NOTICE_CTA_TEST_ID));

        expect(openSpy).toHaveBeenCalledWith('https://example.com/notice', '_blank');
    });

    it('shows the content without a button when the message has no cta', () => {
        renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true, hasCTA: false }),
        });

        expect(screen.getByTestId(NOTICE_TEST_ID)).toHaveTextContent('Notice from the config');
        expect(screen.queryByTestId(NOTICE_CTA_TEST_ID)).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows the content in the language of the user', () => {
        renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true }),
            language: 'cs-CZ',
        });

        expect(screen.getByTestId(NOTICE_TEST_ID)).toHaveTextContent('Upozornění z konfigurace');
    });

    it('shows the English content when the translation for the user is empty', () => {
        renderNotice({
            messageSystem: mockNoticeMessageSystemState({
                flag: true,
                content: getLocalization('Notice from the config', ''),
            }),
            language: 'cs-CZ',
        });

        expect(screen.getByTestId(NOTICE_TEST_ID)).toHaveTextContent('Notice from the config');
    });

    it('shows nothing when the config has no message for the domain', () => {
        const messageSystem = mockMessageSystemStateWithFeatureFlags({
            [Feature.suiteSync]: true,
        });

        // The generic selector treats a missing domain as enabled, the notice must not.
        expect(selectIsFeatureEnabled({ messageSystem }, Feature.connectV9.warning)).toBe(true);

        renderNotice({ messageSystem });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing before any config is loaded', () => {
        renderNotice({ messageSystem: messageSystemInitialState });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing when the flag is off', () => {
        renderNotice({ messageSystem: mockNoticeMessageSystemState({ flag: false }) });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing for an app on 10.0.1', () => {
        renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true }),
            source: getDesktopSource('10.0.1'),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing when the app sends no version', () => {
        renderNotice({
            messageSystem: mockNoticeMessageSystemState({ flag: true }),
            source: getDesktopSource(),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing when the message content is empty', () => {
        renderNotice({
            messageSystem: mockMessageSystemStateWithFeatureFlags({
                [Feature.connectV9.warning]: true,
            }),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing when the message content is only whitespace', () => {
        renderNotice({
            messageSystem: mockNoticeMessageSystemState({
                flag: true,
                content: getLocalization(' '),
            }),
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });

    it('shows nothing when the user has dismissed the message', () => {
        renderNotice({
            messageSystem: {
                ...mockNoticeMessageSystemState({ flag: true }),
                dismissedMessages: {
                    [NOTICE_MESSAGE_ID]: {
                        banner: false,
                        context: false,
                        modal: false,
                        feature: true,
                    },
                },
            },
        });

        expect(screen.queryByTestId(NOTICE_TEST_ID)).not.toBeInTheDocument();
    });
});
