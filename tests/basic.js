const assert = require('assert');
const ethutil = require('ethereumjs-util');
const leftPad = require('left-pad');
const sha3 = require('solidity-sha3').default;
const mysql = require('mysql');
const PlasmaSql = require('../index.js').default;

const key = 'ad339a5aed3b6183b3baceb4c35f72d7357a2997b00c7a603bae5cc40ff66d04'
const addr = '0x' + ethutil.privateToAddress(Buffer.from(key, 'hex')).toString('hex');
const conn = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'plasma',
  multipleStatements: true,
});
const plasmaSql = new PlasmaSql(conn);


function getSpendHash(id, to, value) {
  const prehash = `${id}${to.slice(2)}${leftPad(value.toString(16), 64, '0')}`;
  return sha3(prehash);
}

function signHash(h, pkey) {
  const sig = ethutil.ecsign(Buffer.from(h.slice(2), 'hex'), Buffer.from(pkey, 'hex'));
  return sig;
}

describe('1. Table checks', () => {
  it('Should check Utxo table', (done) => {
    conn.query('SHOW COLUMNS FROM Utxos', (err, rows) => {
      assert(err === null);
      assert(rows.length === 9);
      done();
    });
  });

  it('Should check Creates table', (done) => {
    conn.query('SHOW COLUMNS FROM Creates', (err, rows) => {
      assert(err === null);
      assert(rows.length === 6);
      done();
    });
  });

  it('Should check Spends table', (done) => {
    conn.query('SHOW COLUMNS FROM Spends', (err, rows) => {
      assert(err === null);
      assert(rows.length === 10);
      done();
    });
  });

  it('Should check Deposits table', (done) => {
    conn.query('SHOW COLUMNS FROM Deposits', (err, rows) => {
      assert(err === null);
      assert(rows.length === 6);
      done();
    });
  });

  it('Should check Withdrawals table', (done) => {
    conn.query('SHOW COLUMNS FROM Withdrawals', (err, rows) => {
      assert(err === null);
      assert(rows.length === 6);
      done();
    });
  });

  it('Should check Transfers table', (done) => {
    conn.query('SHOW COLUMNS FROM Transfers', (err, rows) => {
      assert(err === null);
      assert(rows.length === 5);
      done();
    });
  });
});

let id1;
const newPkey = '9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658'
const newAddr = ethutil.privateToAddress(Buffer.from(newPkey, 'hex'));
let newId1;
let newId2;
let newId3;
describe('2. Create and spend UTXOs', () => {
  it('Should relay a deposit', (done) => {
    const deposit = {
      to: addr,
      value: 10,
      txHash: sha3(new Date().getTime()), // made up deposit
    };
    id1 = deposit.txHash;
    plasmaSql.recordDeposit(deposit, (err) => {
      assert(err === null);
      done();
    });
  });

  it('Should try to spend the UTXO via someone else and fail', (done) => {
    const h = getSpendHash(id1, '0x' + newAddr.toString('hex'), 10);
    const sig = signHash(h, newPkey);
    const params = {
      id: id1,
      to: '0x' + newAddr.toString('hex'),
      value: 10,
      v: sig.v,
      r: sig.r.toString('hex'),
      s: sig.s.toString('hex'),
    };
    const signerPubKey = ethutil.ecrecover(Buffer.from(h.slice(2), 'hex'), sig.v, sig.r, sig.s);
    assert(ethutil.publicToAddress(signerPubKey).toString('hex') === newAddr.toString('hex'));
    plasmaSql.spendUtxo(params, (err) => {
      assert(err === 'Signer does not own UTXO.')
      done();
    });
  });

  it('Should successfully spend some of the UTXO', (done) => {
    const to = '0x' + newAddr.toString('hex');
    const h = getSpendHash(id1, to, 2);
    const sig = signHash(h, key);
    const params = {
      id: id1,
      to: to,
      value: 2,
      v: sig.v,
      r: sig.r.toString('hex'),
      s: sig.s.toString('hex'),
    };
    const signerPubKey = ethutil.ecrecover(Buffer.from(h.slice(2), 'hex'), sig.v, sig.r, sig.s);
    const signer = '0x' + ethutil.publicToAddress(signerPubKey).toString('hex');
    assert(signer === addr);
    plasmaSql.spendUtxo(params, (err) => {
      assert(err === null)
      done();
    });
  });

  it('Should fail spend some of the deleted UTXO', (done) => {
    const to = '0x' + newAddr.toString('hex');
    const h = getSpendHash(id1, to, 2);
    const sig = signHash(h, key);
    const params = {
      id: id1,
      to: to,
      value: 2,
      v: sig.v,
      r: sig.r.toString('hex'),
      s: sig.s.toString('hex'),
    };
    const signerPubKey = ethutil.ecrecover(Buffer.from(h.slice(2), 'hex'), sig.v, sig.r, sig.s);
    const signer = '0x' + ethutil.publicToAddress(signerPubKey).toString('hex');
    assert(signer === addr);
    plasmaSql.spendUtxo(params, (err) => {
      assert(err == 'UTXO already spent.');
      done();
    });
  });

  it('Should check the users Utxos and find a new Utxo', (done) => {
    plasmaSql.getUserUtxos(addr, (err, utxos) => {
      assert(err === null);
      assert(utxos.length === 1);
      assert(utxos[0].value === 8);
      done();
    });
  });

  it('Should check spends and find a new record', (done) => {
    plasmaSql.query('SELECT * FROM Spends', (err, spends) => {
      assert(err === null);
      assert(spends.length === 1);
      // newTx2 belongs to the original sender (it is the change UTXO)
      newId1 = spends[0].newTx1;
      newId2 = spends[0].newTx2;
      done();
    });
  });

  it('Should spend the new Utxo', (done) => {
    const to = addr;
    const h = getSpendHash(newId1, to, 1);
    const sig = signHash(h, newPkey);
    const params = {
      id: newId1,
      to: to,
      value: 1,
      v: sig.v,
      r: sig.r.toString('hex'),
      s: sig.s.toString('hex'),
    };
    plasmaSql.spendUtxo(params, (err, newIds) => {
      assert(err === null);
      newId3 = newIds.newId2;
      done();
    });
  });
});

let lastSpendId;
describe('Checkpointing', () => {
  it('Should get the last spend id', (done) => {
    plasmaSql.getLastSpendId((err, id) => {
      assert(err === null);
      lastSpendId = id;
      done();
    });
  });

  it('Should get the list of spends logged', (done) => {
    plasmaSql.getSpends(1, lastSpendId, (err, spends) => {
      assert(err === null);
      assert(spends.length === 2);
      done();
    });
  });

  it('Should log that a user withdrawal has been initiated', (done) => {
    const madeUpHash = '0xa243c4c597803ed1c261dafb25fc0e2175cc3a4eae168302cc594ff614e98ffc'
    plasmaSql.recordWithdrawalStarted({ id: newId1, txHash: madeUpHash }, (err) => {
      assert(err === null);
      done();
    });
  });

  it('Should get the provenance on newId1', (done) => {
    plasmaSql.getUtxoProvenance(newId3, (err, provenance) => {
      assert(err === null);
      assert(provenance.length === 2);
      done();
    })
  })
});

describe('Cleanup', () => {
  it('Should drop tables', () => {
    let q = 'drop table Creates; drop table Deposits; drop table Spends; ';
    q += 'drop table Utxos; drop table Withdrawals; drop table Transfers';
    plasmaSql.query(q, (err) => {
      assert(err === null);
    });
  });
});
