// The details a guest gives when sending an order on WhatsApp: name, phone and
// where they are. Mirrors src/common/text/contact-details.ts, which is the
// tested version (no bundler here, so the rules are kept in step by hand).
// They are remembered on this phone only, in localStorage, never sent anywhere
// except inside the WhatsApp message the guest chooses to send.

var GUEST_CONTACT_KEY = 'qaemati:contact';

function guestWesternDigits(value) {
  return value.replace(/[٠-٩۰-۹]/g, function (digit) {
    var code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function guestCleanLine(value, max) {
  return String(value || '')
    .replace(new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]+', 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function guestNormalizePhone(value) {
  var text = guestWesternDigits(String(value || '')).replace(new RegExp('[\\s().\\-\\u200e\\u200f]', 'g'), '');
  return text.indexOf('00') === 0 ? '+' + text.slice(2) : text;
}

function guestMapUrl(pin) {
  return 'https://maps.google.com/?q=' + pin.lat.toFixed(5) + ',' + pin.lng.toFixed(5);
}

function guestValidPin(pin) {
  return (
    !!pin &&
    isFinite(pin.lat) &&
    isFinite(pin.lng) &&
    Math.abs(pin.lat) <= 90 &&
    Math.abs(pin.lng) <= 180
  );
}

// Returns { ok: true, contact } or { ok: false, errors: { name, phone, location } }.
function guestValidate(input) {
  var errors = {};
  var name = guestCleanLine(input.name, 60);
  var phone = guestNormalizePhone(input.phone);
  var address = guestCleanLine(input.address, 200);
  var pin = guestValidPin(input.pin) ? input.pin : null;
  if (name.length < 2) errors.name = 'nameRequired';
  if (!/^\+?\d{7,15}$/.test(phone)) errors.phone = 'phoneInvalid';
  if (!pin && address.length < 3) errors.location = 'locationRequired';
  if (Object.keys(errors).length) return { ok: false, errors: errors };
  return {
    ok: true,
    contact: { name: name, phone: phone, address: address, mapUrl: pin ? guestMapUrl(pin) : '' },
  };
}

// Methods, not getters: Alpine copies a getter's value once when this object is
// spread into a component, and the page would never update.
function guestContactState() {
  return {
    guest: { name: '', phone: '', address: '', pin: null },
    guestRemember: true,
    guestErrors: {},
    guestLocating: false,
    guestLocationNote: '',
    guestHasSaved: false,

    init: function () {
      try {
        var saved = JSON.parse(localStorage.getItem(GUEST_CONTACT_KEY) || 'null');
        if (saved && typeof saved === 'object') {
          this.guest = {
            name: guestCleanLine(saved.name, 60),
            phone: guestCleanLine(saved.phone, 30),
            address: guestCleanLine(saved.address, 200),
            pin: guestValidPin(saved.pin) ? { lat: saved.pin.lat, lng: saved.pin.lng } : null,
          };
          this.guestHasSaved = !!(this.guest.name || this.guest.phone || this.guest.address || this.guest.pin);
        }
      } catch (e) {
        // Storage blocked or corrupt: start empty, the order still works.
      }
    },

    // What goes into the message, from whatever is typed now, or nothing while it is unusable.
    guestForMessage: function () {
      var result = guestValidate(this.guest);
      return result.ok ? result.contact : null;
    },

    guestPersist: function () {
      try {
        if (this.guestRemember) {
          localStorage.setItem(GUEST_CONTACT_KEY, JSON.stringify(this.guest));
          this.guestHasSaved = true;
        } else {
          localStorage.removeItem(GUEST_CONTACT_KEY);
          this.guestHasSaved = false;
        }
      } catch (e) {
        // Could not save: not a reason to stop the order.
      }
    },

    guestForget: function () {
      try {
        localStorage.removeItem(GUEST_CONTACT_KEY);
      } catch (e) {
        // Nothing stored, nothing to forget.
      }
      this.guest = { name: '', phone: '', address: '', pin: null };
      this.guestErrors = {};
      this.guestHasSaved = false;
    },

    guestShareLocation: function () {
      var self = this;
      self.guestLocationNote = '';
      if (!navigator.geolocation) {
        self.guestLocationNote = self.labels.locationDenied;
        return;
      }
      self.guestLocating = true;
      navigator.geolocation.getCurrentPosition(
        function (position) {
          self.guest.pin = { lat: position.coords.latitude, lng: position.coords.longitude };
          self.guestLocating = false;
          delete self.guestErrors.location;
        },
        function () {
          self.guestLocating = false;
          self.guestLocationNote = self.labels.locationDenied;
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    },

    guestRemovePin: function () {
      this.guest.pin = null;
    },

    // The click on "Send on WhatsApp": let it through only with usable details.
    guestSend: function (event) {
      var result = guestValidate(this.guest);
      if (!result.ok) {
        event.preventDefault();
        this.guestErrors = result.errors;
        var first = result.errors.name ? 'guest-name' : result.errors.phone ? 'guest-phone' : 'guest-address';
        var field = document.getElementById(first);
        if (field) field.focus();
        return;
      }
      this.guestErrors = {};
      // What is remembered, and shown next time, is the cleaned version.
      this.guest = {
        name: result.contact.name,
        phone: result.contact.phone,
        address: result.contact.address,
        pin: this.guest.pin,
      };
      this.guestPersist();
    },
  };
}
