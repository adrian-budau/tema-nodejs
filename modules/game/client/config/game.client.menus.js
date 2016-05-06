(function () {
  'use strict';

  angular
    .module('game')
    .run(menuConfig);

  menuConfig.$inject = ['menuService'];

  // Menu for the poker game
  function menuConfig(menuService) {
    menuService.addMenuItem('topbar', {
      title: 'Game',
      state: 'game',
      type: 'dropdown',
      roles: ['user', 'admin']
    });

    menuService.addSubMenuItem('topbar', 'game', {
      title: 'My Game',
      state: 'game.me'
    });

    menuService.addSubMenuItem('topbar', 'game', {
      title: 'List Games',
      state: 'game.list'
    });
  }
}());
