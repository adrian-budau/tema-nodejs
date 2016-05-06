(function () {
  'use strict';

  // Users service used for communicating with the users REST endpoint
  angular
    .module('game.services')
    .factory('GameListService', GameListService);

  GameListService.$inject = ['$resource'];

  function GameListService($resource) {
    return $resource('api/game', {}, {
    });
  }
}());
