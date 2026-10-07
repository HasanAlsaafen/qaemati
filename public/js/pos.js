// The cashier and kitchen screen. The board itself is server rendered and
// re-fetched with htmx; this file keeps the live connection, plays the sounds
// and keeps the connection light and the tab title honest.
(function () {
  var statusEl = document.querySelector('[data-pos-connection]');
  var dot = document.querySelector('[data-pos-dot]');
  var label = document.querySelector('[data-pos-connection-label]');
  var soundButton = document.querySelector('[data-pos-sound]');
  var blocked = document.querySelector('[data-pos-sound-blocked]');
  var baseTitle = document.title;
  var STORE = 'qaemati:pos-sound';

  var audio = null;
  var soundOn = false;
  var alarmTimer = null;

  function remember(value) {
    try {
      localStorage.setItem(STORE, value ? '1' : '0');
    } catch (e) {
      // Private mode: the choice just does not survive a reload.
    }
  }

  function wanted() {
    try {
      return localStorage.getItem(STORE) === '1';
    } catch (e) {
      return false;
    }
  }

  function beep(context, frequency, start, length, volume) {
    var oscillator = context.createOscillator();
    var gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }

  // A new order is two soft notes. A waiter call is three rising, louder ones,
  // so the two are never mistaken for each other across a kitchen.
  function playOrder() {
    if (!soundOn || !audio) return;
    var t = audio.currentTime;
    beep(audio, 660, t, 0.22, 0.25);
    beep(audio, 880, t + 0.2, 0.3, 0.25);
  }

  function playCall() {
    if (!soundOn || !audio) return;
    var t = audio.currentTime;
    beep(audio, 880, t, 0.18, 0.5);
    beep(audio, 1100, t + 0.2, 0.18, 0.5);
    beep(audio, 1320, t + 0.4, 0.3, 0.5);
  }

  function setSound(on) {
    soundOn = on;
    soundButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundButton.textContent = on ? soundButton.dataset.on : soundButton.dataset.off;
  }

  function enableSound() {
    var Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audio) audio = new Context();
    var started = audio.resume ? audio.resume() : Promise.resolve();
    Promise.resolve(started).then(function () {
      var ok = audio.state === 'running';
      setSound(ok);
      remember(ok);
      blocked.hidden = ok;
      if (ok) playOrder();
    });
  }

  soundButton.addEventListener('click', function () {
    if (soundOn) {
      setSound(false);
      remember(false);
    } else {
      enableSound();
    }
  });

  // Browsers only allow sound after a tap on this page. If the cashier had it
  // on last time, say so instead of silently staying quiet.
  if (wanted()) blocked.hidden = false;

  function state() {
    var node = document.querySelector('[data-pos-state]');
    return {
      newOrders: node ? Number(node.dataset.newOrders) : 0,
      openCalls: node ? Number(node.dataset.openCalls) : 0,
    };
  }

  // While a call is unanswered it keeps sounding, until someone taps On my way.
  function syncAlarm() {
    var current = state();
    var attention = current.newOrders + current.openCalls;
    document.title = attention > 0 ? '(' + attention + ') ' + baseTitle : baseTitle;
    if (current.openCalls > 0 && !alarmTimer) {
      alarmTimer = setInterval(function () {
        if (state().openCalls > 0) playCall();
      }, 7000);
    } else if (current.openCalls === 0 && alarmTimer) {
      clearInterval(alarmTimer);
      alarmTimer = null;
    }
  }

  document.body.addEventListener('htmx:afterSwap', syncAlarm);
  syncAlarm();

  function refresh() {
    document.body.dispatchEvent(new Event('pos-refresh'));
  }

  function show(kind) {
    var colors = { live: 'bg-success', connecting: 'bg-warning', offline: 'bg-danger' };
    dot.className = 'h-2.5 w-2.5 rounded-full ' + colors[kind];
    label.textContent = statusEl.dataset[kind];
  }

  if (window.io) {
    var socket = window.io('/pos', { transports: ['websocket', 'polling'] });
    show('connecting');
    socket.on('connect', function () {
      show('live');
      // Anything that happened while the screen was offline.
      refresh();
    });
    socket.on('disconnect', function () {
      show('offline');
    });
    socket.on('connect_error', function () {
      show('offline');
    });
    socket.on('unauthorized', function () {
      window.location.href = '/admin/login?redirect=/admin/pos';
    });
    socket.on('order.new', function () {
      playOrder();
      refresh();
    });
    socket.on('call.new', function () {
      playCall();
      refresh();
    });
    socket.on('order.updated', refresh);
    socket.on('call.updated', refresh);
  } else {
    show('offline');
  }

  // "Use my current location" in the settings form.
  var locate = document.querySelector('[data-pos-locate]');
  if (locate) {
    locate.addEventListener('click', function () {
      var original = locate.textContent;
      if (!navigator.geolocation) {
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: locate.dataset.denied, variant: 'danger' } }));
        return;
      }
      locate.textContent = locate.dataset.busy;
      navigator.geolocation.getCurrentPosition(
        function (position) {
          document.querySelector('[name="latitude"]').value = position.coords.latitude.toFixed(6);
          document.querySelector('[name="longitude"]').value = position.coords.longitude.toFixed(6);
          locate.textContent = original;
        },
        function () {
          locate.textContent = original;
          window.dispatchEvent(new CustomEvent('toast', { detail: { message: locate.dataset.denied, variant: 'danger' } }));
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    });
  }
})();
