'use strict';

// Load Firefox based resources
var self = require('sdk/self'),
    sp = require('sdk/simple-prefs'),
    tabs = require('sdk/tabs'),
    timers = require('sdk/timers'),
    unload = require('sdk/system/unload'),
    panels = require('sdk/panel'),
    core = require('sdk/view/core'),
    Worker = require('sdk/content/worker').Worker,  // jshint ignore:line
    XMLHttpRequest = require('sdk/net/xhr').XMLHttpRequest, // jshint ignore:line
    {ToggleButton} = require('sdk/ui/button/toggle'),
    {Cc, Cu, Ci} = require('chrome'),
    {all, defer, race, resolve, reject} = require('sdk/core/promise'),
    config = require('../config');

var {WebRequest} = Cu.import('resource://gre/modules/WebRequest.jsm', {});
var {MatchPattern} = Cu.import('resource://gre/modules/MatchPattern.jsm');

var nsIObserverService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);

var panel, callbacks = [];
var button = new ToggleButton({
  id: 'igcalendar',
  label: 'Google™ Calendar',
  icon: {
    '16': './icons/16.png',
    '32': './icons/32.png',
    '64': './icons/64.png'
  },
  onChange: function (state) {
    if (state.checked) {
      // do not load panel until it is actually requested
      if (!panel) {
        panel = panels.Panel({
          width: config.popup.width,
          height: config.popup.height,
          contentURL: self.data.url('./popup/index.html'),
          contentScriptFile: [
            self.data.url('./popup/firefox/firefox.js'),
            self.data.url('./popup/index.js')
          ],
          contentStyleFile : self.data.url('./popup/index.css'),
          contentScriptWhen: 'start',
          onHide: () => button.state('window', {checked: false})
        });
        core.getActiveView(panel).setAttribute('tooltip', 'aHTMLTooltip');
        callbacks.forEach(([id, callback]) => panel.port.on(id, callback));
      }
      panel.show({
        position: button
      });
    }
  }
});

exports.popup = {
  receive: (id, callback) => callbacks.push([id, callback]),
  hide: () => panel.hide()
};

exports.browserAction = (function () {
  let onClicks = [];

  return {
    onClicked: {
      addListener: (c) => onClicks.push(c)
    },
    setTitle: (obj) => button.label = obj.title,
    setBadgeText: (obj) => button.badge = obj.text
  };
})();

exports.storage = {
  local: {
    set: (obj, callback = function () {}) => {
      Object.keys(obj).forEach(key => sp.prefs[key] = obj[key]);
      callback();
    },
    get: function (arr, callback) {
      if (typeof arr === 'string') {
        arr = [arr];
      }
      let tmp = {};
      arr.forEach(str => tmp[str] = sp.prefs[str]);
      callback(tmp);
    }
  },
  onChanged: {
    addListener: function (callback) {
      sp.on('schedule.period', () => callback({'schedule.period': {newValue: sp.prefs['schedule.period']}}));
      sp.on('badge.time', () => callback({'badge.time': {newValue: sp.prefs['badge.time']}}));
    }
  }
};

exports.Promise = function (callback) {
  let d = defer();
  callback(d.resolve, d.reject);
  return d.promise;
};
exports.Promise.defer = defer;
exports.Promise.all = all;
exports.Promise.race = race;
exports.Promise.resolve = resolve;

exports.tabs = {
  create: function (props) {
    tabs.open({
      url: props.url
    });
  }
};

exports.runtime = {
  getManifest: () => ({
    version: self.version
  })
};

exports.window = {
  setTimeout: timers.setTimeout,
  clearTimeout: timers.clearTimeout,
  XMLHttpRequest,
  DOMParser: function () {
    return Cc['@mozilla.org/xmlextras/domparser;1'].createInstance(Ci.nsIDOMParser);
  }
};

exports.webRequest = {
  onBeforeRequest: {
    addListener: function (callback, filter, extraInfoSpec) {
      filter.urls = new MatchPattern(filter.urls);
      WebRequest.onBeforeRequest.addListener(callback, filter, extraInfoSpec);
      unload.when(() => WebRequest.onBeforeRequest.removeListener(callback));
    }
  }
};

//startup
exports.startup = function (callback) {
  if (self.loadReason === 'install' || self.loadReason === 'startup') {
    callback();
  }
};

// events
(function () {
  let httpRequestObserver = {
    observe: function (subject, topic) {
      if (topic === 'http-on-examine-response') {
        try {
          let channel = subject.QueryInterface(Ci.nsIHttpChannel);
          let loadInfo = channel.loadInfo;
          let policyType = loadInfo ?
             loadInfo.externalContentPolicyType :
             Ci.nsIContentPolicy.TYPE_OTHER;
          if (policyType !== Ci.nsIContentPolicy.TYPE_SUBDOCUMENT) {
            return;
          }
          if (
            channel.URI.spec.startsWith('https://accounts.google.com/signin/challenge') ||
            channel.URI.spec.startsWith('https://accounts.google.com/ServiceLogin') ||
            channel.URI.spec.startsWith('https://calendar.google.com/') ||
            channel.URI.spec.startsWith('https://www.google.com/calendar') ||
            channel.URI.spec.startsWith('https://google.com/calendar')
          ) {
            if (channel.getResponseHeader('X-Frame-Options')) {
              channel.setResponseHeader('X-Frame-Options', '', false);
            }
          }
        }
        catch (e) {}
      }
    }
  };
  nsIObserverService.addObserver(httpRequestObserver, 'http-on-examine-response', false);
  unload.when(function () {
    nsIObserverService.removeObserver(httpRequestObserver, 'http-on-examine-response');
  });
})();
(function () {
  let httpRequestObserver = {
    observe: function (subject, topic) {
      if (topic === 'http-on-modify-request') {
        try {
          let channel = subject.QueryInterface(Ci.nsIHttpChannel);
          let loadInfo = channel.loadInfo;
          let policyType = loadInfo ?
             loadInfo.externalContentPolicyType :
             Ci.nsIContentPolicy.TYPE_OTHER;
          if (policyType !== Ci.nsIContentPolicy.TYPE_SUBDOCUMENT) {
            return;
          }
          if (
            channel.URI.spec.startsWith('https://accounts.google.com/ServiceLogin') ||
            channel.URI.spec.startsWith('https://calendar.google.com/') ||
            channel.URI.spec.startsWith('https://www.google.com/calendar') ||
            channel.URI.spec.startsWith('https://google.com/calendar')
          ) {
            let value = 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12A405 Safari/600.1.4';
            channel.setRequestHeader('User-Agent', value, false);
          }
        }
        catch (e) {}
      }
    }
  };
  nsIObserverService.addObserver(httpRequestObserver, 'http-on-modify-request', false);
  unload.when(function () {
    nsIObserverService.removeObserver(httpRequestObserver, 'http-on-modify-request');
  });
})();

// injecting script to the iframe of the panel
(function () {
  let documentInsertedObserver = {
    observe: function (window, topic) {
      if (topic !== 'content-document-global-created') {
        return;
      }
      if (!window || !window.parent || window.parent.location.href.indexOf(self.data.url('./popup/index.html')) !== 0) {
        return;
      }
      if (window.top === window) {
        return;
      }
      new Worker({
        window,
        contentScriptFile: self.data.url('./inject/inject.js'),
      });
    }
  };
  nsIObserverService.addObserver(documentInsertedObserver, 'content-document-global-created', false);
  unload.when(function () {
    nsIObserverService.removeObserver(documentInsertedObserver, 'content-document-global-created');
  });
})();
