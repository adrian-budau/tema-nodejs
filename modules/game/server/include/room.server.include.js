var Events = require('./events.server.include.js');
var mongoose = require('mongoose');
var Game = mongoose.model('Game');
var SingleGameSchema = mongoose.model('SingleGameSchema');
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
    Game.findOne({ _id: roomId }).then(function(game) {
      if (!game.currentGame) { // we're in ready phase
        if (roomReady[roomId].length > 1) { // wee, we can start
          
        } else {
          console.log("Let's try to see if people are ready in ", game.title);
          if (game.users.length < 2) { // do nothing, can't play poker with only one player
            console.log("Too few people in ", game.title);
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
  roomTimer[roomId] = setInterval(nextPhase(roomId), 15000);
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
  setUpRooms: setUpRooms
};
