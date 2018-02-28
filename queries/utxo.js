// SQL statements for dealing with UTXOS

exports.logDeposit = function(to, value, txHash, chainId, tokenId) {
  let q = `INSERT INTO Deposits (owner, value, txHash, tokenId, chainId) VALUES `;
  q += `('${to}', ${value}, '${txHash}', '${tokenId}', ${chainId})`;
  return q;
}

exports.logWithdrawalStarted = function(id, txHash, chainId, tokenId) {
  let q = `INSERT INTO Withdrawals (utxoId, startedTxHash, tokenId, chainId) VALUES `;
  q += `('${id}', '${txHash}', '${tokenId}', ${chainId})`;
  return q;
}

exports.createUtxo = function(to, value, id) {
  let q = `INSERT INTO Utxos (id, owner, value) VALUES ('${id}', '${to}', '${value}')`;
  return q;
}

exports.spendUtxo = function(oldTx, value, to, newId1, newId2, v, r, s) {
  let q = `INSERT INTO Spends (oldTx, value, toAddr, newTx1, newTx2, v, r, s) VALUES ('${oldTx}', `;
  q += `${value}, '${to}', '${newId1}', '${newId2}', ${v}, '${r}', '${s}')`;
  return q;
}

exports.getUtxo = function(id) {
  return `SELECT * FROM Utxos WHERE id='${id}'`;
}

exports.deleteUtxo = function(id) {
  return `UPDATE Utxos SET deleted=true WHERE id='${id}'`;
}
