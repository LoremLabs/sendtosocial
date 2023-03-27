# Send to Social CLI

This is a simple cli tool to help us implement the send-to-social idea.



## Usage

```
% npx @loremlabs/send-to-social
```

```
% npx @loremlabs/send-to-social help
```

### Wallet

To use you start by creating a wallet. This is a non-custodial wallet that is used to send and receive payments as well as perform the escrowed payments.

Setup a new wallet with:

```
% npx @loremlabs/send-to-social wallet init
```

Then you can fund your wallet with:

```
% npx @loremlabs/send-to-social wallet fund
```

Which (for testnet) will fund the wallet with 1000 XRP.

You can also receive payments to your wallet with:

```
% npx @loremlabs/send-to-social wallet receive
```

### Social Send

To send a social send you need to have a wallet setup and funded. You can then send a social send with:

```
% npx @loremlabs/send-to-social send social did:kudos:email:YOUR_EMAIL@YOUR_DOMAIN
``` 



