(function () {
  'use strict';

  angular
    .module('game')
    .controller('GameCreateController', GameCreateController);

  GameCreateController.$inject = ['$scope', '$state', 'GameListService', 'Authentication'];

  function GameCreateController($scope, $state, GameListService, Authentication) {
    var vm = this;

    vm.authentication = Authentication;
    vm.game = new GameListService();
    vm.error = null;
    vm.form = {};
    vm.create = create;

    // Create Game Room
    function create(isValid) {
      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'vm.form.gameForm');
        return false;
      }

      vm.game.$save(successCallback, errorCallback);


      function successCallback(res) {
        $state.go('game.list');
      }

      function errorCallback(res) {
        vm.error = res.data.message;
      }
    }
  }
}());
