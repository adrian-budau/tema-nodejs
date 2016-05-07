var path = require('path'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  Game = mongoose.model('Game'),
  User = mongoose.model('User'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  Events = require('../include/events.server.include.js');

/**
 * List of Games
 */
exports.list = function (req, res) {
  Game.find().populate('users spectators').sort('-created').exec(function (err, games) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      _.forEach(games, function (game) {
        game.hideImportant();
      });
      res.json(games);
    }
  });
};

/**
 * Game param middleware
 */
exports.gameById = function (req, res, next, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Game id is invalid  '
    });
  }

  Game.findById(id).deepPopulate('users spectators currentGame.users.user').exec(function (err, game) {
    if (err) {
      return next(err);
    } else if (!game) {
      return res.status(404).send({
        message: 'No game with that identifier has been found'
      });
    }

    req.game = game;
    next();
  });
};

/**
 * Create a game room
 */
exports.create = function (req, res) {
  var game = new Game(req.body);

  game.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(game);
    }
  });
};

exports.read = function(req, res) {
  req.game.hideImportant();
  res.json(req.game);
};

exports.join = function(req, res) {
  Game.findOne({ users: req.user._id }).exec(function(err, game) {
    if (!err && game) { // we're already somewhere, send us there
      res.json({ id: game._id });
    } else {
      if (req.game.users.length === 6) {
        res.json({ full: true });
      } else {
        req.game.users = _.unionWith(_.map(req.game.users || [], function(user) {
          return user._id;
        }), [req.user._id]);

        req.game.save(function() {
          Events.goUpdate(req.game._id, 'join');

          res.json({ id: req.game._id });
        });
      }
    }
  });
};

exports.leave = function(req, res) {
  var userId = req.user._id;
  Game.findOne({ _id: req.game._id }).exec(function(err, game) {
    game.users = _.filter(game.users, function (user) {
      return String(user) !== String(req.user._id);
    });

    game.save(function(arg1, arg2) {
      res.json({});
    });
  });
};


exports.me = function(req, res) {
  // Search for the game
  Game.findOne({ users: req.user._id }).exec(function(err, game) {
    if (err || !game)
      res.json({});
    else {
      res.json({ id: game._id });
    }
  });
};
