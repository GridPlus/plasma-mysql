// Plasma functionality for a MySQL instance
import { utxos, creates, spends, deposits, withdrawals, merges } from './queries/tables.js';
import { logDeposit, createUtxo } from './queries/utxo.js';
const sha3 = require('solidity-sha3').default;
const leftPad = require('left-pad');
const ethutil = require('ethereumjs-util');

class PlasmaSql {
  constructor (conn) {
    this.conn = conn;
    this.conn.connect();
    this.createTables();
  }

  // Create a UTXO object for a user. The id should be the transaction hash
  // of the blockchain deposit
  recordDeposit(params, cb) {
    const { to, value, txHash } = params;
    const chainId = params.chainId ? params.chainId : 0;
    const tokenId = params.tokenId ? params.tokenId : '';

    // First log the deposit
    const depositQ = logDeposit(to, value, txHash, chainId, tokenId);
    this.query(depositQ, (err, results, fields) => {
      if (err) { cb(err); }
      else {
        // Then create the UTXO
        const utxoQ = createUtxo(to, value, txHash);
        this.query(utxoQ, (err, results, fields) => {
          if (err) { cb(err); }
          else { cb(null, txHash); }
        })
      }
    })
  }

  // Allow a user to spend a UTXO and create 1 or 2 new UTXOs from that spend
  spendUtxo(params, cb) {
    const { id, to, value, v, r, s } = params;
    // Check the signature spending the UTXO
    try {
      // Check the signer of the spend message
      const hash = sha3(`${id}${to.slice(2)}${leftPad(value.toString('hex'), 64, '0')}`);
      const signerPubKey = ethutil.ecrecover(hash, v, r, s);
      const signer = ethutil.publicToAddress(signerPubKey);
      const q = utxo.getUtxo(id);
      this.getOne(q, (err, utxo) => {
        if (utxo.owner != signer) { cb('Signer does not own UTXO.'); }
        else if (utxo.value < value) { cb('Insufficient value in UTXO.'); }
        else {
          // Delete the original (old) UTXO
          const delQ = utxo.delete(id);
          this.query(delQ, (err) => {
            if (err) { cb(err); }
            else {
              // Create 1 or 2 new UTXOs

            }
          })
        }
      })
    } catch (err) {
      cb(err);
    }
  }

  // Register a withdrawal that happened on the root chain. Delete the UTXO
  // and mark the withdrawal as started. If the withdrawal comples, we will
  // call a separate function to mark the withdrawal as finalized.
  startWithdrawal(params, cb) {
    const { id, txHash } = params;
  }

  // Allow a user to merge two UTXOs
  merge(params, cb) {
    const { id1, id2, v, r, s } = params;
  }

  // Send a bunch of CREATE IF NOT EXISTS commands to the connection.
  // There are a few tables required for plasma functionality
  createTables() {
    this.query(tables(), (err, results, fields) => {
      if (err) { throw new Error(err); }
    })
  }

  // Get a single record
  getOne(q, cb) {
    this.query(q, (err, results, fields) {
      if (err) { cb(err); }
      else { cb(null, results[0]); }
    }
  }

  query(data, cb) {
    this.conn.query(data, cb);
  }

  quit() {
    this.conn.end();
  }

}
