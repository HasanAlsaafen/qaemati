// Table service on the public menu: send the selection to the kitchen and call
// the waiter. The server decides everything that matters (the table, the plan,
// the prices, whether the guest is in the restaurant). This file only asks the
// phone where it is, posts, and shows the answer in the guest's language.

function getGuestPosition() {
  return new Promise(function (resolve) {
    if (!navigator.geolocation) return resolve({ error: 'unsupported' });
    navigator.geolocation.getCurrentPosition(
      function (position) {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      function () {
        resolve({ error: 'denied' });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

function postJson(url, payload) {
  var meta = document.querySelector('meta[name="csrf-token"]');
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRF-Token': meta ? meta.content : '',
    },
    body: JSON.stringify(payload),
  }).then(function (response) {
    return response.json().then(
      function (body) {
        return { ok: response.ok, status: response.status, body: body };
      },
      function () {
        return { ok: false, status: response.status, body: {} };
      },
    );
  });
}

function toastMessage(message, variant) {
  window.dispatchEvent(new CustomEvent('toast', { detail: { message: message, variant: variant } }));
}

function tableOrderState(config) {
  var text = config.labels;
  var storageKey = 'qaemati:order:' + config.slug;

  function describe(error) {
    var template = (text.errors && text.errors[error.error]) || error.message || text.network;
    return template.split('{item}').join(error.item || '');
  }

  function fill(template, values) {
    return Object.keys(values).reduce(function (result, key) {
      return result.split('{' + key + '}').join(values[key]);
    }, template);
  }

  // The server's own sentence is already in the visitor's language and names
  // the dish; fall back to the template only when it sent none.
  function words(result) {
    return result.body && result.body.message ? result.body.message : describe(result.body || {});
  }

  function position() {
    if (!config.locationCheck) return Promise.resolve({});
    return getGuestPosition();
  }

  return {
    orderText: text,
    phase: 'idle', // idle, locating, sending
    message: '',
    calling: false,
    // The order this guest is following: { token, number, status, total, currency }.
    tracking: null,
    _socket: null,
    _poll: null,

    init: function () {
      if (!config.track) return;
      var saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      } catch (e) {
        saved = null;
      }
      if (saved && saved.token) {
        this.tracking = { token: saved.token, number: saved.number, status: 'NEW', total: saved.total, currency: saved.currency };
        this.follow();
      }
    },

    statusText: function () {
      return this.tracking ? text.status[this.tracking.status] || '' : '';
    },

    pillText: function () {
      return this.tracking
        ? fill(text.pill, { number: this.tracking.number, status: this.statusText() })
        : '';
    },

    finished: function () {
      return !!this.tracking && (this.tracking.status === 'SERVED' || this.tracking.status === 'CANCELED');
    },

    // 0 to 3: how far along the order is. Canceled has no position.
    step: function () {
      return this.tracking ? ['NEW', 'PREPARING', 'READY', 'SERVED'].indexOf(this.tracking.status) : -1;
    },

    setStatus: function (status) {
      if (!this.tracking || !status) return;
      this.tracking = Object.assign({}, this.tracking, { status: status });
      if (this.finished()) this.stopFollowing();
    },

    forget: function () {
      this.stopFollowing();
      this.tracking = null;
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // Nothing stored, nothing to remove.
      }
    },

    // Live over a websocket when the browser has it, otherwise a slow poll.
    follow: function () {
      var self = this;
      var url = '/m/' + encodeURIComponent(config.slug) + '/orders/' + encodeURIComponent(self.tracking.token);
      function check() {
        fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (response) {
            if (response.status === 404) return self.forget();
            return response.json().then(function (body) {
              self.setStatus(body.status);
            });
          })
          .catch(function () {
            // Offline for a moment. The next poll or the socket catches up.
          });
      }
      check();
      if (window.io) {
        self._socket = window.io('/track', { auth: { token: self.tracking.token }, transports: ['websocket', 'polling'] });
        self._socket.on('status', function (payload) {
          self.setStatus(payload.status);
        });
        self._socket.on('unknown_order', function () {
          self.forget();
        });
        self._socket.on('connect', check);
      }
      self._poll = setInterval(check, window.io ? 30000 : 8000);
    },

    stopFollowing: function () {
      if (this._socket) this._socket.disconnect();
      if (this._poll) clearInterval(this._poll);
      this._socket = null;
      this._poll = null;
    },

    sendOrder: function () {
      var store = Alpine.store('selection');
      if (this.phase !== 'idle' || store.count === 0) return;
      var self = this;
      self.message = '';
      self.phase = 'locating';
      position()
        .then(function (where) {
          if (where.error) {
            self.message = text.errors.location_required;
            self.phase = 'idle';
            return null;
          }
          self.phase = 'sending';
          return postJson('/m/' + encodeURIComponent(config.slug) + '/orders', {
            table: config.token,
            lines: store.list.map(function (item) {
              return { key: item.id, qty: item.quantity };
            }),
            note: store.note,
            lat: where.lat,
            lng: where.lng,
            accuracy: where.accuracy,
          });
        })
        .then(function (result) {
          if (!result) return;
          if (result.ok) {
            self.tracking = {
              token: result.body.track,
              number: result.body.number,
              status: 'NEW',
              total: result.body.total,
              currency: store.currencySymbol,
            };
            try {
              localStorage.setItem(storageKey, JSON.stringify(self.tracking));
            } catch (e) {
              // The order still goes through and updates, it just is not remembered on reload.
            }
            store.clear();
            self.phase = 'idle';
            self.open = true;
            self.follow();
          } else {
            self.message = words(result);
            self.phase = 'idle';
          }
        })
        .catch(function () {
          self.message = text.network;
          self.phase = 'idle';
        });
    },

    finish: function () {
      if (this.finished()) this.forget();
      this.open = false;
    },

    callWaiter: function () {
      if (this.calling) return;
      var self = this;
      self.calling = true;
      toastMessage(text.calling, 'neutral');
      position()
        .then(function (where) {
          if (where.error) {
            toastMessage(text.errors.location_required, 'danger');
            return null;
          }
          return postJson('/m/' + encodeURIComponent(config.slug) + '/waiter-calls', {
            table: config.token,
            lat: where.lat,
            lng: where.lng,
            accuracy: where.accuracy,
          });
        })
        .then(function (result) {
          if (!result) return;
          if (result.ok) {
            toastMessage(result.body.alreadyCalled ? text.alreadyCalled : text.called, 'success');
          } else {
            toastMessage(words(result), 'danger');
          }
        })
        .catch(function () {
          toastMessage(text.network, 'danger');
        })
        .then(function () {
          self.calling = false;
        });
    },
  };
}
