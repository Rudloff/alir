//jshint browser: true
/*global RemoteStorage: true */
var matchesSelector = document.documentElement.matches ||
                      document.documentElement.matchesSelector ||
                      document.documentElement.webkitMatchesSelector ||
                      document.documentElement.mozMatchesSelector ||
                      document.documentElement.oMatchesSelector ||
                      document.documentElement.msMatchesSelector;
var realLog = console.log;
var utils = {
  device: {
    type: '',
    orientation: ''
  },
  logLevel: 'debug',
  logLevels: ['debug', 'info', 'warning', 'error'],
  // @src http://blog.snowfinch.net/post/3254029029/uuid-v4-js
  // @licence Public domain
  uuid : function uuid() {
    /*jshint bitwise: false */
    "use strict";
    var id = "", i, random;
    for (i = 0; i < 32; i++) {
      random = Math.random() * 16 | 0;
      if (i === 8 || i === 12 || i === 16 || i === 20) {
        id += "-";
      }
      id += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
    }
    return id;
  },
  format:  function format(str) {
    "use strict";
    var params = Array.prototype.splice.call(arguments, 1);
    return (str.replace(/%s/g, function () {return params.shift(); }));
  },
  trim: function trim(str) {
    "use strict";
    return str.replace(/^\s+/, '').replace(/\s+$/, '');
  },
  getDate: function (d) {
    "use strict";
    var date = (typeof d  === 'undefined' ? new Date() : new Date(d));
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString();
  },
  log: function log() {
    "use strict";
    var args = Array.prototype.slice.call(arguments),
        level,
        levelNum,
        message,
        ui,
        curDate = utils.getDate().substr(11, 8);
    if (args.length > 1) {
      level = args.pop();
    } else {
      level = "info";
    }
    levelNum = utils.logLevels.indexOf(level);
    if (levelNum === -1) {
      realLog("Unknown log level " + level);
    }
    if (levelNum >= utils.logLevels.indexOf(utils.logLevel)) {
      if (args.length === 1) {
        message = args[0];
        if (typeof message === 'object') {
          message = JSON.stringify(message, null, '  ');
        }
      } else {
        message = utils.format.apply(null, args);
      }
      ui = document.getElementById('debugLog');
      if (ui) {
        ui.innerHTML = utils.format('<p><span class="%s">[%s][%s]</span> %s<p>', level, curDate, level + new Array(10 - level.length).join(' '), message) + ui.innerHTML;
        if (level === 'error') {
          document.body.classList.add('error');
        }
      }
      try {
        realLog(utils.format('=====> [%s][%s] %s\n', curDate, level + new Array(10 - level.length).join(' '), message));
      } catch (e) {}
    }
  },
  notify: function (title, body, cb) {
    "use strict";
    var notif;
    if ("Notification" in window) {
      if (window.Notification.permission === "granted") {
        notif = new window.Notification(title, {body: body});
        if (cb) {
          notif.addEventListener('click', cb);
        }
      } else if (window.Notification.permission !== 'denied') {
        window.Notification.requestPermission(function (permission) {
          if (!('permission' in window.Notification)) {
            window.Notification.permission = permission;
          }
          if (permission === "granted") {
            notif = new window.Notification(title, {body: body});
            if (cb) {
              notif.addEventListener('click', cb);
            }
          }
        });
      }
    } else if ("mozNotification" in navigator) {
      notif = navigator.mozNotification.createNotification(title, body);
      notif.show();
      if (cb) {
        notif.addEventListener('click', cb);
      }
    } else {
      window.alir.ui.message(title + "\n" + body, "info");
    }
  },
  merge: function (a, b) {
    "use strict";
    Object.keys(a).forEach(function (keyA) {
      if (typeof b[keyA] === 'undefined') {
        b[keyA] = a[keyA];
      } else {
        if (typeof a[keyA] === 'object') {
          b[keyA] = utils.merge(a[keyA], b[keyA]);
        }
      }
    });
    return b;
  },
  match: function (elmt, sel) {
    "use strict";
    sel = sel + ', ' + sel + ' *';
    return matchesSelector.call(elmt, sel);
  },
  /**
   * Return parent element matching criteria
   *
   * @param {DOMElement} elmt
   * @param {Function}   match
   *
   * @return {DOMElement|null}
   */
  parent: function (elmt, match) {
    "use strict";
    var res = null, found = false;
    while (!found) {
      if (elmt.nodeType !== 1) {
        found = true;
      } else {
        if (match(elmt)) {
          res   = elmt;
          found = true;
        } else {
          elmt = elmt.parentNode;
        }
      }
    }
    return res;
  },
  /**
   * Convert Object to array
   *
   * @param {Object} obj
   * @param {String} key
   *
   * @return {Array}
   */
  toArray: function (obj, key) {
    "use strict";
    key = key || '_id';
    var res = [];
    Object.keys(obj).forEach(function (k) {
      var item = obj[k];
      item[key] = k;
      res.push(item);
    });
    return res;
  },
  createXPathFromElement: function (elm) {
    // source: http://stackoverflow.com/a/5178132
    //jshint maxcomplexity: 12
    "use strict";
    var allNodes = document.getElementsByTagName('*'),
    uniqueIdCount,
    i, n,
    sib, segs;
    for (segs = []; elm && elm.nodeType === 1; elm = elm.parentNode) {
      if (elm.hasAttribute('id')) {
        uniqueIdCount = 0;
        for (n = 0; n < allNodes.length; n++) {
          if (allNodes[n].hasAttribute('id') && allNodes[n].id === elm.id) {
            uniqueIdCount++;
          }
          if (uniqueIdCount > 1) {
            break;
          }
        }
        if (uniqueIdCount === 1) {
          segs.unshift('//*[@id="' + elm.getAttribute('id') + '"]');
          return segs.join('/');
        } else {
          segs.unshift(elm.localName.toLowerCase() + '[@id="' + elm.getAttribute('id') + '"]');
        }
      } else if (elm.hasAttribute('class')) {
        segs.unshift(elm.localName.toLowerCase() + '[@class="' + elm.getAttribute('class') + '"]');
      } else {
        for (i = 1, sib = elm.previousSibling; sib; sib = sib.previousSibling) {
          if (sib.localName === elm.localName) {
            i++;
          }
        }
        segs.unshift(elm.localName.toLowerCase() + '[' + i + ']');
      }
    }
    return segs.length ? '/' + segs.join('/') : null;
  }

};
console.log = function () {
  "use strict";
  [].slice.call(arguments).forEach(function (a) { utils.log(a, 'debug'); });
};
window.onerror = function (errorMsg, url, lineNumber) {
  "use strict";
  utils.log("%s on %s:%s", errorMsg, url, lineNumber, "error");
};

var Tiles = function (global) {
  "use strict";
  RemoteStorage.eventHandling(this, "leaving", "shown");
  var self = this,
      current,
      tiles = [],
      popup = (window.matchMedia("(min-width: 78rem) and (min-height: 3rem)").matches);
  this.show = function (name) {
    this._emit('leaving', current);
    Array.prototype.forEach.call(document.querySelectorAll('[data-tile]'), function (e) {
      if (e.dataset.tile === name) {
        e.classList.add('shown');
        //window.setTimeout(function () { window.scrollTo(0, 0); }, 600);
        window.scrollTo(0, 0);
        current = name;
      } else {
        e.classList.remove('shown');
      }
    });
    window.alir.ui.toggleMenu(false);
    window.location.hash = name;
    this._emit('shown', name);
  };
  this.go = function (name, cb) {
    //jshint maxstatements: 30
    var i = tiles.findIndex(function (e) { return e.name === name; }),
        next,
        popupElmt;
    if (i !== -1) {
      next = tiles[i];
      this.show(next.name);
      if (typeof next.cb === 'function') {
        next.cb();
      }
      //window.setTimeout(function () { window.scrollTo(0, next.y); }, 600);
      window.scrollTo(0, 0);
      tiles.splice(i);
    } else {
      if (name !== current && typeof current !== 'undefined') {
        tiles.push({name: current, y: window.scrollY, cb: cb});
      }
      if (popup) {
        popupElmt = document.querySelector(".popup[data-tile]");
        if (popupElmt) {
          popupElmt.classList.remove('popup');
        }
        popupElmt = document.querySelector("[data-tile='" + name + "']");
        this._emit('leaving', current);
        if (popupElmt) {
          popupElmt.classList.add('popup');
          setTimeout(function () {
            popupElmt.style.left = (popupElmt.getBoundingClientRect().width - 2) + 'px';
            popupElmt.style.opacity = "1";
          });
          //window.setTimeout(function () { window.scrollTo(0, 0); }, 600);
          window.scrollTo(0, 0);
          window.location.hash = name;
          this._emit('shown', name);
          current = name;
        }
      } else {
        this.show(name);
      }
    }
    window.alir.ui.toggleMenu(false);
  };
  this.back = function (res) {
    //jshint maxstatements: 30
    var popupOldElmt, popupNewElmt, next;
    next = tiles.pop();
    if (typeof next === 'undefined') {
      // default tile
      next = {
        name: 'articleList',
        y: 0
      };
    }
    if (popup) {
      popupOldElmt = document.querySelector(".popup[data-tile]");
      if (popupOldElmt) {
        popupOldElmt.style.left = "0";
        popupOldElmt.style.opacity = "0";
        setTimeout(function () {
          popupOldElmt.style.left = "0";
          popupOldElmt.style.opacity = "1";
          popupOldElmt.classList.remove('popup');
          if (tiles.length === 0) {
            document.body.classList.remove('popup');
          }
        }, 500);
      }
      this._emit('leaving', current);
      if (tiles.length !== 0) {
        popupNewElmt = document.querySelector("[data-tile='" + next.name + "']");
        if (popupNewElmt) {
          popupNewElmt.classList.add('popup');
          //window.scrollTo(0, 0);
        }
      } else {
        self.show(next.name);
      }
      current = next.name;
      window.location.hash = name;
      this._emit('shown', current);
    } else {
      if (typeof next === 'object') {
        this.show(next.name);
        if (typeof next.cb === 'function') {
          next.cb(res);
        }
        window.scrollTo(0, next.y);
      }
    }
    window.alir.ui.toggleMenu(false);
  };
  this.$ = function (name) {
    var root = document.querySelector('[data-tile="' + name + '"]');
    return function (sel) { return root.querySelector(sel); };
  };
  this.pop = function () {
    var tile = tiles.pop();
    current = tile.name;
    return tile;
  };
  this.tiles = function () {
    return tiles;
  };
  this.getCurrent = function () {
    return current;
  };
  this.getCurrentTile = function () {
    return document.querySelector("[data-tile='" + current + "']");
  };
  this.exists = function (name) {
    return document.querySelectorAll("[data-tile='" + name + "']").length === 1;
  };
  window.addEventListener('resize', function () {
    var newState = (window.matchMedia("(min-width: 78rem) and (min-height: 3rem)").matches),
        curr;
    if (newState !== popup) {
      console.log("POPUP changed", popup, newState);
      if (tiles.length > 0) {
        curr = current;
        self.back();
        popup = newState;
        self.go(curr);
      } else {
        popup = newState;
      }
    }
  }, false);
};
window.tiles = new Tiles();
