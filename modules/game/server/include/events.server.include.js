var Set = require('es6-set');
var EventEmitter = require('events');

var roomEmitter = {};
var roomEE = new EventEmitter();

function addListener(gameId, socket) {
  if (!roomEmitter[gameId])
    roomEmitter[gameId] = new Set();

  roomEE.emit(gameId, 1);
  roomEmitter[gameId].add(socket);
  return {
    gameId: gameId,
    socket: socket
  };
}

function removeListener(roomListener) {
  if (roomListener) {
    roomEmitter[roomListener.gameId].delete(roomListener.socket);
    roomEE.emit(roomListener.gameId, -1);
  }
}

function callCallback(roomId, cb) {
  if (!roomEmitter[roomId])
    return;
  roomEmitter[roomId].forEach(cb);
}

function goUpdate(gameId, reason) {
  callCallback(gameId, function (socket) {
    socket.emit('pokerAction', {
      action: 'updateGameStatus',
      reason: reason,
      created: Date.now()
    });
  });
}

module.exports.addListener = addListener;
module.exports.removeListener = removeListener;
module.exports.callCallback = callCallback;
module.exports.goUpdate = goUpdate;
module.exporst.emitter = roomEE;
