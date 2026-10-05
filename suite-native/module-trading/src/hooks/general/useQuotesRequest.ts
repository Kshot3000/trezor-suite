import { useEffect, useEffectEvent, useRef } from 'react';

import { type ActionCreatorWithoutPayload, isFulfilled } from '@reduxjs/toolkit';

import { useTradingRefetchScheduler } from '@suite-common/trading';
import { type AbortablePromise } from '@suite-native/trading-types';
import { useDebounce } from '@trezor/react-utils';

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
    const quotesPromiseRef = useRef<AbortablePromise | undefined>(undefined);
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

    const requestQuotes = useEffectEvent(() => {
        if (quotesPromiseRef.current?.abort) {
            quotesPromiseRef.current.abort('Request was replaced by another one.');
        }

        debounce(runQuotesRequest);
    });

    useEffect(() => {
        if (requestKey === undefined) {
            return;
        }

        requestQuotes();
    }, [requestKey]);

    useTradingRefetchScheduler({
        onRefetch: () => {
            if (!isFetchAllowed) return;
            debounce(runQuotesRequest);
        },
    });
};
