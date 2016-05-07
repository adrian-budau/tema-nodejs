(function () {
  'use strict';

  angular
    .module('game')
    .controller('GameController', GameController);

  GameController.$inject = ['$scope', '$state', 'gameResolve', 'Authentication', 'Socket', 'GameService'];

  function GameController($scope, $state, game, Authentication, Socket, GameService) {
    var vm = this;

    vm.log = [];
    vm.game = game;
    vm.spectating = spectating;
    vm.playing = playing;
    vm.leave = leave;
    vm.ready = ready;

    init();

    function init() {
      // If user is not signed in then redirect back home
      if (!Authentication.user) {
        $state.go('home');
      }

      // Make sure the Socket is connected
      if (!Socket.socket) {
        Socket.connect();
        Socket.on('connect', onConnect);
      } else {
        onConnect();
      }

      // Add an event listener to the 'logMessage' event
      Socket.on('logMessage', function (message) {
        vm.log.unshift(message);
        console.log(message);
      });

      Socket.on('pokerAction', function (message) {
        console.log(message);
        if (message.action === 'leaveRoom') {
          $state.go('game.list');
          return;
        }

        if (message.action === 'updateGameStatus') {
          GameService.get({
            gameId: vm.game._id
          }).$promise.then(function(game) {
            vm.game = game;
          });
          return;
        }

        if (message.action === "readyToPlay") {
          GameService.get({
            gameId: vm.game._id
          }).$promise.then(function(game) {
            vm.game = game;
          });
          vm.readyButton = 'show';
        }

        if (message.action === "gameStarted") {
          GameService.get({
            gameId: vm.game._id
          }).$promise.then(function(game) {
            vm.game = game;
          });
          vm.readyButton = null;
        }
      });

      // Remove the event listener when the controller instance is destroyed
      $scope.$on('$destroy', function () {
        Socket.emit('pokerAction', {
          id: game._id,
          action: 'unregister',
          created: Date.now()
        });
        Socket.removeListener('logMove');
        Socket.removeListener('pokerAction');
        Socket.removeListener('connect');
      });


    }

    function onConnect() {
      console.log('we are connected');
      Socket.emit('pokerAction', {
        id: game._id,
        action: 'register',
        created: Date.now()
      });

      if (spectating()) {
        Socket.emit('pokerAction', {
          id: game._id,
          action: 'spectate',
          created: Date.now()
        });
      }
    }

    function spectating() {
      for (var i = 0; i < vm.game.users.length; ++i)
        if (vm.game.users[i]._id === Authentication.user._id)
          return false;
      return true;
    }

    function playing() {
      console.log(vm.game);
      if (!vm.game.currentGame)
        return false;
      for (var i = 0; i < vm.game.currentGame.users.length; ++i) {
        console.log(String(vm.game.currentGame.users[i].user._id), String(Authentication.user._id));
        if (String(vm.game.currentGame.users[i].user._id) === String(Authentication.user._id))
          return true;
      }
      return false;
    }

    function leave() {
      var game = vm.game;
      GameService.leaveRoom({ gameId: game._id }, function () {
        Socket.emit('pokerAction', {
          id: game._id,
          action: 'leaveRoom',
          created: Date.now()
        });
        $state.go('game.list');
      });
    }

    function ready() {
      vm.readyButton = 'pressed';
      Socket.emit('pokerAction', {
        id: game._id,
        action: 'ready',
        created: Date.now()
      });
    }
  }
}());
