'use strict';

/**
 * Module dependencies
 */
var gamePolicy = require('../policies/game.server.policy'),
  game = require('../controllers/game.server.controller');

module.exports = function (app) {
  app.route('/api/game').all(gamePolicy.isAllowed)
    .get(game.list)
    .post(game.create);

  app.route('/api/game/id/:gameId').all(gamePolicy.isAllowed)
    .get(game.read)
    .post(game.join)
    .put(game.leave);
//    .delete(game.delete);

  app.route('/api/game/me').all(gamePolicy.isAllowed)
    .get(game.me);

  app.param('gameId', game.gameById);
};
