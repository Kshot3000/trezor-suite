import { ERROR_CODES } from '@trezor/connect-common/src/constants/errors';

import { type ConnectSerializedError } from './connectPopupTypes';

export type ConnectV9ErrorPayload = Partial<ConnectSerializedError> & {
    error: string;
};

/**
 * Builds the `payload` of a failed Suite desktop response for Connect 9 clients. They show the
 * error text from `payload.error` and decide about a fallback by `payload.code`, so both are
 * needed. Connect 10 clients read only the `error` field of the response and ignore this payload.
 */
export const toConnectV9ErrorPayload = (
    error: Partial<ConnectSerializedError> | undefined,
): ConnectV9ErrorPayload => ({
    ...error,
    // Connect 9 types `payload.error` as a required string, so fall back to the code and then to
    // a generic text.
    error: error?.message || error?.code || ERROR_CODES.Failure_UnknownCode,
});
