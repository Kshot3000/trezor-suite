import type { StakingBatch } from '@suite-common/earn-staking-api';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { TestCategory, TestPriority, TestStream, createTestAnnotation } from '@trezor/e2e-utils';

import { expect, test } from '../../../support/fixtures';
import { ADA_MOCKED_ACCOUNT } from '../../../support/mocks/ada-endpoints';

const adaSymbol = asNetworkSymbol('ada');
// EVE7 pool
const everstakePoolId = 'pool1n0uxgs5qfk5n9xl7qvq9jt8zuu02cntrsjnjayjlqtejyffnemj';
const everstakePoolApy = 3.9;
// Retired FiveBinaries pool
const fiveBinariesPoolId = 'pool1nhhsh9yhlrvj9e3nce0zpx0xm2xlt6tx7gqakhr6hjc8wy84sat';

test.describe(
    'Staking - Cardano outdated provider',
    { tag: ['@T3W1', '@T3T1', '@webOnly'] },
    () => {
        test.use({ deviceSetup: { mnemonic: 'mnemonic_academic' } });

        test.beforeEach(async ({ page, onboardingPage, settingsPage, blockbookMock }) => {
            await test.step('Mock Everstake Cardano pool stats', async () => {
                await page.route(/\/staking\/v1\/\?networks=/, route =>
                    route.fulfill({
                        json: {
                            data: [
                                {
                                    symbol: 'ada',
                                    pools: [
                                        {
                                            apy: everstakePoolApy,
                                            saturation: 50,
                                            id: everstakePoolId,
                                        },
                                    ],
                                },
                            ],
                            errors: [],
                        } satisfies StakingBatch,
                    }),
                );
            });

            await onboardingPage.completeOnboarding();

            await test.step('Enable Cardano with account staked to a FiveBinaries pool', async () => {
                await settingsPage.navigateTo('coins');
                await blockbookMock.start('ada', 'blockfrost');
                blockbookMock.updateAccountState({
                    misc: {
                        staking: {
                            ...ADA_MOCKED_ACCOUNT.misc.staking,
                            isActive: true,
                            poolId: fiveBinariesPoolId,
                        },
                    },
                });

                await settingsPage.changeNetworks({
                    enableNetworks: [
                        {
                            symbol: adaSymbol,
                            backend: { type: 'blockfrost', url: blockbookMock.url },
                        },
                    ],
                });
            });
        });

        test(
            'User staked with FiveBinaries is warned to update provider',
            {
                annotation: createTestAnnotation({
                    testCase:
                        'Verifies that a Cardano account delegated to a retired FiveBinaries pool shows the outdated provider warnings and leads the user to Earn.',
                    category: TestCategory.Staking,
                    priority: TestPriority.Medium,
                    stream: TestStream.Earn,
                }),
            },
            async ({ page, walletPage, stakingSection, earnNutshellModal }) => {
                await test.step('Verify global outdated staking banner', async () => {
                    await expect(stakingSection.cardanoOutdatedBanner).toContainTranslation(
                        'TR_STAKING_MODAL_OUTDATED',
                        { values: { apy: everstakePoolApy } },
                    );
                    await expect(
                        stakingSection.cardanoOutdatedBannerUpdateProviderButton,
                    ).toHaveTranslation('TR_STAKING_MODAL_OUTDATED_BUTTON');
                });

                await test.step('Verify "No rewards" label in account menu', async () => {
                    await expect(
                        walletPage.stakingRewardsReducedLabel({
                            symbol: adaSymbol,
                            subAccount: 'staking',
                        }),
                    ).toHaveTranslation('TR_STAKING_REWARDS_REDUCED');
                });

                await test.step('Verify outdated provider card on Staking tab', async () => {
                    await walletPage.openAccount({ symbol: adaSymbol });
                    await stakingSection.stakingTabButton.click();
                    await expect(stakingSection.stakingDashboardCard).toBeVisible();
                    await expect(stakingSection.newProviderCard).toContainTranslation(
                        'TR_STAKING_NEW_PROVIDER_OUTDATED_TITLE',
                    );
                    await expect(stakingSection.newProviderCard).toContainTranslation(
                        'TR_STAKING_NEW_PROVIDER_OUTDATED_TEXT',
                        { values: { apy: everstakePoolApy, displaySymbol: 'ADA' } },
                    );
                    await expect(
                        stakingSection.newProviderCardUpdateProviderButton,
                    ).toHaveTranslation('TR_EARN_UPDATE_PROVIDER');
                    await expect(stakingSection.startStakingButton).toBeHidden();
                });

                await test.step('Card button opens update provider modal', async () => {
                    await stakingSection.newProviderCardUpdateProviderButton.click();
                    await expect(earnNutshellModal.heading).toHaveTranslation(
                        'TR_EARN_STAKING_IN_A_NUTSHELL',
                    );
                    await expect(earnNutshellModal.updateProviderProcess).toContainTranslation(
                        'TR_EARN_PROVIDER_UPDATE',
                    );
                    await page.modalCloseButton.click();
                    await expect(earnNutshellModal.modalContainer).toBeHidden();
                });

                await test.step('Banner button navigates to Earn', async () => {
                    await stakingSection.cardanoOutdatedBannerUpdateProviderButton.click();
                    await expect(
                        stakingSection.earnDashboardUpdateProviderButton,
                    ).toHaveTranslation('TR_EARN_UPDATE_PROVIDER');
                });

                await test.step('Earn button navigates to account Staking tab', async () => {
                    await stakingSection.earnDashboardUpdateProviderButton.click();
                    await expect(stakingSection.stakingDashboardCard).toBeVisible();
                    await expect(stakingSection.newProviderCard).toContainTranslation(
                        'TR_STAKING_NEW_PROVIDER_OUTDATED_TITLE',
                    );
                });
            },
        );
    },
);
