(function () {
  'use strict';

  angular
    .module('game.services')
    .factory('GameService', GameService)
    .factory('UserGameService', UserGameService);

  GameService.$inject = ['$resource'];

  function GameService($resource) {
    return $resource('api/game/id/:gameId', {
      gameId: '@gameId'
    }, {
      joinRoom: {
        method: 'POST'
      },
      leaveRoom: {
        method: 'PUT'
      },
      remove: {
        method: 'DELETE'
      }
    });
  }
}());
