// SQL statements for dealing with UTXOS

exports.logDeposit = function(to, value, txHash, chainId, tokenId) {
  let q = `INSERT INTO Deposits (owner, value, txHash, tokenId, chainId) VALUES `;
  q += `('${to}', ${value}, '${txHash}', '${tokenId}', ${chainId})`;
  return q;
}

exports.createUtxo = function(to, value, id) {
  let q = `INSERT INTO Utxos (id, owner, value) VALUES ('${id}', '${to}', '${value}')`;
  return q;
}

exports.getUtxo = function(id) {
  return `SELECT * FROM Utxos WHERE id='${id}'`;
}

exports.deleteUtxo = function(id) {
  return `UPDATE Utxos SET deleted=true WHERE id='${id}'`;
}
