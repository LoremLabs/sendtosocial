# Send to Social CLI

This is a simple cli tool to help us implement the send-to-social idea.

## Usage

```
% setler help
```

### Wallet

To use setler, you start by creating a wallet. This is a non-custodial wallet that is used to send and receive payments as well as perform the escrowed payments.

Setup a new wallet with:

```
% setler wallet init
```

Then you can fund your wallet with:

```
% setler wallet fund
```

Which (for testnet) will fund the wallet with 1000 XRP.

You can also receive payments to your wallet with:

```
% setler wallet receive
```
