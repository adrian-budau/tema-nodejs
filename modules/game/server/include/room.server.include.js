var Events = require('./events.server.include.js');
var mongoose = require('mongoose');
var Game = mongoose.model('Game');
var SingleGame = mongoose.model('SingleGame');
var _ = require('lodash');
var User = mongoose.model('User');

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

function getGame(roomId) {
  return Game.findOne({ _id: roomId }).deepPopulate('users spectators currentGame.users.user');
}

function nextPhase(roomId) {
  return function() {
    getGame(roomId).then(function(game) {
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
      } else if (game.currentGame.phase === 'foldWinner' || game.currentGame.phase === 'end') {
        // ah well, we restart
        game.currentGame = null;
        game.save(function() {
          return Events.emit(game._id, {
            action: 'gameEnded',
            created: Date.now()
          });
        });
      }
    });
  };
}

function myTurn(game, userId) {
  return game.currentGame.users[game.currentGame.index].user._id.toString() === userId.toString();
}

function saveMoney(game, cb) {
  if (game.currentGame.phase !== "end" && game.currentGame.phase !== 'foldWinner') {
    // Nothing to save, no winner yet
    cb(null);
  } else {
    var winners = game.currentGame.winners();
    var change = {
    };
    var i;
    for (i = 0; i < game.currentGame.users.length; ++i)
      change[game.currentGame.users[i].user._id] = 0;

    for (i = 0; i < game.currentGame.users.length; ++i) {
      var user = game.currentGame.users[i];
      var ifWinner = _.find(winners, user.user._id);
      change[user.user._id] -= user.bid;
      for (var j = 0; j < winners.length; ++j)
        change[winners[j]] += user.bid / winners.length;
    }


    change = _.toPairs(change);

    function saveMoney(changes) {
      if (_.size(changes) === 0) {
        // there must be some winners
        cb(game.currentGame.winners());
      } else {
        User.findById(changes[0][0]).then(function(user) {
          user.money += changes[0][1];
          user.save(function () {
            saveMoney(_.tail(changes));
          });
        });
      }
    }
    saveMoney(change);
  }
}

function fold(roomId, userId) {
  console.log('Folding in ', roomId, ' by ', userId);
  getGame(roomId).then(function(game) {
    if (!myTurn(game, userId)) {
      console.log('Not my turn to fold');
      return;
    }
    game.currentGame.users[game.currentGame.index].status = 'out';
    game.currentGame.next();
    console.log(game.currentGame);
    game.save(function() {
      saveMoney(game, function(winners) {
        restartRoom(roomId);
        if (winners) {
          Events.emit(game._id, {
            action: 'gameEnded',
            winners: winners,
            created: Date.now
          });
        } else {
          Events.goUpdate(game._id, 'play');
        }
      });
    });
  });
}

function raise(roomId, userId, value) {
  console.log('Raising ', value, ' in ', roomId, ' by ', userId);
  getGame(roomId).then(function(game) {
    if (!myTurn(game, userId)) {
      console.log('Not my turn to raise');
      return;
    }
    if (!_.isNumber(value) || value <= 0)
      return; // no op
    var myMoney = game.currentGame.users[game.currentGame.index].user.money;
    var need = game.currentGame.bidSize() + value;

    console.log(myMoney, ' vs ', need);
    if (myMoney < need) {
      console.log('Not enough money');
      return;
    }

    game.currentGame.users[game.currentGame.index].bid = need;
    game.currentGame.firstCall = game.currentGame.index;
    game.currentGame.next();
    game.save(function() {
      restartRoom(roomId);
      Events.goUpdate(game._id, 'play');
    });
  });
}

function call(roomId, userId) {
  console.log('Calling in ', roomId, ' by ', userId);
  getGame(roomId).then(function(game) {
    if (!myTurn(game, userId)) {
      console.log('Not my turn to call');
      return;
    }

    var myMoney = game.currentGame.users[game.currentGame.index].user.money;
    var need = game.currentGame.bidSize();
    if (myMoney < need)
      need = myMoney;
    if (game.currentGame.firstCall === -1)
      game.currentGame.firstCall = game.currentGame.index;
    game.currentGame.users[game.currentGame.index].bid = need;
    game.currentGame.next();
    game.save(function() {
      saveMoney(game, function(winners) {
        restartRoom(roomId);
        if (winners) {
          Events.emit(game._id, {
            action: 'gameEnded',
            winners: winners,
            created: Date.now
          });
        } else {
          Events.goUpdate(game._id, 'play');
        }
      });
    });
  });
}

function check(roomId, userId) {
  console.log('Checking in ', roomId, ' by ', userId);
  getGame(roomId).then(function(game) {
    if (!myTurn(game, userId)) {
      console.log('Not my turn to check');
      return;
    }

    var myMoney = game.currentGame.users[game.currentGame.index].user.money;
    var need = game.currentGame.bidSize();
    if (myMoney < need)
      need = myMoney;
    var myBid = game.currentGame.users[game.currentGame.index].bid;
    if (myBid < need) {
      console.log('Not allowed to check, have to call');
      return; // no-op
    }
    if (game.currentGame.firstCall === -1)
      game.currentGame.firstCall = game.currentGame.index;
    game.currentGame.next();
    game.save(function() {
      saveMoney(game, function(winners) {
        restartRoom(roomId);
        if (winners) {
          Events.emit(game._id, {
            action: 'gameEnded',
            winners: winners,
            created: Date.now
          });
        } else {
          Events.goUpdate(game._id, 'play');
        }
      });
    });
  });
}

function startRoom(roomId) {
  Events.emitter.on(roomId, updateRoom);
  roomTimer[roomId] = setInterval(nextPhase(roomId), 10000);
}

function stopRoom(roomId) {
  clearInterval(roomTimer[roomId]);
}

function startTimerRoom(roomId) {
  roomTimer[roomId] = setInterval(nextPhase(roomId), 10000);
}

function restartRoom(roomId) {
  stopRoom(roomId);
  startTimerRoom(roomId);
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
  },
  fold: fold,
  raise: raise,
  call: call,
  check: check
};
