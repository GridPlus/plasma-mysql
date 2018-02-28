// Create table commands

exports.tables = function() {
  let q1 = 'CREATE TABLE IF NOT EXISTS Utxos (id VARCHAR(66), owner VARCHAR(42), value INT, ';
  q1 += ' tokenId VARCHAR(42), chainId INT, deleted TINYINT(1) DEFAULT 0, createdAt TIMESTAMP)';

  let q2 = 'CREATE TABLE IF NOT EXISTS Creates (id VARCHAR(66), owner VARCHAR(42), value INT, '
  q2 += 'tokenId VARCHAR(42), chainId INT, createdAt TIMESTAMP)';

  let q3 = 'CREATE TABLE IF NOT EXISTS Spends (oldTx VARCHAR(66), value INT, newTx1 VARCHAR(66),';
  q3 += ' newTx2 VARCHAR(66), v TINYINT(1), r VARCHAR(66), s VARCHAR(66), createdAt TIMESTAMP)';

  let q4 = 'CREATE TABLE IF NOT EXISTS Deposits (owner VARCHAR(42), value INT,';
  q4 += ' txHash VARCHAR(66), tokenId VARCHAR(42), chainId INT, createdAt TIMESTAMP)';

  let q5 = 'CREATE TABLE IF NOT EXISTS Withdrawals (utxoId VARCHAR(66), startedTxHash VARCHAR(66),';
  q5 += ' completed BOOL, createdAt TIMESTAMP)';

  return [q1, q2, q3, q4, q5];
}
