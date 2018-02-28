# plasma-mysql
mySQL wrapper for plasma functionality

The Ethereum plasma [specification](https://ethresear.ch/t/minimal-viable-plasma/426) outlines a mechanism to deposit tokens of value into an auxiliary system and further guarantees users the ability to withdraw those tokens as long as they remain unspent.

Although this side-system is presumed to be a blockchain (likely of centralized variety), there is no reason it cannot be a simple web service/API. This library outlines a minimum API for interacting with plasma tokens in mysql. It allows the operator to create UTXO 'tokens' to map to deposits on the root blockchain. It also allows users to spend those tokens (requiring a signature), and also accounts for withdrawals of unspent tokens.

## Usage

You can install with:

```
npm install plasma-mysql
```

The library is a wrapper over an existing `mysql` connection object:

```
var mysql = require('mysql');
var PlasmaSql = require('plasma-sql').default;

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'me',
  password : 'secret',
  database : 'my_db',
  multipleStatements: true  //this is required!
});

// Create your plasma connection object
var plasmaConn = new PlasmaSql(connection);

// Record a deposit that happened on the root chain
var deposit = {
  to: '0x6ce07006399d7092513f708b0fbb2243a7822443',
  value: 10,
  txHash: '412831121b09286f71b74cbbc82e1f37a0592a75fab47f369464e074e1d9f934',
}
plasmaConn.recordDeposit(deposit, (err) => {
  // deposit saved and utxo created (id = txhash)
})

// Do a general query
plasmaConn.query(`SELECT * FROM Utxos WHERE id='${deposit.txHash}'`, (err, results, fields) => {
  // same callback as mysql module
})
```

## API

plasma-sql provides an easy interface for managing plasma transactions off-chain.

### self.recordDeposit(params, cb)

Replay a deposit that was made on the root chain. This will create a UTXO object.

### self.spendUtxo(params, cb)

Spend a UTXO and create 1 or 2 new UTXOs from it. Signature from user is required.

### self.startWithdrawal(params, cb)

Replay the start of a withdrawal on the root chain. This will delete the corresponding UTXO in the database.

## self.merge(params, cb)

Merge two UTXOs for easier withdrawals on the root chain. Requires user signature. Destroys the original 2 UTXOs and creates a new one.
