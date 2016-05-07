var Events = require('./events.server.include.js');
var mongoose = require('mongoose');
var Game = mongoose.model('Game');
var SingleGame = mongoose.model('SingleGame');
var _ = require('lodash');

var roomCount = {};
var roomTimer = {};
var roomReady = {};

function updateRoom(roomId, value) {
  roomCount[roomId] = roomCount[roomId] || 0;
  roomCount[roomId] += 1;
}

function setUpRooms() {
  // now that we have all games
  Game.find().exec(function(err, games) {
    if (err)
      return console.log('Could not set up rooms -> ', err);
    _.forEach(games, function (game) {
      startRoom(game._id);
    });
  });
}

function nextPhase(roomId) {
  return function() {
    Game.findOne({ _id: roomId }).deepPopulate('users spectators currentGame.users.user').then(function(game) {
      if (!game.currentGame) { // we're in ready phase
        var readyUsers = _.map(roomReady[roomId] || [], String);
        var gameUsers = _.map(game.users, function (user) {
          return String(user._id);
        });
        roomReady[roomId] = [];

        if (_.intersection(readyUsers, gameUsers).length > 1) { // wee, we can start
          try {
            game.currentGame = SingleGame.createGame(_.intersection(readyUsers, gameUsers));
          } catch (err) {
            console.log("weird error: ", err);
          }

          game.save(function() {
            return Events.emit(game._id, {
              action: 'gameStarted',
              created: Date.now()
            });
          });
        } else {
          if (game.users.length < 2) { // do nothing, can't play poker with only one player
            return;
          }
          return Events.emit(game._id, {
            action: 'readyToPlay',
            created: Date.now()
          });
        }
      }
    });
  };
}

function startRoom(roomId) {
  Events.emitter.on(roomId, updateRoom);
  roomTimer[roomId] = setInterval(nextPhase(roomId), 5000);
}

module.exports = {
  startRoom: startRoom,
  closeRoom: function(roomId) {
    Events.emitter.removeAllListeners(roomId);
    clearInterval(roomTimer[roomId]);
  },
  hasStartedOn: function(roomId) {
    return Events.emitter.listenerCount(roomId) > 0;
  },
  setUpRooms: setUpRooms,
  readyFor: function (roomId, userId) {
    roomReady[roomId] = roomReady[roomId] || [];
    roomReady[roomId] = _.union(roomReady[roomId], [userId]);
  }
};
