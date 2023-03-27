# Send to Social

![image](https://user-images.githubusercontent.com/170588/228046344-7e852b78-b91a-4de6-9e94-9575dc013312.png)

Use existing usernames (social media, email, etc.) to send money. This is a hackathon project for the [Unlocking the Potential of XRP Ledger Hackathon](https://unlockingxrpl.devpost.com/?utm_campaign=send-to-social).

## Overview

This is a simple service that allows you to send money to a user who may not yet have an XRP address. It's implemented as a command line tool that creates a non-custodial wallet as well as a backend service that watches for incoming payments and fulfills escrowed payments.

## How it works

To send money to an email for example, you'd issue a command requesting to send money to Distributed Identifiers (DIDs) which can be associated with a social media account or email address. The tool uses the escrow functionality of the XRPL to set aside funds, notifies our backend of the new user, and later creates a payment when we know the payment account for the user.

## Example

```bash
$ setler send social did:kudos:email:matt@loremlabs.com ...
```

![Screen-Recording-2023-03-25-at-20 03 15](https://user-images.githubusercontent.com/170588/227736633-93f70b05-56d2-4993-9de2-9a446d19404c.gif)

## What happens

1. The escrowed payment is received by the XRPL.
2. Th watcher service watches our payment address for new transactions.
3. When we receive a transaction, we check to see if it is a DID we know about. If it is, we check to see if the DID has a payment address associated with it.
4. If the DID has a payment address in our database, we fulfill the escrowed payment with the pre-image. We then send the funds to the DID's payment address.
5. If the DID does not have a payment address in our database, the funds can be returned when the escrow expires.

## Overview Architecture

![Architecture](./docs/send-to-social-overview.svg)
