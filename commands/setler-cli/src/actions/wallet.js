import chalk from "chalk";
import { gatekeep } from "../lib/wallet/gatekeep.js";
import prompts from "prompts";
import { waitFor } from "../lib/wait.js";

const log = console.log;

const exec = async (context) => {
  // switch based on the subcommand
  switch (context.input[1]) {
    case "init":
      await gatekeep(context, true);
      break;
    case "fund": {
      await gatekeep(context);

      let network = context.flags.network || "xrpl:testnet";
      if (network === "testnet") {
        network = "xrpl:testnet";
      } else if (network === "livenet") {
        network = "xrpl:livenet";
      }
      const keys = await context.vault.keys();

      // convert xrpl:testnet to keys[xrpl][testnet]
      let walletAddress;
      const networkParts = network.split(":");
      if (networkParts.length === 1) {
        walletAddress = keys[network].address;
      } else {
        walletAddress = keys[networkParts[0]][networkParts[1]].address;
      }

      // input[2] could be {address}, in which case we should fund that address
      // ask for the address
      const response = await prompts([
        {
          type: "text",
          name: "address",
          message: `Enter the address you want to fund: `,
          initial: walletAddress,
        },
        // confirm are you sure
        {
          type: "confirm",
          name: "ok",
          message: `Are you sure you want to fund this address?`,
          initial: false,
        },
      ]);
      if (!response.address || !response.ok) {
        process.exit(1);
      }
      walletAddress = response.address;

      const faucetPromise = context.coins.fundViaFaucet({
        network,
        address: walletAddress,
      });
      const status = await waitFor(faucetPromise, {
        text: `Funding ${walletAddress} on ${network}`,
      });
      if (status) {
        log(chalk.bold(`Ok, funded. New balance: ${status.balance}`));
      } else {
        log(chalk.red(`Funding failed.`));
      }

      await context.coins.disconnect();

      break;
    }
    case "keys":
      await gatekeep(context);

      if (!context.keys) {
        context.keys = await context.vault.keys();
      }
      log(`keys: ${JSON.stringify(context.keys, null, "  ")}`);
      break;
    case "mnemonic":
      await gatekeep(context);

      // input[2] could be {set}, in which case we should set the mnemonic
      if (context.input[2] === "set") {
        // ask for the mnemonic
        const response = await prompts([
          {
            type: "text",
            name: "mnemonic",
            message: `Enter your mnemonic phrase in one line, separated by spaces: `,
            initial: false,
          },
          // confirm are you sure
          {
            type: "confirm",
            name: "ok",
            message: `Are you sure you want to set this mnemonic?`,
            initial: false,
          },
        ]);
        if (!response.mnemonic || !response.ok) {
          process.exit(1);
        }
        await context.vault.write("mnemonic", response.mnemonic);
      } else {
        // get the mnemonic
        if (!context.flags.yes) {
          // ask if we should print the mnemonic
          const response = await prompts([
            {
              type: "confirm",
              name: "ok",
              message: `Would you like to disclose your mnemonic phrase?`,
              initial: false,
            },
          ]);
          if (!response.ok) {
            process.exit(1);
          }
        }
        log(chalk.bold(context.mnemonic));
      }
      break;
    default:
      if (
        !context.input[1] ||
        context.flags.help ||
        context.input[1] === "help"
      ) {
        // give help with available subcommands and flags
        log("Usage: setler wallet [command] [options]");
        log("");
        log("Commands:");
        log("  init");
        log("  keys");
        log("  mnemonic {get,set}");
        log("");
        log("Options:");
        log(
          "  --profile <profile> - default: 0, 1, 2, ... Same mnemonic, different keys"
        );
        log(
          "  --scope <scope> - default: 0, 1, 2, ... Different mnemonic, different keys"
        );
        log("  --passPhrase <passPhrase> - default: ''");
        log("  --yes - default: false");
        log("");
        log("Examples:");
        log("  setler wallet init --profile 0 --scope 5");
        log("  setler wallet keys --profile 1 --scope 5");
        log("  setler wallet mnemonic --yes --scope 0");
        log("  setler wallet mnemonic set --scope 1");
        log("");

        process.exit(1);
      }

      log(chalk.red(`Unknown command: ${context.input[1]}`));
      process.exit(1);
  }
};

export { exec };
