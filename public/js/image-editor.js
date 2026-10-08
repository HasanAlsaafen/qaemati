// Every image an admin picks passes through here first: move, zoom, rotate and
// crop, then the cropped picture replaces the file in the input and the normal
// upload (htmx or form) carries on as if they had picked that file.
(function () {
  var OUTPUT_MAX = 1600;
  var SKIP = 'imageEdited';

  function isImageInput(el) {
    return el && el.tagName === 'INPUT' && el.type === 'file' && /image\//.test(el.accept || '');
  }

  function start(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var template = document.getElementById('image-editor-template');
    if (!template) return;
    // Decoded without a blob: URL, which the page's content security policy does not allow.
    createImageBitmap(file)
      .then(function (bitmap) {
        open(input, file, bitmap, template);
      })
      .catch(function () {
        input.value = '';
      });
  }

  function open(input, file, bitmap, template) {
    var img = { naturalWidth: bitmap.width, naturalHeight: bitmap.height };
    var root = template.content.firstElementChild.cloneNode(true);
    document.body.appendChild(root);
    var opener = document.activeElement;
    document.body.style.overflow = 'hidden';

    var stage = root.querySelector('[data-editor-stage]');
    var canvas = root.querySelector('[data-editor-canvas]');
    var circle = root.querySelector('[data-editor-circle]');
    var zoomInput = root.querySelector('[data-zoom]');
    var ctx = canvas.getContext('2d');
    var shapes = Array.prototype.slice.call(root.querySelectorAll('[data-aspect]'));

    var requested = input.getAttribute('data-crop-aspect') || 'free';
    var round = input.getAttribute('data-crop-round') === 'true';
    var state = { aspect: requested, rotation: 0, zoom: 1, x: 0, y: 0 };

    function source() {
      return state.rotation % 180 === 0
        ? { w: img.naturalWidth, h: img.naturalHeight }
        : { w: img.naturalHeight, h: img.naturalWidth };
    }
    function ratio() {
      if (state.aspect === 'free') {
        var s = source();
        return s.w / s.h;
      }
      return parseFloat(state.aspect);
    }
    // Size of the picture, in stage pixels, at zoom 1: just covers the frame.
    function base(w, h) {
      var s = source();
      var scale = Math.max(w / s.w, h / s.h);
      return { w: s.w * scale, h: s.h * scale };
    }
    function clamp(w, h) {
      var b = base(w, h);
      var maxX = Math.max(0, (b.w * state.zoom - w) / 2);
      var maxY = Math.max(0, (b.h * state.zoom - h) / 2);
      state.x = Math.min(maxX, Math.max(-maxX, state.x));
      state.y = Math.min(maxY, Math.max(-maxY, state.y));
    }
    function draw(target, w, h, k) {
      // k scales stage pixels to target pixels, so the export matches what was seen.
      var b = base(w, h);
      var dw = b.w * state.zoom * k;
      var dh = b.h * state.zoom * k;
      target.save();
      target.fillStyle = '#fff';
      target.fillRect(0, 0, w * k, h * k);
      target.translate((w * k) / 2 + state.x * k, (h * k) / 2 + state.y * k);
      target.rotate((state.rotation * Math.PI) / 180);
      var iw = state.rotation % 180 === 0 ? dw : dh;
      var ih = state.rotation % 180 === 0 ? dh : dw;
      target.drawImage(bitmap, -iw / 2, -ih / 2, iw, ih);
      target.restore();
    }
    function render() {
      // Width follows the height cap so the frame always keeps the chosen ratio.
      stage.style.width = '100%';
      var full = stage.getBoundingClientRect().width;
      stage.style.width = Math.floor(Math.min(full, window.innerHeight * 0.5 * ratio())) + 'px';
      stage.style.aspectRatio = String(ratio());
      var rect = stage.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      clamp(w, h);
      draw(ctx, w, h, dpr);
      circle.classList.toggle('hidden', !(round && Math.abs(ratio() - 1) < 0.01));
      zoomInput.value = String(state.zoom);
      shapes.forEach(function (b) {
        b.setAttribute(
          'aria-pressed',
          String(
            b.getAttribute('data-aspect') === state.aspect ||
              (b.getAttribute('data-aspect') !== 'free' &&
                state.aspect !== 'free' &&
                Math.abs(parseFloat(b.getAttribute('data-aspect')) - parseFloat(state.aspect)) <
                  0.01),
          ),
        );
      });
    }

    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, sx: state.x, sy: state.y };
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = 'grabbing';
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      state.x = drag.sx + (e.clientX - drag.x);
      state.y = drag.sy + (e.clientY - drag.y);
      render();
    });
    function endDrag() {
      drag = null;
      stage.style.cursor = 'grab';
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
      },
      { passive: false },
    );
    stage.addEventListener('keydown', function (e) {
      var step = 12;
      var handled = true;
      if (e.key === 'ArrowLeft') state.x += step;
      else if (e.key === 'ArrowRight') state.x -= step;
      else if (e.key === 'ArrowUp') state.y += step;
      else if (e.key === 'ArrowDown') state.y -= step;
      else if (e.key === '+' || e.key === '=') setZoom(state.zoom + 0.1);
      else if (e.key === '-') setZoom(state.zoom - 0.1);
      else handled = false;
      if (handled) {
        e.preventDefault();
        render();
      }
    });

    function setZoom(value) {
      state.zoom = Math.min(4, Math.max(1, value));
      render();
    }
    zoomInput.addEventListener('input', function () {
      setZoom(parseFloat(zoomInput.value));
    });
    root.querySelector('[data-zoom-in]').addEventListener('click', function () {
      setZoom(state.zoom + 0.25);
    });
    root.querySelector('[data-zoom-out]').addEventListener('click', function () {
      setZoom(state.zoom - 0.25);
    });
    root.querySelector('[data-rotate]').addEventListener('click', function () {
      state.rotation = (state.rotation + 90) % 360;
      state.x = 0;
      state.y = 0;
      render();
    });
    root.querySelector('[data-reset]').addEventListener('click', function () {
      state = { aspect: requested, rotation: 0, zoom: 1, x: 0, y: 0 };
      render();
    });
    shapes.forEach(function (b) {
      b.addEventListener('click', function () {
        state.aspect = b.getAttribute('data-aspect');
        state.x = 0;
        state.y = 0;
        render();
      });
    });

    function close() {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', render);
      root.remove();
      document.body.style.overflow = '';
      bitmap.close();
      if (opener && opener.focus) opener.focus();
    }
    function cancel() {
      input.value = '';
      close();
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancel();
      } else if (e.key === 'Tab') {
        var focusable = Array.prototype.slice.call(
          root.querySelectorAll('button, input, [tabindex="0"]'),
        );
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', render);
    root.querySelector('[data-cancel]').addEventListener('click', cancel);
    root.addEventListener('click', function (e) {
      if (e.target === root) cancel();
    });

    root.querySelector('[data-apply]').addEventListener('click', function () {
      var rect = stage.getBoundingClientRect();
      var w = Math.round(rect.width);
      var h = Math.round(rect.height);
      // Keep the picture's own detail, but never bigger than the upload needs.
      var b = base(w, h);
      var s = source();
      var k = Math.min(s.w / (b.w * state.zoom), OUTPUT_MAX / Math.max(w, h));
      var out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(w * k));
      out.height = Math.max(1, Math.round(h * k));
      draw(out.getContext('2d'), w, h, k);
      var keepPng = file.type === 'image/png';
      out.toBlob(
        function (blob) {
          if (!blob) return cancel();
          var name = file.name.replace(/\.[^.]+$/, '') + (keepPng ? '.png' : '.jpg');
          var edited = new File([blob], name, { type: blob.type });
          var transfer = new DataTransfer();
          transfer.items.add(edited);
          input.files = transfer.files;
          input.dataset[SKIP] = '1';
          close();
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        keepPng ? 'image/png' : 'image/jpeg',
        0.9,
      );
    });

    render();
    root.querySelector('[data-apply]').focus();
  }

  // Capture phase on the document runs before htmx or any handler on the input itself.
  document.addEventListener(
    'change',
    function (event) {
      var input = event.target;
      if (!isImageInput(input)) return;
      if (input.dataset[SKIP]) {
        delete input.dataset[SKIP];
        return;
      }
      if (!input.files || !input.files.length) return;
      event.stopImmediatePropagation();
      start(input);
    },
    true,
  );
})();
