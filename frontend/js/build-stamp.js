// build-stamp.js — Single source of truth for "which code is loaded".
//
// Bump BUILD_ID on every shipped change. The value is written into the
// #build-stamp badge in the header. If the number on screen does not match
// the number you expect, the browser is serving a CACHED copy — fix the
// cache, do not debug the logic.
//
// Convention: BUILD_ID = "NN-short-label" (e.g. "04-arrow-capture").
(function () {
    var BUILD_ID = '11-readyok-counter';

    function paint() {
        var el = document.getElementById('build-stamp');
        if (el) el.textContent = 'build ' + BUILD_ID;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', paint);
    } else {
        paint();
    }

    // Expose for quick console checks: BuildStamp.id
    window.BuildStamp = { id: BUILD_ID };
})();
