(function (app) {
  'use strict';

  app.registerModule('game', ['core']);
  app.registerModule('game.admin');
  app.registerModule('game.admin.routes', ['ui.router', 'core.routes', 'game.admin.services']);
  app.registerModule('game.admin.services');
  app.registerModule('game.routes', ['ui.router', 'core.routes']);
  app.registerModule('game.services');
}(ApplicationConfiguration));
