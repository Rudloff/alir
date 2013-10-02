/*jshint browser: true, devel: true */
/*global remoteStorage: true, RemoteStorage: true, HTMLtoXML: true, doT: true */
/**
    Alir
    Copyright (C) {2013}  {Clochix}

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.
*/

/**
 * @TODO use notifications
 * https://developer.mozilla.org/en-US/docs/WebAPI/Using_Web_Notifications
 */

var templates = {},
    list = document.getElementById('list'),
    listHtml = '';

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
  log: function log() {
    "use strict";
    var level    = arguments[arguments.length - 1],
        levelNum = utils.logLevels.indexOf(level);
    if (levelNum === -1) {
      console.log("Unknown log level " + level);
    }
    if (levelNum >= utils.logLevels.indexOf(utils.logLevel)) {
      console.log('[' + level + '] ' + utils.format.apply(utils, arguments));
    }
  },
  createXPathFromElement: function createXPathFromElement(elm) {
    // source: http://stackoverflow.com/a/5178132
    //jshint maxcomplexity: 10
    "use strict";
    var allNodes = document.getElementsByTagName('*'),
        uniqueIdCount,
        i, n,
        sib, segs;
    for (segs = []; elm && elm.nodeType === 1; elm = elm.parentNode) {
      if (elm.hasAttribute('id')) {
        uniqueIdCount = 0;
        for (n = 0;n < allNodes.length;n++) {
          if (allNodes[n].hasAttribute('id') && allNodes[n].id === elm.id) {
            uniqueIdCount++;
          }
          if (uniqueIdCount > 1) {
            break;
          }
        }
        if (uniqueIdCount === 1) {
          segs.unshift('id("' + elm.getAttribute('id') + '")');
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
/*
(function () {
  "use strict";
  var l = console.log;
  console.log = function log() {
    l.apply(console, arguments);
    if (Notification && Notification.permission === "granted") {
      var n = new Notification(arguments[0]);
    }
  };
})();
*/

RemoteStorage.defineModule('alir', function module(privateClient, publicClient) {
  "use strict";

  // Define a common data type using JSON Schema
  privateClient.declareType('article', {
    "description": "Article",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "id"
      },
      "title": {
        "type": "string"
      },
      "html": {
        "type": "string"
      },
      "text": {
        "type": "string"
      }
    }
  });

  return {
    exports: {
      addPrivate: function (article) {
        return privateClient.storeObject('article', article.id, article);
      },
      goOffline: function () {
        remoteStorage.stopSync();
      },
      goOnline: function () {
        remoteStorage.syncCycle();
      },
      private: privateClient,
      public: publicClient
    }
  };
});
function updateList() {
  "use strict";
  remoteStorage.alir.private.getAll('').then(function onAll(objectsPrivate) {
    remoteStorage.alir.public.getAll('').then(function onAll(objectsPublic) {
      function createList(objects, context) {
        /*jshint newcap: false*/
        if (typeof objects === "object") {
          Object.keys(objects).forEach(function (key) {
            var obj   = objects[key],
                title = obj.title || key,
                datas = {};
            datas = {
              key: key,
              context: context,
              title: title.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
              url: obj.url || '#'
            };
            if (obj.html) {
              datas.type = 'html';
              try {
                datas.content = HTMLtoXML(obj.html);
              } catch (e) {
                console.log('Error sanityzing ' + obj.title);
                datas.content = "Content contains errors";
              }
            } else {
              datas.type = 'text';
              datas.content = obj.text;
            }

            listHtml += templates.item(datas);
          });
        //} else {
        // No object in this context
        //  console.log('Unable to create list of undefined objects for context ' + context);
        }
      }
      listHtml = '';
      createList(objectsPublic, 'public');
      createList(objectsPrivate, 'private');
      list.innerHTML = listHtml;
    });
  });
}
function initUI() {
  // jshint maxstatements: 30
  "use strict";
  var $  = function (sel) {return document.querySelector.call(document, sel); },
      $$ = function (sel) {return document.querySelectorAll.call(document, sel); },
      forElement = function (sel, fct) {Array.prototype.forEach.call(document.querySelectorAll(sel), fct); },
      UI = {},
      menuActions = {};
  UI = {
    input: $('#input'),
    list: $('#list'),
    menu: {}
  };
  function displayTile(name) {
    forElement('[data-tile]', function (e) {
      if (e.dataset.tile === name) {
        e.classList.remove('hidden');
      } else {
        e.classList.add('hidden');
      }
    });
  }
  forElement('form', function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      return false;
    });
  });
  // left menu actions
  menuActions = {
    create: function doCreate() {
      menuActions.toggleMenu();
      $('#input [name="id"]').value = utils.uuid();
      displayTile('input');
    },
    toggleContent: function doToggle() {
      var cl = $('#menu').classList;
      cl.toggle("detail");
      cl.toggle("list");
      forElement('#list li[data-key]', function (e) {
        e.classList.remove('hidden');
        e.classList.remove('current');
      });
      menuActions.toggleMenu();
    },
    toggleMenu: function doToggleMenu() {
      $('#menu').classList.toggle("show");
      document.body.classList.toggle("menu");
    },
    sync: function doSync() {
      remoteStorage.sync().then(function onSyncDone() {
        window.alert('Synk ok');
      }, function onSynFail() {
        window.alert('Synk ko');
      });
    },
    settings: function doMenu() {
      menuActions.toggleMenu();
      displayTile('settings');
    },
    offline: function doOffline() {
      remoteStorage.alir.goOffline();
    },
    online: function doOnline() {
      remoteStorage.alir.goOnline();
    },
    onoff: function doOnOff() {
      if (UI.menu.onoffcheck.checked) {
        menuActions.offline();
        document.body.classList.remove('online');
      } else {
        menuActions.online();
        document.body.classList.add('online');
      }
    }
  };
  forElement('#menu .content [data-action]', function () {
    var elmt = arguments[0];
    UI.menu[elmt.dataset.action] = elmt;
  });
  UI.menu.onoffcheck = $('#menu .content [data-action="onoff"] input');
  if (!remoteStorage.connected) {
    UI.menu.onoffcheck.checked  = false;
    UI.menu.onoffcheck.disabled = true;
    document.body.classList.remove('online');
  }
  remoteStorage.on("disconnected", function (e) {
    UI.menu.onoffcheck.checked  = false;
    UI.menu.onoffcheck.disabled = true;
    document.body.classList.remove('online');
  });
  remoteStorage.on("sync-busy", function (e) {
    document.body.classList.add('sync');
  });
  remoteStorage.on("sync-done", function (e) {
    document.body.classList.remove('sync');
  });
  // @FIXME - connected doesn't exists
  //remoteStorage.on("connected", function (e) {
  //  UI.menu.onoffcheck.checked  = true;
  //  UI.menu.onoffcheck.disabled = false;
  //  document.body.classList.add('online');
  //});

  // @TODO
  //remoteStorage.on("authing", function (e) { });
  //remoteStorage.on("conflict", function (e) { });
  //remoteStorage.on("connecting", function e() { });
  //remoteStorage.on("disconnect", function (e) { });
  //remoteStorage.on("error", function (e) { });
  //remoteStorage.on("features-loaded", function (e) { });
  //remoteStorage.on("ready", function (e) { });
  //UI.list.addEventListener('contextmenu', function (e) {
  //  window.alert(utils.createXPathFromElement(e.originalTarget));
  //});
  UI.list.addEventListener('click', function onClick(event) {
    var target = event.target,
        context, key, keyNode = target, parent;
    function toggleItem(key) {
      var clItem = $('[data-key="' + key + '"]').classList,
          clMenu = $('#menu').classList;
      clMenu.toggle("detail");
      clMenu.toggle("list");
      Array.prototype.forEach.call($$('li[data-key]'), function (e) {
        e.classList.toggle('hidden');
      });
      clItem.toggle('hidden');
      clItem.toggle('current');
      $('#menu .content .top').href = '#' + key;
    }
    if (target.dataset.action) {
      while (typeof keyNode.dataset.key === 'undefined' && keyNode.parentNode) {
        keyNode = keyNode.parentNode;
      }
      if (typeof keyNode.dataset.key !== 'undefined') {
        key = keyNode.dataset.key;
      }
      parent  = target;
      while (typeof parent.dataset.context === 'undefined' && parent.parentNode) {
        parent = parent.parentNode;
      }
      context = parent.dataset.context;
      switch (target.dataset.action) {
      case 'toggle':
        toggleItem(key);
        break;
      case 'delete':
        if (window.confirm("Supprimer ???")) {
          remoteStorage.alir[context].remove(key);
        }
        toggleItem(key);
        break;
      case 'compose':
        remoteStorage.alir[context].getObject(key).then(function (object) {
          console.log(object);
          $('#input [name="id"]').value    = key;
          $('#input [name="title"]').value = object.title;
          $('#input [name="url"]').value   = object.url;
          $('#input [name="text"]').value  = object.text;
          displayTile('input');
        });
        break;
      }
    }
  });
  // input {{
  $('#input [name="private"]').addEventListener('click', function () {
    var obj = {
      id: $('#input [name="id"]').value,
      url: $('#input [name="url"]').value,
      title: $('#input [name="title"]').value,
      text: $('#input [name="text"]').value
    };
    remoteStorage.alir.addPrivate(obj);
    //menuActions.create();
  });
  $('#input [name="done"]').addEventListener('click', function () {
    displayTile('list');
  });
  // }}
  // {{ Settings
  $('#settings [name="cancel"]').addEventListener('click', function () {
    displayTile('list');
  });
  $('#settings [name="install"]').addEventListener('click', function () {
    var request = window.navigator.mozApps.install("http://alir.clochix.net/manifest.webapp");
    request.onerror = function () {
      window.alert("Error");
      console.log(this.error, 'error');
    };
    request.onsuccess = function () {
      window.alert("Yeah");
      displayTile('list');
    };
  });
  // }}
  // Left menu {{
  $('#menu').addEventListener('click', function (event) {
    var target = event.target,
        action = target.dataset.action;
    if (action && menuActions[action]) {
      menuActions[action]();
    }
  });
  // }}
  // Prepare templates
  templates.item = doT.template($('#tmpl-item').innerHTML);


  (function () {
    var height = document.body.clientHeight,
        scroll = $("#menu .scrollbar");
    scroll.style.height = (window.innerHeight / document.body.clientHeight * 100) + '%';
    setInterval(function checkSize() {
      var h = document.body.clientHeight;
      if (h !== height) {
        height = h;
        scroll.style.height = (window.innerHeight / document.body.clientHeight * 100) + '%';
        scroll.style.top = (window.scrollY / document.body.clientHeight * 100) + '%';
      }
    }, 250);
    window.onscroll = function () {
      scroll.style.top = (window.scrollY / document.body.clientHeight * 100) + '%';
    };
  })();
}
// }}

/*
window.addEventListener('load', function () {
  "use strict";
  if (Notification && Notification.permission !== "granted") {
    Notification.requestPermission(function (status) {
      // This allows to use Notification.permission with Chrome/Safari
      if (Notification.permission !== status) {
        Notification.permission = status;
      }
    });
  }
});
*/

initUI();

remoteStorage.access.claim('alir', 'rw');
remoteStorage.caching.enable('/alir/');
remoteStorage.caching.enable('/public/alir/');
remoteStorage.displayWidget();
remoteStorage.alir.private.on('change', function onChange(ev) {
  "use strict";
  //console.log('change');
  //console.log(ev);
  updateList();
});
updateList();
