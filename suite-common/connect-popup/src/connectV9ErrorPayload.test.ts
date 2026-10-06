import { TypedError, serializeError } from '@trezor/connect-common/src/constants/errors';

import { type ConnectSerializedError } from './connectPopupTypes';
import { toConnectV9ErrorPayload } from './connectV9ErrorPayload';

describe('toConnectV9ErrorPayload', () => {
    it('adds the message as the error text and keeps the message and the code', () => {
        const error: ConnectSerializedError = {
            message: 'Coin not found',
            code: 'Method_UnknownCoin',
        };

        expect(toConnectV9ErrorPayload(error)).toEqual({
            message: 'Coin not found',
            code: 'Method_UnknownCoin',
            error: 'Coin not found',
        });
    });

    it('keeps the text and the code of a cancelled request', () => {
        const error = serializeError(TypedError('Method_Cancel'));

        expect(toConnectV9ErrorPayload(error)).toEqual({
            message: 'Canceled',
            code: 'Method_Cancel',
            error: 'Canceled',
        });
    });

    it('does not modify the given error', () => {
        const error: ConnectSerializedError = {
            message: 'Popup closed',
            code: 'Method_Interrupted',
        };

        toConnectV9ErrorPayload(error);

        expect(error).toEqual({ message: 'Popup closed', code: 'Method_Interrupted' });
    });

    it('falls back to the code when the message is missing', () => {
        expect(toConnectV9ErrorPayload({ code: 'Method_Interrupted' })).toEqual({
            code: 'Method_Interrupted',
            error: 'Method_Interrupted',
        });
    });

    it('falls back to the code when the message is empty', () => {
        expect(toConnectV9ErrorPayload({ message: '', code: 'Method_Interrupted' })).toEqual({
            message: '',
            code: 'Method_Interrupted',
            error: 'Method_Interrupted',
        });
    });

    it('returns a generic error text when the error is missing', () => {
        expect(toConnectV9ErrorPayload(undefined)).toEqual({ error: 'Unknown error' });
    });
});
