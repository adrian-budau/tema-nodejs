(function () {
  'use strict';

  // Setting up route
  angular
    .module('game.routes')
    .config(routeConfig);

  routeConfig.$inject = ['$stateProvider'];

  function routeConfig($stateProvider) {
    $stateProvider
      .state('game', {
        abstract: true,
        url: '/game',
        template: '<ui-view/>'
      })
      .state('game.list', {
        url: '/game/list',
        templateUrl: 'modules/game/client/views/game-list.client.view.html',
        controller: 'GameListController',
        controllerAs: 'vm',
        data: {
          pageTitle: 'Game List'
        }
      })
      .state('game.create', {
        url: '/game/create',
        templateUrl: 'modules/game/client/views/game-create.client.view.html',
        controller: 'GameCreateController',
        controllerAs: 'vm',
        data: {
          pageTitle: 'Add a new Game Room'
        }
      })
      .state('game.id', {
        url: '/:gameId',
        templateUrl: 'modules/game/client/views/game-play.client.view.html',
        controller: 'GameController',
        controllerAs: 'vm',
        resolve: {
          gameResolve: getGame
        },
        data: {
          pageTitle: 'Game - {{ vm.title }}'
        }
      })
      .state('game.me', {
        resolve: {
          me: getMeGame
        },
        onEnter: ['$state', 'me', function($state, me) {
          if (me.id) {
            $state.go('game.id', {
              gameId: me.id
            });
          } else {
            $state.go('game.list');
          }
        }]
      });
  }

  getGame.$inject = ['$stateParams', 'GameService'];

  function getGame($stateParams, GameService) {
    return GameService.get({
      gameId: $stateParams.gameId
    }).$promise;
  }

  getMeGame.$inject = ['$stateParams', 'UserGameService'];

  function getMeGame($stateParams, UserGameService) {
    return UserGameService.get().$promise;
  }
}());
