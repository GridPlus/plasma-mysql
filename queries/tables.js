// Create table commands

exports.tables = function() {
  let q = 'CREATE Utxos IF NOT EXISTS (id VARCHAR(66), owner VARCHAR(22), value INT, ';
  q += ' tokenId VARCHAR(22), chainId INT, deleted BOOL, createdAt TIMESTAMP);';

  q += 'CREATE Creates IF NOT EXISTS (id VARCHAR(66), owner VARCHAR(22), value INT,'
  q += 'tokenId VARCHAR(22), chainId INT, createdAt TIMESTAMP);';

  q = 'CREATE Spends IF NOT EXISTS (oldTx VARCHAR(66), value INT, newTx1 VARCHAR(66),';
  q += ' newTx2 VARCHAR(66), v TINYINT(1), r VARCHAR(66), s VARCHAR(66), createdAt TIMESTAMP);';

  q = 'CREATE Deposits IF NOT EXISTS (owner VARCHAR(22), value INT,';
  q += ' txHash VARCHAR(66), tokenId VARCHAR(22), chainId INT, createdAt TIMESTAMP);';

  q = 'CREATE Withdrawals IF NOT EXISTS (utxoId VARCHAR(66), startedTxHash VARCHAR(66),';
  q += ' completed BOOL, createdAt TIMESTAMP);';

  q = 'CREATE Merges IF NOT EXISTS (utxoId1 VARCHAR(66), utxoId2 VARCHAR(66), ';
  q += 'newUtxoId VARCHAR(66), v TINYINT(1), r VARCHAR(66), s VARCHAR(66), createdAt TIMESTAMP);';

  return q;
}
