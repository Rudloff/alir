//jshint browser: true
/* global remoteStorage: true, tiles: true, utils: true, _: true, View: true, $:true */
function Feeds() {
  "use strict";
  var _cache = {},
      self = this;
  this.cache = function (obj) {
    _cache[obj.url] = obj;
  };
  /**
   * Display feed item
   *
   * @param {Object} obj
   *
   */
  this.display = function (obj) {
    //jshint maxstatements: 35, debug: true, maxcomplexity: 22
    var title = obj.title || obj.id,
        data  = {},
        item,
        classes = [];
    item = document.getElementById(obj.id);
    if (item) {
      classes = [].slice.call(item.classList);
      item.parentNode.removeChild(item);
    }
    data = {
      key: obj.id,
      context: 'private',
      title: title,
      url: obj.url
    };
    item = View.template('tmpl-feed', data);
    View.insertInList(document.getElementById('feedsList'), "[data-key]", item, function (e) { return (e.dataset.title.toLowerCase() > title.toLowerCase()); });
    // update feed cache
    window.feeds.cache(obj);

    if (classes.length !== 0) {
      classes.forEach(function (cl) {
        item.classList.add(cl);
      });
    }

    return item;
  };
  this.save = function () {
    var $  = tiles.$('feedEdit'),
        id = $('[name="id"]').value,
        obj;

    function doSave(feed) {
      remoteStorage.alir.saveFeed(feed);
      window.feeds.display(feed);
      window.feeds.cache(feed);
      tiles.show('feeds');
      $('[name="url"]').value   = 'http://';
      $('[name="title"]').value = '';
      $('[name="feedShort"]').checked = false;
    }
    if (id) {
      // update
      remoteStorage.alir.getFeed(id, function (obj) {
        if (obj) {
          obj.url   = $('[name="url"]').value;
          obj.title = $('[name="title"]').value;
          obj.short = $('[name="feedShort"]').checked;
          obj.date  = Date.now();
          doSave(obj);
        }
      });
    } else {
      // create
      obj = {
        id:    utils.uuid(),
        url:   $('[name="url"]').value,
        title: $('[name="title"]').value,
        date:  Date.now(),
        short: $('[name="feedShort"]').checked,
        articles: {}
      };
      doSave(obj);
    }
  };
  this.fetch = function (url, test, cb) {
    //jshint maxcomplexity: 20
    if (typeof _cache[url] === 'undefined') {
      if (test) {
        _cache[url] = {
          'articles': {},
          'short': false,
          'title': '???'
        };
      } else {
        utils.log('No cache for url ' + url, 'error');
        window.alir.ui.message(_('feedNoCache'), 'error');
        if (cb) {
          cb({});
        }
        return;
      }
    }
    function onFeedGot(err, doc) {
      //jshint maxstatements: 40
      var feedUpdated,
          root,
          format = 'atom',
          cache,
          parser;
      cache = _cache[url];
      utils.log('Updating feed ' + cache.title, "debug");
      if (err) {
        utils.log(err, "warning");
      } else {
        if ((!doc.responseXML) || (doc.responseXML && doc.responseXML.getElementsByTagName('rss').length === 0 && doc.responseXML.getElementsByTagName('feed').length === 0)) {
          try {
            parser = new DOMParser();
            doc = parser.parseFromString(doc.response, 'text/html');
          } catch (e) {
            utils.log("Error parsing feed : " + e.toString(), "error");
          }
          if (doc.getElementsByTagName('rss').length === 0 && doc.getElementsByTagName('feed').length === 0) {
            utils.log("Unable to get feed type for " + url, "error");
            if (cb) {
              cb(cache.articles);
            }
            return;
          }
        } else {
          doc = doc.responseXML;
        }
        if (!doc) {
          utils.log("Unable to parse feed " + url, "error");
          if (cb) {
            cb(cache.articles);
          }
          return;
        }
        doc.url = url;
        root = doc.getElementsByTagName('rss');
        if (root.length > 0) {
          format = 'rss';
          root   = "rss > channel ";
        } else {
          format = 'atom';
          root   = 'feed ';
        }
        utils.log("Feed format : " + format, "debug");
        feedUpdated = doc.querySelector(root + " > updated");
        if (feedUpdated) {
          feedUpdated = new Date(feedUpdated.textContent);
        }
        root = format === 'atom' ? root + ' entry' : root + ' item';
        [].slice.call(doc.querySelectorAll(root)).forEach(function (entry) {
          //jshint maxstatements: 30
          var itemContent, itemId, itemTitle, itemUpdated, itemUrl;
          function getVal(key, prop) {
            var val = entry.querySelector(key);
            if (val) {
              if (prop) {
                return val.getAttribute(prop);
              } else {
                if (val.textContent !== '') {
                  return utils.trim(val.textContent);
                } else if (val.nextSibling && val.nextSibling.nodeType === 3) {
                  return utils.trim(val.nextSibling.textContent);
                }
              }
            } else {
              return null;
            }
          }
          itemId      = format === 'atom' ? getVal('id') : getVal('guid');
          itemUrl     = format === 'atom' ? getVal('link', 'href') : getVal('link');
          itemTitle   = getVal('title');
          itemContent = getVal('encoded') || getVal('content') || getVal('summary') || getVal('description');/* || entry.getElementsByTagName("content:encoded")*/
          //if (typeof itemContent === 'object' && typeof itemContent.length !== 'undefined' && itemContent.length > 0) {
          //  //itemContent = itemContent[0].innerHTML;
          //  itemContent = itemContent[0].textContent;
          //}
          itemUpdated = entry.querySelector("updated") || entry.querySelector("published") || entry.querySelector("pubDate") || entry.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", 'date');
          if (itemUpdated && typeof itemUpdated.length !== 'undefined') {
            itemUpdated = itemUpdated[0];
          }
          if (!!!itemId || !!!itemUpdated) {
            return;
          }
          itemUpdated = utils.getDate(itemUpdated.textContent);
          if (typeof cache.articles[itemId] !== 'undefined' && cache.articles[itemId].updated >= itemUpdated) {
            return;
          }
          if (typeof cache.articles[itemId] === 'undefined') {
            utils.log('New article "%s" in "%s"', itemTitle, cache.title, "info");
            utils.notify('New article in ' + cache.title, utils.format('"%s" in "%s"', itemTitle, cache.title), function () {
              if (window.alir.getStatus().installed) {
                navigator.mozApps.getSelf().onsuccess = function gotSelf(evt) {
                  var app = evt.target.result;
                  if (app !== null) {
                    app.launch();
                  }
                  self.showArticle(itemUrl);
                };
              } else {
                self.showArticle(itemUrl);
              }
            });
          } else {
            utils.log('Article Updated : "%s" "%s" < "%s"', itemTitle, cache.articles[itemId].updated, itemUpdated, "info");
          }
          if (itemUpdated > feedUpdated) {
            feedUpdated = itemUpdated;
          }
          function doSave(content) {
            var article = {
              id:    utils.uuid(),
              url:   itemUrl,
              title: itemTitle,
              html:  content,
              date:  itemUpdated,
              flags: {
                editable: false
              },
              tags: ['feed', cache.title]
            };
            if (typeof content === 'undefined') {
              article.loaded = false;
            } else {
              // Parse HTML to cache images (???)
              View.toDom(content, itemUrl);
            }
            if (test !== true) {
              remoteStorage.alir.saveArticle(article);
              window.articles.addToList(article);
            }
            return article.id;
          }
          cache.articles[itemId] = {
            url: itemUrl,
            updated: itemUpdated,
            title: itemTitle
          };
          if (test !== true && (cache.short || !!!itemContent)) {
            window.scrap(itemUrl, function (err, res) {
              if (err) {
                utils.log(err.toString(), 'error');
                doSave();
              } else {
                doSave(res.html);
              }
            });
          } else {
            doSave(itemContent);
          }
        });
        if (test !== true) {
          remoteStorage.alir.getFeed(_cache[url].id, function (obj) {
            if (obj) {
              obj.articles = cache.articles;
              obj.date     = Date.now();
              remoteStorage.alir.saveFeed(obj);
              window.feeds.display(obj);
              // If feed is shown, try to reload it
              try {
                if (tiles.getCurrent() === "feedShow" && document.querySelector('#feedDetail [data-url]').dataset.url === obj.url) {
                  window.feeds.show(obj.url);
                }
              } catch (e) {}
            }
          });
        }
      }
      if (cb) {
        cb(cache.articles);
      }
    }
    window.network.fetch(url, onFeedGot);
  };
  this.test = function (url) {
    var $   = tiles.$('feedEdit');
    url = url || $('[name="url"]').value;
    window.feeds.fetch(url, true, function (items) {
      items = items || {};
      window.alir.ui.message(_('feedTestResult', {nb: Object.keys(items).length}), 'info');
      items = {};
    });
  };
  this.create = function (url, title) {
    if (typeof title === 'undefined') {
      title = '';
    }
    if (typeof url === 'undefined') {
      url = 'http://';
    }
    var $   = tiles.$('feedEdit');
    $('[name="id"]').value    = '';
    $('[name="url"]').value   = url;
    $('[name="title"]').value = title;
    $('[name="feedShort"]').checked = false;
    tiles.go('feedEdit');
  };
  this.edit = function (url) {
    var $    = tiles.$('feedEdit'),
        feed = _cache[url];
    $('[name="id"]').value    = feed.id;
    $('[name="url"]').value   = feed.url;
    $('[name="title"]').value = feed.title;
    $('[name="feedShort"]').checked = feed.short;
    tiles.go('feedEdit');
  };
  this.show = function (url) {
    var feed = _cache[url],
        parent = $("#feedDetail");
    feed.items = utils.toArray(feed.articles);
    feed.items.forEach(function (v, k) {
      if (!v.title) {
        feed.items[k].title = v.url.split('/').pop();
      }
    });
    feed.items.sort(function (a, b) {return a.updated > b.updated ? -1 : 1; });
    parent.innerHTML = '';
    parent.appendChild(View.template('tmpl-feed-detail', feed));
    tiles.go('feedShow');
  };
  this.delete = function (url) {
    var feed = _cache[url];
    if (window.confirm(_('feedConfirmDelete', {title: feed.title}))) {
      remoteStorage.alir.private.remove('/feed/' + feed.id);
      delete _cache[url];
      tiles.show('feeds');
    }
  };
  this.update = function () {
    // Note: when app is awake by alarm, cache may be empty, so
    // we can't rely on it here
    remoteStorage.alir.private.getAll('feed/').then(function (feeds) {
      var keys, toFetch;
      if (feeds) {
        keys    = Object.keys(feeds);
        toFetch = keys.length;
        keys.forEach(function (key) {
          window.feeds.fetch(feeds[key].url, false, function () {
            self.cache(feeds[key]);
            toFetch--;
            if (toFetch === 0) {
              utils.log("Feeds updated", "debug");
            }
          });
        });
      } else {
        keys    = Object.keys(_cache);
        toFetch = keys.length;
        utils.log("No feeds yet", "warning");
        keys.forEach(function (key) {
          window.feeds.fetch(_cache[key].url, false, function () {
            toFetch--;
            if (toFetch === 0) {
              utils.log("Feeds updated", "debug");
            }
          });
        });
      }
    });
  };
  this.showArticle = function (url) {
    var elmt = $('[data-url="' + url + '"]');
    if (elmt) {
      tiles.go('list');
      window.articles.show(elmt.dataset.key);
    } else {
      if (window.confirm(_('feedShowReload'))) {
        window.scrap(url, function (err, article) {
          var obj;
          obj = {
            id: utils.uuid(),
            url: article.url,
            title: article.title,
            html: article.html,
            date: Date.now(),
            flags: {
              editable: false
            },
            tags: ['feed']
          };
          if (err) {
            utils.log(err.toString(), 'error');
            obj.loaded = false;
          } else {
            // Parse HTML to cache images (???)
            View.toDom(article.html, article.url);
          }
          remoteStorage.alir.saveArticle(obj).then(function () {
            utils.log('Created : ' + obj.title, "info");
            // Hack: Article may not be really created yet, so we display it
            window.articles.display(obj);
          });
        });
      }
    }
  };
  this.handleNotificationMessage = function (message) {
    if (!message.clicked) {
      return;
    }
    navigator.mozApps.getSelf().onsuccess = function gotSelf(evt) {
      var app = evt.target.result;
      if (app !== null) {
        app.launch();
      }
    };
  };
  this.handleAlarmMessage = function (mozAlarm) {
    try {
      utils.log("alarm fired: " + JSON.stringify(mozAlarm.data), "debug");
    } catch (e) {
      utils.log(e, "warning");
    }
    switch (mozAlarm.data.action) {
    case 'feedUpdate':
      try {
        self.update();
      } catch (e) {
        utils.notify("Error in updating", e.toString());
        utils.log(e, "warning");
      }
      try {
        window.alarms.plan();
      } catch (e) {
        utils.notify("Error in planning", e.toString());
        utils.log(e, "warning");
      }
    }
  };
  this.reset = function (url) {
    _cache[url].article = {};
    tiles.back();
    this.show(url);
    tiles.go('feedShow');
  };
}
window.feeds = new Feeds();
// Manage alarms
if (navigator.mozAlarms) {
  window.alarms = {
    display: function () {
      "use strict";
      var request = navigator.mozAlarms.getAll();

      request.onsuccess = function () {
        var alarms  = this.result;
        if (alarms.length === 0) {
          utils.log(_('alarmsNoAlarms'), 'warning');
        } else {
          alarms.forEach(function (alarm) {
            utils.log(alarm.data.action + " at " + alarm.date, "info");
          });
        }
      };

      request.onerror = function () {
        utils.log('Error getting alarms: ' + this.error);
      };
    },
    plan: function () {
      "use strict";
      var request = navigator.mozAlarms.getAll();
      if (typeof window.utils !== 'object') {
        window.utils = window.console;
      }

      request.onsuccess = function () {
        var alarms   = this.result,
            current  = new Date(),
            nb       = alarms.length,
            interval = window.config.alarmInterval || 60;
        utils.log(alarms.length + " alarms planned", "debug");
        if (alarms.length === 0) {
          current.setMinutes(current.getMinutes() + 1);
          window.alarms.set(current);
        }
        alarms.forEach(function (alarm) {
          if (alarm.date > current) {
            current = alarm.date;
          }
        });
        utils.log("Last alarm planned at " + utils.getDate(current), "debug");
        while (nb < 10) {
          current.setMinutes(current.getMinutes() + parseInt(interval, 10));
          window.alarms.set(current);
          nb++;
        }
      };

      request.onerror = function () {
        utils.log('Error getting alarms: ' + this.error);
      };
    },
    set: function (date) {
      "use strict";
      var alarm, request;
      alarm = {
        date: date,
        respectTimezone: 'honorTimezone',
        data: {
          action: 'feedUpdate'
        }
      };
      utils.log("Planning alarm at " + date, "debug");
      request = navigator.mozAlarms.add(alarm.date, alarm.respectTimezone, alarm.data);

      request.onsuccess = function () {
        utils.log("Alarm planned at " + date, "debug");
      };
      request.onerror = function () {
        utils.log("Error planning alarm at " + date, "error");
      };
    },
    reset: function (cb) {
      "use strict";
      var request = navigator.mozAlarms.getAll();

      request.onsuccess = function () {
        this.result.forEach(function (alarm) {
          navigator.mozAlarms.remove(alarm.id);
        });
        if (cb) {
          cb();
        }
      };

      request.onerror = function () {
        utils.log('Error getting alarms: ' + this.error);
      };
    }
  };
  if (navigator.mozSetMessageHandler) {
    navigator.mozSetMessageHandler("alarm", window.feeds.handleAlarmMessage);
  }

} else {
  // @TODO
  window.alarms = {
    all: [],
    display: function () {
      "use strict";
      if (this.all.length === 0) {
        utils.log(_('alarmsNoAlarms'), 'warning');
      } else {
        this.all.forEach(function (alarm) {
          utils.log(alarm.data.action + " at " + alarm.date, "debug");
        });
      }
    },
    plan: function () {
      "use strict";
      if (typeof window.utils !== 'object') {
        window.utils = window.console;
      }
      var current  = new Date(),
          nb       = this.all.length,
          interval = window.config.alarmInterval || 60;
      utils.log(this.all.length + " alarms planned", "debug");
      if (nb === 0) {
        current.setMinutes(current.getMinutes() + 1);
        window.alarms.set(current);
      }
      this.all.forEach(function (alarm) {
        if (alarm.date > current) {
          current = alarm.date;
        }
      });
      utils.log("Last alarm planned at " + utils.getDate(current), "debug");
      while (nb < 10) {
        current.setMinutes(current.getMinutes() + parseInt(interval, 10));
        window.alarms.set(current);
        nb++;
      }
    },
    set: function (date) {
      "use strict";
      var alarm, interval;
      interval = date - new Date();
      if (interval > 0) {
        alarm = {
          date: date,
          data: {
            action: 'feedUpdate'
          }
        };
        utils.log("Planning alarm at " + date, "debug");
        alarm.id = window.setTimeout(function () {
          delete window.config.alarms[date.toISOString()];
          window.feeds.handleAlarmMessage(alarm);
        }, interval);
        this.all.push(alarm);
        window.config.alarms[date.toISOString()] = alarm;
      } else {
        utils.log("Unable to plan action in the past " + date, "error");
      }
    },
    reset: function (cb) {
      "use strict";
      this.all.forEach(function (alarm) {
        window.clearTimeout(alarm.id);
      });
      this.all = [];
      if (cb) {
        cb();
      }
    }
  };

}
