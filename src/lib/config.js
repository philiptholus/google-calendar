'use strict';

var config = typeof exports !== 'undefined' ? exports : {};
var app = app || require('./firefox/firefox');

config.popup = {
  width: 400,
  height: 550
};

config.badge = {
  time: 30 // minutes
};
config.schedule = {
  period: 24 // hours
};
config.debug = 0;
