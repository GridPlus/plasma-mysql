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
    const utxoQ = createUtxo(to, value, txHash);
    this.multiQuery([depositQ, utxoQ], cb);
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
          this.deleteUtxos(id, (err) => {
            if (err) { cb(err); }
            else {
              // Create new UTXO ids deterministically
              // Create the new UTXO(s)
              const newId1 = this.newId(to, id);
              const q1 = createUtxo(to, value, newId1);
              const newId2 = value < utxo.value ? this.newId(signer, id) : null;
              const q2 = newId2 == null ? null : createUtxo(to, utxo.value - value, newId2);
              const qs = newId2 == null ? [q1] : [q1, q2];
              this.multiQuery(qs, cb);
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
    try {
      const hash = sha3(`${id1}${id2}`);
      const signerPubKey = ethutil.ecrecover(hash, v, r, s);
      const signer = ethutil.publicToAddress(signerPubKey);
      const q1 = utxo.getUtxo(id1);
      const q2 = utxo.getUtxo(id2);
      let sum = 0;
      // Get the UTXOs and ensure the merger owns both
      this.getOne(q1, (err, utxo1) => {
        if (err) { cb(err); }
        else if (utxo1.owner != signer) { cb('Tx1 does not belong to signer.'); }
        else {
          sum += utxo1.value;
          this.getOne(q2, (err, utxo2) => {
            if (err) { cb(err); }
            else if (utxo2.owner != signer) { cb('Tx2 does not belong to signer.'); }
            else {
              sum += utxo2.value;
              // Delete the original UTXOs
              this.deleteUtxos([id1, id2], (err) => {
                if (err) { cb(err); }
                else {
                  // Merge the UTXOs
                  const newId = this.newId(signer, id1, id2);
                  const createQ = createUtxo(signer, sum, newId);
                  this.query(createQ, cb);
                }
              })
            }
          })
        }
      })
    }
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

  // Delete one or more utxos. Expecting ids to be an array, but can handle
  // a single number
  deleteUtxos(ids, cb, outerCb=null) {
    if (typeof ids == 'number') { ids = [ids]; }
    if (outerCb == null) { outerCb = cb; }
    if (ids.length == 0 ) { outerCb(null); }
    else {
      const id = ids.pop();
      const delQ = utxo.delete(id);
      this.query(delQ, (err) => {
        if (err) { outerCb(err); }
        else { deleteUtxos(ids, cb, outerCb); }
      })
    }
  }

  // Play multiple queries in sequence. The order is preserved.
  multiQuery(queries, cb, outerCb=null) {
    if (queries.length == 0) { outerCb(null); }
    else {
      const q = queries.reverse().pop();
      this.query(q, (err) => {
        if (err) { outerCb(err); }
        else { multiQuery(queries, cb, outerCb); }
      })
    }
  }

  newId(to, oldId, extraData=1) {
    return sha3(to, oldId, extraData);
  }

}
