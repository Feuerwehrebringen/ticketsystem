/**
 * Verbindung zur Apps-Script-Schnittstelle.
 * Verwendung: API.run.withSuccessHandler(ok).withFailureHandler(fehler).submitTicket(daten)
 */
(function () {
  var SPEC = {                       // Funktionsname -> Parameternamen in Aufrufreihenfolge
    getFormData: [], getPublicTickets: [],
    submitTicket: ['data'], meToo: ['data'],
    adminInit: ['pin'], adminGetTicket: ['pin', 'nr'], adminUpdate: ['pin', 'nr', 'data'], adminPdf: ['pin', 'nr']
  };
  var READS = { getFormData: 1, getPublicTickets: 1 };   // per GET, alles andere per POST (PIN nie in der Adresse)

  function call(name, args, ok, fail) {
    var url = window.TICKET_API_URL || '';
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
      fail(new Error('Die API-Adresse fehlt oder ist ungültig (docs/config.js).'));
      return;
    }
    var params = { action: name };
    SPEC[name].forEach(function (k, i) { params[k] = args[i]; });

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 90000) : null;
    var opts = ctrl ? { signal: ctrl.signal } : {};
    var target = url;
    if (READS[name]) {
      target += '?action=' + encodeURIComponent(name);
    } else {
      opts.method = 'POST';
      opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };   // „einfache“ Anfrage: kein CORS-Preflight
      opts.body = JSON.stringify(params);
    }

    fetch(target, opts).then(function (r) { return r.text(); }).then(function (txt) {
      if (timer) clearTimeout(timer);
      var res;
      try { res = JSON.parse(txt); } catch (e) {
        throw new Error('Unerwartete Antwort vom Server. Ist die Web-App für „Jeder“ bereitgestellt?');
      }
      if (!res.ok) throw new Error(res.error || 'Fehler');
      ok(res.data);
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      var msg = e && e.name === 'AbortError' ? 'Zeitüberschreitung. Bitte erneut versuchen.'
        : (e instanceof TypeError ? 'Keine Verbindung zum Server. Bitte erneut versuchen.' : (e && e.message) || 'Fehler');
      fail(new Error(msg));
    });
  }

  function builder() {
    var ok = function () {}, fail = function () {};
    var b = {
      withSuccessHandler: function (f) { ok = f; return b; },
      withFailureHandler: function (f) { fail = f; return b; }
    };
    Object.keys(SPEC).forEach(function (name) {
      b[name] = function () { call(name, Array.prototype.slice.call(arguments), ok, fail); };
    });
    return b;
  }

  window.API = { run: {
    withSuccessHandler: function (f) { return builder().withSuccessHandler(f); },
    withFailureHandler: function (f) { return builder().withFailureHandler(f); }
  } };
})();
