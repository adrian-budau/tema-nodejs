'use strict';

var gamePolicy = require('../policies/game.server.policy.js');
var mongoose = require('mongoose');
var Game = mongoose.model('Game');
var Events = require('../include/events.server.include.js');
var addListener = Events.addListener,
  removeListener = Events.removeListener,
  callCallback = Events.callCallback,
  goUpdate = Events.goUpdate;
var Rooms = require('../include/room.server.include.js');

// Create the chat configuration
module.exports = function (io, socket) {
  // Emit the status event when a new socket client is connected

  if (!gamePolicy.playAllowed(socket.request.user)) {
    io.close();
    return;
  }

  io.emit('logMessage', {
    text: socket.request.user.username + ' is now connected',
    created: Date.now()
  });

  var roomListener = null;

  socket.on('pokerAction', function(message) {
    var gameId = message.id;
    if (message.action === 'register') {
      removeListener(roomListener);
      roomListener = addListener(gameId, socket);
      return;
    }

    if (message.action === 'unregister') {
      unregister();
      return;
    }

    if (message.action === 'spectate') {
      Game.findById(gameId, function (err, game) {
        if (err) {
          caseError(err);
          return;
        }
        game.spectators = game.spectators || [];
        if (game.spectators.indexOf(socket.request.user._id) === -1) {
          game.spectators.push(socket.request.user._id);
        }

        game.save(function(err) {
          goUpdate(gameId, 'spectate');
        });
      });
      return;
    }

    if (message.action === 'leaveRoom') {
      goUpdate(gameId, 'leaveRoom');
      return;
    }

    if (message.action === 'ready') {
      Rooms.readyFor(gameId, socket.request.user._id);
      return;
    }
  });

  socket.on('disconnect', function() {
    unregister();
    return;
  });

  function caseError(err) {
    io.emit('pokerAction', {
      action: 'leaveRoom',
      reason: 'Does not exist',
      created: Date.now()
    });
  }

  function unregister() {
    if (!roomListener)
      return;
    // first remove as spectator
    var gameId = roomListener.gameId;
    Game.findById(gameId, function (err, game) {
      if (err || !game) {
        caseError(err);
        return;
      }
      game.spectators = game.spectators || [];
      if (game.spectators.indexOf(socket.request.user._id) !== -1)
        game.spectators.splice(game.spectators.indexOf(socket.request.user._id), 1);
      game.save(function(err) {
        goUpdate(gameId, 'not-spectate');
      });
    });
    removeListener(roomListener);
    roomListener = null;
  }
};
