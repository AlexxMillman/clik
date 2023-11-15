#!/usr/bin/env node
'use strict'
import { Argument, Command, Option } from 'commander'
import { initialize, formatNumberToBalance, getKeyringFromSeed, isValidAddress } from 'avail-js-sdk'
import { ApiPromise } from '@polkadot/api';
import { ISubmittableResult, SignatureOptions } from '@polkadot/types/types';
import { KeyringPair } from '@polkadot/keyring/types';
import { H256 } from '@polkadot/types/interfaces';
import { spawn } from 'child_process'
// import { version } from './package.json'  assert { type: "json" };
const program = new Command()

enum NetworkNames {
  Kate = 'kate',
  Goldberg = 'goldberg',
  Local = 'local'
}

const NETWORK_RPC_URLS: { kate: string, goldberg: string, local: string } = {
  kate: 'wss://kate.avail.tools/ws',
  goldberg: 'wss://goldberg.avail.tools/ws',
  local: 'wss://127.0.0.1:9944/ws'
}

program
  .name('avail')
  .description('A simple CLI for Avail network utilities')

const transfer = async (to: string, value: number, options: {
  seed: string
  network: NetworkNames
  rpc: string
  to: string
  value: number
}): Promise<void> => {
  try {
    if (!isValidAddress(to)) throw new Error(to + ' recipient address is invalid')
    const seed = options.seed

    let rpcUrl: string
    if (typeof (NETWORK_RPC_URLS[options.network]) === 'undefined') {
      rpcUrl = options.rpc
    } else {
      rpcUrl = NETWORK_RPC_URLS[options.network]
    }

    const tempConsoleWarn = console.warn
    console.warn = () => {}
    const api = await initialize(rpcUrl, { noInitWarn: true })
    console.warn = tempConsoleWarn
    const keyring = getKeyringFromSeed(seed)
    const amount = formatNumberToBalance(value)

    await api.tx.balances.transfer(to, amount).signAndSend(keyring, { nonce: -1 })
    console.log(`✅ ${value} AVL successfully sent to ${to}`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const sendTx = async (api: any, blob: string, keyring: KeyringPair, opt: Partial<any>): Promise<void> => {
  return new Promise((resolve, reject) => {
    api.tx.dataAvailability.submitData(blob)
      .signAndSend(keyring, opt, (result: ISubmittableResult) => {

        if (result.status.isInBlock) {
          console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
        }
        if (result.status.isFinalized) {
          console.log(`Transaction included at blockHash ${result.status.asFinalized}`);
          resolve();
        }
      })
      .catch((error: any) => {
        console.error('Transaction failed:', error);
        reject(error); // Reject the promise on error
      });
  });
};




async function data(blob: string, options: {
  seed: string;
  network: NetworkNames;
  rpc: string;
  appId: number;
}): Promise<void> {
  try {
    const seed = options.seed;

    let rpcUrl: string;
    if (typeof (NETWORK_RPC_URLS[options.network]) === 'undefined') {
      rpcUrl = options.rpc;
    } else {
      rpcUrl = NETWORK_RPC_URLS[options.network];
    }
    interface SignatureOptionsNew extends SignatureOptions {
      app_id: number;
    }
    const tempConsoleWarn = console.warn;
    console.warn = () => { };
    const api = await initialize(rpcUrl, { noInitWarn: true });
    console.warn = tempConsoleWarn;
    const keyring = getKeyringFromSeed(seed);
    const opt: Partial<any> = { app_id: options.appId, nonce: -1 };


    //   await api.tx.dataAvailability.submitData(blob).signAndSend(
    //     keyring,  // sender
    //     opt, // options
    //     (result: ISubmittableResult) => {
    //         //uncomment the below line👇 to see the whole status flow of the transaction
    //         // console.log(`Tx status: ${result.status}`);
    //         if (result.status.isReady) {
    //             console.log(`result is ready`)
    //         }
    //         if (result.status.isInBlock) {
    //             let block_hash = result.status.asInBlock;
    //             let extrinsic_hash = result.txHash;
    //             console.log(`\nExtrinsic hash: ${result.txHash} is in block`);
    // }
    //     })
    await sendTx(api, blob, keyring, opt);
    console.log('✅ Data blob sent to Avail');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

const lc = async (options: {
  network: NetworkNames
  config: string
}): Promise<void> => {
  try {
    let cmd = `curl -sL1 avail.sh | sh -s -- --network ${options.network}`
    if (typeof (options.config) !== 'undefined') {
      cmd = cmd.concat(` --config ${options.config}`)
    }
    const child: any = spawn(cmd, { cwd: process.cwd(), shell: true, stdio: 'inherit' })
    child.on('close', (code: number) => {
      process.exit(code)
    })
    child.on('exit', (code: number) => {
      process.exit(code)
    })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

program
  .command('transfer').description('Transfer AVL token to another account')
  .addOption(new Option('-n, --network <network name>', 'network name').choices(['kate', 'goldberg', 'local']).default('goldberg').conflicts('rpc'))
  .addOption(new Option('-r, --rpc <RPC url>', 'the RPC url to connect to').env('AVAIL_RPC_URL').default(NETWORK_RPC_URLS.goldberg))
  .addOption(new Option('-s, --seed <seed phrase>', 'the seed phrase for the Avail account').env('AVAIL_SEED').makeOptionMandatory())
  .argument('<to>', 'the recipient address')
  .argument('<value>', 'the amount of AVL (10e18 units) to transfer')
  .action(transfer)

program
  .command('data').description('Utilities to operate with data on Avail network')
  .command('submit').description('Submit a data blob to an Avail network')
  .addOption(new Option('-n, --network <network name>', 'network name').choices(['kate', 'goldberg', 'local']).default('goldberg').conflicts('rpc'))
  .addOption(new Option('-r, --rpc <RPC url>', 'the RPC url to connect to').env('AVAIL_RPC_URL').default(NETWORK_RPC_URLS.goldberg))
  .addOption(new Option('-s, --seed <seed phrase>', 'the seed phrase for the Avail account').env('AVAIL_SEED').makeOptionMandatory())
  .addOption(new Option('-a, --app-id <app ID>', 'the blob will be submitted with this app ID').default(0))
  .addArgument(new Argument('<blob>', 'the data blob to submit'))
  .action(data)

program
  .command('lc').description('Utilities to operate an Avail light client')
  .command('up').description('Spawns a new Avail light client or runs an existing one')
  .addOption(new Option('-n, --network <network name>', 'network name').choices(['kate', 'goldberg', 'local']).default('goldberg').makeOptionMandatory())
  .option('-c, --config <path to config file>', 'the config file to use')
  .action(lc)

program.parse()
