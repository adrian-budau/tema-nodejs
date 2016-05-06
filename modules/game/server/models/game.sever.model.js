'use strict';

/**
 * Module dependencies
 */
var mongoose = require('mongoose'),
  _ = require('lodash'),
  Schema = mongoose.Schema;

/**
 * User Schema
 */

var Card = new Schema({
  number: {
    type: Number,
    min: 2,
    max: 14
  },
  type: {
    type: String,
    enum: ['hearts', 'diamonds', 'clubs', 'spades']
  }
});

var SingleGameSchema = new Schema({
  users: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    bid: {
      type: Number
    },

    status: {
      type: String,
      enum: ['in', 'out']
    },

    cards: [Card]
  }],
  bottomDeck: [Card],
  shown: [Card],

  started: {
    type: Date,
    default: Date.now
  },

  phase: {
    type: String,
    enum: ['bid1', 'bid2', 'bid3', 'bid4', 'end']
  },

  phaseStarted: {
    type: Date,
    default: Date.now
  },

  index: {
    type: Number,
    default: 0
  },

  firstCall: {
    type: Number,
    default: -1
  }
});

SingleGameSchema.methods.winner = function() {
  var winner = null;
  for (var i = 0; i < this.users.length; ++i) {
    if (this.users[i].status === 'in') {
      if (winner === null) {
        winner = this.users[i].id;
      } else {
        return null;
      }
    }
  }
  return winner;
};

SingleGameSchema.methods.bidSize = function() {
  return _.maxBy(this.users, function(user) {
    return user.bid;
  });
};

SingleGameSchema.methods.next = function() {
  this.index = (this.index + 1) % this.users.length;
};

SingleGameSchema.methods.bidFinished = function() {
  return this.index === this.firstCall;
};

SingleGameSchema.methods.nextPhase = function() {
  if (this.phase === 'bid1') {
    // take out one card
    this.bottomDeck.shift();
    for (var i = 0; i < 3; ++i)
      this.shown.push(this.bottomDeck.shift());
    this.phase = 'bid2';
  } else if (this.phase === 'bid2') {
    // take out one card
    this.bottomDeck.shift();
    this.shown.push(this.bottomDeck.shift());
    this.phase = 'bid3';
  } else if (this.phase === 'bid3') {
    // take out one card
    this.bottomDeck.shift();
    this.shown.push(this.bottomDeck.shift());
    this.phase = 'bid4';
  } else {
    this.phase = 'end';
  }

  this.firstCall = -1;
};

SingleGameSchema.methods.callAmount = function(forIndex) {
  if (forIndex === undefined)
    forIndex = this.index;
  return this.bidSize() - this.users[forIndex].bid;
};

var GameSchema = new Schema({
  users: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  spectators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  title: String,

  created: {
    type: Date,
    default: Date.now
  },

  currentGame: {
    type: SingleGameSchema
  }
});

GameSchema.methods.hideImportant = function(exceptFor) {
  var i;
  for (i = 0; i < this.users.length; ++i)
    this.hideUser(this.users, i);
  for (i = 0; i < this.spectators.length; ++i)
    this.hideUser(this.spectators, i);

  if (!this.currentGame)
    return;
  for (i = 0; i < this.currentGame.users.length; ++i) {
    if (this.currentGame.users[i].id === exceptFor)
      continue;
    this.currentGame.users[i].cards = [];
  }

  this.currentGame.bottomDeck = [];

  for (i = 0; i < this.currentGame.users.length; ++i)
    this.hideUser(this.currentGame.users, i);
};

GameSchema.methods.hideUser = function(obj, key) {
  var user = obj[key];
  if ((typeof user) == 'number')
    return;
  obj[key] = {
    id: user.id,
    displayName: user.displayName,
    money: user.money,
    profileImageURL: user.profileImageURL,
    username: user.username
  };
};

mongoose.model('Game', GameSchema);
