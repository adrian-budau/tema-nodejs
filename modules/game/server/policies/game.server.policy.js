'use strict';

/**
 * Module dependencies
 */
var acl = require('acl');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Game Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/game',
      permissions: '*'
    }, {
      resources: '/api/game/id/:gameId',
      permissions: '*'
    }, {
      resources: '/api/game/me',
      permissions: '*'
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/game',
      permissions: ['get']
    }, {
      resources: '/api/game/id/:gameId',
      permissions: ['get', 'post', 'put']
    }, {
      resources: '/api/game/me',
      permissions: ['get']
    }]
  }]);
};

/**
 * Check If Game Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  var roles = (req.user) ? req.user.roles : ['guest'];

  // Check for user roles
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function (err, isAllowed) {
    if (err) {
      // An authorization error occurred
      return res.status(500).send('Unexpected authorization error');
    } else {
      if (isAllowed) {
        // Access granted! Invoke next middleware
        return next();
      } else {
        return res.status(403).json({
          message: 'User is not authorized'
        });
      }
    }
  });
};

exports.playAllowed = function(user) {
  var roles = user ? user.roles : ['guest'];
  return roles.indexOf('user') !== -1 || roles.indexOf('admin') !== -1;
};
