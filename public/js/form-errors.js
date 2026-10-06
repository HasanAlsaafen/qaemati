// Places server validation messages next to the fields they belong to.
// htmx does not swap a 4xx response, so the form on screen is left
// untouched and everything the user typed stays in place. The body is the
// JSON shape produced by HttpExceptionFilter: { errors: { field: [msg] } }.
(function () {
  var MARK = 'data-field-error';

  function clear(form) {
    form.querySelectorAll('[' + MARK + ']').forEach(function (node) {
      node.remove();
    });
    form.querySelectorAll('[aria-invalid="true"][data-server-invalid]').forEach(function (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('data-server-invalid');
      input.classList.remove('border-danger');
    });
  }

  function mark(form, field, message) {
    var input = form.querySelector('[name="' + field.replace(/"/g, '\\"') + '"]');
    if (!input) return null;
    var id = (input.id || field) + '-server-error';
    var note = document.createElement('p');
    note.id = id;
    note.setAttribute(MARK, '');
    note.className = 'text-sm text-danger';
    note.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('data-server-invalid', '');
    input.setAttribute('aria-describedby', id);
    input.classList.add('border-danger');
    input.insertAdjacentElement('afterend', note);
    input.addEventListener(
      'input',
      function () {
        note.remove();
        input.removeAttribute('aria-invalid');
        input.removeAttribute('data-server-invalid');
        input.classList.remove('border-danger');
      },
      { once: true },
    );
    return input;
  }

  document.body.addEventListener('htmx:beforeRequest', function (event) {
    var form = event.target && event.target.closest ? event.target.closest('form') : null;
    if (form) clear(form);
  });

  document.body.addEventListener('htmx:responseError', function (event) {
    var xhr = event.detail && event.detail.xhr;
    if (!xhr || xhr.status !== 422) return;
    var body;
    try {
      body = JSON.parse(xhr.responseText);
    } catch (e) {
      return;
    }
    var form = event.target.closest ? event.target.closest('form') : null;
    if (!form || !body.errors) return;
    var first = null;
    Object.keys(body.errors).forEach(function (field) {
      var input = mark(form, field, body.errors[field][0]);
      if (input && !first) first = input;
    });
    if (first) first.focus();
  });
})();
