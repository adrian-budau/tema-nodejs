(function () {
  'use strict';

  angular
    .module('game')
    .controller('GameListController', GameListController);

  GameListController.$inject = ['$scope', '$state', '$filter', 'GameListService', 'GameService', 'Authentication'];

  function GameListController($scope, $state, $filter, GameListService, GameService, Authentication) {
    var vm = this;

    vm.buildPager = buildPager;
    vm.figureOutItemsToDisplay = figureOutItemsToDisplay;
    vm.pageChanged = pageChanged;
    vm.admin = Authentication.user.roles.indexOf('admin') !== -1;
    vm.join = join;
    vm.spectate = spectate;

    GameListService.query(function (data) {
      vm.games = data;
      vm.buildPager();
    });

    function buildPager() {
      vm.pagedItems = [];
      vm.itemsPerPage = 15;
      vm.currentPage = 1;
      vm.figureOutItemsToDisplay();
    }

    function figureOutItemsToDisplay() {
      vm.filteredItems = $filter('filter')(vm.games, {
        $: vm.search
      });
      vm.filterLength = vm.filteredItems.length;
      var begin = ((vm.currentPage - 1) * vm.itemsPerPage);
      var end = begin + vm.itemsPerPage;
      vm.pagedItems = vm.filteredItems.slice(begin, end);
    }

    function pageChanged() {
      vm.figureOutItemsToDisplay();
    }

    function spectate(game) {
      $state.go('game.id', game);
    }

    function join(game) {
      GameService.joinRoom({
        gameId: game.gameId
      }, function(data) {
        if (data.id)
          $state.go('game.id', {
            gameId: data.id
          });
      });
    }
  }
}());
