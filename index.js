// Plasma functionality for a MySQL instance
const { tables } = require('./queries/tables.js');
const { logDeposit, createUtxo, getUtxo, deleteUtxo } = require('./queries/utxo.js');
const sha3 = require('solidity-sha3').default;
const leftPad = require('left-pad');
const ethutil = require('ethereumjs-util');

class PlasmaSql {
  constructor (conn) {
    this.conn = conn;
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
      const hash = this.newId(id, to, value);
      const br = Buffer.from(r, 'hex');
      const bs = Buffer.from(s, 'hex');
      const signerPubKey = ethutil.ecrecover(Buffer.from(hash.slice(2), 'hex'), v, br, bs);
      const signer = '0x' + ethutil.publicToAddress(signerPubKey).toString('hex');
      const q = getUtxo(id);
      this.getOne(q, (err, utxo) => {
        if (utxo.owner != signer) { cb('Signer does not own UTXO.'); }
        else if (utxo.value < value) { cb('Insufficient value in UTXO.'); }
        else if (utxo.deleted == 1) { cb('UTXO already spent.'); }
        else {
          // Delete the original (old) UTXO
          this.deleteUtxos(id, (err) => {
            if (err) { cb(err); }
            else {
              // Create new UTXO ids deterministically
              // Create the new UTXO(s)
              const newId1 = hash;
              const q1 = createUtxo(to, value, newId1);
              const newId2 = value < utxo.value ? this.newId(id, signer, utxo.value - value) : null;
              const q2 = newId2 == null ? null : createUtxo(signer, utxo.value - value, newId2);
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

  // Get all Utxos belonging to a particular user
  getUserUtxos(user, cb) {
    const q = `SELECT * FROM Utxos WHERE owner='${user}' AND deleted=0`;
    this.query(q, (err, rows) => {
      if (err) { cb(err); }
      else { cb(null, rows); }
    })
  }

  // Register a withdrawal that happened on the root chain. Delete the UTXO
  // and mark the withdrawal as started. If the withdrawal comples, we will
  // call a separate function to mark the withdrawal as finalized.
  startWithdrawal(params, cb) {
    const { id, txHash } = params;
  }

  // Send a bunch of CREATE IF NOT EXISTS commands to the connection.
  // There are a few tables required for plasma functionality
  createTables() {
    const tableQs = tables();
    this.multiQuery(tableQs, (err) => {
      if (err) { throw new Error(err); }
    })
  }

  // Get a single record
  getOne(q, cb) {
    this.query(q, (err, results, fields) => {
      if (err) { cb(err); }
      else { cb(null, results[0]); }
    })
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
    if (typeof ids == 'string') { ids = [ids]; }
    if (outerCb == null) { outerCb = cb; }
    if (ids.length == 0 ) { outerCb(null); }
    else {
      const id = ids.pop();
      const delQ = deleteUtxo(id);
      this.query(delQ, (err) => {
        if (err) { outerCb(err); }
        else { this.deleteUtxos(ids, cb, outerCb); }
      })
    }
  }

  // Play multiple queries in sequence. The order is preserved.
  multiQuery(queries, cb) {
    // Join separate queries on ;
    const joined = queries.join('; ')
    this.query(joined, (err) => {
      if (err) { cb(err); }
      else { cb(null); }
    });
  }

  newId(oldId, to, value) {
    const prehash = `${oldId}${to.slice(2)}${leftPad(value.toString(16), 64, '0')}`;
    return sha3(prehash);
  }

  close() { this.conn.end(); }

}

exports.default = PlasmaSql;
