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
    phase: 'idle', // idle, locating, sending, sent
    message: '',
    sent: null,
    calling: false,

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
            self.sent = {
              number: result.body.number,
              total: result.body.total,
              currency: store.currencySymbol,
              text: fill(text.sentText, { table: config.tableLabel }),
              title: fill(text.sentTitle, { number: result.body.number }),
            };
            store.clear();
            self.phase = 'sent';
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
      this.sent = null;
      this.phase = 'idle';
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
