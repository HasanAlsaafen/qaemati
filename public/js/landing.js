// The phone on the landing page shows a live menu in an iframe. If that first
// navigation is dropped (it can be when a service worker takes over the page
// as it loads), load it again instead of leaving an empty screen.
(function () {
  var frame = document.querySelector('.iphone__page');
  if (!frame) return;
  var loaded = false;
  frame.addEventListener('load', function () {
    loaded = true;
  });
  function retry() {
    if (loaded) return;
    var src = frame.getAttribute('src');
    frame.setAttribute('src', 'about:blank');
    setTimeout(function () {
      frame.setAttribute('src', src);
    }, 50);
  }
  setTimeout(retry, 3000);
  setTimeout(retry, 8000);
})();
