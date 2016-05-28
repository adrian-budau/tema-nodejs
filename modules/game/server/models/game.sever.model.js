'use strict';

/**
 * Module dependencies
 */
var mongoose = require('mongoose'),
  _ = require('lodash'),
  Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate')(mongoose);
var assert = require('assert');
var comb = require('js-combinatorics');

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
    enum: ['bid1', 'bid2', 'bid3', 'bid4', 'end', 'foldWinner']
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
  do {
    this.index = (this.index + 1) % this.users.length;
    if (this.bidFinished())
      this.nextPhase();
  } while (this.users[this.index].status === 'out');
  if (this.winner())
    this.phase = 'foldWinner';
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

function compare(a, b) {
  for (var i = 0; i < a.length; ++i)
    if (a[i] > b[i])
      return 1;
    else if (b[i] > a[i])
      return -1;
  return 0;
}

function maxBetween(a, b) {
  if (compare(a, b) === -1)
    return b;
  return a;
}

/**
 * We assume this function is only called when the game is ended"
 */
SingleGameSchema.methods.winners = function() {
  assert(this.phase === 'end' || this.phase === 'foldWinner');
  if (this.winner())
    return [this.winner()];

  // Now get the best winner
  var inGame = _.map(this.users, function(user) {
    return user.status === 'in';
  });
  var game = this;
  var best = [-1],
    whom = [];
  var power = _.map(inGame, function (user) {
    var cards = user.cards + game.shown;
    var bestNow = [-1];
    _.foreach(comb.combination(cards, 5), function (cards) {
      cards = _.orderBy(cards, function (card) {
        return card.number;
      });

      // now check
      var flush = _.all(cards, function (card) {
        return card.type === cards[0].type;
      });

      var straight = true,
        i,
        fromStraight = -1;
      for (i = 1; i < 5; ++i) {
        if (cards[i].number !== cards[i - 1].number) {
          if (i === 4 && cards[i].number === 14 && cards[0].number === 2) {
            fromStraight = 1;
            break;
          }
          straight = false;
          break;
        }
      }

      var counts = _.countBy(cards, function (card) {
        return card.number;
      });

      var fourKind = _.findKey(counts, function (count) {
        return count === 4;
      });
      var threeKind = _.findKey(counts, function (count) {
        return count === 3;
      });

      var descCards = _.orderBy(_.toPairs(counts), function (pair) {
        return pair.first;
      }, 'desc');

      var twoKinds = _.flatMap(descCards, function (pair) {
        if (pair.second === 2)
          return [pair.second];
        return [];
      });
      var oneKinds = _.flatMap(descCards, function (pair) {
        if (pair.second === 1)
          return [pair.second];
      });

      if (straight && fromStraight === -1)
        fromStraight = cards[0].number;
      var now = [];
      if (flush && straight && fromStraight === 10)
        now = [10];
      else if (flush && straight)
        now = [9, fromStraight];
      else if (fourKind) {
        now = [8, fourKind, oneKinds[0]];
      } else if (threeKind && _.size(twoKinds)) { // full house
        now = [7, threeKind, twoKinds[0]];
      } else if (flush) {
        now = [6] + oneKinds;
      } else if (straight) {
        now = [5, fromStraight];
      } else if (threeKind) {
        now = [4, threeKind] + oneKinds;
      } else if (_.size(twoKinds) === 2) {
        now = [3] + twoKinds + oneKinds;
      } else if (_.size(twoKinds)) {
        now = [2] + twoKinds + oneKinds;
      } else {
        now = [1] + oneKinds;
      }
      bestNow = maxBetween(bestNow, now);
    });
    if (compare(best, bestNow) === 0)
      whom += [user.user];
    else if (compare(best, bestNow) === -1) {
      best = bestNow;
      whom = [user.user];
    }
  });
  return whom;
};

SingleGameSchema.statics.createGame = function(userIds) {
  var currentCards = _.shuffle(cards);
  function getCards(number, skip) {
    skip = skip || 0;
    while (skip > 0) {
      currentCards.shift();
      skip--;
    }
    var res = [];
    while (number > 0) {
      res.push(currentCards.shift());
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
    if (String(this.currentGame.users[i].user._id) === String(exceptFor))
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
