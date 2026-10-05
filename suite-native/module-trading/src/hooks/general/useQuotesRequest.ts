import { useEffect, useEffectEvent, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { type ActionCreatorWithoutPayload, isFulfilled } from '@reduxjs/toolkit';

import { useTradingRefetchScheduler } from '@suite-common/trading';
import { type AbortablePromise } from '@suite-native/trading-types';
import { useDebounce } from '@trezor/react-utils';
import { noop } from '@trezor/utils';

import { useQuotesInvalidator } from './useQuotesInvalidator';

type QuotesRequestKeyParams = Record<string, string | boolean | undefined>;

/**
 * Serializes the values that should trigger a new quotes request. Returns `undefined` when fetching
 * is not allowed, which also invalidates already loaded quotes.
 */
export const getQuotesRequestKey = (
    isFetchAllowed: boolean,
    params: QuotesRequestKeyParams,
): string | undefined => (isFetchAllowed ? JSON.stringify(params) : undefined);

export type UseQuotesRequestParams = {
    requestKey: string | undefined;
    fetchQuotes: () => AbortablePromise | undefined;
    onQuotesReceived?: () => void;
    isLoading: boolean;
    hasQuotes: boolean;
    clearQuotesAction: ActionCreatorWithoutPayload;
    clearStateAction: ActionCreatorWithoutPayload;
};

const hasReceivedQuotes = (action: unknown) =>
    isFulfilled(action) && Array.isArray(action.payload) && action.payload.length > 0;

export const useQuotesRequest = ({
    requestKey,
    fetchQuotes,
    onQuotesReceived,
    isLoading,
    hasQuotes,
    clearQuotesAction,
    clearStateAction,
}: UseQuotesRequestParams) => {
    const debounce = useDebounce();
    const isFocused = useIsFocused();
    const quotesPromiseRef = useRef<AbortablePromise | undefined>(undefined);
    const wasBlurredRef = useRef(false);
    const isFetchAllowed = requestKey !== undefined;

    useQuotesInvalidator({
        isFormValid: isFetchAllowed,
        isLoading,
        anyQuotesLoaded: hasQuotes,
        quotesPromiseRef,
        debounce,
        getClearRequestAction: clearQuotesAction,
        getClearStateAction: clearStateAction,
    });

    const runQuotesRequest = async () => {
        const quotesPromise = fetchQuotes();
        quotesPromiseRef.current = quotesPromise;

        if (!quotesPromise || !onQuotesReceived) {
            return;
        }

        const action = await quotesPromise;
        if (hasReceivedQuotes(action)) {
            onQuotesReceived();
        }
    };

    const abortQuotesRequest = (reason: string) => {
        if (quotesPromiseRef.current?.abort) {
            quotesPromiseRef.current.abort(reason);
        }
    };

    const requestQuotes = useEffectEvent((shouldFetchImmediately: boolean) => {
        abortQuotesRequest('Request was replaced by another one.');

        if (shouldFetchImmediately) {
            runQuotesRequest();
        } else {
            debounce(runQuotesRequest);
        }
    });

    const cancelQuotesRequest = useEffectEvent(() => {
        debounce(noop);
        abortQuotesRequest('Screen lost focus.');
    });

    useEffect(() => {
        if (!isFocused) {
            wasBlurredRef.current = true;
            cancelQuotesRequest();

            return;
        }

        // If the screen was blurred, we want to fetch quotes immediately when it regains focus.
        const shouldFetchImmediately = wasBlurredRef.current;
        wasBlurredRef.current = false;

        if (requestKey === undefined) {
            return;
        }

        requestQuotes(shouldFetchImmediately);
    }, [requestKey, isFocused]);

    useTradingRefetchScheduler({
        onRefetch: () => {
            if (!isFetchAllowed || !isFocused) return;
            debounce(runQuotesRequest);
        },
    });
};
