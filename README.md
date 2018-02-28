# plasma-sql
mySQL wrapper for plasma functionality

The Ethereum plasma [specification](https://ethresear.ch/t/minimal-viable-plasma/426) outlines a mechanism to deposit tokens of value into an auxiliary system and further guarantees users the ability to withdraw those tokens as long as they remain unspent.

Although this side-system is presumed to be a blockchain (likely of centralized variety), there is no reason it cannot be a simple web service/API. This library outlines a minimum API for interacting with plasma tokens in mysql. It allows the operator to create UTXO 'tokens' to map to deposits on the root blockchain. It also allows users to spend those tokens (requiring a signature), and also accounts for withdrawals of unspent tokens.

## Usage

You can install with:

```
npm install plasma-sql
```

The library is a wrapper over an existing `mysql` connection object. It may be usable with other connections, but has only been tested with the `mysql` package.

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

## UTXO Standard

UTXO (unspent transaction output) objects represent deposits made on the Ethereum root chain. They can be spent off-chain and an owner may withdraw any UTXO he or she owns at any time, but once that withdrawal is triggered the user should not be able to spend the UTXO on your application. You should watch the anchored root chain plasma contract for any withdrawals and quickly replay them on your state. If you don't and the user spends his or her UTXO, it will be difficult to resolve. *Note that in some plasma implementations, the user may incur a penalty on-chain for spending a UTXO when it is being withdrawn.* There are several ways to avoid this situation (e.g. by exposing the plasma interface through your app), but they are out of the scope of this module.

UTXOs can be created in one of two ways:

1. Corresponding to a deposit, the UTXO is created with an `id` equal to the Ethereum transaction hash of the deposit on the root chain.
2. From a spend, which creates one or two new UTXOs (two if there is change). The id of a UTXO can be determined as:

```
keccak256(previousId, to, value)
```

Where `previousId` is the id of the UTXO that created this one.

To withdraw a UTXO on a plasma chain, the user would need to collect signatures spending each UTXO that led to the one being withdrawn. This is called the *provenance* of the UTXO and can be collected via `getUtxoProvenance()` (see API). The longer this provenance, the more costly a withdrawal - good UX designs should keep this constraint in mind.

## API

plasma-sql provides an easy interface for managing plasma transactions off-chain.

### self.recordDeposit(params, cb)

Replay a deposit that was made on the root chain. This will create a UTXO object.

*params*:
```
{
  to: <string>,     // 0x-prefixed Ethereum address of depositor
  value: <int>,     // atomic units of token deposited
  txHash: <string>, // 0x-prefixed hash of deposit transaction
  chainId: <int>,   // [OPTIONAL] id of blockchain on which deposit was made
  tokenId: <string>,// [OPTIONAL] address of token on deposit blockchain
}
```

*cb*: (Error)

### self.spendUtxo(params, cb)

Spend a UTXO and create 1 or 2 new UTXOs from it. Signature from user is required.

*params*:
```
{
  id: <string>,     // id of the UTXO (txHash or derived from previous UTXO)
  to: <string>,     // recipient of payment
  value: <int>,     // atomic units of payment
  v: <int>,         // 27 or 28
  r: <string>,
  s: <string>,
}
```

*cb*: (Error)

### self.getUserUtxos(user, cb)

Get all of a user's open UTXOs.

*cb*: (Error, array) with array of:

```
{
  id: <string>,
  owner: <string>,
  value: <int>,
  tokenId: <string>,
  chainId: <string>,
  deleted: 0,
  createdAt: <timestamp>
}
```

### self.startWithdrawal(params, cb)

Replay the start of a withdrawal on the root chain. This will delete the corresponding UTXO in the database.

*params* Object:
```
{
  id: <string>,         // UTXO identifier
  txHash: <string>,     // transaction hash of withdrawal on the root chain
  chainId: <string>,    // [OPTIONAL] id of the root chain
  tokenId: <string>     // [OPTIONAL] address of token being withdrawn
}
```
*cb* Error

### self.getUtxoProvenance(id, cb)

Get the full provenance of a UTXO given its id.

*id* string: UTXO identifier to get provenance on

*cb*: (Error, array) with array of Spend objects:

```
{
  id: <int>,                // SQL id of Spend record
  oldTx: <string>,          // id of UTXO that was spent
  value: <int>,             // amount spent
  toAddr: <string>,         // recipient of newTx1
  newTx1: <string>,         // UTXO created with value specified to toAddr
  newTx2: <string>,         // UTXO created if there is change, owned by sender
  v: <int>,   
  r: <string>,
  s: <string>,  
  createdAt: <timestamp>
}
```
