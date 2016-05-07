'use strict';

/**
 * Module dependencies
 */
var mongoose = require('mongoose'),
  _ = require('lodash'),
  Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate')(mongoose);

/**
 * User Schema
 */

var CardSchema = new Schema({
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

var Card = mongoose.model('Card', CardSchema);

var SingleGame;
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

    cards: [CardSchema]
  }],
  bottomDeck: [CardSchema],
  shown: [CardSchema],

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
  },

  currentBid: {
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

var cards = [];
for (var i = 2; i < 15; ++i) {
  var types = ['hearts', 'diamonds', 'clubs', 'spades'];
  for (var j = 0; j < 4; ++j) {
    cards.push(new Card({ number: i, type: types[j] }));
  }
}

SingleGameSchema.statics.createGame = function(userIds) {
  var currentCards = _.shuffle(cards);
  function getCards(number, skip) {
    skip = skip || 0;
    while (skip > 0) {
      currentCards.unshift();
      skip--;
    }
    var res = [];
    while (number > 0) {
      res.push(currentCards.unshift());
      number--;
    }
    return res;
  }

  return new SingleGame({
    users: _.map(userIds, function (userId, index) {
      var bid = 0;
      if (index === 0)
        bid = 1;
      else
        bid = 2;
      return {
        user: userId,

        bid: bid,

        status: 'in',

        cards: getCards(2)
      };
    }),

    shown: [],
    bottomDeck: currentCards,
    started: Date.now(),
    phase: 'bid1',
    index: 2 % userIds.length
  });
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
    if (this.currentGame.users[i].user._id === exceptFor)
      continue;
    this.currentGame.users[i].cards = [];
  }

  this.currentGame.bottomDeck = [];

  for (i = 0; i < this.currentGame.users.length; ++i) {
    // freaking bug
    this.currentGame.users[i] = JSON.parse(JSON.stringify(this.currentGame.users[i]));
    this.hideUser(this.currentGame.users[i], 'user');
  }
};

GameSchema.methods.hideUser = function(obj, key) {
  var user = obj[key];
  if ((typeof user) === 'number')
    return;

  var newUser = {
    _id: user._id,
    displayName: user.displayName,
    money: user.money,
    profileImageURL: user.profileImageURL,
    username: user.username
  };

  obj[key] = newUser;
};

GameSchema.methods.unpop = function(obj, key) {
  if ((typeof user) !== 'object') {
    return;
  }
  obj[key] = obj[key]._id;
};

GameSchema.pre('save', function(next) {
  var i;
  for (i = 0; i < this.users.length; ++i)
    this.unpop(this.users, i);
  for (i = 0; i < this.spectators.length; ++i)
    this.unpop(this.spectators, i);

  if (!this.currentGame)
    return next();

  for (i = 0; i < this.currentGame.users.length; ++i)
    this.unpop(this.currentGame.users[i], 'user');
  next();
});

GameSchema.plugin(deepPopulate);

SingleGame = mongoose.model('SingleGame', SingleGameSchema);
mongoose.model('Game', GameSchema);
