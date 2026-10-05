import EthereumSignTransaction from './ethereumSignTransaction';
import { decodeEthereumDefinition, getEthereumDefinitions } from '../ethereumDefinitions';

jest.mock('../ethereumDefinitions', () => ({
    ...jest.requireActual('../ethereumDefinitions'),
    getEthereumDefinitions: jest.fn(),
    decodeEthereumDefinition: jest.fn(),
}));

const construct = (chainId: number) =>
    new EthereumSignTransaction({
        payload: {
            method: 'ethereumSignTransaction',
            path: "m/44'/60'/0'/0/0",
            transaction: {
                to: '0x7314e0f1c0e28474bdb6be3e2c3e0453255188f8',
                value: '0xf4240',
                gasPrice: '0x14',
                gasLimit: '0x14',
                nonce: '0x0',
                chainId,
            },
        },
    });

describe('EthereumSignTransaction __info', () => {
    beforeEach(() => {
        jest.mocked(getEthereumDefinitions).mockReset().mockResolvedValue({});
        jest.mocked(decodeEthereumDefinition).mockReturnValue({
            network: { chain_id: 137, name: 'Polygon', slip44: 966, symbol: 'POL' },
        });
    });

    it('names the chain from its definition, downloaded once for the title and precomposed', async () => {
        const method = construct(137);

        const { info } = await method.getMethodInfo();
        const precomposed = await method.payloadToPrecomposed();

        expect(info).toBe('Sign Polygon transaction');
        expect(precomposed?.nativeToken?.symbol).toBe('POL');
        expect(getEthereumDefinitions).toHaveBeenCalledTimes(1);
    });

    it('downloads nothing for a mainnet transfer', async () => {
        const { info } = await construct(1).getMethodInfo();

        expect(info).toBe('Sign Ethereum transaction');
        expect(getEthereumDefinitions).not.toHaveBeenCalled();
    });
});
